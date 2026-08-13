import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";

import useGame from "../../hooks/useGame";
import AssetDescription from "../../components/popup/form/AssetDescription";
import * as THREE from "three";
// import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer";
// import {OutlinePass} from "three/examples/jsm/postprocessing/OutlinePass";
// import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass";
// import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass";
// import {OutputPass} from "three/examples/jsm/postprocessing/OutputPass";
// import {SMAAPass} from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { useGame1 } from "../../hooks/useGame1";
import { useSelector } from "react-redux";
import { Box3 } from "three";
import fetchAssetFields from "../../components/popup/form/FetchFields.jsx";
import { instanceMesh, sceneAssets, } from "../player/puzzle/character/Constants.jsx";

const isTransformControlReleaseClick = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    const state = window.__editorTransformControlsState;
    return Boolean(state?.dragging || Date.now() < (state?.suppressSceneSelectUntil || 0));
};

const isEditorInactive = () => {
    if (typeof document === 'undefined') {
        return false;
    }

    return document.body.classList.contains('is-editor-fullscreen')
        || document.documentElement.classList.contains('is-editor-fullscreen')
        || Boolean(document.querySelector('.editor-app-root.is-editor-fullscreen'));
};

const hasPendingTransformUpdate = () => Boolean(useGame.getState?.()?.hasUnsavedTransformUpdate);

const toNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getAssetTransformRotation = (assetTransform = {}) => {
    if (assetTransform?.quarternion) {
        const quaternion = new THREE.Quaternion(
            toNumber(assetTransform.quarternion.x ?? assetTransform.quarternion._x, 0),
            toNumber(assetTransform.quarternion.y ?? assetTransform.quarternion._y, 0),
            toNumber(assetTransform.quarternion.z ?? assetTransform.quarternion._z, 0),
            toNumber(assetTransform.quarternion.w ?? assetTransform.quarternion._w, 1)
        );
        return new THREE.Euler().setFromQuaternion(quaternion);
    }

    if (assetTransform?.rotation) {
        return new THREE.Euler(
            toNumber(assetTransform.rotation.x, 0),
            toNumber(assetTransform.rotation.y, THREE.MathUtils.degToRad(toNumber(assetTransform.angle, 0))),
            toNumber(assetTransform.rotation.z, 0)
        );
    }

    if (assetTransform?.object?.rotation) {
        return assetTransform.object.rotation.clone();
    }

    return new THREE.Euler(
        0,
        THREE.MathUtils.degToRad(toNumber(assetTransform?.angle, 0)),
        0
    );
};


