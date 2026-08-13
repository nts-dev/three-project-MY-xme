import React, { useEffect, useRef, useState } from "react";
import { createRoot, useFrame, useThree } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Provider } from "react-redux";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import reduxStore from "../../store/store";
import InstanceExperience from "../../threejs/InstanceExperience.jsx";
import Player from "../../threejs/player/Player.tsx";
import {
    GOOGLE_MAP_ID,
    loadGoogleMaps,
    PROJECT_153_L0_MODEL_ORIGIN,
} from "./ProjectGoogleWebGLMap.jsx";
import "./ProjectGoogleWebGLMap.css";

const PROJECT_153_L0_MODEL_SCALE = 0.7;
const PROJECT_GOOGLE_TO_THREE_ZOOM_EPSILON = 0.01;
const GOOGLE_OVERLAY_HIDDEN_OBJECT_NAMES = new Set(["floor_cube"]);
const PLAYER_CAMERA_FOV = 45;
const PLAYER_CAMERA_NEAR = 0.05;
const PLAYER_CAMERA_FAR = 100000000;

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
    { name: "climb", keys: ["KeyL"] },
    { name: "Inventory", keys: ["KeyI"] },
];

function Project153L0SceneObjTransform({ hybridCameraState }) {
    const { scene } = useThree();
    const modelYaw = THREE.MathUtils.degToRad(PROJECT_153_L0_MODEL_ORIGIN.modelYawDegrees || 0);
    const modelOffset = PROJECT_153_L0_MODEL_ORIGIN.modelOffsetMeters || {};

    useFrame(() => {
        const sceneObj = scene.getObjectByName("sceneObj");
        if (!sceneObj) return;

        const virtualZoom = Math.max(0, Number(hybridCameraState?.virtualZoom) || 0);
        const virtualScale = 2 ** virtualZoom;

        sceneObj.position.set(
            Number(modelOffset.x) || 0,
            Number(modelOffset.y) || 0,
            Number(modelOffset.z) || 0
        );
        sceneObj.rotation.y = modelYaw;
        sceneObj.scale.setScalar(PROJECT_153_L0_MODEL_SCALE * virtualScale);
        sceneObj.updateMatrixWorld();
    });

    return null;
}

function isLargeOverlayPlaneArtifact(object) {
    if (!object?.isMesh || !object.geometry) return false;

    const name = String(object.name || object.parent?.name || "").toLowerCase();
    if (GOOGLE_OVERLAY_HIDDEN_OBJECT_NAMES.has(name)) {
        return true;
    }

    if (!String(object.geometry.type || "").toLowerCase().includes("plane")) {
        return false;
    }

    object.geometry.computeBoundingBox?.();
    const box = object.geometry.boundingBox;
    if (!box) return false;

    const size = new THREE.Vector3();
    box.getSize(size);
    return Math.max(size.x, size.y, size.z) >= 1000;
}

function Project153L0OverlayArtifactCleanup() {
    const { scene } = useThree();

    useFrame(() => {
        scene.traverse((object) => {
            if (!isLargeOverlayPlaneArtifact(object)) return;

            object.visible = false;
            object.userData.__projectGoogleMapsHidden = true;
        });
    });

    return null;
}

function Project153L0PlayerOrbitBridge({ orbitControlsRef }) {
    const { camera } = useThree();

    useEffect(() => {
        const target = new THREE.Vector3();
        orbitControlsRef.current = {
            target,
            update: () => {
                camera.lookAt(target);
                camera.updateMatrixWorld?.();
            },
            getAzimuthalAngle: () => {
                const direction = new THREE.Vector3();
                camera.getWorldDirection(direction);
                return Math.atan2(direction.x, direction.z);
            },
        };

        return () => {
            orbitControlsRef.current = null;
        };
    }, [camera, orbitControlsRef]);

    return null;
}

