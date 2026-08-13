import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { normalizeSceneAssetName } from '../../threejs/generatedAssetPaths.js';
import { objects } from '../../threejs/player/puzzle/character/Constants.jsx';
import { normalizeTextureList, toFileUrl } from './assetUtils.js';

const materialsMap = new Map();
const textureLoader = new THREE.TextureLoader();
const thumbnailCache = new Map();
const thumbnailQueue = [];
const thumbnailWorkerRequests = new Map();
let activeThumbnailJobs = 0;
let thumbnailWorker = null;
let thumbnailWorkerFailed = false;
let thumbnailWorkerRequestId = 0;

const THUMBNAIL_RENDER_CONCURRENCY = 1;

export const loadModel = async (url, extension) => {
    if (extension === 'glb' || extension === 'gltf') {
        const gltf = await new GLTFLoader().loadAsync(url);
        return gltf.scene;
    }

    if (extension === 'fbx') {
        return await new FBXLoader().loadAsync(url);
    }

    if (extension === 'obj') {
        return await new OBJLoader().loadAsync(url);
    }

    if (extension === 'stl') {
        const geometry = await new STLLoader().loadAsync(url);

        return new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.55,
                metalness: 0.1,
            })
        );
    }

    throw new Error(`Unsupported model format: ${extension}`);
};

const loadTextureMaterial = async (texturePath) => {
    let material = materialsMap.get(texturePath);
    if (material) {
        return material;
    }

    const texture = await textureLoader.loadAsync(toFileUrl(texturePath));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    material = new THREE.MeshPhongMaterial({
        map: texture,
        reflectivity: 5.0,
    });
    materialsMap.set(texturePath, material);

    return material;
};

const applyTexturesToMesh = async (child, textures) => {
    await Promise.all(
        textures.map(async (textureUrl, index) => {
            if (textureUrl === '') {
                return;
            }

            const material = await loadTextureMaterial(textureUrl);
            if (child.material?.[index]) {
                child.material[index] = material;
            } else {
                child.material = material;
            }

            if (Array.isArray(child.material)) {
                child.material.forEach((meshMaterial) => {
                    if (meshMaterial) meshMaterial.needsUpdate = true;
                });
            } else if (child.material) {
                child.material.needsUpdate = true;
            }
        })
    );
};


    const applyTextures = (child, textures) => {


        // Helper to apply translucency if needed
        const getFinalMaterial = (material) => {
            return material;
        };

        // If textures exist and are a valid array
        if (Array.isArray(textures) && textures.length > 0) {
            textures.forEach((textureUrl, i) => {
                if (!textureUrl) return;

                let material = materialsMap.get(textureUrl);

                if (!material) {
                    const texture = textureLoader.load(`${import.meta.env.VITE_FILE_URL}}/${textureUrl}`);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;

                    material = new THREE.MeshStandardMaterial({
                        map: texture,
                        // reflectivity: 5.0,
                    });

                    materialsMap.set(textureUrl, material);
                }

                const finalMaterial = getFinalMaterial(material);

                if (Array.isArray(child.material)) {
                    child.material[i] = finalMaterial;
                } else {
                    child.material = finalMaterial;
                }
            });
        } else {
            // No textures provided – just update the existing material
            if (Array.isArray(child.material)) {
                child.material = child.material.map((mat) => getFinalMaterial(mat));
            } else if (child.material) {
                child.material = getFinalMaterial(child.material);
            }
        }
    };


export const applyTexturesToObject = async (object, texturePaths = [], name) => {
    const textures = normalizeTextureList(texturePaths).filter(Boolean);
    const textureTasks = [];

    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            textureTasks.push(applyTexturesToMesh(child, textures));
        }
    });

    await Promise.all(textureTasks);
};

const waitForNextFrame = () => new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
});

const waitForTextureRender = async (renderer, scene, camera) => {
    renderer.render(scene, camera);
    await waitForNextFrame();
    renderer.render(scene, camera);
    await waitForNextFrame();
};




export const disposeObject = (object) => {
    object.traverse((child) => {
        if (child.geometry) {
            child.geometry.dispose();
        }
    });
};
export const adjustTilesCamera = (object, camera) => {
    if (!camera || !object) return;

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);
    // Normalize all models to a fixed size
    const maxDim = Math.max(size.x, size.y, size.z);
    // Target size for all thumbnails
    const TARGET_SIZE = 1.25; // 25% bigger than current
    const scaleFactor = maxDim > 0 ? TARGET_SIZE / maxDim : 1;
    object.scale.setScalar(scaleFactor);
    // Recalculate bounds after scaling
    const scaledBox = new THREE.Box3().setFromObject(object);
    const scaledSize = new THREE.Vector3();
    const scaledCenter = new THREE.Vector3();

    scaledBox.getSize(scaledSize);
    scaledBox.getCenter(scaledCenter);
    const normalizedMaxDim = Math.max(
        scaledSize.x,
        scaledSize.y,
        scaledSize.z
    );
    const fov = camera.fov * (Math.PI / 180);
    // Fixed framing for all thumbnails
    const distance = (normalizedMaxDim ) / Math.tan(fov / 2);

    camera.position.set(
        scaledCenter.x,
        scaledCenter.y,
        scaledCenter.z + distance
    );

    camera.lookAt(scaledCenter);
    camera.updateProjectionMatrix();
};

