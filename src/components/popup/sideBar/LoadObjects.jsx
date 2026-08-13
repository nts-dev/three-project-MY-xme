
import {FBXLoader} from "three/examples/jsm/loaders/FBXLoader";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import * as THREE from "three";
import {Box3} from "three";
import database from "../../../database/index";
import {Q} from "@nozbe/watermelondb";
import {objects} from "../../../threejs/player/puzzle/character/Constants.jsx";


export default function LoadObjects(item,projectId,isPuzzleGame) {

    const materialsMap = new Map();
    const textureLoader = new THREE.TextureLoader();
    const templateFilesCollection = database.collections.get('template_files');


    const getObject = async (item) => {
        const itemId = item.id;
        const template_id = item.template_id;
        const objectList= [];
        const checkFile= {};

        for (const i in objects) {
            const {object, name, categoryIndex} = objects[i];

            if (itemId !== Number(categoryIndex)) continue;

            if (!checkFile[name]) {
                objectList.push({categoryIndex, object, name});
                checkFile[name] = name; // Mark file as checked
            }
        }


        // if (!initCheckedItems.includes(itemId)) {
        const dbObjects = await fetchDbObjects(template_id, itemId);
        // }
        return [...objectList, ...dbObjects];
    };




    const fetchDbObjects = async (template_id, itemId) => {

        let templ_id = 1127
        if(projectId==144){
            templ_id = 1578
        }
        else if(projectId==145){
            templ_id =  1614
        }
        else if(isPuzzleGame){
            templ_id =  1630
        }

        try {
            const results = []; // To store results
            if(isPuzzleGame){
               const data = await templateFilesCollection.query(Q.where('template_id', parseInt(template_id))).fetch();
                for (const i in data) {
                    const {fbx, textures, asset_id, asset_name} = data[i]._raw;

                    const object = await fileLoader(fbx, JSON.parse(textures), itemId, asset_id, template_id,asset_name);
                    if (object) results.push(object);
                }
                return results;

            }
            const response = await fetch(`${import.meta.env.VITE_API_URL}/getCategoryFiles/${template_id}/${templ_id}`);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (!data.data) {
                return []; // Return an empty array if there's no data
            }



            const promises = Object.entries(data.data)?.map(async ([, entry]) => {
                const {fbx, textures, assetId, assetName} = entry;
                const object = await fileLoader(fbx, textures, itemId, assetId, template_id,assetName);
                if (object) results.push(object); // Add loaded object to results
            });

            await Promise.all(promises); // Wait for all file loaders to complete
            return results; // Return the loaded results

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
        name
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

                object.traverse((child) => {
                    if (child instanceof THREE.Mesh && textures) {
                        applyTextures(child, textures);
                    }
                });



                const halfWidth = getWidth(object);
                const halfLength = getLength(object);
                const halfHeight = getHeight(object);
                const scale =  object.scale.clone().multiplyScalar(0.01);
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

                resolve({ categoryIndex: itemId, object, name });
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

   return  getObject(item)
}