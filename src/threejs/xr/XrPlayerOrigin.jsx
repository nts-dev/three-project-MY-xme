import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { XROrigin } from "@react-three/xr";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import { getXrStickIntent } from "./xrControllerInput";
import { xrStore } from "./xrStore";

const DEFAULT_HEAD_HEIGHT = 0.08;
const XR_MOVE_SPEED = 2.5;
const XR_RUN_MULTIPLIER = 1.8;
const XR_TURN_SPEED = 2.8;
const XR_TURN_ONLY_RATIO = 1.35;
const XR_MOVE_DEAD_ZONE = 0.12;
function readPlayerPosition(playerRef, target) {
    const player = playerRef?.current || playerRef;
    if (!player) return false;

    if (typeof player.translation === "function") {
        const position = player.translation();
        target.set(position.x || 0, (position.y || 0) + DEFAULT_HEAD_HEIGHT, position.z || 0);
        return true;
    }

    if (player.position) {
        target.copy(player.position);
        target.y += DEFAULT_HEAD_HEIGHT;
        return true;
    }

    return false;
}

function getHeadCamera(renderer, baseCamera) {
    return renderer.xr.getCamera(baseCamera) || baseCamera;
}

function readViewerPoseQuaternion(frame, renderer, target) {
    const referenceSpace = renderer.xr.getReferenceSpace?.();
    if (!frame || !referenceSpace) return false;

    const pose = frame.getViewerPose(referenceSpace);
    const orientation = pose?.views?.[0]?.transform?.orientation;
    if (!orientation) return false;

    target.set(orientation.x, orientation.y, orientation.z, orientation.w);
    return true;
}

function readCameraPosition(renderer, baseCamera, target) {
    const headCamera = getHeadCamera(renderer, baseCamera);
    if (!headCamera) return false;

    headCamera.updateWorldMatrix?.(true, false);
    headCamera.getWorldPosition(target);
    target.y = Math.max(target.y, DEFAULT_HEAD_HEIGHT);
    return true;
}

export default function XrPlayerOrigin() {
    const originRef = useRef(null);
    const syncedToPlayerRef = useRef(false);
    const playerPosition = useMemo(() => new THREE.Vector3(), []);
    const moveDirection = useMemo(() => new THREE.Vector3(), []);
    const cameraForward = useMemo(() => new THREE.Vector3(), []);
    const cameraQuaternion = useMemo(() => new THREE.Quaternion(), []);
    const viewerQuaternion = useMemo(() => new THREE.Quaternion(), []);
    const originQuaternion = useMemo(() => new THREE.Quaternion(), []);
    const { gl, camera } = useThree();
    const gameCharacterRef = useGame((state) => state.gameCharacterRef);
    const characterRef = useGame((state) => state.characterRef);
    const movingSpeed = useGame((state) => state.movingSpeed);
    const speedFactor = useGame((state) => state.speedFactor);

    useFrame((_, delta, frame) => {
        const session = xrStore.getState?.().session;
        const origin = originRef.current;
        if (!session || !origin) {
            syncedToPlayerRef.current = false;
            return;
        }

        if (!syncedToPlayerRef.current) {
            const hasStartPosition = readPlayerPosition(gameCharacterRef, playerPosition)
                || readPlayerPosition(characterRef, playerPosition)
                || readCameraPosition(gl, camera, playerPosition);
            if (hasStartPosition) {
                origin.position.copy(playerPosition);
                syncedToPlayerRef.current = true;
            }
        }

        const safeDelta = Math.min(delta, 0.05);
        const intent = getXrStickIntent(session.inputSources);
        const forwardAmount = -intent.moveY;
        const sideAmount = Math.abs(intent.turnX) > Math.abs(intent.moveX)
            ? intent.turnX
            : intent.moveX;
        const hasForwardInput = Math.abs(forwardAmount) > XR_MOVE_DEAD_ZONE;
        const hasSideInput = Math.abs(sideAmount) > XR_MOVE_DEAD_ZONE;

        origin.updateWorldMatrix(true, false);
        if (readViewerPoseQuaternion(frame, gl, viewerQuaternion)) {
            origin.getWorldQuaternion(originQuaternion);
            cameraQuaternion.multiplyQuaternions(originQuaternion, viewerQuaternion);
        } else {
            const headCamera = getHeadCamera(gl, camera);
            headCamera.updateWorldMatrix(true, false);
            headCamera.getWorldQuaternion(cameraQuaternion);
        }
        cameraForward.set(0, 0, -1).applyQuaternion(cameraQuaternion);
        cameraForward.y = 0;
        if (cameraForward.lengthSq() < 0.0001) cameraForward.set(0, 0, -1);
        cameraForward.normalize();

        moveDirection.set(0, 0, 0);

        if (hasSideInput) {
            const isTurnOnly = Math.abs(sideAmount) > Math.abs(forwardAmount) * XR_TURN_ONLY_RATIO;

            if (isTurnOnly) {
                origin.rotateY(-sideAmount * XR_TURN_SPEED * safeDelta);
            }
        }

        if (hasForwardInput) {
            moveDirection.addScaledVector(cameraForward, forwardAmount);
        }

        if (moveDirection.lengthSq() < 0.0001) return;

        const baseSpeed = Math.max(0.6, movingSpeed * 120 * speedFactor);
        const run = Math.abs(forwardAmount) > 0.72;
        const speed = baseSpeed * XR_MOVE_SPEED * (run ? XR_RUN_MULTIPLIER : 1);
        moveDirection.clampLength(0, 1).multiplyScalar(speed * safeDelta);
        origin.position.add(moveDirection);
    });

    return <XROrigin ref={originRef} />;
}