function Project153L0PlayerSpawnTarget() {
    const { scene } = useThree();
    const setSearchCenter = useGame((state) => state.setSearchCenter);
    const hasSetSpawnRef = useRef(false);

    useFrame(() => {
        if (hasSetSpawnRef.current) return;

        const sceneObj = scene.getObjectByName("sceneObj");
        if (!sceneObj) return;

        const bounds = new THREE.Box3().setFromObject(sceneObj);
        if (bounds.isEmpty()) return;

        const center = new THREE.Vector3();
        bounds.getCenter(center);
        center.y = bounds.min.y + 1;
        setSearchCenter(center);
        hasSetSpawnRef.current = true;
    });

    return null;
}

function Project153L0OverlayScene({ hybridCameraState }) {
    const orbitControlsRef = useRef(null);

    return (
        <KeyboardControls map={keyboardMap}>
            <Physics debug={false} gravity={[0, -9.81, 0]}>
                <group>
                    <InstanceExperience />
                </group>
                <Player client="" orbitControls={orbitControlsRef} />
            </Physics>
            <Project153L0SceneObjTransform hybridCameraState={hybridCameraState} />
            <Project153L0OverlayArtifactCleanup />
            <Project153L0PlayerOrbitBridge orbitControlsRef={orbitControlsRef} />
            <Project153L0PlayerSpawnTarget />
            <directionalLight position={[5, 10, 5]} intensity={4.5} />
            <ambientLight intensity={1.5} />
        </KeyboardControls>
    );
}

function createGoogleMapsR3FOverlay({ maps, map, anchor, hybridCameraState }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    camera.userData.__projectGoogleMapsOverlayCamera = true;
    const rotationArray = new Float32Array([90, 0, 0]);
    const r3fCanvas = document.createElement("canvas");
    let renderer = null;
    let root = null;
    let store = null;

    const overlay = new maps.WebGLOverlayView();

    overlay.onContextRestored = ({ gl }) => {
        renderer = new THREE.WebGLRenderer({
            canvas: gl.canvas,
            context: gl,
            ...gl.getContextAttributes(),
        });
        renderer.autoClear = false;
        renderer.autoClearDepth = false;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const width = gl.canvas.width;
        const height = gl.canvas.height;
        renderer.setViewport(0, 0, width, height);

        root = createRoot(r3fCanvas);
        root.configure({
            gl: renderer,
            scene,
            camera: Object.assign(camera, { manual: true }),
            frameloop: "never",
            size: { width, height, top: 0, left: 0 },
            dpr: 1,
            onCreated: (state) => {
                state.gl.autoClear = false;
                state.scene.background = null;
            },
        });
        store = root.render(
            <Provider store={reduxStore}>
                <Project153L0OverlayScene hybridCameraState={hybridCameraState} />
            </Provider>
        );
    };

    overlay.onDraw = ({ gl, transformer }) => {
        if (!renderer || !store) return;

        const width = gl.canvas.width;
        const height = gl.canvas.height;
        renderer.setViewport(0, 0, width, height);
        const isPlayerCameraActive = Boolean(
            useGame.getState?.().firstPerson || useGame.getState?.().character
        );

        if (isPlayerCameraActive) {
            camera.fov = PLAYER_CAMERA_FOV;
            camera.aspect = width / Math.max(height, 1);
            camera.near = PLAYER_CAMERA_NEAR;
            camera.far = PLAYER_CAMERA_FAR;
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld();
            camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
        } else {
            camera.projectionMatrix.fromArray(
                transformer.fromLatLngAltitude(anchor, rotationArray)
            );
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
            camera.matrixWorld.identity();
            camera.matrixWorldInverse.identity();
        }

        gl.disable(gl.SCISSOR_TEST);
        store.getState().advance(performance.now(), true);
        renderer.resetState();
        overlay.requestRedraw();
    };

    overlay.onContextLost = () => {
        root?.unmount();
        root = null;
        store = null;
        renderer?.dispose();
        renderer = null;
    };

    overlay.onRemove = () => {
        root?.unmount();
        root = null;
        store = null;
        renderer?.dispose();
        renderer = null;
    };

    overlay.setMap(map);
    return overlay;
}

function publishResolvedOrigin(origin) {
    window.__NTS_PROJECT_153_L0_MODEL_ORIGIN = origin;
    window.dispatchEvent(new CustomEvent("project-153-l0-model-origin", { detail: origin }));
}

