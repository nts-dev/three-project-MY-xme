import React, { Fragment, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Vector3 } from "three";
import useGame from "../hooks/useGame";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { useThree } from "@react-three/fiber";
import database from '../database';
import { Q } from '@nozbe/watermelondb';
import R3fInstancePattern from "./r3fInstancePattern";
import InfiniteWorldRenderer from "./infiniteWorld/InfiniteWorldRenderer";

import Chessboard from "./ChessBoard";
import LevelChessBoard from "./LevelChessBoard";
import CharacterAnimation from "./player/puzzle/character/CharacterAnimation";
import SaveFromTemplate from "../components/popup/form/SaveFromTemplate";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import EditAsset from "./EditAsset";
import Plane from "../shaders/Plane";
import { socket } from "../socket.js";
import { objects, sceneAssets, floors, locationPoints, instanceMesh, apiData, assetCommands, categoryCommands } from "./player/puzzle/character/Constants.jsx";
import { hydrateSceneCategoriesWithDbAnimations } from "./gamePathAnimationSource";
import { normalizeSceneAssetName } from "./generatedAssetPaths";
import SceneFog from "./environment/SceneFog";
import {
    clearFallLandingTilePositions,
    clearLandingTilePositions,
} from "./infiniteWorld/landingTileStore";

const DSL_SCENE_COMMAND_APPLIED = "dsl-scene-command-applied";




