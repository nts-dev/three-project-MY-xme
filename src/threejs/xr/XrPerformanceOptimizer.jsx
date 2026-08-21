import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { xrStore } from "./xrStore";

const XR_PIXEL_RATIO = 0.75;
const LABEL_CULL_DISTANCE = 70;
const LABEL_CULL_DISTANCE_SQ = LABEL_CULL_DISTANCE * LABEL_CULL_DISTANCE;
const LABEL_CULL_INTERVAL = 10;
const LABEL_CACHE_REFRESH_INTERVAL = 90;

function getXrSession() {
    return xrStore.getState?.().session || null;
}

function refreshBuildingLabelCache(scene, cacheRef) {
    const labels = [];
    scene?.traverse((object) => {
        if (object?.userData?.isBuildingLabel) {
            labels.push(object);
        }
    });
    cacheRef.current = labels;
}

function setBuildingLabelsVisible(scene, camera, frameCountRef, cacheFrameRef, cacheRef) {
    frameCountRef.current = (frameCountRef.current + 1) % LABEL_CULL_INTERVAL;
    cacheFrameRef.current = (cacheFrameRef.current + 1) % LABEL_CACHE_REFRESH_INTERVAL;
    if (frameCountRef.current !== 0 || !scene || !camera) {
        return;
    }

    if (!cacheRef.current.length || cacheFrameRef.current === 0) {
        refreshBuildingLabelCache(scene, cacheRef);
    }

    camera.updateWorldMatrix?.(true, false);
    const cameraPosition = camera.getWorldPosition?.(setBuildingLabelsVisible.cameraPosition);
    if (!cameraPosition) {
        return;
    }

    cacheRef.current.forEach((object) => {
        object.visible = cameraPosition.distanceToSquared(object.getWorldPosition(setBuildingLabelsVisible.labelPosition)) <= LABEL_CULL_DISTANCE_SQ;
    });
}

setBuildingLabelsVisible.cameraPosition = new THREE.Vector3();
setBuildingLabelsVisible.labelPosition = new THREE.Vector3();

export default function XrPerformanceOptimizer() {
    const { gl, scene, camera } = useThree();
    const [isPresenting, setIsPresenting] = useState(Boolean(getXrSession()));
    const previousPixelRatioRef = useRef(null);
    const previousShadowStateRef = useRef(null);
    const labelFrameRef = useRef(0);
    const labelCacheFrameRef = useRef(0);
    const labelCacheRef = useRef([]);

    useEffect(() => {
        const unsubscribe = xrStore.subscribe((state) => {
            setIsPresenting(Boolean(state.session));
        });

        return () => unsubscribe?.();
    }, []);

    useEffect(() => {
        if (!gl) {
            return undefined;
        }

        if (!isPresenting) {
            return undefined;
        }

        previousPixelRatioRef.current = gl.getPixelRatio?.() || window.devicePixelRatio || 1;
        previousShadowStateRef.current = gl.shadowMap
            ? {
                enabled: gl.shadowMap.enabled,
                autoUpdate: gl.shadowMap.autoUpdate,
                needsUpdate: gl.shadowMap.needsUpdate,
            }
            : null;

        gl.setPixelRatio?.(XR_PIXEL_RATIO);
        if (gl.shadowMap) {
            gl.shadowMap.enabled = false;
            gl.shadowMap.autoUpdate = false;
            gl.shadowMap.needsUpdate = false;
        }

        return () => {
            if (previousPixelRatioRef.current) {
                gl.setPixelRatio?.(previousPixelRatioRef.current);
            }

            if (gl.shadowMap && previousShadowStateRef.current) {
                gl.shadowMap.enabled = previousShadowStateRef.current.enabled;
                gl.shadowMap.autoUpdate = previousShadowStateRef.current.autoUpdate;
                gl.shadowMap.needsUpdate = previousShadowStateRef.current.needsUpdate;
            }

            scene?.traverse((object) => {
                if (object?.userData?.isBuildingLabel) {
                    object.visible = true;
                }
            });
        };
    }, [gl, isPresenting, scene]);

    useFrame(() => {
        if (!isPresenting) {
            return;
        }

        const xrCamera = gl.xr?.isPresenting ? gl.xr.getCamera(camera) : camera;
        setBuildingLabelsVisible(scene, xrCamera || camera, labelFrameRef, labelCacheFrameRef, labelCacheRef);
    });

    return null;
}
