
import * as THREE from "three";
import React, { useEffect, useRef, useState } from "react";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import useGame from "../../hooks/useGame";
import { Vector3 } from "three";
import UiController from "../hud/inventory/UiController.jsx";
import UpdateAsset from "../scene/UpdateAsset";
import { objects, sceneAssets } from "../player/puzzle/character/Constants";
import { normalizeSceneAssetName } from '../generatedAssetPaths';
import {
    getRememberedCategorySelectionForAsset,
    isValidCategoryIndex,
    normalizeAssetCategoryKey
} from "../../components/popup/form/categorySelectionRequest";



const normalizeDegrees = (value = 0) => {
    const parsed = Number.parseFloat(value);
    const safeValue = Number.isFinite(parsed) ? parsed : 0;
    return ((safeValue % 360) + 360) % 360;
};

const getAxisVector = (axis) => {
    if (axis && typeof axis === 'object') {
        const vector = new Vector3(
            Number.parseFloat(axis.x) || 0,
            Number.parseFloat(axis.y) || 0,
            Number.parseFloat(axis.z) || 0
        );
        if (vector.lengthSq() > 0) {
            return vector.normalize();
        }
    }

    return new Vector3(0, 1, 0);
};



const getLogicalObjectPosition = (targetObject) => {
    const position = targetObject?.position || new Vector3();
    return new Vector3(position.x, position.y, position.z);
};

const getTransformSnapshot = (targetObject) => {
    if (!targetObject) {
        return null;
    }

    return {
        position: targetObject.position?.clone?.(),
        quaternion: targetObject.quaternion?.clone?.(),
        scale: targetObject.scale?.clone?.(),
    };
};

const hasTransformChangedSince = (snapshot, targetObject) => {
    if (!snapshot || !targetObject) {
        return false;
    }

    return Boolean(
        snapshot.position && targetObject.position && !snapshot.position.equals(targetObject.position) ||
        snapshot.quaternion && targetObject.quaternion && !snapshot.quaternion.equals(targetObject.quaternion) ||
        snapshot.scale && targetObject.scale && !snapshot.scale.equals(targetObject.scale)
    );
};

const getInstanceAngleFromQuaternion = (targetObject, assetTransform) => {
    if (!targetObject?.quaternion || !assetTransform?.axis) {
        return null;
    }

    const axis = getAxisVector(assetTransform.axis);
    const previousAngle = normalizeDegrees(assetTransform.angle ?? assetTransform.fAngle ?? targetObject.userData?.angle);
    const previousAngleQuaternion = new THREE.Quaternion().setFromAxisAngle(
        axis,
        THREE.MathUtils.degToRad(previousAngle)
    );
    const previousFinalQuaternion = (assetTransform.quarternion || assetTransform.quart || targetObject.quaternion).clone();
    const initialQuaternion = previousFinalQuaternion.clone().multiply(previousAngleQuaternion.invert());
    const deltaQuaternion = initialQuaternion.clone().invert().multiply(targetObject.quaternion).normalize();
    const signedRadians = 2 * Math.atan2(
        deltaQuaternion.x * axis.x + deltaQuaternion.y * axis.y + deltaQuaternion.z * axis.z,
        deltaQuaternion.w
    );

    return normalizeDegrees(THREE.MathUtils.radToDeg(signedRadians));
};

const isObjectInSceneGraph = (object, scene) => {
    if (!object || !scene) {
        return false;
    }

    let current = object;
    while (current) {
        if (current === scene) {
            return true;
        }
        current = current.parent;
    }

    return false;
};










const getDropViewportRect = (event) => {
    const canvasElement =
        document.querySelector('.canvas-element') ||
        document.querySelector('canvas') ||
        document.getElementById('root');

    return canvasElement?.getBoundingClientRect?.() ||
        event?.currentTarget?.getBoundingClientRect?.() ||
        event?.target?.getBoundingClientRect?.();
};

const hasPendingTransformUpdate = () => Boolean(useGame.getState?.()?.hasUnsavedTransformUpdate);