function moveProjectCamera(map, cameraOptions, center) {
    map.moveCamera({
        center,
        zoom: cameraOptions.zoom,
        heading: cameraOptions.heading,
        tilt: cameraOptions.tilt,
    });

    window.requestAnimationFrame(() => {
        map.setZoom(cameraOptions.zoom);
        map.moveCamera({
            center,
            zoom: cameraOptions.zoom,
            heading: cameraOptions.heading,
            tilt: cameraOptions.tilt,
        });
    });
}

function installProjectMapWheelCamera(map, element, cameraOptions, hybridCameraState) {
    const cameraState = {
        requestedZoom: cameraOptions.zoom,
        googleZoom: cameraOptions.zoom,
        googleZoomThreshold: null,
        hasWheelZoomed: false,
        virtualZoom: 0,
        heading: cameraOptions.heading,
        tilt: cameraOptions.tilt,
    };
    Object.assign(hybridCameraState, cameraState);

    const syncFromMap = () => {
        const actualZoom = map.getZoom?.() ?? cameraState.googleZoom;
        cameraState.googleZoom = actualZoom;
        cameraState.heading = map.getHeading?.() ?? cameraState.heading;
        cameraState.tilt = map.getTilt?.() ?? cameraState.tilt;

        if (
            !cameraState.hasWheelZoomed &&
            cameraState.googleZoomThreshold == null &&
            cameraState.virtualZoom === 0 &&
            actualZoom < cameraState.requestedZoom - PROJECT_GOOGLE_TO_THREE_ZOOM_EPSILON
        ) {
            cameraState.requestedZoom = actualZoom;
        }

        if (
            cameraState.hasWheelZoomed &&
            cameraState.requestedZoom > actualZoom + PROJECT_GOOGLE_TO_THREE_ZOOM_EPSILON &&
            (cameraState.googleZoomThreshold == null || actualZoom <= cameraState.googleZoomThreshold + PROJECT_GOOGLE_TO_THREE_ZOOM_EPSILON)
        ) {
            cameraState.googleZoomThreshold = actualZoom;
        }
        updateHybridZoom();
    };

    const updateHybridZoom = () => {
        const threshold = cameraState.googleZoomThreshold;
        const baseZoom = threshold == null ? cameraState.googleZoom : threshold;
        cameraState.virtualZoom = Math.max(0, cameraState.requestedZoom - baseZoom);
        Object.assign(hybridCameraState, cameraState);
    };

    const moveCamera = () => {
        const threshold = cameraState.googleZoomThreshold;
        const googleZoom = threshold == null
            ? cameraState.requestedZoom
            : Math.min(cameraState.requestedZoom, threshold);

        map.moveCamera({
            center: map.getCenter?.(),
            zoom: googleZoom,
            heading: cameraState.heading,
            tilt: cameraState.tilt,
        });
        updateHybridZoom();
    };

    const onWheel = (event) => {
        event.preventDefault();
        event.stopPropagation();

        cameraState.hasWheelZoomed = true;
        cameraState.requestedZoom = Math.max(0, cameraState.requestedZoom - event.deltaY * 0.008);
        if (
            cameraState.googleZoomThreshold != null &&
            cameraState.requestedZoom <= cameraState.googleZoomThreshold + PROJECT_GOOGLE_TO_THREE_ZOOM_EPSILON
        ) {
            cameraState.googleZoomThreshold = null;
            cameraState.virtualZoom = 0;
        }

        moveCamera();
        window.requestAnimationFrame(syncFromMap);
    };

    element.addEventListener("wheel", onWheel, { capture: true, passive: false });
    const idleListener = window.google?.maps?.event?.addListener?.(map, "idle", syncFromMap);

    return () => {
        element.removeEventListener("wheel", onWheel, { capture: true });
        idleListener?.remove?.();
    };
}

