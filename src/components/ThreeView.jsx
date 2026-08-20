import React, { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom';
import { Canvas, extend } from '@react-three/fiber';
import { useDrop } from 'react-dnd';
import { AdaptiveDpr, KeyboardControls, MapControls, Stats, useHelper } from "@react-three/drei";
import Hud from "../threejs/hud/Hud";
import Events from "../threejs/events/Events.jsx";
import PlayersGridView from "./popup/grid/PlayersGridView";
import useGame from "../hooks/useGame";
import Player from "../threejs/player/Player.tsx";
import SpeedMeter from '../threejs/hud/playerControls/SpeedMeter';
import { EcctrlJoystick } from "../threejs/player/EcctrlJoyStick";
import Channels2 from "./popup/sideBar/Channels2";
import VideoPopup from "./popup/sideBar/VideoPopup";
import ZoomAsset from "../threejs/scene/ZoomAsset.jsx";
import Roof from "../threejs/scene/Roof";
import { GameExperience } from "../threejs/GameExperience.jsx";
import SceneGrid from './popup/grid/SceneGrid';
import CheckLabel from "../threejs/scene/CheckLabel";
import MiniMap from "./popup/map/MiniMap";
import Cordinates from "./popup/sideBar/Cordinates";
import Camera from "../threejs/hud/camera/Camera";
import Jumpoints from "./popup/sideBar/Jumpoints";
import { Toast } from "primereact/toast";
import DarkForm from "./popup/form/darkForm";
import Documents from "./popup/sideBar/Documents";
import Category from "./popup/sideBar/Category.jsx";
import AssetsGrid from "./popup/grid/AssetsGrid";
import QrPopup from "../threejs/hud/scanner/QrPopup";
import CameraPopup from "./photo/CameraPopup";
import Projects from "./packaging/Projects";
import PackageControls from "./packaging/PackageControls";
import ComponentSideBar from "./packaging/ComponentSideBar";
import PackageRuntimeBridge from "./packaging/PackageRuntimeBridge.jsx";
import ProductsTreeGrid from "./popup/sideBar/ProductsTreeGrid";
import ZoomSlider from "../threejs/hud/camera/ZoomSlider";
import ViewportMouseCoordinates from "./ViewportMouseCoordinates.jsx";
import PlayerHeightSlider from "../threejs/hud/playerControls/PlayerHeightSlider";
import PlayerViewAngleSlider from "../threejs/hud/playerControls/PlayerViewAngleSlider";
import DetailPopup from "./popup/miscellaneous/DetailPopup";
import Ground from "../threejs/environment/Ground";
import ProjectSkyClouds from "../threejs/environment/ProjectSkyClouds.jsx";
import AssetDragDrop from "../threejs/events/AssetDragDrop.jsx";
import { Physics } from "@react-three/rapier";
import InstanceExperience from "../threejs/InstanceExperience.jsx";
import PlayerHudCleanUp from "../threejs/player/PlayerHudCleanUp";
import AvatarEyeDirectionalLight from "../threejs/player/AvatarEyeDirectionalLight.jsx";
import Floor from "../threejs/environment/Floor.jsx";
import Notification from "../threejs/notification/Notification";
import '../leaderboard.css'
import { PhysicsProvider } from '../threejs/cannon/PhysicsContext';
import Scene from "../threejs/cannon/Scene";
import PopupInfo from "./popup/form/PopupInfo";
import HideShowAssets from "../threejs/scene/HideShowAssets";
import CharacterRotationSpeed from "../threejs/hud/playerControls/RotationMeter";
import CharacterJumpSpeed from "../threejs/hud/playerControls/JumpMeter";
import LayerOptions from "./popup/form/game-layers/LayerOptions";
// import FourStateButtonWithDropdown from "./popup/form/game-layers/ControlButtons";
import AddLevel from "./popup/gui/level/AddLevel.jsx";
import { Color } from "three";
import DeleteAsset from "../threejs/DeleteAsset";
import Chat from "./popup/spectrum-analyzer/chat/Chat";
import PlayersRanking from "./popup/player-rank/PlayersRanking";
import TopScoreboard from "./popup/player-rank/TopScoreboard.jsx";
import InventoryUi from "../puzzleUi/InventoryUi.jsx";
import NavigationPad from "../puzzleUi/NavigationPad.jsx";
import GameRuntimeChrome from "../puzzleUi/GameRuntimeChrome.jsx";
import GameMenu from "./popup/gui/GameMenu.jsx";
import AvatarSetupConfirm from "./popup/gui/AvatarSetupConfirm.jsx";
import PlayAssetInfoHud from "./popup/gui/playAssetInfo/PlayAssetInfoHud.jsx";
import PlayCategoryPopup from "./popup/gui/playAssetInfo/PlayCategoryPopup.jsx";
import PlayModeViewControls from "./popup/gui/playAssetInfo/PlayModeViewControls.jsx";
import PuzzleAssetPlacementController from "./puzzle-game/PuzzleAssetPlacementController.jsx";
import CategorySelectionDialog from "./popup/form/CategorySelectionDialog.jsx";

import ConfirmationDialog from "./popup/gui/ConfirmationDialog.jsx";
import PauseMenu from "./popup/gui/PauseMenu.jsx";
import ShowController from "./popup/miscellaneous/ShowController.jsx";
import StatsPopup from "./popup/gui/stats/StatsPopup.jsx";
import SoundTrack from "../threejs/player/puzzle/character/SoundTrack";
import * as THREE from 'three/webgpu'
import SingleEdgesDrawing from "../threejs/autoCad/SingleEdgesDrawing.jsx";
import SingleEdgesOverlay from "../threejs/autoCad/SingleEdgesOverlay.jsx";
import WebGLStudioGrid from "../threejs/scene/WebGLStudioGrid.jsx";
import { EDITOR_ASSET_DND_TYPE } from "../engine-editor/dndTypes.js";
import { shouldDisableGridByDefault } from "../utils/gridVisibility";
import AvatarLoadingOverlay from "../threejs/player/puzzle/character/AvatarLoadingOverlay.jsx";
import UnsavedAssetConfirmDialog from "../threejs/hud/inventory/UnsavedAssetConfirmDialog.jsx";
import { AIChaserDebug } from "../threejs/aiPathfinding";
import {
    getGoogleMapsViewportMode,
    isGoogleMapsWebGLProject,
    subscribeGoogleMapsViewportMode,
} from "./project-map/projectGoogleMapsViewportMode.js";
import { sceneAssets } from "../threejs/player/puzzle/character/Constants.jsx";
import {
    getAvatarLoadingHudSnapshot,
    subscribeAvatarLoadingHud,
} from "../threejs/player/puzzle/character/avatarLoadingHudStore.js";

const EDIT_MODE_EXIT_CAMERA_POSITION = new THREE.Vector3(2.35, 1.75, 2.35);
const EDIT_MODE_EXIT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
const MIN_SCENE_CAMERA_NEAR = 0.05;
const DEFAULT_SCENE_CAMERA_FAR = 100000000;

function applyFixedEditModeCamera(camera, controls) {
    if (!camera || !controls) return;

    camera.position.copy(EDIT_MODE_EXIT_CAMERA_POSITION);
    camera.near = MIN_SCENE_CAMERA_NEAR;
    camera.far = DEFAULT_SCENE_CAMERA_FAR;
    camera.lookAt(EDIT_MODE_EXIT_CAMERA_TARGET);
    camera.updateProjectionMatrix?.();

    controls.target.copy(EDIT_MODE_EXIT_CAMERA_TARGET);
    controls.update?.();
}

function isUrlLevelProjectLaunch() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const skipMenu = params.get("skipMenu");
    const source = params.get("source");
    const projectId = String(params.get("projectId") || window.__NTS_RESOLVED_LAUNCH_PARAMS?.projectId || "").trim().replace(/[,\s]+$/g, "");

    return /_L\d+$/i.test(String(projectId || ""))
        && mode !== "edit"
        && skipMenu !== "1"
        && source !== "theia";
}