export default function AssetDragDrop({ cameraRef, sceneRef, orbitControls }) {
    const transformControlsRef = useRef(null);
    const keydownHandlerRef = useRef(null);
    const syncFrameRef = useRef(0);
    const pendingSyncRef = useRef(null);
    const temporaryDropIdRef = useRef(-1);
    const dragObjectPropertiesRef = useRef(null);
    const selectedEditorInstanceRef = useRef(null);
    const editAssetIdRef = useRef(0);
    const activeObjectRef = useRef(null);
    const activeSelectionIdRef = useRef(null);
    const assetSelectedRef = useRef(false);
    const hasUnsavedTransformUpdateRef = useRef(false);
    const dropInProgressRef = useRef(false);

    const [object, setDataObject] = useState();

    const setDrop = useGame((state) => state.setDrop)
    const setDragObjectProperties = useGame((state) => state.setDragObjectProperties)
    const isDragAssetDeleted = useGame((state) => state.isDragAssetDeleted);
    const assetSelected = useGame((state) => state.assetSelected);
    const setAssetSelected = useGame((state) => state.setAssetSelected);
    const setDragAssetProps = useGame((state) => state.setDragAssetProps);
    const assetEdit = useGame((state) => state.assetEdit);
    const editAssetId = useGame((state) => state.editAssetId);
    const editProps = useGame((state) => state.editProps);
    const selectedEditorInstance = useGame((state) => state.selectedEditorInstance);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const editorSelectionEnabled = useGame((state) => state.editorSelectionEnabled);
    const updateSelectedEditorTransform = useGame((state) => state.updateSelectedEditorTransform);
    const editorGizmoMode = useGame((state) => state.editorGizmoMode);
    const setEditorGizmoMode = useGame((state) => state.setEditorGizmoMode);
    const dragObjectProperties = useGame((state) => state.dragObjectProperties);
    const setEditAssetId = useGame((state) => state.setEditAssetId);

    const setEditProps = useGame((state) => state.setEditProps);
    const [isDrag, setIsDrag] = useState(false)
    const setFirstDrop = useGame((state) => state.setFirstDrop)
    const dragAssetProps = useGame((state) => state.dragAssetProps);
    const deleteAssetId = useGame((state) => state.deleteAssetId);
    const editing = useGame((state) => state.isEditing);
    const hasUnsavedTransformUpdate = useGame((state) => state.hasUnsavedTransformUpdate);
    const setIsEditing = useGame((state) => state.setIsEditing);
    const setisGizmoActive = useGame((state) => state.setisGizmoActive);
    const setHasUnsavedTransformUpdate = useGame((state) => state.setHasUnsavedTransformUpdate);
    const isGizmo = useRef(false);
    const isGizmoDragging = useRef(false);

    const getDroppedAssetCategoryKey = (objectData = {}, targetObject = null) => normalizeAssetCategoryKey(
        objectData.nameKey,
        objectData.assetPath,
        objectData.path,
        objectData.fbxName,
        objectData.fileName,
        objectData.name,
        objectData.obj?.userData?.assetKey,
        objectData.obj?.userData?.assetPath,
        targetObject?.userData?.assetKey,
        targetObject?.userData?.assetPath,
        targetObject?.userData?.name,
        targetObject?.name
    );

    const getFallbackCategoryForDroppedAsset = (objectData = {}, targetObject = null) => {
        const assetKey = getDroppedAssetCategoryKey(objectData, targetObject);
        const rememberedCategory = getRememberedCategorySelectionForAsset(assetKey);
        if (rememberedCategory?.categoryIndex) {
            return rememberedCategory.categoryIndex;
        }

        const targetCategoryOwner = normalizeAssetCategoryKey(
            targetObject?.userData?.categorySelectionAssetKey,
            objectData.obj?.userData?.categorySelectionAssetKey
        );
        const targetCategory = objectData.obj?.userData?.categoryIndex || targetObject?.userData?.categoryIndex;
        if (targetCategoryOwner && targetCategoryOwner === assetKey && isValidCategoryIndex(targetCategory)) {
            return targetCategory;
        }

        const explicitCategory = objectData.categoryIndex || objectData.category_index;
        return isValidCategoryIndex(explicitCategory) ? explicitCategory : 0;
    };

    const markTransformAsUnsaved = () => {
        hasUnsavedTransformUpdateRef.current = true;
        setHasUnsavedTransformUpdate(true);
    };

    const setTransformControlInteractionState = (nextState = {}) => {
        if (typeof window === 'undefined') {
            return;
        }

        window.__editorTransformControlsState = {
            ...(window.__editorTransformControlsState || {}),
            ...nextState,
        };
    };

    const suppressSceneSelectionAfterGizmoRelease = () => {
        setTransformControlInteractionState({
            dragging: false,
            suppressSceneSelectUntil: Date.now() + 1000,
        });
    };

    // const setNotification = useGame((state) => state.setNotification);

    const createFallbackAssetMeta = (targetObject, objectData = {}) => {
        const box = new THREE.Box3().setFromObject(targetObject);
        const size = new THREE.Vector3();
        box.getSize(size);

        const name = objectData.obj?.userData?.assetPath || targetObject.userData?.assetKey;
        const cleanKey = normalizeSceneAssetName(name)

        return {
            object: targetObject,
            categoryIndex: getFallbackCategoryForDroppedAsset(objectData, targetObject),
            halfWidth: (size.x * 100) / 2 || objectData.halfWidth || 0.5,
            halfLength: (size.z * 100) / 2 || objectData.halfLength || 0.5,
            halfHeight: (size.y * 100) / 2 || objectData.halfHeight || 0.5,
            assetID: objectData.obj?.userData?.assetID || targetObject?.userData?.assetID || targetObject?.userData?.assetId || editAssetId,
            template_id: objectData.obj?.userData?.template_id || targetObject?.userData?.template_id || 0,
            textures: objectData.obj?.textures || [],
            fbxName: objectData.obj?.userData?.assetPath || targetObject?.userData?.name || targetObject?.name || `Asset ${editAssetId}`,
            fileName: cleanKey,
            scale: targetObject.children > 0 ? targetObject.children[0].scale?.clone() : targetObject.scale?.clone(),
        };
    };

    useEffect(() => {
        dragObjectPropertiesRef.current = dragObjectProperties;
    }, [dragObjectProperties]);

    useEffect(() => {
        selectedEditorInstanceRef.current = selectedEditorInstance;
    }, [selectedEditorInstance]);

    useEffect(() => {
        editAssetIdRef.current = editAssetId;
    }, [editAssetId]);

    useEffect(() => {
        assetSelectedRef.current = assetSelected;

        if (dropInProgressRef.current) {
            return;
        }

        if (!assetSelected && !activeObjectRef.current && !selectedEditorInstanceRef.current?.object) {
            const sceneObject = sceneRef?.current?.getObjectByName("DraggedObj");
            if (sceneObject) {
                sceneObject.parent?.remove(sceneObject);
            }
            setIsEditing(false)
            setEditAssetId(0);
            resetAsset()

        }

    }, [assetSelected]);

    useEffect(() => {
        hasUnsavedTransformUpdateRef.current = hasUnsavedTransformUpdate;
    }, [hasUnsavedTransformUpdate]);
    useEffect(() => {
        if (editorSelectionEnabled) {
            return;
        }

        removeTransformControls();
        activeObjectRef.current = null;
        setDrop(false);
    }, [editorSelectionEnabled]);

    useEffect(() => {
        const checkAttachedObject = () => {
            const controls = transformControlsRef.current;
            if (controls?.object && !isObjectInSceneGraph(controls.object, sceneRef.current)) {
                removeTransformControls();
            }
        };

        const intervalId = window.setInterval(checkAttachedObject, 500);
        return () => window.clearInterval(intervalId);
    }, []);

    const getTransformInstanceId = (targetObject, fallbackId) => {
        if (fallbackId !== undefined && fallbackId !== null) {
            return fallbackId;
        }

        const userData = targetObject?.userData || {};
        const instancedSelection = userData.__instancedSelection;
        return userData.instanceId ||
            userData.instance_id ||
            userData.device_id ||
            userData.assetId ||
            userData.assetID ||
            instancedSelection?.instanceInfo?.assetId ||
            instancedSelection?.instanceInfo?.instanceId ||
            instancedSelection?.instanceInfo?.instance_id ||
            selectedEditorInstanceRef.current?.instanceId ||
            editAssetIdRef.current;
    };

    const syncSelectedTransform = (targetObject, meta = {}) => {

        if (!targetObject) {
            return;
        }

        if (!isObjectInSceneGraph(targetObject, sceneRef.current)) {
            removeTransformControls();
            return;
        }

        targetObject.updateMatrix?.();
        targetObject.updateMatrixWorld?.(true);

        const position = getLogicalObjectPosition(targetObject);
        const rotation = new Vector3(targetObject.rotation.x, targetObject.rotation.y || 0, targetObject.rotation.z);
        const scale = new Vector3(targetObject.scale.x, targetObject.scale.y, targetObject.scale.z);
        const { distance, interval } = dragObjectPropertiesRef.current || {};
        const instancedSelection = targetObject.userData?.__instancedSelection;
        const instanceId = getTransformInstanceId(targetObject, meta.instanceId);
        const assetTransform = sceneAssets[instanceId];
        const instanceAngle = instancedSelection?.mesh
            ? getInstanceAngleFromQuaternion(targetObject, assetTransform)
            : null;

        if (instancedSelection?.mesh && instancedSelection.instanceIndex !== undefined) {

            instancedSelection.mesh.setMatrixAt(instancedSelection.instanceIndex, targetObject.matrix);
            instancedSelection.mesh.instanceMatrix.needsUpdate = true;

            const instanceInfo = instancedSelection.mesh.userData?.instances?.[instancedSelection.instanceIndex] ||
                instancedSelection.instanceInfo;
            if (instanceInfo) {
                instanceInfo.position = { x: position.x, y: position.y, z: position.z };
                instanceInfo.scale = { x: scale.x, y: scale.y, z: scale.z };
                instanceInfo.angle = {
                    ...(typeof instanceInfo.angle === 'object' ? instanceInfo.angle : {}),
                    x: rotation.x,
                    y: instanceAngle ?? THREE.MathUtils.radToDeg(rotation.y || 0),
                    z: rotation.z,
                };
            }

            if (instanceAngle !== null) {
                targetObject.userData.angle = instanceAngle;
                if (assetTransform) {
                    assetTransform.angle = instanceAngle;
                    assetTransform.quarternion = targetObject.quaternion.clone();
                    assetTransform.quart = targetObject.quaternion.clone();
                }
            }
        }

        const name = meta.name ||
            object?.fbxName ||
            targetObject.userData?.name ||
            selectedEditorInstanceRef.current?.gameObject?.name ||
            targetObject.name;
        const dragRotation = instanceAngle !== null
            ? new Vector3(0, THREE.MathUtils.degToRad(instanceAngle), 0)
            : rotation;
        const nextDragProperties = { name, position, rotation: dragRotation, scale, distance, interval };

        dragObjectPropertiesRef.current = nextDragProperties;
        setDragObjectProperties(nextDragProperties);
        updateSelectedEditorTransform({
            instanceId,
            object: targetObject,
            position: { x: position.x, y: position.y, z: position.z },
            rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
            scale: { x: scale.x, y: scale.y, z: scale.z },
            dragObjectProperties: nextDragProperties,
            markUnsavedTransform: Boolean(meta.markUnsavedTransform),
        });
        cameraRef?.current?.updateProjectionMatrix();
    };

    const getTemporaryDropInstanceId = () => {
        temporaryDropIdRef.current -= 1;
        return temporaryDropIdRef.current;
    };

    const buildDroppedGameObject = (instanceId, name, targetObject, objectData = {}) => ({
        name: name || targetObject?.userData?.name || targetObject?.name || String(instanceId),
        position: (() => {
            const logicalPosition = getLogicalObjectPosition(targetObject);
            return {
                x: logicalPosition.x || 0,
                y: logicalPosition.y || 0,
                z: logicalPosition.z || 0,
            };
        })(),
        rotation: {
            x: targetObject?.rotation?.x || 0,
            y: targetObject?.rotation?.y || 0,
            z: targetObject?.rotation?.z || 0,
        },
        scale: {
            x: targetObject?.scale?.x || 1,
            y: targetObject?.scale?.y || 1,
            z: targetObject?.scale?.z || 1,
        },
        components: [
            {
                type: 'model',
                assetPath: objectData.assetPath || objectData.path || objectData.fbxName || name,
            },
        ],
        source: {
            instanceId,
            instance_id: instanceId,
            apiObject: {
                ...objectData,
                instance_id: instanceId,
                device_id: instanceId,
                AssetID: objectData.assetID,
                Assetname: name,
            },
        },
    });

    const selectDroppedEditorObject = (instanceId, name, targetObject, objectData = {}) => {
        const gameObject = buildDroppedGameObject(instanceId, name, targetObject, objectData);

        const selection = {
            instanceId,
            scenePath: 'dropped-assets',
            object: targetObject,
            gameObject,
            apiObject: gameObject.source.apiObject,
            updatedAt: Date.now(),
            cleanKey: name
        };

        setSelectedEditorInstance(selection);
        selectedEditorInstanceRef.current = selection;
        activeObjectRef.current = targetObject;
        activeSelectionIdRef.current = instanceId;
        setEditProps({
            name,
            position: targetObject.position.clone(),
            angle: targetObject.rotation.y || 0,
            obj: targetObject,
            categoryIndex: targetObject.userData?.categoryIndex,
            assetID: targetObject.userData?.assetID || targetObject.userData?.assetId,
            template_id: targetObject.userData?.template_id,
        });
        setEditAssetId(instanceId);

        window.dispatchEvent(new CustomEvent('editor-select-virtual-scene-object', {
            detail: {
                scenePath: selection.scenePath,
                gameObject,
                apiObject: selection.apiObject,
            },
        }));
    };

    const removeTransformControls = () => {
        if (syncFrameRef.current) {
            window.cancelAnimationFrame(syncFrameRef.current);
            syncFrameRef.current = 0;
            pendingSyncRef.current = null;
        }

        if (keydownHandlerRef.current) {
            document.removeEventListener("keydown", keydownHandlerRef.current);
            keydownHandlerRef.current = null;
        }

        const controls = transformControlsRef.current;
        if (controls) {
            transformControlsRef.current = null;
            activeObjectRef.current = null;
            controls.enabled = false;
            controls.userData?.__editorCleanup?.();

            const helper = controls.getHelper?.();
            if (helper?.parent) {
                helper.parent.remove(helper);
            }

            try {
                controls.reset();
                controls.detach();
            } catch (error) {
                console.warn('Failed to detach transform controls:', error);
            }

            controls.dispose?.();
        }
    };

    const attachTransformControls = (targetObject) => {
        if (!targetObject || !cameraRef.current || !sceneRef.current) {
            return null;
        }
    
        removeTransformControls();

        if (!isObjectInSceneGraph(targetObject, sceneRef.current)) {
            sceneRef.current.add(targetObject);
            targetObject.updateMatrixWorld?.(true);
        }

        const docs = document.getElementsByClassName('canvas-element');
        const domElement = docs[0];
        if (!domElement) {
            return null;
        }

        const controls = new TransformControls(cameraRef.current, domElement);
        const transformStartRef = { current: null };
        controls.userData = controls.userData || {};
        sceneRef.current.add(controls.getHelper());
        controls.attach(targetObject);
        controls.setMode(editorGizmoMode || 'translate');
        setDrop(true);
        transformControlsRef.current = controls;
        activeObjectRef.current = targetObject;

        const onKeyDown = (event) => {
            if (!transformControlsRef.current) {
                return;
            }

            switch (event.key.toLowerCase()) {
                case "t":
                    transformControlsRef.current.setMode("translate");
                    setEditorGizmoMode("translate");
                    break;
                case "r":
                    transformControlsRef.current.setMode("rotate");
                    setEditorGizmoMode("rotate");
                    break;
                case "s":
                    transformControlsRef.current.setMode("scale");
                    setEditorGizmoMode("scale");
                    break;
                default:
                    return;
            }

            transformControlsRef.current.showX = true;
            transformControlsRef.current.showY = true;
            transformControlsRef.current.showZ = true;
        };

        document.addEventListener("keydown", onKeyDown);
        keydownHandlerRef.current = onKeyDown;

        const onControlsChanged = () => {
            const controlledObject = controls.object || targetObject;
            const markUnsavedTransform = Boolean(
                isGizmoDragging.current ||
                controls.dragging ||
                hasTransformChangedSince(transformStartRef.current, controlledObject)
            );

            if (markUnsavedTransform) {
                markTransformAsUnsaved();
            }

            pendingSyncRef.current = controlledObject;

            if (syncFrameRef.current) {
                return;
            }

            syncFrameRef.current = window.requestAnimationFrame(() => {
                syncFrameRef.current = 0;
                const pendingObject = pendingSyncRef.current;
                pendingSyncRef.current = null;
                syncSelectedTransform(pendingObject, {
                    markUnsavedTransform,
                });
            });
        };

        const onDraggingChanged = (event) => {
            //console.log("dragging changed", event.value);
            //markTransformControlsDragging(event.value);
            setisGizmoActive(event.value);
            if (event.value) {
                setTransformControlInteractionState({ dragging: true });
            } else {
                suppressSceneSelectionAfterGizmoRelease();
            }
            if (orbitControls.current) {
                orbitControls.current.enabled = !event.value;
            }

            if (!event.value && controls.object && !isObjectInSceneGraph(controls.object, sceneRef.current)) {
                removeTransformControls();
            }
        };

        // const onMouseDown = () => markTransformControlsDragging(true);
        // const onMouseUp = () => markTransformControlsDragging(true);

        // const markTransformControlsDragging = (isDragging) => {
        //     // console.log("markTransformControlsDragging", isDragging);
        //     setisGizmoActive(isDragging);
        // };

        const updateGizmoActive = () => {

            setisGizmoActive(isGizmo.current || isGizmoDragging.current);
        };

        const onPointerMove = () => {
            const hovering = Boolean(controls.axis);
                  
            if (hovering === isGizmo.current) {
                return;
            }

            isGizmo.current = hovering;
            updateGizmoActive();


        };

        const onPointerLeave = () => {
            isGizmo.current = false;
            updateGizmoActive();
        };

        const onMouseDown = () => {
           
            isGizmoDragging.current = true;
            transformStartRef.current = getTransformSnapshot(controls.object || targetObject);
            setTransformControlInteractionState({ dragging: true });
            updateGizmoActive();
        };

        const onMouseUp = () => {
            const controlledObject = controls.object || targetObject;
            if (hasTransformChangedSince(transformStartRef.current, controlledObject)) {
                markTransformAsUnsaved();
                syncSelectedTransform(controlledObject, { markUnsavedTransform: true });
            }
            transformStartRef.current = null;
            isGizmoDragging.current = false;
            suppressSceneSelectionAfterGizmoRelease();
            updateGizmoActive();
        };

        controls.addEventListener("dragging-changed", onDraggingChanged);
        controls.addEventListener("mouseDown", onMouseDown);
        controls.addEventListener("mouseUp", onMouseUp);
        controls.addEventListener("objectChange", onControlsChanged);
        domElement.addEventListener("pointermove", onPointerMove);
        domElement.addEventListener("pointerleave", onPointerLeave);

        controls.userData.__editorCleanup = () => {
            controls.removeEventListener("dragging-changed", onDraggingChanged);
            controls.removeEventListener("mouseDown", onMouseDown);
            controls.removeEventListener("mouseUp", onMouseUp);
            controls.removeEventListener("objectChange", onControlsChanged);
            domElement.removeEventListener("pointermove", onPointerMove);
            domElement.removeEventListener("pointerleave", onPointerLeave);

        };


    };

    useEffect(() => {
        const handleDetachTransformControls = () => removeTransformControls();
        window.addEventListener('editor-detach-transform-controls', handleDetachTransformControls);

        return () => {
            window.removeEventListener('editor-detach-transform-controls', handleDetachTransformControls);
        };
    }, []);

    useEffect(() => {
        if (transformControlsRef.current && editorGizmoMode) {
            transformControlsRef.current.setMode(editorGizmoMode);
        }
    }, [editorGizmoMode]);


    const accept = () => {
        resetAsset()
        setEditAssetId(0)

        removeTransformControls();
    }

    const reject = () => {
        // setUserAccepted(false)
        //toast.current?.show({ severity: 'warn', summary: 'Rejected', detail: 'You have rejected', life: 3000 });
    }

    const prepareDroppedObjectForEditing = ({
        cObj,
        objectData,
        name,
        categoryIndex,
        halfWidth,
        halfLength,
        halfHeight,
        assetID,
        template_id,
        textures,
        fbxName,
        scale,
        event = false,
    }) => {
        if (!cObj) {
            return;
        }

        if (event || objectData.source !== 'editor-bottom-dock') {
            setFirstDrop(true)
        }
        setHasUnsavedTransformUpdate(false);

        setDataObject({ object: cObj, categoryIndex: categoryIndex || 0, halfWidth, halfLength, halfHeight, assetID, template_id, textures, fbxName });

        const position = getLogicalObjectPosition(cObj);
        const rotation = new Vector3(cObj.rotation.x, cObj.rotation.y, cObj.rotation.z);
        const interval = {
            x: halfWidth,
            y: halfHeight,
            z: halfLength,
        }
        const distance = {
            x: halfWidth * 2,
            y: halfHeight * 2,
            z: halfLength * 2,
        }

        const nextDragProperties = { name, position, rotation, scale, interval, distance };
        dragObjectPropertiesRef.current = nextDragProperties;

        if (cameraRef.current && sceneRef.current) {
            setIsEditing(true)
            activeSelectionIdRef.current = getTransformInstanceId(
                cObj,
                objectData.instanceId ||
                objectData.instance_id ||
                cObj.userData?.instanceId ||
                cObj.userData?.instance_id ||
                editAssetIdRef.current
            );
                  
            attachTransformControls(cObj);
        }
    };

    const onDropObject = async (objectData, event, dnd) => {

        const { name, nameKey } = objectData;

        const dropPointer = event ? {
            x: event.clientX,
            y: event.clientY,
            rect: getDropViewportRect(event),
        } : null;
        const objectKey = nameKey



        if (!objectKey && !objectData?.obj) {
            //console.warn('Dropped asset is missing a valid nameKey:', objectData);
            return;
        }

        if (event && hasPendingTransformUpdate()) {
            setAssetSelected(true);
            return;
        }



        const sceneObject = sceneRef?.current.getObjectByName("sceneObj") || sceneRef?.current

        removeTransformation()

        // if (sceneObject && object) {
        const objectTemplate = objects[objectKey];
       
        const existingAsset = objectTemplate?.object// new THREE.Group(); // sceneRef?.current.getObjectByName("hover");
        const targetExistingObject = objectData?.obj;
        const assetMeta = objectTemplate || (targetExistingObject
            ? createFallbackAssetMeta(targetExistingObject, objectData)
            : null);

        if (!assetMeta?.object) {
            return;
        }

        const textures = assetMeta?.textures || objectData.textures
        const fbxName = assetMeta?.fileName


        if (event) {
            const {
                object,
                categoryIndex,
                halfWidth,
                halfLength,
                halfHeight,
                assetID,
                template_id,
                scale
            } = assetMeta

            const cObj = object.clone(true)

            cObj.children.length > 0 ? cObj.children[0].scale.set(scale.x, scale.y, scale.z) : cObj.scale.set(scale.x, scale.y, scale.z)
            cObj.updateMatrixWorld?.(true);

            // 1. Convert mouse position to normalized device coordinates (NDC)
            const rect = dropPointer?.rect;
            if (!rect || !rect.width || !rect.height) {
                console.warn('Drop asset failed: viewport rect is unavailable.');
                return;
            }

            const mouse = new THREE.Vector2(
                ((dropPointer.x - rect.left) / rect.width) * 2 - 1,
                -((dropPointer.y - rect.top) / rect.height) * 2 + 1
            );

            // 2. Create a raycaster
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cameraRef.current);

            // 3. Create or check against a ground plane
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Plane parallel to XZ at Y=0
            const intersectPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(groundPlane, intersectPoint);

            // 4. Check for intersections with existing objects (to prevent collision)
            const existingObjects = sceneObject.children.filter((child) => child !== cObj);
            const intersects = raycaster.intersectObjects(existingObjects, true);

            if (intersects.length === 0) {
                // 4. No intersection: place at calculated point on ground plane
                const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Ground plane
                const intersectPoint = new THREE.Vector3();
                raycaster.ray.intersectPlane(groundPlane, intersectPoint);
                cObj.position.copy(intersectPoint);

            } else {
                // 5. Intersection detected: place object on top of the first intersected object
                const intersect = intersects[0]; // Closest intersection
                const intersectPoint = intersect.point; // Intersection point on the object


                // Position the object on top of the intersected surface
                cObj.position.set(
                    intersectPoint.x,
                    intersectPoint.y,
                    intersectPoint.z
                );
            }

            const droppedInstanceId = objectData.source === 'editor-bottom-dock'
                ? getTemporaryDropInstanceId()
                : (objectData.instanceId || objectData.instance_id || objectData.assetID || getTemporaryDropInstanceId());

            cObj.name = 'DraggedObj'
            cObj.userData = {
                ...cObj.userData,
                ...objectData,
                instanceId: droppedInstanceId,
                instance_id: droppedInstanceId,
                device_id: droppedInstanceId,
                name: cObj.name,
            };

            dropInProgressRef.current = true;
            sceneObject.add(cObj);
            selectDroppedEditorObject(droppedInstanceId, cObj.name, cObj, objectData);
            if (objectData.source === 'editor-bottom-dock') {
                setFirstDrop(true);
            }
            prepareDroppedObjectForEditing({
                cObj,
                objectData,
                name,
                categoryIndex,
                halfWidth,
                halfLength,
                halfHeight,
                assetID,
                template_id,
                textures,
                fbxName,
                scale,
                event: Boolean(event),
            });
            if (objectData.source === 'editor-bottom-dock') {
                markTransformAsUnsaved();
            }

            const clearDropInProgress = () => {
                dropInProgressRef.current = false;
            };
            if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(clearDropInProgress);
            } else {
                setTimeout(clearDropInProgress, 0);
            }
            return
        }



        const { position, angle, obj } = objectData


        const {
            object,
            categoryIndex,
            halfWidth,
            halfLength,
            halfHeight,
            assetID,
            template_id,
            scale
        } = assetMeta

        const cObj = (obj || existingAsset || object);
       
            cObj.position.copy(position)
            cObj.rotation.y = THREE.MathUtils.degToRad(angle)
            cObj.rotation.x = 0
            cObj.rotation.z = 0
            cObj.position.y -= halfHeight || 0

            sceneObject.add(cObj);
        

        prepareDroppedObjectForEditing({
            cObj,
            objectData,
            name,
            categoryIndex,
            halfWidth,
            halfLength,
            halfHeight,
            assetID,
            template_id,
            textures,
            fbxName,
            scale,
            event: Boolean(event),
        });



        // }
    };

    // useEffect(() => {
    //     console.log(inventoryDragObject)
    // }, [inventoryDragObject]);

    const handleDrop = (e) => {
        const data = e.dataTransfer?.getData("application/json");
        let objectData = null;


        if (data) {
            try {
                objectData = JSON.parse(data);

            } catch {
                // React DnD owns editor asset drops. Its HTML5 backend can leave
                // non-JSON drag data behind, so the legacy native drop path ignores it.
                return;
            }
        }

        if (objectData?.source === 'editor-bottom-dock') {
            return;
        }

        const menuItem = document.querySelector('.edit-asset');
        if (!assetEdit && menuItem && objectData?.source !== 'editor-bottom-dock') {
            menuItem.classList.add('glowing-element')

            return
        }

        // e.preventDefault();

        if (objectData) {
            try {
                setDrop(false)

                onDropObject(objectData, e, 1).catch((error) => console.warn('Drop asset failed:', error));

            } catch (error) {
                console.log(error)
            }
        }
    };

    const handleReactDndDrop = (event) => {
        const item = event.detail?.item;
        
        const clientOffset = event.detail?.clientOffset;

        if (!item || !clientOffset) {
            return;
        }

        const dropItem = () => {
            setDrop(false)

            onDropObject(item, {
                clientX: clientOffset.x,
                clientY: clientOffset.y,
            }, true).catch((error) => console.warn('Drop asset failed:', error));
        };

        dropItem()
    };

    const handleDragOver = (e) => {
        e.stopPropagation();
        e.preventDefault(); // Necessary to allow drop

    };


    const handleDragStart = (e) => {
        if (e.target?.closest?.('[data-editor-asset-thumb="true"]')) {
            return;
        }

        e.preventDefault();
    }
    const resetAsset = (isSaved = false) => {
        removeTransformControls();
        setFirstDrop(false)
        setDrop(false)
        setisGizmoActive(false);
        setDragAssetProps({})

        setDataObject(null)
        const sceneObject = sceneRef?.current?.getObjectByName("sceneObj");
        const objectInstanceId =
            object?.object?.userData?.instanceId ??
            object?.object?.userData?.instance_id ??
            activeSelectionIdRef.current;
        const isTemporaryAsset = Number.parseInt(String(objectInstanceId), 10) < 0;

        if (object && sceneObject && !isSaved && (object.object?.name === 'DraggedObj' || isTemporaryAsset)) {
            sceneObject?.remove(object?.object)
            const hoverObj = sceneRef?.current?.getObjectByName("hover");
            if (hoverObj) {
                hoverObj.parent?.remove()
            }
        }

        activeObjectRef.current = null;
        activeSelectionIdRef.current = null;
    }

    const removeTransformation = () => {

        if (transformControlsRef.current) {
            setDrop(false)
            setDragAssetProps({})
            setDataObject(null)
            removeTransformControls();
        }

    }

    useEffect(() => {
        const menuItem = document.querySelector('.edit-asset');

        if (assetEdit && menuItem) {
            menuItem.classList.remove('glowing-element')
        }

        const overlay = document.getElementById("root");

        overlay?.addEventListener("dragover", handleDragOver);
        overlay?.addEventListener("dragstart", handleDragStart);
        overlay?.addEventListener("drop", handleDrop);
        window.addEventListener("editor-asset-dnd-drop", handleReactDndDrop);

        return () => {
            overlay?.removeEventListener("dragover", handleDragOver);
            overlay?.removeEventListener("dragstart", handleDragStart);
            overlay?.removeEventListener("drop", handleDrop);
            window.removeEventListener("editor-asset-dnd-drop", handleReactDndDrop);
        };


    }, [assetEdit, editing, dragObjectProperties, object, selectedEditorInstance]);

    useEffect(() => {
        return () => {
            removeTransformControls();
        };
    }, []);


    useEffect(() => {

        if (deleteAssetId === 0) {

            resetAsset()
        }

    }, [deleteAssetId]);

    useEffect(() => {

        const dragAssetId = dragAssetProps?.dragAssetId

        if (dragAssetId < 0) {
            resetAsset(true)
            setEditAssetId(0)
        }

    }, [dragAssetProps?.dragAssetId]);


    useEffect(() => {
        if (dropInProgressRef.current) {
            return;
        }

        if (!editorSelectionEnabled) {

            return;
        }

        if (selectedEditorInstance?.scenePath === 'dropped-assets') {
            return;
        }

        setDrop(false)
        setIsDrag(false)

        if (selectedEditorInstance?.object && selectedEditorInstance?.instanceId) {
            const targetObject = selectedEditorInstance.object;
            const name = selectedEditorInstance.gameObject?.name || targetObject.userData?.name || targetObject.name;
            const objectData = {
                ...(selectedEditorInstance.apiObject || {}),
                obj: targetObject,
                name,
                nameKey: selectedEditorInstance.cleanKey || targetObject.userData?.assetKey || name,
                source: selectedEditorInstance.apiObject?.source || 'scene-selection',
            };
            const assetMeta = createFallbackAssetMeta(targetObject, objectData);

         
            prepareDroppedObjectForEditing({
                cObj: targetObject,
                objectData,
                name,
                categoryIndex: assetMeta.categoryIndex,
                halfWidth: assetMeta.halfWidth,
                halfLength: assetMeta.halfLength,
                halfHeight: assetMeta.halfHeight,
                assetID: assetMeta.assetID,
                template_id: assetMeta.template_id,
                textures: assetMeta.textures,
                fbxName: assetMeta.fileName || assetMeta.fbxName,
                scale: assetMeta.scale,
                event: false,
            });
        }


    }, [selectedEditorInstance?.instanceId, selectedEditorInstance?.object, selectedEditorInstance?.scenePath, editorSelectionEnabled]);

    useEffect(() => {
        const sceneObject = sceneRef?.current?.getObjectByName("sceneObj");

        // Cleanup: Remove the hover object if it exists
        if (sceneObject) {
            const hoverObj = sceneRef?.current?.getObjectByName("hover");
            if (hoverObj) {
                hoverObj.parent?.remove(hoverObj);
            }
        }

        // Update asset if position changes
        // const isInstancedProxySelection = Boolean(object?.object?.userData?.__instancedSelection);
        // if (dragObjectProperties?.position && editAssetId > 0 && sceneAssets[editAssetId] && !isInstancedProxySelection) {
        //    // UpdateAsset(null, editAssetId, null, dragObjectProperties);
        // }

        // Check if there's an object to clone
        if (object && object?.object.children.length > 0) {
            const { distance, interval } = dragObjectProperties;

            const noOfObjonXAxis = Math.floor(distance.x / (interval.x !== 0 ? interval.x * 2 : 1));
            const noOfObjonYAxis = Math.floor(distance.y / (interval.y !== 0 ? interval.y * 2 : 1));
            const noOfObjonZAxis = Math.floor(distance.z / (interval.z !== 0 ? interval.z * 2 : 1));

            // Keep only the original object as a base
            object.object.children = [object.object?.children[0]];

            const originalObj = object.object?.children[0];
            const addedObjects = [];

            // Full X * Y * Z grid
            for (let i = 0; i < noOfObjonXAxis; i++) {
                for (let j = 0; j < noOfObjonYAxis; j++) {
                    for (let k = 0; k < noOfObjonZAxis; k++) {
                        // Skip 0,0,0 to keep the original object
                        if (i === 0 && j === 0 && k === 0) continue;

                        const cloneObj = originalObj.clone();
                        cloneObj.position.set(
                            i * interval.x * 2,
                            j * interval.y * 2,
                            k * interval.z * 2
                        );
                        object.object.add(cloneObj);
                        addedObjects.push(cloneObj);
                    }
                }
            }
        }
    }, [isDragAssetDeleted, isDrag, dragObjectProperties]);



    // useEffect(() => {
    //     const sceneObject = sceneRef?.current?.getObjectByName("sceneObj");
    //
    //     // Cleanup: Remove the hover object if it exists
    //     if (sceneObject) {
    //         const hoverObj = sceneRef?.current?.getObjectByName("hover");
    //         if (hoverObj) {
    //             hoverObj.parent?.remove(hoverObj);
    //         }
    //     }
    //
    //     // Update asset if position changes
    //     if (dragObjectProperties?.position && editAssetId > 0 && sceneAssets[editAssetId]) {
    //         UpdateAsset(null, editAssetId, null, dragObjectProperties);
    //     }
    //
    //     // Check if there's an object to clone
    //     if (object && object?.object.children.length > 0) {
    //         const { distance, interval } = dragObjectProperties;
    //
    //         const noOfObjonXAxis = Math.floor(distance.x / (interval.x !== 0 ? interval.x * 2 : 1));
    //         const noOfObjonYAxis = Math.floor(distance.y / (interval.y !== 0 ? interval.y * 2 : 1));
    //         const noOfObjonZAxis = Math.floor(distance.z / (interval.z !== 0 ? interval.z * 2 : 1));
    //
    //         // Keep only the original object as a base
    //         object.object.children = [object.object?.children[0]];
    //
    //         const originalObj = object.object?.children[0];
    //         const addedObjects: THREE.Object3D[] = []; // Store references to cloned objects
    //
    //         // Add objects along the X-axis
    //         for (let i = 1; i < noOfObjonXAxis; i++) {
    //             const cloneObj = originalObj.clone();
    //             cloneObj.position.set(i * interval.x * 2, 0, 0); // Adjust X position
    //             object.object.add(cloneObj);
    //             addedObjects.push(cloneObj); // Track added object
    //         }
    //
    //         // Add objects along the Y-axis
    //         for (let i = 1; i < noOfObjonYAxis; i++) {
    //             const cloneObj = originalObj.clone();
    //             cloneObj.position.set(0, i * interval.y * 2, 0); // Adjust Y position
    //             object.object.add(cloneObj);
    //             addedObjects.push(cloneObj); // Track added object
    //         }
    //
    //         // Add objects along the Z-axis
    //         for (let i = 1; i < noOfObjonZAxis; i++) {
    //             const cloneObj = originalObj.clone();
    //             cloneObj.position.set(0, 0, i * interval.z * 2); // Adjust Z position
    //             object.object.add(cloneObj);
    //             addedObjects.push(cloneObj); // Track added object
    //         }
    //
    //     }
    //
    //
    // }, [isDragAssetDeleted, isDrag, dragObjectProperties]);




    return (
        <>
            {/*<ConfirmDialog />*/}
            {object && <UiController objectData={object} sceneRef={sceneRef} transformControlsRef={transformControlsRef} headless />}
        </>
    )


}