const generateModelThumbnailOnMainThread = async (url, extension, textures, size = 256) => {
    const scene = new THREE.Scene();
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas, 
      antialias: true, 
      alpha: true 
    });

    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xffffff, 0);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);
    const object = await loadModel(toFileUrl(url), extension);

    object.scale.set(1, 1, 1);

    await applyTexturesToObject(object, textures, url);
    object.rotation.x = 0.3;

    adjustTilesCamera(object, camera);
    scene.add(object);
    scene.add(new THREE.HemisphereLight(0xaaaaaa, 0x444444, 5.5));

    const light = new THREE.DirectionalLight(0xffffff, 3);

    scene.add(light);

    await waitForTextureRender(renderer, scene, camera);
    renderer.render(scene, camera);

    const imageUrl = renderer.domElement.toDataURL('image/png');

    disposeObject(object);
    renderer.dispose();

    return imageUrl;
};

const getThumbnailWorker = () => {
    if (thumbnailWorkerFailed || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
        return null;
    }

    if (thumbnailWorker) {
        return thumbnailWorker;
    }

    try {
        thumbnailWorker = new Worker(new URL('./modelThumbnail.worker.js', import.meta.url), {
            type: 'module',
        });

        thumbnailWorker.onmessage = (event) => {
            const { id, imageUrl, error } = event.data || {};
            const request = thumbnailWorkerRequests.get(id);
            if (!request) return;

            thumbnailWorkerRequests.delete(id);
            if (error) {
                request.reject(new Error(error));
                return;
            }

            request.resolve(imageUrl);
        };

        thumbnailWorker.onerror = (error) => {
            thumbnailWorkerFailed = true;
            thumbnailWorkerRequests.forEach((request) => {
                request.reject(error instanceof Error ? error : new Error('Thumbnail worker failed'));
            });
            thumbnailWorkerRequests.clear();
            thumbnailWorker?.terminate();
            thumbnailWorker = null;
        };
    } catch {
        thumbnailWorkerFailed = true;
        thumbnailWorker = null;
    }

    return thumbnailWorker;
};

const generateModelThumbnailInWorker = (url, extension, textures, size) => new Promise((resolve, reject) => {
    const worker = getThumbnailWorker();
    if (!worker) {
        reject(new Error('Thumbnail worker is unavailable'));
        return;
    }

    const id = ++thumbnailWorkerRequestId;
    thumbnailWorkerRequests.set(id, { resolve, reject });
    worker.postMessage({
        id,
        url: toFileUrl(url),
        extension,
        textures: normalizeTextureList(textures).map(toFileUrl),
        size,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    });
});

const runQueuedThumbnailJobs = () => {
    while (activeThumbnailJobs < THUMBNAIL_RENDER_CONCURRENCY && thumbnailQueue.length) {
        const job = thumbnailQueue.shift();
        activeThumbnailJobs += 1;

        const run = async () => {
            try {
                try {
                    return await generateModelThumbnailInWorker(
                        job.url,
                        job.extension,
                        job.textures,
                        job.size
                    );
                } catch {
                    return await generateModelThumbnailOnMainThread(
                        job.url,
                        job.extension,
                        job.textures,
                        job.size
                    );
                }
            } finally {
                activeThumbnailJobs -= 1;
                runQueuedThumbnailJobs();
            }
        };

        run().then(job.resolve, job.reject);
    }
};

export const generateModelThumbnail = (url, extension, textures, size = 256) => {
    const cacheKey = JSON.stringify({
        url,
        extension,
        textures: normalizeTextureList(textures),
        size,
    });

    const cached = thumbnailCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const promise = new Promise((resolve, reject) => {
        thumbnailQueue.push({
            url,
            extension,
            textures,
            size,
            resolve,
            reject,
        });
        runQueuedThumbnailJobs();
    }).catch((error) => {
        thumbnailCache.delete(cacheKey);
        throw error;
    });

    thumbnailCache.set(cacheKey, promise);
    return promise;
};

const getObjectHalfSize = (object, axis) => {
    const box = new THREE.Box3().setFromObject(object);
    return (box.max[axis] - box.min[axis]) / 2;
};

export const getDragAssetName = (file) => {
    const name = file.assetName || file.name || '';
    return String(name).replace(/\.[^.]+$/, '') || String(file.name || file.path || 'Asset');
};

export const getBottomDockAssetKey = (file) => (
    normalizeSceneAssetName(file.path)
);

export const getBottomDockMapKey = (file) => (
    file.assetID ? `id-${file.assetID}` : getBottomDockAssetKey(file)
);

export const ensureBottomDockObject = async (file) => {
    const assetKey = getBottomDockAssetKey(file);

    if (objects[assetKey]) {
        return assetKey;
    }

    const object = await loadModel(toFileUrl(file.path), file.extension);
    await applyTexturesToObject(object, file.textures,file.name);

    const halfWidth = getObjectHalfSize(object, 'x');
    const halfLength = getObjectHalfSize(object, 'z');
    const halfHeight = getObjectHalfSize(object, 'y');
    const position = new THREE.Vector3()
    object.children.length > 0 ? object.children[0].position.copy(position) : object.position.copy(position);
    const scale = object.children.length > 0 ? object.children[0].scale.clone().multiplyScalar(0.01) : object.scale.clone().multiplyScalar(0.01);


    objects[assetKey] = {
        object,
        name: assetKey,
        fileName: file.name,
        categoryIndex: file.categoryIndex,
        halfWidth,
        halfLength,
        halfHeight,
        assetID: file.assetID,
        template_id: file.template_id,
        textures: normalizeTextureList(file.textures),
        scale,
    };

    return assetKey;
};