function setEditorFullscreenClass(enabled, isGameProject = false, isUrlProjectFullscreen = false) {
    const appRoot = document.querySelector('.editor-app-root');
    appRoot?.classList.toggle('is-editor-fullscreen', enabled);
    document.documentElement.classList.toggle('is-editor-fullscreen', enabled);
    document.body.classList.toggle('is-editor-fullscreen', enabled);
    document.documentElement.classList.toggle('is-game-project-fullscreen', enabled && isGameProject);
    document.body.classList.toggle('is-game-project-fullscreen', enabled && isGameProject);
    appRoot?.classList.toggle('is-game-project-fullscreen', enabled && isGameProject);
    document.documentElement.classList.toggle('is-url-project-fullscreen', enabled && isUrlProjectFullscreen);
    document.body.classList.toggle('is-url-project-fullscreen', enabled && isUrlProjectFullscreen);
    appRoot?.classList.toggle('is-url-project-fullscreen', enabled && isUrlProjectFullscreen);
    window.dispatchEvent(new Event('resize'));
}

function enterUrlProjectFullscreen(isGameProject = false) {
    setEditorFullscreenClass(true, isGameProject, true);
    requestAnimationFrame(() => setEditorFullscreenClass(true, isGameProject, true));
    window.setTimeout(() => setEditorFullscreenClass(true, isGameProject, true), 120);
}