export function GameExperience({ world, orbitControls, client }) {
    const categoriesCollection = database.collections.get('categories');
    const assetsCollection = database.collections.get('assets');
    const fieldsCollection = database.collections.get('fields');
    const BranchCollection = database.collections.get('branches');
    const RoomsCollection = database.collections.get('rooms');
    const projectId = useGame((state) => state.projectID)
    const checkReload = useGame((state) => state.checkReload);
    const setBranch = useGame((state) => state.setBranch);
    const setProjectSceneData = useGame((state) => state.setProjectSceneData);
    const { scene, camera } = useThree()
    const [data, setData] = useState([])
    // const setPackageControl = useGame((state) => state.setPackageControl);
    // const setShowBdims = useGame((state) => state.setShowBdims);
    // const setShowFdims = useGame((state) => state.setShowFdims);
    // const setShowOdims = useGame((state) => state.setShowOdims);

    // const setEditPopup = useGame((state) => state.setEditPopup);
    // const setWallsOpacity = useGame((state) => state.setWallsOpacity)
    const setSearchCenter = useGame((state) => state.setSearchCenter);
    const animatedTextures = useRef([])
    // const setCategory = useGame((state) => state.setCategory);
    const [sceneData, setSceneData] = useState([])
    // const dataObject = useRef([])
    const setLazy = useGame((state) => state.setLazy)
    const setForwardOnly = useGame((state) => state.setForwardOnly)
    const isMobile = useMemo(() => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent), []);

    const setToolBarHidden = useGame((state) => state.setToolBarHidden);
    const gameInstances = useGame((state) => state.gameInstances)
    const setDefaultInstanceId = useGame((state) => state.setDefaultInstanceId);
    const defaultInstanceId = useGame((state) => state.defaultInstanceId);
    const rotationValue = useGame((state) => state.rotationValue);
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    // const setGameInstances = useGame((state) => state.setGameInstances);
    const assetName = useGame((state) => state.assetName);
    const dragObjectProperties = useGame((state) => state.dragObjectProperties);
    const animationRef = useGame((state) => state.animationRef);
    const uName = useGame((state) => state.uName);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const dslSceneCommand = useGame((state) => state.dslSceneCommand);
    const dslSceneCommandTick = useGame((state) => state.dslSceneCommandTick);
    const clearDslSceneCommand = useGame((state) => state.clearDslSceneCommand);
  

    const nameSet = useMemo(() => new Set(), []);
    const templateAssetProps = useGame((state) => state.templateAssetProps);
    const setSelectedAssetId = useGame((state) => state.setSelectedAssetId);
    const vAlignValue = useGame((state) => state.vAlignValue);

    const setTerminalMessage = useGame((state) => state.setTerminalMessage);
    const setIsLoaded = useGame((state) => state.setIsLoaded);
    const setTokenCode = useGame((state) => state.setTokenCode);
    const originalTokenCode = useGame((state) => state.tokenCode);
    const setCheckReload = useGame((state) => state.setCheckReload);
     const buttonMode = useGame((state) => state.buttonMode);
    const setClientId = useGame((state) => state.setClientId);
    const setSelectedAssetName = useGame((state) => state.setSelectedAssetName);
    // const reqRef = useRef(0);
    const didRun = useRef(false);
    const reloadTimes = useRef(0)
    // const projectLoadTokenRef = useRef(0);
    const remoteLoadTokenRef = useRef(0);
    const modelLoadTokenRef = useRef(0);
    const dataRef = useRef([]);
    const sceneSignatureRef = useRef("");
    const lastAppliedDslCommandRef = useRef("");
    const commandOverlayCategoriesRef = useRef([]);
    const previousButtonModeRef = useRef(buttonMode);
    // const materialsMap = useMemo(() => new Map(), []);
    // const textureLoader = useMemo(() => new THREE.TextureLoader(), []);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        const previousMode = previousButtonModeRef.current;
        previousButtonModeRef.current = buttonMode;

        if (previousMode !== "Play mode" || buttonMode !== "Edit Mode") {
            return;
        }

        const resetEditorCamera = () => {
            camera.position.set(1, 5, 10);
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();

            const controls = orbitControls?.current;
            if (controls) {
                controls.target.set(0, 0, 0);
                controls.update();
            }
        };

        resetEditorCamera();
        requestAnimationFrame(resetEditorCamera);
    }, [buttonMode, camera, orbitControls]);

    useLayoutEffect(() => {
        remoteLoadTokenRef.current += 1;
        modelLoadTokenRef.current += 1;
        const previousData = dataRef.current || [];
        previousData.forEach((item) => disposeObject3D(item?.fbx));
        sceneSignatureRef.current = "";
        commandOverlayCategoriesRef.current = [];
        categoryCommands.current = [];
        assetCommands.current = "";
        apiData.current = {};
        dataRef.current = [];
        nameSet.clear();

        setSceneData([]);
        setData([]);
        setIsLoaded(false);
        clearLandingTilePositions();
        clearFallLandingTilePositions();
        cleanupSceneAssets(sceneAssets);
        cleanupSceneAssets(objects);

        if (objects.length) objects.splice(0, objects.length);
        if (floors.length) floors.splice(0, floors.length);
        if (locationPoints.length) locationPoints.splice(0, locationPoints.length);
        if (instanceMesh.length) instanceMesh.splice(0, instanceMesh.length);

        useGame.setState({
            gameInstances: {},
            instanceData: [],
            instanceDataList: [],
            removedObject: {},
        });
    }, [projectId, nameSet, setIsLoaded]);

    const getAssetInstanceId = (asset) =>
        asset?._raw?.instance_id || asset?.instanceId || asset?.instance_id || "";

    const buildAssetsSignature = (assets = []) => {
        const parts = [];
        for (const asset of assets) {
            const fields = asset?.fields || {};
            parts.push(
                `${getAssetInstanceId(asset)}:${fields["X-pos"]?.value ?? ""}:${fields["Y-pos"]?.value ?? ""}:${fields["Z-pos"]?.value ?? ""}:${fields["Angle"]?.value ?? ""}:${fields["Color"]?.value ?? ""}:${fields["Width"]?.value ?? ""}:${fields["Height"]?.value ?? ""}:${fields["Length"]?.value ?? ""}:${fields["v-align"]?.value ?? ""}`
            );
        }
        return parts.join("|");
    };

    const parseProperties = (value) => {
        if (!value) return {};
        if (typeof value === "string") {
            try {
                return JSON.parse(value);
            } catch {
                return {};
            }
        }
        return typeof value === "object" ? value : {};
    };

    const buildSceneSignature = (categories = []) => {
        const parts = [];
        for (const item of categories) {
            const category = item?._raw ? item._raw : item;
            const fbx = category?.fbx || "";
            const cleanKey = fbx.replace(/\s+/g, "").replace(/\.fbx$/i, "");
            const properties = parseProperties(category?.properties);
            const animationSignature = JSON.stringify(properties.dslAnimations || []);
            const assetsObj = item?.assets || {};
            const arrayOfObjects = Object.entries(assetsObj).map(([key, value]) => ({
                key,
                ...value,
            }));
            parts.push(`${cleanKey}:${arrayOfObjects.length}:${buildAssetsSignature(arrayOfObjects)}:${animationSignature}`);
        }
        return parts.join("||");
    };

    const getCategoryRaw = (category) => category?._raw || category || {};

    const getCategoryIdentity = (category, fallbackIndex = "") => {
        const raw = getCategoryRaw(category);
        return String(
            raw?.category_index
            || raw?.category_id
            || raw?.id
            || raw?.asset_id
            || raw?.name
            || fallbackIndex
        ).replace(/[^a-zA-Z0-9_-]/g, "_");
    };

    const getCategoryKey = (category) => {
        const raw = getCategoryRaw(category);
        const fbx = String(raw?.fbx || raw?.name || "").replace(/\s+/g, "").replace(/\.(fbx|glb|gltf)$/i, "").toLowerCase();
        const categoryId = raw?.category_index || raw?.category_id || raw?.id || raw?.asset_id || raw?.name || fbx;
        return `${String(categoryId).trim().toLowerCase()}::${fbx}`;
    };

    const mergeSceneData = (baseData, overlayData) => {
        if (!Array.isArray(overlayData?.categories) || !overlayData.categories.length) {
            return baseData || { categories: [] };
        }

        const nextData = { ...(baseData || { categories: [] }) };
        const categories = Array.isArray(nextData.categories) ? [...nextData.categories] : [];
        const categoryIndexByKey = new Map(categories.map((category, index) => [getCategoryKey(category), index]));

        overlayData.categories.forEach((overlayCategory) => {
            const overlayKey = getCategoryKey(overlayCategory);
            const categoryIndex = categoryIndexByKey.get(overlayKey);
            if (categoryIndex === undefined) {
                categories.push(JSON.parse(JSON.stringify(overlayCategory)));
                categoryIndexByKey.set(overlayKey, categories.length - 1);
                return;
            }

            const category = { ...categories[categoryIndex] };
            const assetsAreArray = Array.isArray(category.assets);
            const currentAssets = assetsAreArray ? [...category.assets] : { ...(category.assets || {}) };
            const overlayAssets = Array.isArray(overlayCategory.assets)
                ? overlayCategory.assets
                : Object.values(overlayCategory.assets || {});

            if (assetsAreArray) {
                category.assets = [...currentAssets, ...overlayAssets];
            } else {
                category.assets = { ...currentAssets };
                overlayAssets.forEach((asset) => {
                    const assetId = getAssetInstanceId(asset);
                    if (assetId) category.assets[assetId] = asset;
                });
            }

            const instances = Array.isArray(category.instances) ? category.instances : [];
            const overlayInstances = Array.isArray(overlayCategory.instances) ? overlayCategory.instances : [];
            category.instances = [...new Set([...instances, ...overlayInstances])];
            categories[categoryIndex] = category;
        });

        nextData.categories = categories;
        return nextData;
    };

    const rememberCommandOverlays = (categories = []) => {
        const overlays = categories.filter((category) => Boolean(getCategoryRaw(category).commandOverlay));
        if (!overlays.length) {
            return;
        }

        const next = [...commandOverlayCategoriesRef.current];
        const indexByKey = new Map(next.map((category, index) => [getCategoryKey(category), index]));
        overlays.forEach((category) => {
            const cloned = JSON.parse(JSON.stringify(category));
            const key = getCategoryKey(cloned);
            const existingIndex = indexByKey.get(key);
            if (existingIndex === undefined) {
                next.push(cloned);
                indexByKey.set(key, next.length - 1);
            } else {
                next[existingIndex] = cloned;
            }
        });
        commandOverlayCategoriesRef.current = next;
    };

    const withCommandOverlays = (categories = []) => {
        const overlays = commandOverlayCategoriesRef.current;
        if (!overlays.length) {
            return categories;
        }

        return mergeSceneData(
            { categories: Array.isArray(categories) ? categories : [] },
            { categories: overlays }
        ).categories;
    };


    function setClientFn(clientId) {

        setClientId(clientId)
        socket.emit("playerRank")

    }

    useEffect(() => {

        if (!String(uName || "").trim()) {
            return
        }
       
        socket.emit('login', { userName: uName, gameId: projectId });
        socket.emit("playerRank")

        socket.on('tokenCode', ({ tokenCode }) => {
            if (tokenCode) {
                setTokenCode({ id: tokenCode.id, code: originalTokenCode.code, color: originalTokenCode.color, codeValue: tokenCode })

            }

        })
        socket.on('clientId', setClientFn);
        return () => {
            socket.off('login')
            socket.off('clientId', setClientFn);
        }
    }, [uName]);

    useEffect(() => {

        const updateSceneRemotely = ({ data, dslProjectId }) => {

            if (dslProjectId !== projectId) {
                return
            }
            // setSelectedAssetName(null)
            setSelectedAssetId(null)
            cleanupSceneAssets(sceneAssets);
            cleanupSceneAssets(objects);

            if (data) {
                // apiData.current = data
                // const cats = data?.categories ?? [];
                // setSceneData(cats);
                reloadTimes.current++

                setCheckReload(reloadTimes.current)

            }

        }


        socket.on('updateScene', updateSceneRemotely)

        return () => {

            socket.off('updateScene', updateSceneRemotely);
        }
    }, []);

    const applyDslSceneCommand = (command, triggerSource = "store") => {
        if (!command?.data && !command?.delta?.category) {
            return;
        }

        const commandId = command.commandId || `${command.projectId}:${command.assetId || ""}:${command.createdAt || ""}`;
        if (commandId && lastAppliedDslCommandRef.current === commandId) {
            return;
        }
        lastAppliedDslCommandRef.current = commandId;

        const incomingKey = String(command.projectId || "");
        const incomingBaseKey = incomingKey.replace(/_L\d+$/i, "");
        const activeKey = String(projectId || "");
        if (incomingKey && incomingKey !== activeKey && incomingBaseKey !== activeKey) {
            return;
        }

        const commandData = command.data || (command.delta?.category ? { categories: [command.delta.category] } : { categories: [] });
        apiData.current = mergeSceneData(apiData.current, commandData);

        const commandCategories = Array.isArray(commandData.categories) ? commandData.categories : [];
        if (!commandCategories.length) {
            return;
        }
        rememberCommandOverlays(commandCategories);

        setSceneData((current) => {
            const next = Array.isArray(current) ? [...current] : [];
            const indexByKey = new Map(next.map((category, index) => [getCategoryKey(category), index]));

            commandCategories.forEach((category) => {
                const key = getCategoryKey(category);
                const commandOverlay = Boolean(getCategoryRaw(category).commandOverlay);
                const existingIndex = commandOverlay ? undefined : indexByKey.get(key);
                const cloned = JSON.parse(JSON.stringify(category));

                if (existingIndex === undefined) {
                    next.push(cloned);
                    indexByKey.set(key, next.length - 1);
                } else {
                    next[existingIndex] = cloned;
                }
            });

            sceneSignatureRef.current = buildSceneSignature(next);
            return next;
        });

        setLazy(false);
        clearDslSceneCommand?.();
    };

    useEffect(() => {
        if (!dslSceneCommand?.data) {
            return;
        }
        applyDslSceneCommand(dslSceneCommand, "store");
    }, [dslSceneCommandTick]);

    useEffect(() => {
        const handleDslSceneCommand = (event) => {
            applyDslSceneCommand(event.detail, "window");
        };

        window.addEventListener(DSL_SCENE_COMMAND_APPLIED, handleDslSceneCommand);
        return () => window.removeEventListener(DSL_SCENE_COMMAND_APPLIED, handleDslSceneCommand);
    }, [projectId]);

    useEffect(() => {
        const handleRemoteSceneCommand = (message) => {
            if (!message?.transientSceneCommand || !message?.sceneCommand?.data) {
                return;
            }
            applyDslSceneCommand(message.sceneCommand, "socket-message");
        };

        socket.on("terminalMessage", handleRemoteSceneCommand);
        return () => socket.off("terminalMessage", handleRemoteSceneCommand);
    }, [projectId]);


    const applyTextures = (child, texturesObj, name) => {
        const assetName = String(name || "");

            // Handle animated wave materials
        const targetMaterials = Array.isArray(child.material) ? child.material : [child.material];
        targetMaterials.forEach((mat) => {
            if (mat.map && assetName.includes('wave')) {
                animatedTextures.current.push(mat.map);
            }
        });



            //   if (!appliedAny) {
            const oldMat = Array.isArray(child.material) ? child.material[0] : child.material;
            let map = false
              
            const preservedProps = {
                color: oldMat.color,
                map: map ? null : oldMat.map,
                side: oldMat.side ?? THREE.FrontSide,
                transparent: oldMat.transparent,
                opacity: oldMat.opacity,
                // emissive: new THREE.Color(0xffffff),
                emissiveIntensity: 2.0,
            };

            child.material = new THREE.MeshPhongMaterial(preservedProps);
            return

        // }
   
        
        // texturesObj.forEach((textureUrl, i) => {
        //     if (textureUrl !== "") {
        //         let material = materialsMap.get(textureUrl);
        //     //   console.log(`${import.meta.env.VITE_FILE_URL}/${textureUrl}`)
        //         if (!material) {
        //             const texture = textureLoader.load(`${import.meta.env.VITE_FILE_URL}/${textureUrl}`);
        //              texture.colorSpace = THREE.SRGBColorSpace;
        //             texture.wrapS = THREE.RepeatWrapping;
        //             texture.wrapT = THREE.RepeatWrapping;
        
        //             material = new THREE.MeshPhongMaterial({
        //                  map: texture,
        //                 side: THREE.DoubleSide,
        //             });
        
        //             materialsMap.set(textureUrl, material);
        //         }
        
        //         if (Array.isArray(child.material) && child.material[i]) {
        //             child.material[i] = material;
        //         } else {
        //             child.material = material;
        //         }
        //         appliedAny = true;
        //     }
        // });

        // 🔁 If no textures were applied, fallback to color material


  

    
    };

    const parseCategoryTextures = (value, name) => {
        if (!value || typeof value !== "string" || !value.trim()) {
            return [];
        }

        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn(`Skipping invalid texture JSON for ${name || "model"}`, error);
            return [];
        }
    };

    const loadDbData = async () => {
        const rooms = await RoomsCollection.query(Q.where('room_id', parseInt(projectId.toString()))).fetch()
        // @ts-ignore
        const parentId = rooms[0]?._raw?.parent
        const branches = await BranchCollection.query(Q.where('branch_id', parseInt(parentId))).fetch()
        // @ts-ignore
        const branchName = branches[0]?._raw.name

        if (rooms[0]?._raw?.landing_point && rooms[0]?._raw?.landing_point.length > 0) {
            const center = JSON.parse(rooms[0]?._raw?.landing_point)

            const centerPoint = new Vector3(center.x, center.y, center.z)
            setSearchCenter(centerPoint.multiplyScalar(0.01))
        }
        setBranch(`${branchName} ${rooms[0]?._raw.name}`)
        const projectData = { categories: [] };
        const categories = await categoriesCollection.query(Q.where('project_id', parseInt(projectId.toString()))).fetch()
        // @ts-ignore
        projectData.categories = categories;
        for (const category of categories) {
            // @ts-ignore
            // const fbxName = `${projectId}-${category?.fbx.replace(/\.fbx$/i, '').toLowerCase()}`;

            const instances = category._raw.instances ? JSON.parse(category._raw.instances) : []

            const assets = await assetsCollection.query(Q.where('instance_id', Q.oneOf(instances))).fetch();
            // const assets = await assetsCollection.query(Q.where('category', fbxName)).fetch()
            // @ts-ignore
            category.assets = assets;
            for (const asset of assets) {
                if (!defaultInstanceId && asset.category.includes('platform')) {
                    setDefaultInstanceId(asset.instanceId)
                }

                // if(asset.instanceId===628756){
                //     console.log(asset)
                // }
                // @ts-ignore
                const fields = await fieldsCollection.query(Q.where('instance_id', parseInt(asset.instanceId))).fetch()
                // @ts-ignore
                asset.fields = {};
                for (const field of fields) {
                    // @ts-ignore
                    asset.fields[field.name] = field;
                }
            }
        }

        return [branchName, projectData.categories]
    }



    // useEffect(() => {
    //     if (!rotationValue || !selectedAssetId || rotationValue === null || vAlignValue == null) {
    //         return
    //     }

    //     const { position, categoryIndex, name } = sceneAssets[selectedAssetId] || templateAssetProps


    //     if (!name) {
    //         return
    //     }

    //     const data = gameInstances[name]
    //     if (data === undefined) {
    //         if (animationRef) {
    //             const axis = new THREE.Vector3(0, 1, 0);
    //             const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(parseInt(rotationValue)));
    //             animationRef.quaternion.copy(rotationQuaternion); // Apply the rotation to the animationRef
    //             const props = {
    //                 categoryIndex,
    //                 position,
    //                 rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(rotationValue), 0),
    //                 projectId,
    //                 vAlignValue,
    //                 textures: [],
    //             };

    //             SaveFromTemplate(props, name, selectedAssetId, setLazy, setSelectedAssetId, vAlignValue);
    //         }
    //         return
    //     }
    //     const instanceMesh = data.instanceMesh
    //     if (instanceMesh === undefined) {
    //         return
    //     }

    //     const props = {
    //         categoryIndex,
    //         position,
    //         rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(rotationValue), 0),
    //         projectId,
    //         vAlignValue,
    //         textures: [],
    //     };

    //     SaveFromTemplate(props, name, selectedAssetId, setLazy, setSelectedAssetId, vAlignValue);

    // }, [rotationValue, vAlignValue])



    useEffect(() => {
        const name = assetName || sceneAssets[selectedAssetId]?.name

        if (!rotationValue || !selectedAssetId || !name || !dragObjectProperties) {
            return
        }
        const data = gameInstances[name]
        const newPosition = dragObjectProperties.position
        const newRotation = dragObjectProperties.rotation

        if (!newPosition || data === undefined) {

            if (animationRef) {
                animationRef.position.copy(newPosition)
                animationRef.rotation.copy(newRotation)
            }
            return
        }


    }, [dragObjectProperties])

    useEffect(() => {

        if (isMobile) {
            setForwardOnly(false)
        }

    }, [isMobile]);

   function disposeMaterial(mat) {
        if (!mat) return;

        // dispose any textures on the material
        for (const key in mat) {
            const v = mat[key];
            if (v && v.isTexture) v.dispose();
        }

        mat.dispose?.();
    }
    function disposeObject3D(obj) {
        if (!obj) return;

        obj.traverse((child) => {
            if (!child?.isMesh) return;

            child.geometry?.dispose();

            const m = child.material;
            if (Array.isArray(m)) m.forEach(disposeMaterial);
            else disposeMaterial(m);
        });
    }

    function cleanupSceneAssets(sceneAssets) {

        for (const key of Object.keys(sceneAssets)) {
            const entry = sceneAssets[key];
            const obj = entry?.object;

            if (obj) {
                // remove from scene graph
                obj.parent?.remove(obj);
                // (optional) scene.remove(obj) if you know it's added directly
                scene.remove(obj);

                // dispose GPU resources
                disposeObject3D(obj);
            }
            // drop references (helps GC)
            sceneAssets[key] = null;
            delete sceneAssets[key];
        }
    }
    const disposeScene = (scene) => {
        scene.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach((material) => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
            if (object.texture) {
                object.texture.dispose();
            }
        });
    }

    const loadLevelData = async (projectId) => {
           
        const res = await fetch(`${import.meta.env.VITE_API_URL}/project-scene/${projectId}`);
        
        // const res2 = await fetch(`http://localhost:4001/runs/1`);
        //   const jsonData = await res2.json()
        //   const cat = jsonData?.result
        // console.log(res)
        const data = await res.json();

        if (data) {
            setProjectSceneData(data, projectId);
            apiData.current = data
            return data;
        }
    }

    const getProjectSceneKey = (value = projectId) => {
        const raw = String(value ?? "").trim();
        const levelMatch = /^(.*)_L(\d+)$/i.exec(raw);
        if (levelMatch) {
            const levelCode = Number.parseInt(levelMatch[2], 10);
            return levelCode === 0 ? levelMatch[1] : `${levelMatch[1]}_L${levelCode}`;
        }

        return raw;
    };

    // useEffect(() => {
    //     const reqId = ++reqRef.current;
    //     const token = ++projectLoadTokenRef.current;
    //     let cancelled = false;
    //     reloadTimes.current++;
    //     dataObject.current = [];
    //     categoryCommands.current = [];
    //     assetCommands.current = 'level L2 \n';
    //     commandOverlayCategoriesRef.current = [];

    //     setSceneData([]);
    //     setData([]);
    //     dataRef.current = [];
    //     setGameInstances({});
    //     setInstanceData([]);
    //     setIsLoaded(false);
    //     cleanupSceneAssets(sceneAssets);
    //     cleanupSceneAssets(objects);

    //     isMobile ? setForwardOnly(false) : setForwardOnly(true);

    //     setShowBdims(false);
    //     setShowOdims(false);
    //     setShowFdims(false);
    //     setPackageControl(false);
    //     setEditPopup(false);
    //     setWallsOpacity(30);
    //     setCategory(false);

    //     if (objects.length) objects.splice(0, objects.length);
    //     floors.splice(0, floors.length);
    //     locationPoints.splice(0, locationPoints.length);

    //     const run = async () => {
    //         if (Number(projectId) > 0) {
    //             const dataObj = await loadDbData();
    //             if (cancelled) return;
    //             if (reqRef.current !== reqId || projectLoadTokenRef.current !== token) return;
    //             const latestSceneData = withCommandOverlays(dataObj?.[1] ?? []);
    //             const nextSig = buildSceneSignature(latestSceneData);
    //             sceneSignatureRef.current = nextSig;
    //             setSceneData(latestSceneData);
    //             setLazy(false);
    //             return;
    //         }

    //         if (isNaN(projectId) && projectId?.length > 0) {
    //             const dataObj = await loadLevelData();
    //             if (cancelled) return;
    //             if (reqRef.current !== reqId || projectLoadTokenRef.current !== token) return;
    //             const hydratedCategories = await hydrateSceneCategoriesWithDbAnimations(projectId, dataObj?.categories ?? []);
    //             const cats = withCommandOverlays(hydratedCategories);
    //             sceneSignatureRef.current = buildSceneSignature(cats);
    //             setSceneData(cats);
    //             const center = dataObj?.initPosition;
    //             const centerPoint = center
    //                 ? new Vector3(center.x, center.z, center.y).multiplyScalar(0.01)
    //                 : new Vector3(0, 0, 0);

    //             setSearchCenter(centerPoint);
    //             setLazy(false);
    //         }
    //     };

    //     run();

    //     let sceneObj = new THREE.Object3D();
    //     sceneObj.name = 'sceneObj';
    //     if (scene) {
    //         const localSceneObject = scene.getObjectByName('sceneObj');
    //         if (localSceneObject) {
    //             localSceneObject.clear();
    //             sceneObj = localSceneObject;
    //         }
    //     }
    //     scene.add(sceneObj);

    //     return () => {
    //         cancelled = true;
    //         const localSceneObject = scene.getObjectByName('sceneObj');
    //         if (localSceneObject) {
    //             disposeScene(localSceneObject);
    //         }
    //     };
    // }, [projectId, isMobile]);

    useEffect(() => {
        // if (!checkReload) return;
        let cancelled = false;
        const token = ++remoteLoadTokenRef.current;
         
        const refreshRemoteScene = async () => {
            try {
               
                if (Number(projectId) > 0) {
                    
                    // const dataObj = await loadDbData();
                  const sceneKey = getProjectSceneKey(`${projectId}_L0`);
                   
                  const dataObj = await loadLevelData(sceneKey);
                //  if (cancelled || remoteLoadTokenRef.current !== token) return;
                    const hydratedCategories = await hydrateSceneCategoriesWithDbAnimations(sceneKey, dataObj?.categories ?? []);
                    const cats = withCommandOverlays(hydratedCategories);
                    const nextSig = buildSceneSignature(cats);
                    if (nextSig !== sceneSignatureRef.current) {
                        sceneSignatureRef.current = nextSig;
                        setSceneData(cats);
                    }
                    return;
                }

                if (isNaN(projectId) && projectId?.length > 0) {
                   
                    const sceneKey = getProjectSceneKey(projectId);
                    
                    const dataObj = await loadLevelData(projectId);
                    if (cancelled || remoteLoadTokenRef.current !== token) return;
                    const hydratedCategories = await hydrateSceneCategoriesWithDbAnimations(sceneKey, dataObj?.categories ?? []);
                    const cats = withCommandOverlays(hydratedCategories);
                    const nextSig = buildSceneSignature(cats);
                    if (nextSig !== sceneSignatureRef.current) {
                        sceneSignatureRef.current = nextSig;
                        setSceneData(cats);
                    }
                }
            } catch (error) {
                console.error("Failed to refresh scene data:", error);
            }
        };

        refreshRemoteScene();

        return () => {
            cancelled = true;
        };
    }, [checkReload, projectId]);


    useEffect(() => {
        setToolBarHidden(true)
    }, []);




    useEffect(() => {
        let isMounted = true;
        let timer = null;
        const loadToken = ++modelLoadTokenRef.current;
        //
        // console.log(sceneData?.length)
        if (sceneData?.length === undefined) {
            return;
        }
        if (projectId === 149) {
            setTimeout(() => setIsLoaded(true), 3000);
            return;
        }


        const loadModels = async () => {

            setIsLoaded(false)
            const fbxLoader = new FBXLoader();
            const gltfLoader = new GLTFLoader();
            const loadPromises = [];
            const nextData = [];
            const existingByRenderKey = new Map(
                (dataRef.current || []).map((item) => [item.renderKey || item.cleanKey || item.fileName || item.name, item])
            );
            let cat_id = 0
            for (const index in sceneData) {
                // console.log(sceneData[index])
                const category = sceneData[index]?._raw ? sceneData[index]?._raw : sceneData[index];
                const file = category?.fbx;

                if (!file || category.length || file === 'LED Display 1x0.5x0.2.fbx') continue;
                const ext = file.split(".").pop().toLowerCase();
                const url = `${import.meta.env.VITE_FILE_URL}/${file}`;
                const { name, category_index, properties, fbx, default_color, id } = category;
         
                const assetsObj = sceneData[index]?.assets || {};
                const arrayOfObjects = Object.entries(assetsObj).map(([key, value]) => ({
                    key,
                    ...value,
                }));
                const sceneSig = `${buildAssetsSignature(arrayOfObjects)}:${JSON.stringify(parseProperties(properties).dslAnimations || [])}`;
                const categoryIndex = parseInt(category_index);
                // const baseCleanKey = (fbx || "").replace(/\s+/g, "").replace(/\.fbx$/i, "");
                const baseCleanKey = normalizeSceneAssetName(fbx)
                const commandOverlay = Boolean(category.commandOverlay);
                const cleanKey = commandOverlay
                    ? `${baseCleanKey}__cmd_${category.category_id || category.category_index || index}`
                    : baseCleanKey;
                const categoryIdentity = getCategoryIdentity(category, index);
                const renderKey = `${cleanKey}__cat_${categoryIdentity}__slot_${index}`;
                const renderName = commandOverlay
                    ? `${name || baseCleanKey} Command ${category.category_id || category.category_index || index}`
                    : name;
           

                const categoryData = {
                    category_id: cat_id,
                    category_index: categoryIndex,
                    asset_id: cat_id,
                    name: renderName,
                    fbx
                };
                const categoryStructure = {
                    [cleanKey]: categoryData
                };
                categoryCommands.current.push(categoryStructure);
                cat_id++;

                const existing = existingByRenderKey.get(renderKey);
                if (existing) {
                    if (isMounted && arrayOfObjects.length > 0) {
                        nextData.push({
                            ...existing,
                            name: renderName,
                            categoryIndex,
                            assets: arrayOfObjects,
                            properties,
                            fileName: fbx,
                            defaultColor: default_color,
                            id,
                            cleanKey,
                            renderKey,
                            sceneSig,
                            commandOverlay
                        });
                    }
                    if (!nameSet.has(renderName) && arrayOfObjects.length > 0) {
                        nameSet.add(renderName);
                    }
                    continue;
                }

                const promise = new Promise((resolve, reject) => {
                    const onLoad = (model) => {
                        const root = model.scene || model;
                        if (!isMounted || loadToken !== modelLoadTokenRef.current) {
                            disposeObject3D(root);
                            resolve();
                            return;
                        }

                        if (name?.toLowerCase().includes('key') && root?.children?.[0]) {
                            root.children[0].scale.multiplyScalar(0.1);
                        }

                        root.traverse((child) => {
                            if (child.isMesh && category.textures) {
                                const textures = parseCategoryTextures(category.textures, name);
                                applyTextures(child, textures, name);
                            }
                        });
                        
                        const dto = {
                            name: renderName,
                            categoryIndex,
                            assets: arrayOfObjects,
                            fbx: root,
                            properties,
                            fileName: fbx,
                            defaultColor: default_color,
                            id,
                            cleanKey,
                            renderKey,
                            sceneSig,
                            commandOverlay
                        };

                        if (isMounted && arrayOfObjects.length > 0) {
                            nextData.push(dto);
                        }
                        if (!nameSet.has(renderName) && arrayOfObjects.length > 0) {
                            nameSet.add(renderName);
                        }
                        resolve();
                    };

                    const onError = (error) => {
                        console.error(`Error loading model: ${file}`, error);
                        reject(error);
                    };

                    if (ext === "fbx") {
                        fbxLoader.load(url, onLoad, undefined, onError);
                    } else if (ext === "glb" || ext === "gltf") {
                        gltfLoader.load(url, onLoad, undefined, onError);
                    } else {
                        console.warn(`Unsupported model format: ${file}`);
                        resolve();
                    }
                });
                loadPromises.push(promise);
            }

            try {
                await Promise.all(loadPromises);

                if (isMounted && loadToken === modelLoadTokenRef.current) {
                    const prevData = dataRef.current || [];
                    const hasSameLength = prevData.length === nextData.length;
                    let unchanged = hasSameLength;

                    if (unchanged) {
                        for (let i = 0; i < nextData.length; i++) {
                            const prev = prevData[i];
                            const next = nextData[i];
                            if (!prev || !next) {
                                unchanged = false;
                                break;
                            }
                            const prevKey = prev.renderKey || prev.cleanKey || prev.fileName || prev.name;
                            const nextKey = next.renderKey || next.cleanKey || next.fileName || next.name;
                            if (prevKey !== nextKey || prev.sceneSig !== next.sceneSig) {
                                unchanged = false;
                                break;
                            }
                        }
                    }

                    if (!unchanged) {
                        dataRef.current = nextData;
                        setData(nextData);
                    }
                    timer = setTimeout(() => {
                        setIsLoaded(true)

                    }, 10000);

                }
            } catch (error) {
                console.error("Error loading models:", error);
            }
        };

        setTerminalMessage({ command: "", message: "Loading models..." });

        if (sceneData?.length > 0) {

            setIsLoaded(false)
            loadModels();
        }
        else {
            setIsLoaded(true)

        }

        return () => {
            clearTimeout(timer)
            isMounted = false;
            modelLoadTokenRef.current += 1;
        };
    }, [sceneData]);


    // @ts-ignore
    return (


        <Fragment key={`${projectId}`}>

            {buttonMode !== "Edit Mode" && <SceneFog />}

            {isPuzzleGame ? (
                <InfiniteWorldRenderer
                    data={data}
                    projectId={projectId}
                    world={world}
                    scene={scene}
                    floors={floors}
                />
            ) :
             (
                data.length > 0 && data.map((item) => (
                    <R3fInstancePattern
                        key={`${item.renderKey || item.cleanKey || item.fileName || item.name}`}  // Stable key for granular updates
                        fbx={item.fbx}
                        assets={item.assets}
                        name={item.name}
                        world={world}
                        cscene={scene}
                        floors={floors}
                        properties={item.properties}
                        fileName={item.fileName}
                        defaultColor={item.defaultColor}
                        id={item.id}
                        cleanKey={item.cleanKey}
                        renderKey={item.renderKey}
                        commandOverlay={item.commandOverlay}

                    />
                ))
            )
            }


            {isPuzzleGame &&
                <CharacterAnimation
                    key={client}
                    orbitControlsRef={orbitControls}
                    client={client}
                />
            }

            {isPuzzleGame   && <Chessboard
                key={`${projectId}_chessboard`}
            />}
            {/* {isPuzzleGame && didRun.current && isNaN(projectId) && <LevelChessBoard
                key={`${projectId}_chessboard`}
            />} */}
            <EditAsset key={`${projectId}_edit`} />
            {projectId == 149 && <Plane />}
            {/*{projectId == 149 && <CloudPlane/>}*/}
            {/*<Segment*/}
            {/*    color="cyan" lineWidth={3} />*/}
        </Fragment>

    );
}


