import {useEffect, useRef, useState} from 'react'
import {Sidebar} from 'primereact/sidebar';
import useGame from '../../hooks/useGame';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader';
import * as THREE from 'three';
import {Object3D, Vector3} from 'three';
import {Toast} from 'primereact/toast';
import DimensionHelper from './DimensionHelper'; // Import the DimensionHelper
import { Dropdown } from 'primereact/dropdown';
import ComponentTree from "./tree/ComponentTree";


let FormMixer = null
const textureLoader = new THREE.TextureLoader();
const packageMaterialsMap = new Map();

const getTreeLabel = (object, fallback) => {
    const name = typeof object?.name === 'string' ? object.name.trim() : '';
    return name || fallback || object?.type || 'Object';
};

const toCheckedSelection = (keys = []) => keys.reduce((selection, key) => {
    selection[key] = { checked: true, partialChecked: false };
    return selection;
}, {});

const normalizeTextureList = (textures) => {
    if (!textures) return [];

    const parsed = typeof textures === 'string'
        ? (() => {
            try {
                return JSON.parse(textures);
            } catch {
                return textures;
            }
        })()
        : textures;

    return (Array.isArray(parsed) ? parsed : [parsed])
        .flatMap((texture) => Array.isArray(texture) ? texture : [texture])
        .map((texture) => {
            if (typeof texture === 'string') return texture.trim();
            return String(texture?.url || texture?.path || texture?.file || texture?.name || '').trim();
        })
        .filter(Boolean);
};

const getPackageTextures = (packageItem) => normalizeTextureList(
    packageItem?.textures
    || packageItem?.texture
    || packageItem?.Textures
    || packageItem?.AdvT_Textures
);

