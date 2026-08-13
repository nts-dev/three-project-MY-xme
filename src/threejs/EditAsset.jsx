import useGame from "../hooks/useGame";
import { RigidBody } from "@react-three/rapier";
import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import SaveFromTemplate from "../components/popup/form/SaveFromTemplate";
import { objects, sceneAssets } from "./player/puzzle/character/Constants.jsx";

export default function EditAsset() {
    const assetClone = useGame((state) => state.assetClone); // Single object
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    const setDeleteAssetId = useGame((state) => state.setDeleteAssetId);
    const rotationValue = useGame((state) => state.rotationValue);
    const vAlignValue = useGame((state) => state.vAlignValue);
    const selectedAssetName = useGame((state) => state.selectedAssetName);
    const setLazy = useGame((state) => state.setLazy);
    const setSelectedAssetId = useGame((state) => state.setSelectedAssetId);
    const setSelectedId = useGame((state) => state.setSelectedId);
    const setSelectedCatId = useGame((state) => state.setSelectedCatId);
    const buttonMode = useGame((state) => state.buttonMode);
    const editing = useGame((state) => state.isEditing);
    const hasUnsavedTransformUpdate = useGame((state) => state.hasUnsavedTransformUpdate);
    const selectedEditorInstance = useGame((state) => state.selectedEditorInstance);
    const setAssetSelected = useGame((state) => state.setAssetSelected);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const setSelectedDragObject = useGame((state) => state.setSelectedDragObject);
    const setEditAssetId = useGame((state) => state.setEditAssetId);
    const setEditProps = useGame((state) => state.setEditProps);
    const setEditorSelectionEnabled = useGame((state) => state.setEditorSelectionEnabled);

    const templateAssetProps = useGame((state) => state.templateAssetProps);
    const { gl } = useThree();
    const originalMaterialsRef = useRef(new Map()); // Store original materials
    const clonesRef = useRef([]); // Accumulate clones locally
    const [cloneList, setCloneList] = useState([])

    const clonesSet = useRef(new Set()); // Store unique clones
    const rotateClone = useRef(null);
    // Add new assetClone to clonesRef when it changes
    useEffect(() => {

        if (assetClone && selectedAssetId && !clonesSet.current.has(selectedAssetId)) {

            const clone = assetClone?.clone();
            // Generate a unique ID for the new clone, optionally linked to selectedAssetId
            const newId = `${selectedAssetId}-clone-${Date.now()}`; // Unique ID with reference to selectedAssetId
            clone.userData = { ...clone.userData, id: newId, originalId: selectedAssetId }; // Store original selectedAssetId
            clonesRef.current = [...clonesRef.current, clone];

            setCloneList([...cloneList, clone])

            clonesSet.current.add(selectedAssetId);
            rotateClone.current = clone;

            if (rotationValue) {
                const axisQuaternion = new THREE.Quaternion().setFromAxisAngle(
                    new THREE.Vector3(0, 1, 0),
                    THREE.MathUtils.degToRad(parseFloat(rotationValue))
                );

                rotateClone.current.quaternion.multiplyQuaternions(axisQuaternion, rotateClone.current.quaternion);
                rotateClone.current.userData.rotationValue = rotationValue;
            }
            if (vAlignValue) {
                rotateClone.current.position.y += (vAlignValue) - (rotateClone.current.userData.vAlignValue || 0);
                rotateClone.current.userData.vAlignValue = vAlignValue;
            }


        }
    }, [assetClone, selectedAssetId]);

    // Apply rotation and save template for the latest clone
    useEffect(() => {

        if (!rotateClone.current || selectedAssetId === 614698 || (selectedAssetName==null && selectedAssetId ===null)) return;

        const axisQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            THREE.MathUtils.degToRad(parseFloat(rotationValue || 0) - (rotateClone.current.userData.rotationValue || 0))
        );
        rotateClone.current.quaternion.multiplyQuaternions(axisQuaternion, rotateClone.current.quaternion);
        rotateClone.current.userData.rotationValue = rotationValue;

        const props = {
            categoryIndex: templateAssetProps.categoryIndex,
            position: templateAssetProps.position,
            rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(parseFloat(rotationValue || 0)), 0),
            projectId: templateAssetProps.projectId,
            textures: templateAssetProps.textures,
        };

        rotateClone.current.position.y += (vAlignValue - (rotateClone.current.userData.vAlignValue || 0));
        rotateClone.current.userData.vAlignValue = vAlignValue;

        SaveFromTemplate(props, selectedAssetName, selectedAssetId, setLazy, setSelectedAssetId, vAlignValue);

    }, [rotationValue, vAlignValue]);

    // Memoize clones to prevent unnecessary re-renders
    // const cloneObjs = useMemo(() => { 
    //     console.log(clonesRef.current)
    //     return clonesRef.current}, 
    //     [clonesRef.current,assetClone,selectedAssetId]
    // );

    const setMaterialColor = (object, hexColor, alpha = 1) => {
        if (!hexColor || typeof hexColor !== "string") return;

        const updateMaterial = (material) => {
            const materialClone = material.clone();
            if (materialClone && materialClone.color) {
                try {
                    materialClone.color.set(hexColor);
                } catch (e) {
                    console.warn("Invalid color:", hexColor);
                }
                materialClone.transparent = alpha < 1;
                materialClone.opacity = alpha;
            }
            return materialClone;
        };

        if (object.material) {
            if (Array.isArray(object.material)) {
                originalMaterialsRef.current.set(
                    object,
                    object.material.map((mat) => mat.clone())
                );
                object.material = object.material.map((mat) => updateMaterial(mat));
            } else {
                originalMaterialsRef.current.set(object, object.material.clone());
                object.material = updateMaterial(object.material);
            }
        }

        if (object.children?.length) {
            object.children.forEach((child) => setMaterialColor(child, hexColor, alpha));
        }
    };

    const restoreOriginalMaterials = (object) => {
        if (originalMaterialsRef.current.has(object)) {
            object.material = originalMaterialsRef.current.get(object);
        }

        if (object.children?.length) {
            object.children.forEach((child) => restoreOriginalMaterials(child));
        }
    };

    const buildSelectedGameObject = (instanceId, cloneObj, assetName, asset = {}) => ({
        name: assetName || cloneObj.userData?.name || String(instanceId),
        position: {
            x: cloneObj.position?.x || 0,
            y: cloneObj.position?.y || 0,
            z: cloneObj.position?.z || 0,
        },
        rotation: {
            x: cloneObj.rotation?.x || 0,
            y: cloneObj.rotation?.y || 0,
            z: cloneObj.rotation?.z || 0,
        },
        scale: {
            x: cloneObj.scale?.x || 1,
            y: cloneObj.scale?.y || 1,
            z: cloneObj.scale?.z || 1,
        },
        components: [{
            type: "model",
            assetPath: asset.fileName || assetName || cloneObj.userData?.name || String(instanceId),
        }],
        source: {
            instanceId,
            instance_id: instanceId,
            apiObject: {
                instance_id: instanceId,
                device_id: instanceId,
                AssetID: asset.assetID || cloneObj.userData?.assetID,
                Assetname: assetName || cloneObj.userData?.name,
            },
        },
    });

    const selectCloneForEditing = (cloneObj) => {
        const instanceId = cloneObj.userData?.originalId || cloneObj.userData?.instanceId || cloneObj.userData?.instance_id;
        if (!instanceId) return;

        const sceneAsset = sceneAssets[instanceId] || {};
        const assetName = sceneAsset.name || cloneObj.userData?.name || selectedAssetName;
        const asset = objects[assetName] || sceneAsset;
        const gameObject = buildSelectedGameObject(instanceId, cloneObj, assetName, asset);
        const apiObject = gameObject.source.apiObject;

        sceneAssets[instanceId] = {
            ...sceneAsset,
            position: cloneObj.position.clone(),
            rotation: cloneObj.rotation.clone(),
            scale: cloneObj.scale.clone(),
            angle: THREE.MathUtils.radToDeg(cloneObj.rotation.y || 0),
            fAngle: THREE.MathUtils.radToDeg(cloneObj.rotation.y || 0),
            quarternion: cloneObj.quaternion.clone(),
            quart: cloneObj.quaternion.clone(),
            object: cloneObj,
            name: assetName,
            cleanKey: assetName,
            categoryIndex: sceneAsset.categoryIndex || cloneObj.userData?.categoryIndex || asset.categoryIndex,
            assetID: sceneAsset.assetID || cloneObj.userData?.assetID || asset.assetID,
            fileName: sceneAsset.fileName || asset.fileName,
        };

        const selection = {
            instanceId,
            scenePath: "puzzle-placement",
            object: cloneObj,
            gameObject,
            apiObject,
            cleanKey: assetName,
        };

        setEditorSelectionEnabled(true);
        setSelectedDragObject(cloneObj);
        setEditAssetId(Number.parseInt(String(instanceId), 10));
        setEditProps({
            name: assetName,
            position: cloneObj.position.clone(),
            angle: cloneObj.rotation.y || 0,
            obj: cloneObj,
            categoryIndex: sceneAssets[instanceId].categoryIndex,
            assetID: sceneAssets[instanceId].assetID,
            template_id: sceneAssets[instanceId].template_id,
        });
        setSelectedEditorInstance(selection);

        window.dispatchEvent(new CustomEvent("editor-select-scene-object", {
            detail: {
                scenePath: selection.scenePath,
                gameObject,
                apiObject,
            },
        }));
    };

    const onPointerDownEvent = (e,cloneObj) => {
        
        if(buttonMode !== 'Edit Mode'){
            return
        }
       
                if (e.button === 0) {

                    e.stopPropagation();
                    const instanceId = cloneObj.userData?.originalId || cloneObj.userData?.instanceId || cloneObj.userData?.instance_id;
                    const activeInstanceId = selectedEditorInstance?.instanceId;
                    if (
                        editing &&
                        (hasUnsavedTransformUpdate || useGame.getState?.()?.hasUnsavedTransformUpdate) &&
                        activeInstanceId !== undefined &&
                        activeInstanceId !== null &&
                        instanceId !== undefined &&
                        instanceId !== null &&
                        String(activeInstanceId) !== String(instanceId)
                    ) {
                        setAssetSelected(true);
                        return;
                    }

                    rotateClone.current = cloneObj
                    setSelectedId(cloneObj.userData.id)
                    setSelectedCatId(cloneObj.userData.catId)
                    selectCloneForEditing(cloneObj)
                    return
                 
                }

                // RIGHT click
                if (e.button === 2) {
                    const removedObj = clonesRef.current.find(
                        (clone) => clone.userData.originalId === cloneObj.userData.originalId
                    );
                    setDeleteAssetId(removedObj.userData.originalId);
                    // Remove clone from clonesRef
                
                   const updateList =  cloneList.filter(
                        (clone) => clone.userData.originalId !== cloneObj.userData.originalId
                    );
                    setCloneList(updateList)
                }
            
    
    }

    return (
        <>
            {cloneList.map((cloneObj) => {

                if (!cloneObj) return null;

                return (
                    <RigidBody
                        key={cloneObj.userData.id}
                        type="fixed"
                        colliders={'trimesh'}
                    >
                        <group
                            onPointerOver={() => {
                                gl.domElement.style.cursor = "pointer";
                                setMaterialColor(cloneObj, "rgb(243,255,211)", 1);
                            }}
                            onPointerOut={() => {
                                gl.domElement.style.cursor = "default";
                                restoreOriginalMaterials(cloneObj);
                            }}
                            onPointerDown={(event) => {
                                onPointerDownEvent(event,cloneObj)

                            }

                            }

                        >
                            <primitive object={cloneObj} />
                        </group>
                    </RigidBody>
                );
            })}
        </>
    );
}