// extend({EffectComposer, RenderPass, OutlinePass, ShaderPass});
export default function Events() {
    const { scene, mouse, raycaster, camera, gl, size } = useThree();
    const setScan = useGame((state) => state.setScan);
    const setSearchItem = useGame((state) => state.setSearchItem);
    const setScannedId = useGame((state) => state.setScannedId);
    const composer = useRef(null);
    const outlinePass = useRef(null);
    const selectedObjects = useRef([]);
    const clickedObjects = useRef([]);
    const playDoubleClickIntersections = useRef([]);
    const hover = useRef(false)
    // const [hover, setHover] = useState(false)
    const [isSearch, setIsSearch] = useState(false)
    const prevInstanceId = useRef(0)
    // const [prevInstanceId, setPrevInstanceId] = useState<number>(0);
    const isCameraMoving = useGame((state) => state.isCameraMoving);
    const setLocationId = useGame((state) => state.setLocationId);
    const setisProductsOpen = useGame((state) => state.setisProductsOpen);
    const curAnimation = useGame1((state) => state.curAnimation);
    const projectId = useGame((state) => state.projectID)
    const selectedLevel = useGame((state) => state.selectedLevel);
    const scannedId = useGame((state) => state.scannedId);
    const locationList = useGame((state) => state.locationList);
    const editing = useGame((state) => state.isEditing);
    const hasUnsavedTransformUpdate = useGame((state) => state.hasUnsavedTransformUpdate);
    const setEditAssetId = useGame((state) => state.setEditAssetId);
    const setEditProps = useGame((state) => state.setEditProps);
    const assetEdit = useGame((state) => state.assetEdit);
    const setAssetSelected = useGame((state) => state.setAssetSelected);
    const info = useSelector((state) => state.menu.info);
    const setEditable = useGame((state) => state.setEditable);
    const setEditPopup = useGame((state) => state.setEditPopup);
    const setSelectedAssetId = useGame((state) => state.setSelectedAssetId);
    const setSelectedAsset = useGame((state) => state.setSelectedAsset);
    const setSelectedDragObject = useGame((state) => state.setSelectedDragObject)
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance)
    const setPopupInfo = useGame((state) => state.setPopupInfo);
    const setPlayAssetInfoRequest = useGame((state) => state.setPlayAssetInfoRequest);
    const hideAssetProps = useGame((state) => state.hideAssetProps);
    const buttonMode = useGame((state) => state.buttonMode);
    const editorSelectionEnabled = useGame((state) => state.editorSelectionEnabled);
    const scan = useGame((state) => state.scan);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const isGizmoActive = useGame((state) => state.isGizmoActive);
    const editorInstanceSelectionRequest = useGame((state) => state.editorInstanceSelectionRequest);

    const getEditorScenePath = () => {
        const rawProjectId = String(projectId ?? '').trim();
        if (!rawProjectId || rawProjectId === '0') {
            return null;
        }

        if (/_L\d+$/i.test(rawProjectId)) {
            return `scenes/${rawProjectId}.json`;
        }

        const levelCode = Number.parseInt(String(selectedLevel?.code ?? 1), 10);
        const normalizedLevel = Number.isFinite(levelCode) ? Math.max(0, levelCode) : 1;
        return `scenes/${rawProjectId}_L${normalizedLevel}.json`;
    };

    const normalizeRotation = (rotation = 0) => {
        if (rotation && typeof rotation === 'object') {
            return {
                x: rotation.x || 0,
                y: rotation.y || 0,
                z: rotation.z || 0,
            };
        }

        return {
            x: 0,
            y: THREE.MathUtils.degToRad(rotation || 0),
            z: 0,
        };
    };

    const buildSelectedGameObject = (instanceId, name, position, rotation = 0, scale = { x: 1, y: 1, z: 1 }, apiObject = null) => ({
        name: name || String(instanceId),
        position: {
            x: position?.x || 0,
            y: position?.y || 0,
            z: position?.z || 0,
        },
        scale: {
            x: scale?.x || 1,
            y: scale?.y || 1,
            z: scale?.z || 1,
        },
        rotation: normalizeRotation(rotation),
        components: [
            {
                type: 'model',
                assetPath: name || String(instanceId),
            }
        ],
        source: {
            instanceId,
            apiObject,
        },
    });

    const selectEditorObject = (instanceId, name, position, rotation = 0, scale = { x: 1, y: 1, z: 1 }, apiObject = null, object = null, cleanKey = null) => {
        const scenePath = getEditorScenePath();
        if (!scenePath || !instanceId) {
            return;
        }

        const objectPosition = object?.position || position;
        const objectRotation = object?.rotation || rotation;
        const objectScale = object?.scale || scale;
        const gameObject = buildSelectedGameObject(instanceId, name, objectPosition, objectRotation, objectScale, apiObject);
        const selection = {
            instanceId,
            scenePath,
            object,
            gameObject,
            apiObject: apiObject || { instance_id: instanceId, name },
            cleanKey,
        };

        setSelectedEditorInstance(selection);

        window.dispatchEvent(new CustomEvent('editor-select-scene-object', {
            detail: {
                scenePath,
                gameObject,
                apiObject: selection.apiObject,
            },
        }));
    };

    const findSceneObjectByInstanceId = (instanceId) => {
        let found = null;
        const wantedId = String(instanceId);

        scene.traverse((object) => {
            if (found) {
                return;
            }

            const objectInstanceId = object?.userData?.instanceId ?? object?.userData?.instance_id ?? object?.userData?.device_id;
            if (objectInstanceId !== undefined && objectInstanceId !== null && String(objectInstanceId) === wantedId) {
                found = { object };
                return;
            }

            if (object?.isInstancedMesh && Array.isArray(object.userData?.instances)) {
                const instanceIndex = object.userData.instances.findIndex((item) => {
                    const itemId = item?.assetId ?? item?.instanceId ?? item?.instance_id ?? item?.id;
                    return itemId !== undefined && itemId !== null && String(itemId) === wantedId;
                });

                if (instanceIndex >= 0) {
                    found = {
                        object,
                        instanceIndex,
                        instanceInfo: object.userData.instances[instanceIndex],
                    };
                }
            }
        });

        return found;
    };

    const isEditorControlObject = (object) => {
        let current = object;
        while (current) {
            if (
                current.name === '__editorInstanceProxy' ||
                current.isTransformControlsRoot ||
                current.isTransformControlsGizmo ||
                current.isTransformControlsPlane
            ) {
                return true;
            }

            current = current.parent;
        }

        return false;
    };

    const getFirstSceneHit = (intersections = []) => (
        intersections.find((intersection) => !isEditorControlObject(intersection.object))
    );

    const openPlayAssetInfoFromHit = (hit) => {
        if (!hit) {
            return false;
        }

        let object = hit.object;
        let parentObject = object;
        while (parentObject && !(
            parentObject?.userData?.instanceId ||
            parentObject?.userData?.instance_id ||
            parentObject?.userData?.device_id ||
            parentObject?.isInstancedMesh
        )) {
            parentObject = parentObject.parent;
        }
        object = parentObject || object;
        const directInstanceId = object?.userData?.instanceId ?? object?.userData?.instance_id ?? object?.userData?.device_id;
        if (directInstanceId) {
            setPlayAssetInfoRequest({
                instanceId: directInstanceId,
                name: object?.userData?.name || object?.name,
                categoryIndex: object?.userData?.categoryIndex,
                assetID: object?.userData?.assetID || object?.userData?.assetId,
                requestKey: `${directInstanceId}-${Date.now()}`,
            });
            return true;
        }

        const fileName = object?.name;
        const instancedMesh = instanceMesh[fileName];
        const clickedInstance = hit.instanceId ?? -1;
        const instanceInfo = instancedMesh?.userData?.instances?.[clickedInstance] || object?.userData?.instance;
        const instanceId = instanceInfo?.assetId || instanceInfo?.assetID || instanceInfo?.instanceId || instanceInfo?.instance_id || instanceInfo?.id || instanceInfo?.key;

        if (!instanceId) {
            return false;
        }

        setPlayAssetInfoRequest({
            instanceId,
            name: instanceInfo?.name || fileName,
            instanceIndex: clickedInstance,
            categoryIndex: instanceInfo?.categoryIndex || instanceInfo?.category || instanceInfo?.assetObject?.categoryIndex,
            assetID: instanceInfo?.assetID || instanceInfo?.assetId,
            requestKey: `${instanceId}-${Date.now()}`,
        });
        return true;
    };

    const createInstancedSelectionProxy = (mesh, instanceIndex, instanceInfo = {}) => {
        if (!mesh?.isInstancedMesh || instanceIndex === undefined || instanceIndex < 0) {
            return null;
        }

        const previousProxy = scene.getObjectByName('__editorInstanceProxy');
        if (previousProxy) {
            window.dispatchEvent(new CustomEvent('editor-detach-transform-controls'));
            previousProxy.parent?.remove(previousProxy);
        }
        const instanceId = instanceInfo.assetId || instanceInfo.assetID || instanceInfo.instanceId || instanceInfo.instance_id || instanceInfo.id;
        const assetTransform = sceneAssets[instanceId];


        const proxy = new THREE.Object3D();
        proxy.name = '__editorInstanceProxy';
        proxy.userData = {
            ...mesh.userData,
            ...instanceInfo,
            name: instanceInfo.name || mesh.name,
            instanceId,
            __instancedSelection: {
                mesh,
                instanceIndex,
                instanceInfo,
            },
            axis: assetTransform?.axis,
            angle: assetTransform?.angle,
        };
        if (assetTransform?.position) {
            proxy.position.copy(assetTransform.position);
        }
        if (assetTransform?.scale) {
            proxy.scale.copy(assetTransform.scale);
        }
        proxy.rotation.copy(getAssetTransformRotation(assetTransform));
        proxy.updateMatrix();
        (mesh.parent || scene).add(proxy);
        proxy.updateMatrixWorld(true);

        return proxy;
    };

    /**
     * Check if inside keyboardcontrols
     */


    // useEffect(() => {
    //     if (!scene || !camera || !gl) return;
    //
    //     composer.current = new EffectComposer(gl);
    //     // Add passes to composer
    //     const transparentRenderPass = new RenderPass(scene, camera);
    //     transparentRenderPass.clear = true;
    //     composer.current.addPass(transparentRenderPass);
    //     outlinePass.current = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
    //
    //     outlinePass.current.visibleEdgeColor.set('#f31818');
    //     outlinePass.current.edgeStrength = 2
    //     outlinePass.current.edgeGlow = 0.2
    //     composer.current.addPass(outlinePass.current);
    //
    //     const smaaPass = new SMAAPass(size.width, size.height,);
    //     composer.current.addPass(smaaPass);
    //
    //     const outputPass = new OutputPass();
    //     composer.current.addPass(outputPass);
    //
    //
    //     return () => {
    //         if (composer.current) {
    //             composer.current.dispose();
    //             composer.current = null;
    //         }
    //     };
    // }, [gl, scene, camera]);

    useEffect(() => {

        if (isPuzzleGame) return

        // outlinePass.current.selectedObjects =[]
        if (sceneAssets[scannedId]) {
            const { object, position, angle } = sceneAssets[scannedId];
            object.name = 'hover';
            object.position.copy(position);
            object.rotation.y = THREE.MathUtils.degToRad(angle);
            setIsSearch(true)
            scene.add(object);
            // outlinePass.current.selectedObjects = [object]
        }
        else if (locationList[scannedId]) {
            const { box, position } = locationList[scannedId];
            box.name = 'hover';
            const cPosition = position.clone()
            const cBox = box.clone()
            cBox.scale.multiplyScalar(0.01)
            cPosition.multiplyScalar(0.01)
            cBox.position.copy(cPosition);
            cBox.position.y -= 0.25
            setIsSearch(true)
            scene.add(cBox);
            // outlinePass.current.selectedObjects = [cBox]
        }


        const timer = setTimeout(() => {
            setIsSearch(false);
        }, 9000);
        // Cleanup the timer if component unmounts or scannedId changes
        return () => {
            clearTimeout(timer)
            // outlinePass.current.selectedObjects =[]
        };
    }, [scannedId, isPuzzleGame]);

    useEffect(() => {
        if (!editorInstanceSelectionRequest?.instanceId || buttonMode === 'Play mode') {
            return;
        }

        const selectionTarget = findSceneObjectByInstanceId(editorInstanceSelectionRequest.instanceId);
        if (!selectionTarget?.object) {
            return;
        }

        const targetObject = selectionTarget.object;
        const resolvedObject = targetObject.isInstancedMesh
            ? createInstancedSelectionProxy(
                targetObject,
                selectionTarget.instanceIndex
                ?? targetObject.userData?.keyToIndex?.[editorInstanceSelectionRequest.instanceId]
                ?? targetObject.userData?.instances?.findIndex?.((item) => String(item?.assetId || item?.instanceId || item?.instance_id) === String(editorInstanceSelectionRequest.instanceId)),
                selectionTarget.instanceInfo || editorInstanceSelectionRequest.apiObject || {}
            )
            : targetObject;

        if (!resolvedObject) {
            return;
        }

        const position = new THREE.Vector3();
        resolvedObject.getWorldPosition(position);
        const angle = THREE.MathUtils.radToDeg(resolvedObject.rotation.y || 0);
        const name = resolvedObject.userData?.name || resolvedObject.name || editorInstanceSelectionRequest.name;
        const instanceId = editorInstanceSelectionRequest.instanceId;

        setSelectedDragObject(resolvedObject);
        setEditProps({
            name,
            position,
            angle,
            obj: resolvedObject,
            categoryIndex: resolvedObject?.userData?.categoryIndex || 0,
            assetID: resolvedObject?.userData?.assetID || resolvedObject?.userData?.assetId || editorInstanceSelectionRequest.apiObject?.AssetID,
            template_id: resolvedObject?.userData?.template_id || editorInstanceSelectionRequest.category?.template_id,
        });
        setEditAssetId(Number.parseInt(String(instanceId), 10));

        selectEditorObject(
            instanceId,
            name,
            position,
            angle,
            resolvedObject.scale,
            editorInstanceSelectionRequest.apiObject || resolvedObject.userData,
            resolvedObject
        );
    }, [editorInstanceSelectionRequest, buttonMode, scene]);

    // useFrame(() => {
    //     if ((hover.current || clickedObjects?.current.length>0 || isSearch ) && !category && composer.current  && !isCameraMoving && curAnimation === 'Idle' && editAssetId==0 && info) {
    //
    //         composer.current.render();
    //     }
    // },1);
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

    function setMaterialColor(object, hexColor) {
        // Ensure the hexColor is valid (e.g., "#FF0000")
        if (!hexColor || typeof hexColor !== 'string') {
            console.warn('Invalid hex color provided:', hexColor);
            return;
        }

        // Helper function to update a single material's color
        const updateMaterial = (material) => {
            const materialClone = material.clone()

            if (materialClone && materialClone.color) {

                materialClone.color.set(hexColor);

            }
            return materialClone
        };

        // Check if the object has a material or materials
        if (object.material) {
            // Case 1: Single material
            if (!Array.isArray(object.material)) {
                object.material = updateMaterial(object.material);
            }
            // Case 2: Array of materials
            else {

                object.material = object.material.map(updateMaterial);
            }
        }

        // Recursively process children
        if (object.children && object.children.length > 0) {
            object.children.forEach((child) => setMaterialColor(child, hexColor));
        }
    }

    useEffect(() => {

        if (isPuzzleGame) return

        if (isEditorInactive()) {
            const onPlayModeDoubleClick = (event) => {
                event.preventDefault();
                event.stopPropagation?.();
                event.stopImmediatePropagation?.();
                const rect = gl.domElement.getBoundingClientRect();
                mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                raycaster.setFromCamera(mouse, camera);
                const intersectInstance = playDoubleClickIntersections.current;
                intersectInstance.length = 0;
                raycaster.intersectObjects(scene.children, true, intersectInstance);
                const hit = getFirstSceneHit(intersectInstance);
                openPlayAssetInfoFromHit(hit);
            };

            const docs1 = document.getElementsByClassName('canvas-element');
            if (docs1[0]) {
                docs1[0].addEventListener("dblclick", onPlayModeDoubleClick, true);
            }

            return () => {
                if (docs1[0]) {
                    docs1[0].removeEventListener("dblclick", onPlayModeDoubleClick, true);
                }
            };
        }

        const onMouseHover = (event) => {

            if (isGizmoActive) {
                return;
            }
            const { instanceId, isHidden } = hideAssetProps
            const setCursor = (cursor) => {
                gl.domElement.style.cursor = cursor;
            };

            const showPopup = (instanceId, objProps, obj) => {
                const assetDescription = document.getElementById('assetDescription');
                if (assetDescription) {
                    assetDescription.remove();
                    hover.current = false
                }
                const preObj = scene.getObjectByName('hover');

                if (preObj) {
                    preObj.parent?.remove(preObj);
                }

                if (objProps == null && sceneAssets[instanceId] == null) {
                    return;
                }
                // const mName = sceneAssets[instanceId]?.name
                // console.log(instanceId)
                const { object, position, angle, halfHeight, name, categoryIndex, statusFieldId, inUse } = objProps ?? sceneAssets[instanceId];


                if (info) {
                    const labelPosition = new THREE.Vector3(position.x, position.y + (halfHeight) / 100, position.z);
                    labelPosition.project(camera);
                    const left = (labelPosition.x * 0.5 + 0.5) * window.innerWidth;
                    const top = -(labelPosition.y * 0.5 - 0.5) * window.innerHeight;

                    const mousePosition = { x: left, y: top };
                    AssetDescription(mousePosition, size, projectId, setEditAssetId, instanceId, true, name, setEditPopup, setEditable, setSelectedAssetId,
                        setSelectedAsset, setPopupInfo, mouse, gl, categoryIndex, statusFieldId, inUse);
                    setEditProps({ name, position, angle, obj })
                }


                if (object == undefined)
                    return;

                object.name = 'hover';
                object.position.copy(position);
                object.rotation.y = THREE.MathUtils.degToRad(angle);
                hover.current = true;

                setMaterialColor(object, 'rgba(186,185,185,0.45)');
                scene.add(object);
                prevInstanceId.current = instanceId
            }

            if (curAnimation !== 'Idle' || isCameraMoving || isSearch) {
                return;
            }

            event.preventDefault();
            // orbitControls.current?.addEventListener('change', regress)
            raycaster?.setFromCamera(mouse, camera);

            const intersectInstance = raycaster?.intersectObjects(scene.children);

            let fileName = null;

            if (intersectInstance.length > 0) {
                let ObjectStructure = getFirstSceneHit(intersectInstance);
                if (!ObjectStructure) {
                    return;
                }


                if (ObjectStructure.object.type === 'SkinnedMesh') {
                    ObjectStructure = intersectInstance[1];

                    if (!ObjectStructure) return;
                }
                const clickedInstance = ObjectStructure.instanceId || -1;

                fileName = ObjectStructure.object.name;

                const instancedMesh = instanceMesh[fileName];

                const lInstanceId = ObjectStructure.object?.userData.instanceId

                if (lInstanceId > 0) {

                    setCursor('pointer');

                    const position = new THREE.Vector3();
                    ObjectStructure.object.getWorldPosition(position);

                    const name = ObjectStructure.object?.userData.name
                    const angle = THREE.MathUtils.radToDeg(ObjectStructure.object.rotation.y)
                    const halfLength = getLength(ObjectStructure.object)
                    const halfHeight = getHeight(ObjectStructure.object)
                    const halfWidth = getWidth(ObjectStructure.object)

                    // position.x-= halfWidth
                    position.y += halfHeight
                    // position.z-= halfLength
                    const objProps = {
                        position,
                        angle,
                        halfLength,
                        halfHeight,
                        halfWidth,
                        name
                    }

                    showPopup(lInstanceId, objProps, ObjectStructure.object)
                    return;
                }

                if (instancedMesh == undefined) {
                    prevInstanceId.current = 0
                    // setPrevInstanceId(0);


                    // if (info) {
                    const assetDescription = document.getElementById('assetDescription');
                    if (assetDescription) {
                        assetDescription.remove();
                        // selectedObjects.current = [];
                        hover.current = false
                        // setHover(false)
                    }
                    // }

                    const obj = scene.getObjectByName('hover');
                    if (obj) {
                        obj.parent?.remove(obj);
                        // selectedObjects.current = [];
                    }
                    setPopupInfo({ visible: false })
                    if (!clickedInstance)
                        setCursor('default');

                    return;
                }

                const instanceInfo = instancedMesh.userData.instances[clickedInstance];

                if (!instanceInfo || instanceInfo.assetId === prevInstanceId) {
                    if (!instanceInfo) {
                        setCursor('default');
                    }
                    return;
                }

                if (parseInt(fileName) > 0) {
                    prevInstanceId.current = 0
                    // setPrevInstanceId(0);
                    // if (info) {
                    const assetDescription = document.getElementById('assetDescription');
                    if (assetDescription) {
                        assetDescription.remove();
                        // selectedObjects.current = [];
                        hover.current = false;
                        // setHover(false)
                    }
                    // }
                    const obj = scene.getObjectByName('hover');
                    if (obj) {
                        obj.parent?.remove(obj);
                        // selectedObjects.current = [];
                    }
                    setPopupInfo({ visible: false })
                    setCursor('default');
                    return;
                }

                if (fileName) {
                    if (fileName === 'walls') {
                        prevInstanceId.current = 0
                        // if (info) {
                        const assetDescription = document.getElementById('assetDescription');
                        if (assetDescription) {
                            assetDescription.remove();
                            selectedObjects.current = [];
                            hover.current = false
                            // setHover(false)
                        }
                        // }
                        const obj = scene.getObjectByName('hover');
                        if (obj) {
                            obj.parent?.remove(obj);
                        }
                        // selectedObjects.current = [];
                        setCursor('default');
                        setPopupInfo({ visible: false })
                        return;
                    }

                    if (!instancedMesh) {
                        // if (info) {
                        const assetDescription = document.getElementById('assetDescription');
                        if (assetDescription) {
                            assetDescription.remove();
                            // selectedObjects.current = [];
                            setPopupInfo({ visible: false })
                            hover.current = false
                            // setHover(false)
                        }
                        // }
                        const obj = scene.getObjectByName('hover');
                        if (obj) {
                            obj.parent?.remove(obj);
                        }
                        // selectedObjects.current = [];
                        setCursor('default');
                        setPopupInfo({ visible: false })
                        return;
                    }

                    setCursor('pointer');

                    if (!isHidden && instanceId != instanceInfo.assetId) {
                        showPopup(instanceInfo.assetId, null, null)
                    }
                } else {
                    // if (info) {
                    const assetDescription = document.getElementById('assetDescription');
                    if (assetDescription) {
                        assetDescription.remove();
                        // selectedObjects.current = [];
                        hover.current = false
                        // setHover(false)
                    }
                    prevInstanceId.current = 0
                    setPopupInfo({ visible: false })
                    //  }
                    const obj = scene.getObjectByName('hover');
                    if (obj) {
                        obj.parent?.remove(obj);
                    }
                    setCursor('default');
                    // selectedObjects.current = [];
                    // outlinePass.current.selectedObjects = selectedObjects.current;
                }
            } else {
                // if (info) {
                const assetDescription = document.getElementById('assetDescription');
                if (assetDescription) {
                    assetDescription.remove();
                    // selectedObjects.current = [];
                    hover.current = false;
                    // setHover(false)
                    setPopupInfo({ visible: false })
                }
                const obj = scene.getObjectByName('hover');
                if (obj) {
                    obj.parent?.remove(obj);
                }
                setCursor('default');
                // }
                prevInstanceId.current = 0
                // selectedObjects.current = [];
                // outlinePass.current.selectedObjects = selectedObjects.current;
            }
        };

        const onMouseClick = (event, allowReadOnlyOpen = false) => {
          
             if (isTransformControlReleaseClick()) {
                event.preventDefault();
                event.stopPropagation?.();
                return;
            }

     
           
          
         
            if (buttonMode === 'Play mode' || (!editorSelectionEnabled && !allowReadOnlyOpen)) {
                return;
            }
             
            event.preventDefault();
            raycaster.setFromCamera(mouse, camera);


            const intersectInstance = raycaster.intersectObjects(scene.children);
            let fileName = null;
             
            if (intersectInstance.length > 0) {

                let ObjectStructure = getFirstSceneHit(intersectInstance);
           
                if (!ObjectStructure) {
                    return;
                }

                if (ObjectStructure.object.type === 'SkinnedMesh') {
                    ObjectStructure = intersectInstance[1];
                    if (!ObjectStructure) return;
                }
                fileName = ObjectStructure.object.name;


                const clickedInstance = ObjectStructure.instanceId ?? -1;

                if (fileName) {
                    if (fileName === 'walls') {
                        return;
                    }


                    const instanceId = ObjectStructure.object?.userData.instanceId

                    const name = ObjectStructure.object?.userData.name || ObjectStructure.object?.name
                    const selectedSceneObject = sceneAssets[instanceId]?.object || ObjectStructure.object;
                 
                    if (instanceId > 0) {
                        if (editing && hasPendingTransformUpdate()) {
                            setAssetSelected(true)
                            return;
                        }

                        if (selectedSceneObject) {
                            setSelectedDragObject(selectedSceneObject)
                        }

                        const selectClickedObject = () => {
                            const position = new THREE.Vector3();
                            selectedSceneObject.getWorldPosition(position);


                            setEditProps({
                                name,
                                position,
                                angle: selectedSceneObject.rotation.y || 0,
                                obj: selectedSceneObject,
                                categoryIndex: selectedSceneObject?.userData?.categoryIndex,
                                assetID: selectedSceneObject?.userData?.assetID || selectedSceneObject?.userData?.assetId,
                                template_id: selectedSceneObject?.userData?.template_id,
                            });
                            setEditAssetId(instanceId);
                            selectEditorObject(
                                instanceId,
                                name,
                                position,
                                selectedSceneObject.rotation,
                                selectedSceneObject.scale,
                                selectedSceneObject.userData,
                                selectedSceneObject
                            );

                            fetchAssetFields(instanceId, name, setEditPopup, setEditable, setSelectedAssetId, setSelectedAsset, false)
                        };


                        selectClickedObject();
                        // setScannedId(`${instanceId}_click`)
                        // setScan(!scan)
                        // setSearchItem({noZoom: true})
                        return;
                    }


                    // if(ObjectStructure?.object?.userData?.instances &&
                    //     ObjectStructure?.object?.userData?.instances[clickedInstance] &&
                    //     ObjectStructure?.object?.userData?.instances[clickedInstance].data
                    //  ){

                    //     // clickedObjects.current = [];
                    //     const cObj = scene.getObjectByName('click');
                    //     if (cObj) {
                    //         cObj.parent?.remove(cObj);
                    //     }
                    //     const data = ObjectStructure?.object?.userData?.instances[clickedInstance].data
                    //     const obj =  ObjectStructure?.object?.userData?.object.clone()

                    //     setLocationId(data.locationId)

                    //     setisProductsOpen(true)
                    //     obj.name = 'click';
                    //     const position = data.position.clone()
                    //     obj.position.copy(position.multiplyScalar(0.01));
                    //     obj.position.y -= 0.25
                    //     obj.scale.multiplyScalar(0.01)
                    //     clickedObjects.current = [obj];
                    //     outlinePass.current.selectedObjects = clickedObjects.current;
                    //     scene.add(obj);

                    //     return;
                    // }
                    setisProductsOpen(false)
                    const instancedMesh = instanceMesh[fileName];

                    if (!instancedMesh) {
                        // gl.domElement.style.cursor = 'default';
                        return;
                    }

                    let instanceInfo = instancedMesh.userData.instances[clickedInstance];


                    if (!instanceInfo) {
                        instanceInfo = ObjectStructure.object.userData.instance;
                    }


                    if (!instanceInfo) {
                        return;
                    }
                    const selectClickedInstance = () => {
                        const instanceProxy = createInstancedSelectionProxy(ObjectStructure.object, clickedInstance, instanceInfo);

                        if (!instanceProxy) {
                            return;
                        }
                        const proxyPosition = instanceProxy.position.clone();
                        const proxyRotation = instanceProxy.rotation.clone();
                        const proxyScale = instanceProxy.scale.clone();

                        setEditProps({
                            name: instanceInfo.name || fileName,
                            position: proxyPosition,
                            angle: proxyRotation.y || 0,
                            obj: instanceProxy,
                            categoryIndex: instanceInfo.categoryIndex || instanceInfo.category || instanceInfo.assetObject?.categoryIndex || 0,
                            assetID: instanceInfo.assetId,
                        });
                        setEditAssetId(instanceInfo.assetId);

                        selectEditorObject(
                            instanceInfo.assetId,
                            instanceInfo.name || fileName,
                            proxyPosition,
                            proxyRotation,
                            proxyScale,
                            sceneAssets[instanceInfo.assetId]?.instanceData?.assetObject || instanceInfo,
                            instanceProxy,
                            instanceInfo.cleanKey
                        );
                        setSelectedAssetId(instanceInfo.assetId)
                        setScannedId(`${instanceInfo.assetId}_click`)

                        setScan(!scan)
                        setSearchItem({ noZoom: true })
                    };
                    if (editing && hasPendingTransformUpdate()) {
                        setAssetSelected(true)
                        return;
                    }
                    selectClickedInstance();


                }
            }
        };

        const docs = document.getElementsByClassName('canvas-element')
        const onMouseDoubleClick = (event) => onMouseClick(event, true);


        if (docs[0]) {
            docs[0].addEventListener("click", onMouseClick);
            docs[0].addEventListener("dblclick", onMouseDoubleClick);
        }
        // gl.domElement.addEventListener('mousemove', onMouseHover);
        // gl.domElement.addEventListener('dblclick', onMouseClick);

        return () => {
            if (docs[0]) {
                docs[0].removeEventListener('click', onMouseClick);
                docs[0].removeEventListener('dblclick', onMouseDoubleClick);
            }
            // gl.domElement.removeEventListener('mousemove', onMouseHover);
            // gl.domElement.removeEventListener('dblclick', onMouseClick);

        };
    }, [gl.domElement, editing, hasUnsavedTransformUpdate, curAnimation, isCameraMoving, isSearch, assetEdit, info, scene, hideAssetProps, projectId, buttonMode, editorSelectionEnabled, scan, isPuzzleGame]);

    useEffect(() => {
        if (isCameraMoving || curAnimation !== 'Idle' || !info) {
            const assetDescription = document.getElementById('assetDescription');
            if (assetDescription) {
                assetDescription.remove();
                hover.current = false
                // selectedObjects.current = [];
                // setHover(false)
            }
        }
    }, [isCameraMoving, curAnimation, info]);

    return null;
}
