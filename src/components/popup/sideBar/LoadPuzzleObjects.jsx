
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import * as THREE from "three";
import { Box3 } from "three";
import { objects } from "../../../threejs/player/puzzle/character/Constants.jsx";


export default function LoadPuzzleObjects(item, projectId, isPuzzleGame) {

    const materialsMap = new Map();
    const textureLoader = new THREE.TextureLoader();

    const getObject = async (items) => {

        const objectList = [];

        const ids = [];

        for (const i in items) {
            ids.push(items[i].device_id)
        }


        // if (!initCheckedItems.includes(itemId)) {
        const dbObjects = await fetchDbObjects(ids);
        // }
        return [...objectList, ...dbObjects];
    };


    const fileCategorisation = (data) => {
        const fileObj = {};

        for (const file of data) {

            // Ensure we have an entry for this device
            if (!fileObj[file.device_id]) {
                fileObj[file.device_id] = {
                    fbx: null,
                    textures: [],
                    asset_id: item[file.device_id]?.AssetID ?? null,
                    asset_name: item[file.device_id]?.Assetname ?? "Unknown",
                    asset_info: item[file.device_id]?.AssetInfo ?? {}
                };
            }

            // Categorize file
            if (
                file.name?.toLowerCase().endsWith(".fbx") ||
                file.name?.toLowerCase().endsWith(".glb") ||
                file.name?.toLowerCase().endsWith(".gltf")
            ) {
                fileObj[file.device_id].fbx = file.name;
            } else {
                fileObj[file.device_id].textures.push(file.name);
            }
        }

        return fileObj;
    };


    const fetchDbObjects = async (ids) => {
        let template_id = 1628
        let itemId = 1494
        if (projectId == 147) {
            template_id = 1628
            itemId = 1494
        }
        else if (projectId == 148) {
            template_id = 1634
            itemId = 1500
        }
        else if (projectId == 150) {
            template_id = 1638
            itemId = 1504
        }


        try {
            const results = [];
            if (isPuzzleGame) {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/getPuzzleCategoryFiles/${ids.join(',')}`);

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const data = await response.json();
                if (!data.data) {
                    return []; // Return an empty array if there's no data
                }

                const categorisedFiles = fileCategorisation(data.data)

                for (const i in categorisedFiles) {
                    const file = categorisedFiles[i];

                    const { fbx, textures, asset_id, asset_name, asset_info } = file;

                    const object = await fileLoader(fbx, textures, itemId, asset_id, template_id, asset_name, asset_info);
                    if (object) results.push(object);
                }
                return results;

            }


        } catch (error) {
            console.error("Failed to fetch categories:", error);
            return []; // Return an empty array on error
        }
    };


    const fileLoader = async (
        modelFile,
        textures,
        itemId,
        assetId,
        template_id,
        name,
        asset_info
    ) => {
        const fbxLoader = new FBXLoader();
        const gltfLoader = new GLTFLoader();

        const ext = modelFile.split('.').pop()?.toLowerCase();
        const url = `${import.meta.env.VITE_FILE_URL}/${modelFile}`;


        const applyTextures = (child, textures) => {

            textures.forEach((textureUrl, i) => {
                if (textureUrl != "") {
                    let material = materialsMap.get(textureUrl);
                    if (!material) {
                        const texture = textureLoader.load(`${import.meta.env.VITE_FILE_URL}/${textureUrl}`);
                        texture.colorSpace = THREE.SRGBColorSpace;
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;

                        material = new THREE.MeshPhongMaterial({
                            map: texture,
                            reflectivity: 5.0,
                        });
                        materialsMap.set(textureUrl, material);
                    }

                    // Apply material in a batch or defer until all textures are processed
                    if (child.material[i]) {
                        child.material[i] = material;
                    } else {
                        child.material = material;
                    }
                }
            });
        };
        const getLength = (model) => {
            const boxDims = new Box3().setFromObject(model);
            return (boxDims.max.z - boxDims.min.z) / 2;
        };
        const getWidth = (model) => {
            const boxDims = new Box3().setFromObject(model);
            return (boxDims.max.x - boxDims.min.x) / 2;
        };
        const getHeight = (model) => {
            const boxDims = new Box3().setFromObject(model);
            return (boxDims.max.y - boxDims.min.y) / 2;
        };
        return new Promise((resolve, reject) => {
            const onLoad = (loaded) => {
                const object = loaded.scene || loaded; // GLTFLoader uses .scene, FBXLoader does not

                if (name.toLowerCase().includes('key')) {

                    object.children[0].scale.multiplyScalar(0.1)

                }

                object.traverse((child) => {
                    if (child instanceof THREE.Mesh && textures) {
                        applyTextures(child, textures);
                    }
                });



                const halfWidth = getWidth(object);
                const halfLength = getLength(object);
                const halfHeight = getHeight(object);
                const scale = object.scale.clone().multiplyScalar(0.01);
                objects[name] = {
                    object,
                    name,
                    fileName: modelFile,
                    categoryIndex: itemId,
                    halfWidth,
                    halfLength,
                    halfHeight,
                    assetID: assetId,
                    template_id,
                    textures,
                    scale
                };

                resolve({ categoryIndex: itemId, object, name, assetId, asset_info: asset_info ?? {} });
            };

            const onError = (error) => reject(error);

            if (ext === 'fbx') {

                fbxLoader.load(url, onLoad, undefined, onError);
            } else if (ext === 'glb' || ext === 'gltf') {
                gltfLoader.load(url, onLoad, undefined, onError);
            } else {
                reject(new Error(`Unsupported file extension: ${ext}`));
            }
        });
    };

    return getObject(item)
}