function publishMapCalibrationTools({ maps, map, getOverlay, setOverlay, getAnchor, setAnchor, hybridCameraState }) {
    const rebuildOverlay = (nextCenter, altitude = 0) => {
        const nextAnchor = {
            lat: Number(nextCenter.lat),
            lng: Number(nextCenter.lng),
            altitude: Number(altitude) || 0,
        };

        getOverlay()?.setMap(null);
        setAnchor(nextAnchor);
        setOverlay(createGoogleMapsR3FOverlay({ maps, map, anchor: nextAnchor, hybridCameraState }));
        map.moveCamera({ center: nextCenter });
        publishResolvedOrigin({
            ...PROJECT_153_L0_MODEL_ORIGIN,
            center: nextCenter,
            anchor: nextAnchor,
            geocodeStatus: "MANUAL",
        });
        console.info("153_L0 Google overlay origin set", nextAnchor);
        return nextAnchor;
    };

    window.__NTS_153_L0_GET_MAP_CENTER = () => {
        const center = map.getCenter()?.toJSON?.();
        console.info("153_L0 map center", center);
        return center;
    };

    window.__NTS_153_L0_GET_MODEL_ORIGIN = () => {
        const anchor = getAnchor();
        console.info("153_L0 model origin", anchor);
        return anchor;
    };

    window.__NTS_153_L0_SET_MODEL_ORIGIN = (lat, lng, altitude = 0) =>
        rebuildOverlay({ lat: Number(lat), lng: Number(lng) }, altitude);

    window.__NTS_153_L0_GET_CAMERA = () => {
        const camera = {
            center: map.getCenter()?.toJSON?.(),
            zoom: map.getZoom?.(),
            requestedZoom: hybridCameraState?.requestedZoom,
            virtualZoom: hybridCameraState?.virtualZoom,
            googleZoomThreshold: hybridCameraState?.googleZoomThreshold,
            heading: map.getHeading?.(),
            tilt: map.getTilt?.(),
        };
        console.info("153_L0 camera", camera);
        return camera;
    };

    window.__NTS_153_L0_SET_CAMERA = (zoom, tilt = map.getTilt?.(), heading = map.getHeading?.()) => {
        const center = map.getCenter()?.toJSON?.() || PROJECT_153_L0_MODEL_ORIGIN.center;
        const camera = {
            ...PROJECT_153_L0_MODEL_ORIGIN.camera,
            zoom: Number(zoom),
            tilt: Number(tilt),
            heading: Number(heading),
        };
        if (hybridCameraState) {
            hybridCameraState.requestedZoom = camera.zoom;
            hybridCameraState.virtualZoom = 0;
            hybridCameraState.googleZoomThreshold = null;
        }
        moveProjectCamera(map, camera, center);
        console.info("153_L0 camera requested", camera, "actual zoom", map.getZoom?.());
        return window.__NTS_153_L0_GET_CAMERA();
    };

    return maps.event.addListener(map, "click", (event) => {
        const point = event.latLng?.toJSON?.();
        if (point) {
            console.info("153_L0 clicked map coordinate", point);
        }
    });
}

