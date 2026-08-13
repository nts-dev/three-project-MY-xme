import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

const materialsMap = new Map();

const loadModel = async (url, extension) => {
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

    const imageBitmap = await new THREE.ImageBitmapLoader()
        .setOptions({ imageOrientation: 'flipY' })
        .loadAsync(texturePath);
    const texture = new THREE.Texture(imageBitmap);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;

    material = new THREE.MeshPhongMaterial({
        map: texture,
        reflectivity: 5.0,
    });
    materialsMap.set(texturePath, material);

    return material;
};

const applyTexturesToObject = async (object, textures = []) => {
    if (!textures.length || typeof createImageBitmap === 'undefined') {
        return;
    }

    const textureTasks = [];
    object.traverse((child) => {
        if (!child.isMesh) return;

        textureTasks.push(Promise.all(
            textures.map(async (textureUrl, index) => {
                if (!textureUrl) return;

                const material = await loadTextureMaterial(textureUrl);
                if (Array.isArray(child.material)) {
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
        ));
    });

    await Promise.all(textureTasks);
};

const adjustTilesCamera = (object, camera) => {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = maxDim > 0 ? 1.25 / maxDim : 1;
    object.scale.setScalar(scaleFactor);

    const scaledBox = new THREE.Box3().setFromObject(object);
    const scaledSize = new THREE.Vector3();
    const scaledCenter = new THREE.Vector3();

    scaledBox.getSize(scaledSize);
    scaledBox.getCenter(scaledCenter);

    const normalizedMaxDim = Math.max(scaledSize.x, scaledSize.y, scaledSize.z);
    const fov = camera.fov * (Math.PI / 180);
    const distance = normalizedMaxDim / Math.tan(fov / 2);

    camera.position.set(scaledCenter.x, scaledCenter.y, scaledCenter.z + distance);
    camera.lookAt(scaledCenter);
    camera.updateProjectionMatrix();
};

const disposeObject = (object) => {
    object.traverse((child) => {
        if (child.geometry) {
            child.geometry.dispose();
        }

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.filter(Boolean).forEach((material) => {
            if (material.map?.image?.close) {
                material.map.image.close();
            }
            material.map?.dispose?.();
            material.dispose?.();
        });
    });
};

const blobToDataUrl = async (blob) => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return `data:image/png;base64,${btoa(binary)}`;
};

const renderThumbnail = async ({
    url,
    extension,
    textures = [],
    size = 256,
    pixelRatio = 1,
}) => {
    const scene = new THREE.Scene();
    const canvasSize = Math.max(1, Math.floor(size * pixelRatio));
    const canvas = new OffscreenCanvas(canvasSize, canvasSize);
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
    });

    renderer.setSize(size, size, false);
    renderer.setPixelRatio(pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0xffffff, 0);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);
    const object = await loadModel(url, extension);

    object.scale.set(1, 1, 1);
    await applyTexturesToObject(object, textures);
    object.rotation.x = 0.3;

    adjustTilesCamera(object, camera);
    scene.add(object);
    scene.add(new THREE.HemisphereLight(0xaaaaaa, 0x444444, 5.5));
    scene.add(new THREE.DirectionalLight(0xffffff, 3));

    renderer.render(scene, camera);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const imageUrl = await blobToDataUrl(blob);

    disposeObject(object);
    renderer.dispose();

    return imageUrl;
};

self.onmessage = async (event) => {
    const { id, ...payload } = event.data || {};

    try {
        const imageUrl = await renderThumbnail(payload);
        self.postMessage({ id, imageUrl });
    } catch (error) {
        self.postMessage({
            id,
            error: error?.message || 'Worker thumbnail generation failed',
        });
    }
};