const getTextureMaterial = (textureUrl) => {
    let material = packageMaterialsMap.get(textureUrl);
    if (material) return material;

    const texture = textureLoader.load(`${import.meta.env.VITE_FILE_URL}/${textureUrl}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;

    material = new THREE.MeshPhongMaterial({
        map: texture,
        side: THREE.DoubleSide,
        shininess: 20,
    });
    packageMaterialsMap.set(textureUrl, material);
    return material;
};

const normalizePackageMaterials = (object, textures = []) => {
    object.traverse((child) => {
        if (!child.isMesh) return;

        child.castShadow = true;
        child.receiveShadow = true;

        const materials = Array.isArray(child.material) ? child.material : [child.material];

        const hasEmbeddedTexture = materials.some((material) => Boolean(material?.map));

        if (textures.length && !hasEmbeddedTexture) {
            const texturedMaterials = materials.map((material, index) => getTextureMaterial(textures[index] || textures[0]) || material);
            child.material = Array.isArray(child.material) ? texturedMaterials : texturedMaterials[0];
        } else {
            materials.forEach((material) => {
                if (!material) return;

                if (material.map) {
                    material.map.colorSpace = THREE.SRGBColorSpace;
                    material.map.needsUpdate = true;
                    material.color?.set?.(0xffffff);
                }

                material.side = THREE.DoubleSide;
                material.needsUpdate = true;
            });
        }
    });
};

export default function Projects({ scene, camera,orbitControls }) {
    const isPackage = useGame((state) => state.isPackage);
    const setIsPackage = useGame((state) => state.setIsPackage);
    const packageControl = useGame((state) => state.packageControl);
    const [packagesList, setPackagesList] = useState([]);
    const [loadedObjects, setLoadedObject] = useState([]); // Store the loaded object
    const setLazy = useGame((state) => state.setLazy);
    const setComponentTree = useGame((state) => state.setComponentTree);
    const toast= useRef(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const showFoam = useGame((state) => state.showFoam);
    const showBox = useGame((state) => state.showBox);
    const showObject = useGame((state) => state.showObject);
    const setShowBdims = useGame((state) => state.setShowBdims);
    const setShowFdims = useGame((state) => state.setShowFdims);
    const setShowOdims = useGame((state) => state.setShowOdims);

    const showDimensions = useGame((state) => state.showDimensions);

    const [selectedPackage, setSelectedPackage] = useState(null);
    const setLabelRenderer = useGame((state) => state.setLabelRenderer);

    const setModelTreeChecks = useGame((state) => state.setModelTreeChecks);
    const showSceneBox = () =>{
        const sceneObj = scene?.getObjectByName('Carton_Box_1');
        const sceneObj2 = scene?.getObjectByName('CartonBox');

        if (sceneObj) {
            sceneObj.material.transparent = !showBox
            sceneObj.material.opacity = !showBox? 0.2: 1

        }
        if (sceneObj2) {
            sceneObj2.material.transparent = !showBox
            sceneObj2.material.opacity = !showBox? 0.2: 1

        }
    }
    const showSceneObject = () =>{

        const sceneObj = scene?.getObjectByName('Workstation');
        const sceneObj2 = scene?.getObjectByName('HP_840_G3');
        if (sceneObj) {
            sceneObj.layers.mask = showObject
            // sceneObj2.layers.mask = showObject
        }
        if(sceneObj2){
            sceneObj2.layers.mask = showObject
        }
    }
    const showForm = () =>{
        if(scene) {
            const foamList = scene.children.filter((obj) => obj.name?.includes('Foam'));

            const sceneObj = scene?.getObjectByName('Foam_Top');
            const sceneObj2 = scene?.getObjectByName('Foam_Bottom');
            const sceneObj3 = scene?.getObjectByName('Foam_Top_-_1');
            const sceneObj4 = scene?.getObjectByName('Foam_Top_-_2');
            const sceneObj5 = scene?.getObjectByName('Foam_Bottom_-_1');
            const sceneObj6 = scene?.getObjectByName('Foam_Bottom_-_2');

            if (foamList) {
                for (const foam of foamList) {
                    foam.material.transparent = !showFoam
                    foam.material.opacity = !showFoam ? 0.2 : 1
                    foam.material.needsUpdate = true
                }
            }

            // if (sceneObj) {
            //
            //     sceneObj.material.transparent = !showFoam
            //     sceneObj.material.opacity = !showFoam? 0.2: 1
            //     sceneObj.material.needsUpdate = true
            //
            //     sceneObj2.material.transparent = !showFoam
            //     sceneObj2.material.opacity = !showFoam? 0.2: 1
            //     sceneObj2.material.needsUpdate = true
            //
            //     sceneObj3.material.transparent = !showFoam
            //     sceneObj3.material.opacity = !showFoam? 0.2: 1
            //     sceneObj3.material.needsUpdate = true
            //
            //     sceneObj4.material.transparent = !showFoam
            //     sceneObj4.material.opacity = !showFoam? 0.2: 1
            //     sceneObj4.material.needsUpdate = true
            //
            //     sceneObj5.material.transparent = !showFoam
            //     sceneObj5.material.opacity = !showFoam? 0.2: 1
            //     sceneObj5.material.needsUpdate = true
            //
            //     sceneObj6.material.transparent = !showFoam
            //     sceneObj6.material.opacity = !showFoam? 0.2: 1
            //     sceneObj6.material.needsUpdate = true
            // }
        }
    }
    useEffect(() => {
        showSceneBox()
        showSceneObject()
        showForm()
    }, [showBox,showObject,showFoam]);

    useEffect(() => {
        const fetchPackages = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/packages`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
             
                const packageRows = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.data)
                        ? data.data
                        : Array.isArray(data?.packages)
                            ? data.packages
                            : [];
                setPackagesList(packageRows);
            } catch (error) {
                console.error('Failed to fetch devices:', error);
            }
        };
        fetchPackages();
        
    }, []);

    const showError = (packageName) => {

           toast.current?.show({severity:'error', summary: 'Package Not Found', detail:`Package ${packageName} is not yet made`, life: 8000});
    }

    const createStructureFromObject3D = (object, keyPrefix = '0', selectedKeys = []) => {
        const children = object.children
            .map((child, index) => createStructureFromObject3D(child, `${keyPrefix}-${index}`, selectedKeys))
            .filter(Boolean);

        if (object.type !== 'Group' && object.type !== 'Mesh' && !children.length) {
            return null;
        }

        selectedKeys.push(keyPrefix);

        return {
            key: keyPrefix,
            label: getTreeLabel(object, `Object ${keyPrefix}`),
            data: { objectName: object.name || '', type: object.type },
            ...(children.length ? { children } : {})
        };
    };

    const createSceneStructureArray = (object) => {
        let selectedKeys = [];

        // Iterate over the root's children and flatten the structure
        const treeNodes = object.children.map((child, index) =>
            createStructureFromObject3D(child, `${index}`, selectedKeys)
        );

        // Store the selected keys in your global state using setModelTreeChecks
        setModelTreeChecks(toCheckedSelection(selectedKeys));

        return treeNodes;
    };
    const fetchDims = async (assetId) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/asset/${assetId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return  await response.json();

        } catch (error) {
            console.error('Failed to fetch devices:', error);
        }
    };


    const loadFileInScene = (packageName, packageItem = null) => {
        const objList= []

        if(packageName=='HP EliteBook 840 G3'){
            packageName = 'HP EliteBook 840 G3_'
        }
        const fbxLoader = new FBXLoader();
        setLazy(true); // Set loading state to true
        fbxLoader.load(
            `${import.meta.env.VITE_FILE_URL}/${packageName}.FBX`,
            async object => {



                const mixer = new THREE.AnimationMixer(object);
                const tracks = object.animations[0].tracks;
                tracks.forEach(track => {
                    if (track.name.endsWith('CartonBox_Top.quaternion')) {
                        // Loop through quaternion values
                        for (let i = 0; i < track.values.length; i += 4) {
                            // Only modify non-identity quaternions (where w is not 1 or close to 1)
                            if (Math.abs(track.values[i] - 1) > 0.0001) {
                                track.values[i] *= -1;     // Reverse rotation direction by negating w
                                track.values[i + 2] *= -1; // Reverse Y-axis rotation
                            }
                        }
                    }
                });


                const animate = mixer.clipAction(object.animations[0]);

                FormMixer = {mixer: mixer, action: animate}
                // Success callback

                if (scene) {
                    normalizePackageMaterials(object, getPackageTextures(packageItem));
                    object.scale.multiplyScalar(0.01);
                    const sceneObj = scene.getObjectByName('sceneObj');

                    if (sceneObj) {
                        // scene.remove(sceneObj)
                        sceneObj.add(object);
                    } else {
                        const sceneObject = new Object3D();
                        sceneObject.name = 'sceneObj';
                        object.position.set(0, 0.0, 0);
                        // object.rotation.set(0, 0, Math.PI/4);
                        sceneObject.add(object);
                        const sceneStructure = createSceneStructureArray(object);
                        setComponentTree(sceneStructure);
                        scene.add(sceneObject);
                    }

                    if (packageName.includes('HP EliteBook 840 G3')) {
                        const fAssetid = object.children[1].children[0].name.split('_')[1]
                        const fDims = await fetchDims(parseInt(fAssetid))

                        const bAssetid = 562010 //object.children[1].children[0].name.split('_')[1]
                        const bDims = await fetchDims(bAssetid)

                        object.children[0].name = 'System'
                        object.children[1].children[0].name = 'Foam_Top'
                        object.children[2].name = 'Box'
                        objList.push({object: object.children[0], dims: null})
                        objList.push({object: object.children[1].children[0], dims: fDims})
                        objList.push({object: object.children[2], dims: bDims})

                        setLoadedObject(objList);// Set the loaded object for DimensionHelper
                        setIsLoaded(true)
                    } else {
                        const assetid = object.children[0].children[0].name.split('_')[2]
                        const fDims = await fetchDims(parseInt(assetid))
                        const bAssetid = 549282 //object.children[1].children[0].name.split('_')[1]
                        const bDims = await fetchDims(bAssetid)

                        objList.push({object: object.children[0].children[0], dims: fDims})
                        objList.push({object: object.children[1], dims: null})
                        objList.push({object: object.children[2], dims: bDims})
                        setLoadedObject(objList); // Set the loaded object for DimensionHelper
                        setIsLoaded(true)
                    }


                    //
                    object.traverse((child) => {
                        if (child.type == 'Mesh') {

                            if (
                                // child.name =='Workstation' ||
                                child.name == 'CPU_004' ||
                                // child.name =='HP_840_G3' ||
                                child.name == 'Intel_530_SSD_004' ||
                                child.name == 'Transparent_Paper_Cover') {
                                child.layers.mask = 0
                            } else if (
                                child.name.includes('Box') ||
                                child.name == 'Transparent_Paper_Cover')
                            {
                                const material = child.material;
                                material.transparent = true
                                material.opacity = 0.2
                                child.material = material
                                child.material.needsUpdate = true

                            } else if (child.name.includes('Foam') ||
                                child.name == 'Foam_Bottom' ||
                                child.name == 'Foam_Top_-_1' ||
                                child.name == 'Foam_Top_-_2' ||
                                child.name == 'Foam_Bottom_-_1' ||
                                child.name == 'FoamLeft' ||
                                child.name == 'FoamRight' ||
                                child.name == 'Foam_Bottom_-_2'
                            ) {
                                child.material = new THREE.MeshPhongMaterial({
                                    map: child.material.map,
                                    color: 0xffffff,
                                    side: THREE.DoubleSide,
                                    transparent: !showFoam,
                                    opacity: 0.2
                                })
                                if (child.material.map) {
                                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                                    child.material.map.needsUpdate = true;
                                }
                                child.material.needsUpdate = true;

                            }

                        }
                    });

                }

                setLazy(false); // Set loading state to false after success
                // setIsPackage(false);
            },
            undefined,
            error => {
                showError(packageName);
                setLazy(false); // Set loading state to false on error
            }
        );
    };


    useEffect(() => {

        if ( orbitControls.current) {
            const center = new Vector3(0,0,0)
            const camdirection = orbitControls.current.target.clone()
                .sub(camera.position)
                .normalize()
                .multiplyScalar(4);
            camera.updateProjectionMatrix();
            orbitControls.current.target.copy(center);
            camera.position.copy(center).sub(camdirection);
        }



        if (!packageControl && scene) {
            const sceneObj = scene?.getObjectByName('sceneObj');
            if (sceneObj) {
                sceneObj.parent?.remove(sceneObj);
            }
            setLoadedObject(null)
            setSelectedPackage(null)
            setComponentTree([])
            setLabelRenderer(null)

        }


    }, [packageControl]);



    const handleTileClick = (packageName, packageItem = null) => {
        setShowBdims(false)
        setShowOdims(false)
        setShowFdims(false)
        const sceneObj = scene.getObjectByName('sceneObj');
        if (sceneObj) {
            scene.remove(sceneObj)
        }
        loadFileInScene(packageName, packageItem);

    };

    useEffect(() => {
        if (!packageControl || !isPackage || selectedPackage || !scene || !packagesList.length) {
            return;
        }

        const firstPackage = packagesList[0];
        if (!firstPackage?.AdvT_Category) {
            return;
        }

        setSelectedPackage(firstPackage);
        handleTileClick(firstPackage.AdvT_Category, firstPackage);
    }, [isPackage, packageControl, packagesList, scene, selectedPackage]);

    const customHeader = (
        <div className="flex align-items-center">
            <span style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center' }}>Package List</span>
        </div>
    );

    const selectedPackageTemplate = (option, props) => {
        if (option) {
            return (
                <div className="package-dropdown-option">
                    {option.img && <img alt={option.AdvT_Category} src={option.img} />}
                    <div>{option.AdvT_Category}</div>
                </div>
            );
        }

        return <span>{props.placeholder}</span>;
    };

    // Template for each option in the dropdown
    const packageOptionTemplate = (option) => {
        return (
            <div className="package-dropdown-option">
                {option.img && <img alt={option.AdvT_Category} src={option.img} />}
                <div>{option.AdvT_Category}</div>
            </div>
        );
    };

    // Footer template for the dropdown
    const panelFooterTemplate = () => {
        return (
            <div className="py-2 px-3">
                {selectedPackage ? (
                    <span>
                        <b>{selectedPackage.AdvT_Category}</b> selected.
                    </span>
                ) : (
                    'No model selected.'
                )}
            </div>
        );
    };



    return (

        <>

            <Sidebar
                visible={isPackage}
                header={customHeader}
                modal={false}
                onHide={() => setIsPackage(false)}
                showCloseIcon={false}
                dismissable={false}
                baseZIndex={1000010}
                className="custom-sidebar"
                maskClassName="custom-sidebar-mask"
            >
                <Toast ref={toast}/>
                <div className="card flex justify-content-center package-model-picker">
                    <Dropdown
                        value={selectedPackage}
                        onChange={(e) => {
                            if (!e.value) return;
                            setSelectedPackage(e.value);
                            handleTileClick(e.value.AdvT_Category, e.value); // Call the handler when an option is selected
                        }}
                        options={packagesList}
                        optionLabel="AdvT_Category"
                        placeholder="Select a Model"
                        valueTemplate={selectedPackageTemplate}
                        itemTemplate={packageOptionTemplate}
                        className="w-full py-2 px-2 models"
                        panelClassName="package-model-dropdown-panel"
                        appendTo={typeof document !== 'undefined' ? document.body : undefined}
                        style={{width: '100%'}}
                        panelFooterTemplate={panelFooterTemplate}
                    />
                </div>
                <ComponentTree scene={scene} camera={camera} orbitControls={orbitControls}/>


            </Sidebar>

            { loadedObjects && loadedObjects.length &&  isLoaded && <DimensionHelper objects={loadedObjects} scene={scene} />}
        </>
    );
}
export {FormMixer}