function isTypingTarget(target) {
    if (!target) return false;

    const tagName = target.tagName?.toLowerCase();
    return target.isContentEditable
        || tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select';
}

function isDotZoomKey(event) {
    return event.key === '.'
        || event.code === 'Period'
        || event.code === 'NumpadDecimal'
        || event.keyCode === 110
        || event.which === 110
        || (
            (event.key === 'Delete' || event.keyCode === 46 || event.which === 46)
            && event.location === KeyboardEvent.DOM_KEY_LOCATION_NUMPAD
        );
}




export default function ThreeView() {

    const cameraRef = useRef(null);
    const sceneRef = useRef(null);
    const orbitControls = useRef(null);
    const canvasHostRef = useRef(null);
    const previousButtonModeRef = useRef(null);
    const projectId = useGame((state) => state.projectID)
    const character = useGame((state) => state.character)
    const firstPerson = useGame((state) => state.firstPerson)
    const uName = useGame((state) => state.uName)
    const isGrid = useGame((state) => state.grid)
    const setGrid = useGame((state) => state.setGrid)
    const client = '';
    const [showGrid, setShowGrid] = useState(isGrid);
    const toast = useRef(null);
    const packageControl = useGame((state) => state.packageControl);
    const isPackage = useGame((state) => state.isPackage);
    const isMobile = useGame((state) => state.isMobile);
    const setIsMobile = useGame((state) => state.setIsMobile);
    const isGame = useGame((state) => state.isGame);
    const setIsGame = useGame((state) => state.setIsGame);

    const glRef = useRef(null)
    const directionalLightRef = useRef(null);

    const selectedAssetName = useGame((state) => state.selectedAssetName);
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    const selectedEditorInstance = useGame((state) => state.selectedEditorInstance);
    const buttonMode = useGame((state) => state.buttonMode);
    const setCameraRef = useGame((state) => state.setCameraRef);
    const setSceneRef = useGame((state) => state.setSceneRef);
    const setOrbitControlsRef = useGame((state) => state.setOrbitControlsRef);
    const setIsPuzzleGame = useGame((state) => state.setIsPuzzleGame);
    // const previewDslMode = useGame((state) => state.previewDslMode);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const setGridSize = useGame((state) => state.setGridSize);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const setCharacter = useGame((state) => state.setCharacter);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setPauseGame = useGame((state) => state.setPauseGame);
    const setEditorSelectionEnabled = useGame((state) => state.setEditorSelectionEnabled);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const gridSize = useGame((state) => state.gridSize);
    const pauseGame = useGame((state) => state.pauseGame)
    const hasDied = useGame((state) => state.hasDied);
    const setPackageControl = useGame((state) => state.setPackageControl);
    const setProjectID = useGame((state) => state.setProjectID);
    const currentMenu = useRef([]);
    const [isTouchScreen, setIsTouchScreen] = useState(false)
    const [isLowGpu, setIsLowGpu] = useState(null)
    const [isHudMinimized, setIsHudMinimized] = useState(false)
    const [editorShellNode, setEditorShellNode] = useState(null)
    const showAvatarLoadingOverlay = useSyncExternalStore(
        subscribeAvatarLoadingHud,
        getAvatarLoadingHudSnapshot,
        getAvatarLoadingHudSnapshot
    );
    const gridDefaultKeyRef = useRef(null);

    extend(THREE)



    const checkGame = useCallback(async (incomingBaseKey) => {
              
             
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/checkGame/${incomingBaseKey}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            const nextIsGame = parseInt(data[0].isGame) > 0;
            const nextIsPuzzleGame = parseInt(data[0].isPuzzleGame) > 0;
            setIsGame(nextIsGame)
            setIsPuzzleGame(nextIsPuzzleGame)

            // setGridSize({
            //     x: parseInt(data[0].length),
            //     y: parseInt(data[0].height),
            //     z: parseInt(data[0].width),
            //     backgroundColor: data[0].background,
            // })

            if (isUrlLevelProjectLaunch()) {
                setGrid(false);
                setEditorSelectionEnabled(false);
                setSelectedEditorInstance(null);
                window.dispatchEvent(new CustomEvent('editor-detach-transform-controls'));

                if (nextIsPuzzleGame) {
                    setButtonMode('Play mode');
                    setCharacter(true);
                    setFirstPerson(false);
                    setPauseGame(false);
                    enterUrlProjectFullscreen(true);
                } else {
                    setButtonMode('Play mode');
                    setCharacter(false);
                    setFirstPerson(false);
                    setPauseGame(false);
                    enterUrlProjectFullscreen(false);
                }
            }
           

        } catch (error) {
            console.error('Failed to fetch devices:', error);
        }
    }, [projectId, setButtonMode, setCharacter, setEditorSelectionEnabled, setFirstPerson, setGrid, setGridSize, setIsGame, setIsPuzzleGame, setPauseGame, setSelectedEditorInstance]);

    useEffect(() => {

        if (!sceneRef.current) {
            return;
        }

        if (String(projectId).replace(/_L\d+$/i, "") === "151") {
            sceneRef.current.background = new Color('#4a4a4a');
        } else if (isPuzzleGame && buttonMode !== 'Edit Mode') {
            sceneRef.current.background = new Color(gridSize.backgroundColor || '#000');
        } else {
            sceneRef.current.background = new Color(isPuzzleGame ? '#d6d3d3' : '#fff');
        }
        
    }, [buttonMode, gridSize, isPuzzleGame, projectId]);



    useEffect(() => {
        const detectTouchScreen = () => {
            const hasTouch = window.matchMedia?.('(pointer: coarse)').matches
                || navigator.maxTouchPoints > 0
                || 'ontouchstart' in window;

      
            setIsTouchScreen(hasTouch);
            setIsMobile(hasTouch);
        };

        detectTouchScreen();
        window.addEventListener('resize', detectTouchScreen);
        return () => {
            window.removeEventListener('resize', detectTouchScreen);
        };
    }, [setIsMobile]);

    useEffect(() => {
        if (!isPuzzleGame) return;

        const frameScene = () => applyFixedEditModeCamera(cameraRef.current, orbitControls.current);
        requestAnimationFrame(() => {
            frameScene();
            requestAnimationFrame(frameScene);
        });
    }, [isPuzzleGame]);

    useEffect(() => {
        const previousButtonMode = previousButtonModeRef.current;
        previousButtonModeRef.current = buttonMode;
          
        if (!isPuzzleGame || previousButtonMode !== 'Play mode' || buttonMode !== 'Edit Mode') {
            return;
        }

        const frameScene = () => applyFixedEditModeCamera(cameraRef.current, orbitControls.current);
        requestAnimationFrame(() => {
            frameScene();
            requestAnimationFrame(frameScene);
            window.setTimeout(frameScene, 120);
        });
    }, [buttonMode, isPuzzleGame]);

    useEffect(() => {
 const incomingBaseKey = String(projectId).replace(/_L\d+$/i, "");
//   console.log('Checking game for project ID:', projectId);
//   if (parseInt(incomingBaseKey) == 140) {
//             setPackageControl(true)
//             setIsPackage(true)
//             // setProjectID(0)
//             setBranch('Packaging')
//             return
//         }

        if (Number(incomingBaseKey) > 0) {
            setIsPuzzleGame(null)
            checkGame(incomingBaseKey)
            return;
        }

    }, [ projectId]);




    useEffect(() => {
        setShowGrid(isGrid)
    }, [isGrid])

    useEffect(() => {
         const defaultGridVisible = shouldDisableGridByDefault({ character, firstPerson, isPuzzleGame });
  
        if (defaultGridVisible) {
            setGrid(false);
        }

         
        const nextKey = `${projectId}:${Boolean(isPuzzleGame)}`;
        if (gridDefaultKeyRef.current === nextKey) {
            return;
        }

        gridDefaultKeyRef.current = nextKey;
       
    }, [isPuzzleGame, projectId, setGrid,firstPerson,character])

    useEffect(() => {
        const syncEditorShellNode = () => {
            setEditorShellNode(document.querySelector('.rogue-editor-shell'));
        };

        syncEditorShellNode();

        const observer = typeof MutationObserver !== 'undefined'
            ? new MutationObserver(syncEditorShellNode)
            : null;

        observer?.observe(document.body, { childList: true, subtree: true });
        return () => observer?.disconnect();
    }, []);

    useEffect(() => {
        const resizeRendererToHost = () => {
            const host = canvasHostRef.current;
            const renderer = glRef.current;
            const camera = cameraRef.current;

            if (!host || !renderer) {
                return;
            }

            const width = host.clientWidth;
            const height = host.clientHeight;

            if (width <= 0 || height <= 0) {
                return;
            }

            renderer.setSize?.(width, height, false);

            if (camera?.isPerspectiveCamera) {
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
            }
        };

        const scheduleResize = () => {
            resizeRendererToHost();
            requestAnimationFrame(resizeRendererToHost);
            window.setTimeout(resizeRendererToHost, 120);
        };

        window.addEventListener('resize', scheduleResize);
        document.addEventListener('fullscreenchange', scheduleResize);

        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(scheduleResize)
            : null;

        if (canvasHostRef.current && observer) {
            observer.observe(canvasHostRef.current);
        }

        scheduleResize();

        return () => {
            window.removeEventListener('resize', scheduleResize);
            document.removeEventListener('fullscreenchange', scheduleResize);
            observer?.disconnect();
        };
    }, []);

    const keyboardMap = [
        { name: "forward", keys: ["ArrowUp", "KeyW"] },
        { name: "backward", keys: ["ArrowDown", "KeyS"] },
        { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
        { name: "rightward", keys: ["ArrowRight", "KeyD"] },
        { name: "jump", keys: ["Space"] },
        { name: "run", keys: ["Shift"] },
        { name: "action1", keys: ["1"] },
        { name: "action2", keys: ["2"] },
        { name: "action3", keys: ["3"] },
        { name: "action4", keys: ["KeyF"] },
        { name: "escape", keys: ["Escape"] },
        { name: "climb", keys: ["KeyL"] }, // 👈 Added "L" key
        { name: "Inventory", keys: ["KeyI"] } // 👈 Added "L" key
    ];



    useEffect(() => {

        setCameraRef(cameraRef)
        setSceneRef(sceneRef)
        setOrbitControlsRef(orbitControls)



    }, [cameraRef, orbitControls, sceneRef, setCameraRef, setOrbitControlsRef, setSceneRef]);



    function getGpuInfoFromRenderer(gl) {
        // Works when gl is WebGLRenderer
        const ctx = gl.getContext?.();
        if (!ctx || typeof ctx.getExtension !== "function") return null;

        const debugInfo = ctx.getExtension("WEBGL_debug_renderer_info");
        if (!debugInfo) return { renderer: null, vendor: null, combined: null };

        const renderer = ctx.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        const vendor = ctx.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

        return { renderer, vendor, combined: `${vendor} ${renderer}` };
    }

    function isIntegratedGPU(gpuString) {
        if (!gpuString) return true;
        return /intel|iris|uhd|apple|mali|adreno|powervr|swiftshader/i.test(
            gpuString.toLowerCase()
        );
    }
    function getPerfHints(gl) {
        // Works for both WebGLRenderer and WebGPURenderer (with partial info)
        const caps = gl.capabilities || {};
        const maxTex = caps.maxTextureSize ?? null;
        const maxAniso =
            gl.extensions?.get?.("EXT_texture_filter_anisotropic")
                ? gl.getMaxAnisotropy?.() ?? null
                : null;

        return { maxTextureSize: maxTex, maxAnisotropy: maxAniso };
    }

    const onCreated = useCallback(({ camera, gl, scene }) => {

        const info = getGpuInfoFromRenderer(gl); // may return nulls on WebGPU
        const perf = getPerfHints(gl);
        cameraRef.current = camera;
        sceneRef.current = scene;
        // gl.lighting = lighting
        glRef.current = gl;
        // Heuristic: if no GPU string, decide from caps (tune thresholds)
        const lowByCaps =
            (perf.maxTextureSize != null && perf.maxTextureSize <= 4096) ||
            (perf.maxAnisotropy != null && perf.maxAnisotropy <= 2);

        const lowByName = isIntegratedGPU(info?.combined);

        setIsLowGpu(info?.combined ? lowByName : lowByCaps);

    }, []);

    const [{ isAssetOver }, assetDropRef] = useDrop(() => ({
        accept: EDITOR_ASSET_DND_TYPE,
        drop: (item, monitor) => {
            const clientOffset = monitor.getClientOffset();

            if (!clientOffset || !item) {
                return undefined;
            }

            window.dispatchEvent(new CustomEvent('editor-asset-dnd-drop', {
                detail: {
                    item,
                    clientOffset,
                },
            }));

            return { dropped: true };
        },
        collect: (monitor) => ({
            isAssetOver: monitor.isOver({ shallow: true }) && monitor.canDrop(),
        }),
    }), []);

    const setCanvasHostNode = useCallback((node) => {
        canvasHostRef.current = node;
        assetDropRef(node);
    }, [assetDropRef]);

    const zoomOverlay = (
        <div className="webglstudio-zoom-toolstrip">
            <ZoomSlider camera={cameraRef} orbitControls={orbitControls} />
        </div>
    );
    const layerOverlay = isPuzzleGame && !isMobile && buttonMode === 'Edit Mode' ? (
        <div className="webglstudio-layer-toolstrip">
            <LayerOptions />
        </div>
    ) : null;
    const coordinateOverlay = buttonMode === 'Edit Mode' ? (
        <ViewportMouseCoordinates cameraRef={cameraRef} canvasHostRef={canvasHostRef} />
    ) : null;
    const isGameRuntime = isPuzzleGame && buttonMode === 'Play mode';
    const projectBaseId = String(projectId).replace(/_L\d+$/i, "");
    const isCadProject = projectBaseId === "151";
    const disableAntialiasing = isLowGpu || String(projectId) === "153_L1";
    const canvasBackground = isCadProject ? '#4a4a4a' : (isGameRuntime ? '#000' : '#fff');
    const showUrlViewControls = isUrlLevelProjectLaunch() && !isCadProject && !isPuzzleGame;
    const googleMapsViewportMode = useSyncExternalStore(
        (callback) => subscribeGoogleMapsViewportMode(projectId, callback),
        () => getGoogleMapsViewportMode(projectId),
        () => "three"
    );
    const showGoogleThreeViewControls = isGoogleMapsWebGLProject(projectId) && googleMapsViewportMode === "three";
    const hasActiveProject = String(projectId ?? "").trim() !== "" && String(projectId ?? "").trim() !== "0";
    const showPlayerRuntimeControls = hasActiveProject && (character || firstPerson);

    // if(isLowGpu===null) return null
    const zoomSelectedAsset = useCallback(() => {
        const instanceId = selectedAssetId
            || selectedEditorInstance?.instanceId
            || selectedEditorInstance?.apiObject?.instanceId
            || selectedEditorInstance?.apiObject?.instance_id;
        const sceneAsset = sceneAssets[instanceId];
        const selectedObject = selectedEditorInstance?.object;
        const assetObj = sceneAsset || (
            selectedObject?.position
                ? {
                    position: selectedObject.position,
                    halfHeight: selectedEditorInstance?.apiObject?.halfHeight || selectedObject.scale?.y || 1,
                    width: selectedEditorInstance?.apiObject?.width || selectedEditorInstance?.apiObject?.halfWidth || selectedObject.scale?.x || 1,
                    length: selectedEditorInstance?.apiObject?.length || selectedEditorInstance?.apiObject?.halfLength || selectedObject.scale?.z || 1,
                }
                : null
        );

     

        if (!assetObj?.position || !cameraRef.current || !orbitControls.current) {
            return false;
        }

        const center = assetObj.position.clone
            ? assetObj.position.clone()
            : new THREE.Vector3(assetObj.position.x || 0, assetObj.position.y || 0, assetObj.position.z || 0);
        const halfHeight = Number(assetObj.halfHeight) || 0;
        const width = Number(assetObj.width || assetObj.halfWidth || 0);
        const length = Number(assetObj.length || assetObj.halfLength || 0);
        const boxSize = Math.max(width, length, halfHeight, 1);
        const fov = (cameraRef.current.fov || 45) * (Math.PI / 180);
        const distance = (((boxSize / (2 * Math.tan(fov / 2))) / 100) * 2) + 0.5;
        const camPosition = center.clone().add(new THREE.Vector3(0, distance, 0));

        cameraRef.current.position.copy(camPosition);
        cameraRef.current.lookAt(center);
        cameraRef.current.updateProjectionMatrix?.();

        orbitControls.current.target.copy(center);
        orbitControls.current.update?.();

        return true;
    }, [selectedAssetId, selectedEditorInstance]);

    useEffect(() => {
        document.body.classList.toggle('is-game-runtime-mode', Boolean(isGameRuntime));
        document.documentElement.classList.toggle('is-game-runtime-mode', Boolean(isGameRuntime));

        return () => {
            document.body.classList.remove('is-game-runtime-mode');
            document.documentElement.classList.remove('is-game-runtime-mode');
        };
    }, [isGameRuntime]);

    useEffect(() => {
        const handleDotZoomKey = (event) => {
     

            if (buttonMode !== 'Edit Mode') {
                return;
            }

            if (!isDotZoomKey(event) || event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            if (isTypingTarget(event.target) && event.code !== 'NumpadDecimal') {
                return;
            }

            const didZoom = zoomSelectedAsset();
            window.dispatchEvent(new CustomEvent('editor-zoom-selected-asset'));

            if (didZoom) {
                event.preventDefault();
                event.stopImmediatePropagation?.();
            }
        };

        window.addEventListener('keydown', handleDotZoomKey, true);
        document.addEventListener('keydown', handleDotZoomKey, true);

        return () => {
            window.removeEventListener('keydown', handleDotZoomKey, true);
            document.removeEventListener('keydown', handleDotZoomKey, true);
        };
    }, [buttonMode, zoomSelectedAsset]);

    return (

        <>
            {((character || firstPerson) && isTouchScreen) && <EcctrlJoystick buttonNumber={2} />}
            <Toast ref={toast} />
            {/*<button onClick={enterVR} style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000 }}>*/}
            {/*    Enter VR*/}
            {/*</button>*/}
            <div
                ref={setCanvasHostNode}
                className={`canvas-element${isAssetOver ? ' is-asset-drop-target' : ''}`}
            >

                <Canvas
                    style={{ background: canvasBackground }}
                    dpr={[0.5, 1]}
                    performance={{ min: 0.5 }}
                    gl={{
                        antialias: !disableAntialiasing,
                        powerPreference: "high-performance", // safe to keep
                        logarithmicDepthBuffer: true,
                        outputColorSpace: THREE.SRGBColorSpace,
                        // toneMappingExposure: 0.92,
                        // Optionally add: alpha: false,  // if you don't need transparency
                    }}

                    onCreated={onCreated}
                    camera={{
                        fov: 45,
                        near: MIN_SCENE_CAMERA_NEAR,
                        far: DEFAULT_SCENE_CAMERA_FAR,
                        position: [1, 5, 10]

                    }}
                >
                    {/*<XR store={store}>*/}
                    {/*<DefaultXRControllers />*/}
                    {/*<Teleport enabled={character || firstPerson} />*/}

                    <>

                        {
                            projectId === 145 ? (
                                <PhysicsProvider>
                                    <Scene orbitControls={orbitControls} />
                                </PhysicsProvider>
                            ) : (
                                <>
                                    <Physics debug={false} gravity={[0, -9.81, 0]}>
                                        {/*<Bvh  firstHitOnly>*/}
                                        <KeyboardControls map={keyboardMap}>

                                            {/*<GamePlayer/>*/}
                                            {/* <Ground scene={sceneRef.current} /> */}

                                            

                                            {(isPuzzleGame!==null && isPuzzleGame===false)  && projectId!==0 && (
                                              
                                                <>
                                                <Player
                                                    key='person'
                                                    client={client}
                                                    orbitControls={orbitControls}
                                                />
                                                {/* <AIChaserDebug enabled={character || firstPerson} /> */}
                                                <Floor />

                                                {String(projectId).includes('151') && <SingleEdgesDrawing orbitControls={orbitControls} />}

                                                { !String(projectId).includes('151') &&
                                                <InstanceExperience key={`instanceexperience-${projectId}`} />
                                                }
                                                <directionalLight ref={directionalLightRef} position={[5, 10, 5]} intensity={String(projectId).includes('137') ? 6.5 : 4.5} />
                                                <AvatarEyeDirectionalLight
                                                    lightRef={directionalLightRef}
                                                    enabled={false}
                                                />
                                                <Ground />
                                                <ambientLight intensity={String(projectId).includes('137') ? 3 : 1.5} />
                                                </>
                                            )}
                                            
                                            {isPuzzleGame  && projectId!==0 && !String(projectId).includes('151') &&

                                            <>
                                                <directionalLight position={[5, 10, 5]} intensity={0.8} />
                                                <ambientLight intensity={0.6} />
                                             <GameExperience key={`gameexperience-${projectId}`} orbitControls={orbitControls} client={client} />
                                             <AIChaserDebug enabled={character || firstPerson} />
                                             </>
                                             }

                                            {packageControl &&
                                                <>
                                                    <directionalLight position={[4, 8, 6]} intensity={3.2} />
                                                    <directionalLight position={[-4, 5, -5]} intensity={1.6} />
                                                    <ambientLight intensity={1.4} />
                                                    <PackageRuntimeBridge />
                                                </>
                                            }

                                            

                                        </KeyboardControls>
                                        {/*</Bvh >*/}
                                    </Physics>
                                    {!isPuzzleGame && <Events orbitControls={orbitControls} />}
                                </>
                            )}
                    </>

                    {!character && !firstPerson  && <ZoomAsset orbitControls={orbitControls} toast={toast} gl={glRef} />}
                    <CheckLabel />
                    <PlayerHudCleanUp client={client} />

                    

                    {(!packageControl && showGrid) &&
                        <WebGLStudioGrid />
                        
                        }
                    {/* <directionalLight position={[5, 10, 10]} intensity={0.7} /> */}
                    <ProjectSkyClouds projectBaseId={projectBaseId} />


                    <MapControls ref={orbitControls} />
                    <AdaptiveDpr pixelated />
                    {!packageControl && !isPackage && <Stats className="r3f-stats" showPanel={0} />}
                   
                    {/*</XR>*/}
                </Canvas>
                {isCadProject && <SingleEdgesOverlay cameraRef={cameraRef} />}
            </div>

            {editorShellNode ? createPortal(zoomOverlay, editorShellNode) : zoomOverlay}
            {editorShellNode ? createPortal(layerOverlay, editorShellNode) : layerOverlay}
            {editorShellNode ? createPortal(coordinateOverlay, editorShellNode) : coordinateOverlay}
            {isGameRuntime && <GameRuntimeChrome cameraRef={cameraRef} />}
            {!isPuzzleGame && !isCadProject && (buttonMode === 'Play mode' || showUrlViewControls || showGoogleThreeViewControls) && <PlayModeViewControls />}
            {/* {!isPuzzleGame && buttonMode === 'Play mode' && <PlayCategoryPopup />} */}
            {!isPuzzleGame && <PlayAssetInfoHud cameraRef={cameraRef} sceneRef={sceneRef} />}
            {isGameRuntime && <AvatarSetupConfirm />}
            {showAvatarLoadingOverlay && <AvatarLoadingOverlay />}


            {isPuzzleGame && <PuzzleAssetPlacementController scene={sceneRef.current} />}
            {(character || firstPerson) && isPuzzleGame && <StatsPopup />}
            {buttonMode !== 'Play mode' && <AssetDragDrop cameraRef={cameraRef} sceneRef={sceneRef} orbitControls={orbitControls} />}
            <Roof scene={sceneRef.current} />
            {/* <Hud camera={cameraRef} /> */}
            {!selectedAssetName && <DarkForm scene={sceneRef.current} />}
            <PopupInfo />
            {/* <SceneGrid scene={sceneRef.current} /> */}
            <MiniMap scene={sceneRef.current} />

            {/* {(((character || firstPerson) && !isPuzzleGame)) &&
                <>
                    <CharacterJumpSpeed />
                    <CharacterRotationSpeed />
                    <SpeedMeter />
                </>


            } */}
            {/*{(character || firstPerson) && < Controls/>}*/}

            {/* <Camera /> */}
            <PlayersGridView />
            <AssetsGrid />
            <Cordinates />
            {(isPuzzleGame || (!isPuzzleGame && buttonMode === 'Play mode')) && <ShowController />}
            <Channels2 />
            <Jumpoints />
            <VideoPopup />
            <Documents />
            <Category currentMenu={currentMenu} />
            <QrPopup />
            <CameraPopup />
            <DetailPopup />
            <Notification />
            {isPuzzleGame && <GameMenu />}
            {pauseGame && <PauseMenu />}
            {/*<WaitingScreen/>*/}
            <DeleteAsset />
            <UnsavedAssetConfirmDialog />
            <CategorySelectionDialog />
            <ProductsTreeGrid />
            {packageControl && <ComponentSideBar />}
            {/*{(isPuzzleGame && !isMobile) && <AudioSpectrum/>}*/}
            {(isPuzzleGame) && <SoundTrack />}
            {/*<CategoryButton/>*/}
            <HideShowAssets scene={sceneRef} />
            <ConfirmationDialog />
            {!isMobile && isPuzzleGame && (character || firstPerson) && <InventoryUi />}
            {((character || firstPerson) && isPuzzleGame && !isMobile) && <NavigationPad />}
            {/* {((((character || firstPerson) && isGame) ) || puzzleChar) && <Interface/>} */}
            {((character || firstPerson || hasDied) && isGame && !isMobile && String(uName || "").trim()) && <PlayersRanking />}
            {((character || firstPerson || hasDied) && isGame && !isMobile && String(uName || "").trim()) && <TopScoreboard />}
            {((character || firstPerson || hasDied) && isPuzzleGame && !isMobile) && (
                <Chat
                    isMinimized={false}
                    onToggleHud={() => setIsHudMinimized((prev) => !prev)}
                />
            )}
            {showPlayerRuntimeControls &&
                <PlayerViewAngleSlider />}
            {(showPlayerRuntimeControls && !isPuzzleGame) &&
                <>
                    <PlayerHeightSlider direction='vertical' classIndenfier='height-meter' height='10rem' />
                </>}
            <Projects scene={sceneRef.current} camera={cameraRef.current} orbitControls={orbitControls} />
            {packageControl && <PackageControls />}
        </>

    )
}