export default function ProjectGoogleMapsThreeScene() {
    const hostRef = useRef(null);
    const [error, setError] = useState("");
    const setIsGame = useGame((state) => state.setIsGame);
    const setIsPuzzleGame = useGame((state) => state.setIsPuzzleGame);
    const setGrid = useGame((state) => state.setGrid);
    const setCharacter = useGame((state) => state.setCharacter);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setPauseGame = useGame((state) => state.setPauseGame);
    const setButtonMode = useGame((state) => state.setButtonMode);

    useEffect(() => {
        let cancelled = false;

        setGrid(false);
        setCharacter(false);
        setFirstPerson(false);
        setPauseGame(false);
        setButtonMode("Edit Mode");
        setIsPuzzleGame(null);

        fetch(`${import.meta.env.VITE_API_URL}/checkGame/153`)
            .then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
            .then((data) => {
                if (cancelled) return;

                setIsGame(parseInt(data?.[0]?.isGame, 10) > 0);
                setIsPuzzleGame(parseInt(data?.[0]?.isPuzzleGame, 10) > 0);
            })
            .catch((bootstrapError) => {
                if (cancelled) return;

                console.warn("Project 153_L0 game bootstrap failed; using editor scene defaults.", bootstrapError);
                setIsGame(false);
                setIsPuzzleGame(false);
            });

        return () => {
            cancelled = true;
        };
    }, [setButtonMode, setCharacter, setFirstPerson, setGrid, setIsGame, setIsPuzzleGame, setPauseGame]);

    useEffect(() => {
        if (!hostRef.current) return;

        let map = null;
        let overlay = null;
        let anchor = null;
        let calibrationListener = null;
        let wheelCameraCleanup = null;
        const hybridCameraState = {};
        let cancelled = false;
        window.__NTS_153_L0_HYBRID_CAMERA_STATE = hybridCameraState;

        loadGoogleMaps()
            .then((maps) => {
                if (cancelled || !hostRef.current) return;

                map = new maps.Map(hostRef.current, {
                    center: PROJECT_153_L0_MODEL_ORIGIN.center || PROJECT_153_L0_MODEL_ORIGIN.fallbackCenter,
                    zoom: PROJECT_153_L0_MODEL_ORIGIN.camera.zoom,
                    heading: PROJECT_153_L0_MODEL_ORIGIN.camera.heading,
                    tilt: PROJECT_153_L0_MODEL_ORIGIN.camera.tilt,
                    mapId: GOOGLE_MAP_ID,
                    mapTypeId: maps.MapTypeId?.HYBRID || "hybrid",
                    renderingType: maps.RenderingType?.VECTOR,
                    isFractionalZoomEnabled: true,
                    disableDefaultUI: false,
                    fullscreenControl: true,
                    gestureHandling: "greedy",
                    keyboardShortcuts: true,
                });
                wheelCameraCleanup = installProjectMapWheelCamera(
                    map,
                    hostRef.current,
                    PROJECT_153_L0_MODEL_ORIGIN.camera,
                    hybridCameraState
                );

                const geocoder = new maps.Geocoder();
                geocoder.geocode({ address: PROJECT_153_L0_MODEL_ORIGIN.address }, (results, status) => {
                    if (cancelled) return;

                    const location = status === "OK" && results?.[0]?.geometry?.location;
                    const geocodedCenter = location
                        ? { lat: location.lat(), lng: location.lng() }
                        : PROJECT_153_L0_MODEL_ORIGIN.fallbackCenter;
                    const center = PROJECT_153_L0_MODEL_ORIGIN.center || geocodedCenter || PROJECT_153_L0_MODEL_ORIGIN.fallbackCenter;
                    anchor = { ...center, altitude: 0 };

                    moveProjectCamera(map, PROJECT_153_L0_MODEL_ORIGIN.camera, center);

                    publishResolvedOrigin({
                        ...PROJECT_153_L0_MODEL_ORIGIN,
                        center,
                        geocodedCenter,
                        anchor,
                        geocodeStatus: status,
                    });

                    overlay = createGoogleMapsR3FOverlay({ maps, map, anchor, hybridCameraState });
                    calibrationListener = publishMapCalibrationTools({
                        maps,
                        map,
                        getOverlay: () => overlay,
                        setOverlay: (nextOverlay) => {
                            overlay = nextOverlay;
                        },
                        getAnchor: () => anchor,
                        setAnchor: (nextAnchor) => {
                            anchor = nextAnchor;
                        },
                        hybridCameraState,
                    });
                    setError("");
                });
            })
            .catch((loadError) => {
                console.error("Failed to initialize Google Maps Three scene:", loadError);
                setError(loadError.message || "Failed to initialize Google Maps Three scene");
            });

        return () => {
            cancelled = true;
            wheelCameraCleanup?.();
            calibrationListener?.remove?.();
            overlay?.setMap(null);
            overlay = null;
            anchor = null;
            map = null;
            delete window.__NTS_153_L0_GET_MAP_CENTER;
            delete window.__NTS_153_L0_GET_MODEL_ORIGIN;
            delete window.__NTS_153_L0_SET_MODEL_ORIGIN;
            delete window.__NTS_153_L0_GET_CAMERA;
            delete window.__NTS_153_L0_SET_CAMERA;
            delete window.__NTS_153_L0_HYBRID_CAMERA_STATE;
        };
    }, []);

    return (
        <div className="project-google-webgl-map">
            <div className="project-google-webgl-map__stage" ref={hostRef} />
            {error && (
                <div className="project-google-webgl-map__error">
                    <strong>Google Maps WebGL unavailable</strong>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
