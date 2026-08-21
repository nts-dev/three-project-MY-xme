import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { XROrigin } from "@react-three/xr";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import { getXrStickIntent, toJoystickState } from "./xrControllerInput";
import { xrStore } from "./xrStore";

const DEFAULT_HEAD_HEIGHT = 0.08;
const XR_MOVE_SPEED = 1.25;
const XR_RUN_MULTIPLIER = 1.8;
const XR_TURN_SPEED = 2.8;
const XR_TURN_ONLY_RATIO = 1.35;
const XR_KEY_CODES = {
    KeyW: "forward",
    ArrowUp: "forward",
    KeyS: "backward",
    ArrowDown: "backward",
    KeyA: "leftward",
    ArrowLeft: "leftward",
    KeyD: "rightward",
    ArrowRight: "rightward",
};

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

export default function XrPlayerOrigin() {
    const originRef = useRef(null);
    const pressedKeysRef = useRef(new Set());
    const syncedToPlayerRef = useRef(false);
    const playerPosition = useMemo(() => new THREE.Vector3(), []);
    const moveDirection = useMemo(() => new THREE.Vector3(), []);
    const cameraForward = useMemo(() => new THREE.Vector3(), []);
    const { gl } = useThree();
    const gameCharacterRef = useGame((state) => state.gameCharacterRef);
    const characterRef = useGame((state) => state.characterRef);
    const movingSpeed = useGame((state) => state.movingSpeed);
    const speedFactor = useGame((state) => state.speedFactor);

    useEffect(() => {
        const updateKey = (event, pressed) => {
            const action = XR_KEY_CODES[event.code];
            if (!action) return;
            if (pressed) pressedKeysRef.current.add(action);
            else pressedKeysRef.current.delete(action);
        };

        const onKeyDown = (event) => updateKey(event, true);
        const onKeyUp = (event) => updateKey(event, false);
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("keyup", onKeyUp, true);

        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("keyup", onKeyUp, true);
        };
    }, []);

    useFrame((_, delta) => {
        const session = xrStore.getState?.().session;
        const origin = originRef.current;
        if (!session || !origin) {
            syncedToPlayerRef.current = false;
            return;
        }

        const hasPlayerPosition = readPlayerPosition(gameCharacterRef, playerPosition)
            || readPlayerPosition(characterRef, playerPosition);
        if (!syncedToPlayerRef.current && hasPlayerPosition) {
            origin.position.copy(playerPosition);
            syncedToPlayerRef.current = true;
        }

        const safeDelta = Math.min(delta, 0.05);
        const joystick = toJoystickState(getXrStickIntent(session.inputSources));
        const keys = pressedKeysRef.current;
        const joystickActive = joystick.active;

        const xrCamera = gl.xr.getCamera();
        xrCamera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        if (cameraForward.lengthSq() < 0.0001) cameraForward.set(0, 0, -1);
        cameraForward.normalize();

        moveDirection.set(0, 0, 0);

        if (keys.has("forward")) moveDirection.add(cameraForward);
        if (keys.has("backward")) moveDirection.sub(cameraForward);
        const keyTurn = (keys.has("rightward") ? 1 : 0) - (keys.has("leftward") ? 1 : 0);

        if (joystickActive) {
            const sideAmount = Math.cos(joystick.angle) * joystick.distance;
            const forwardAmount = Math.sin(joystick.angle) * joystick.distance;
            const isTurnOnly = Math.abs(sideAmount) > Math.abs(forwardAmount) * XR_TURN_ONLY_RATIO;

            if (isTurnOnly) {
                origin.rotateY(-sideAmount * XR_TURN_SPEED * safeDelta);
            } else {
                moveDirection.addScaledVector(cameraForward, forwardAmount);
            }
        }

        if (keyTurn) {
            origin.rotateY(-keyTurn * XR_TURN_SPEED * safeDelta);
        }

        if (moveDirection.lengthSq() < 0.0001) return;

        const baseSpeed = Math.max(0.6, movingSpeed * 120 * speedFactor);
        const speed = baseSpeed * XR_MOVE_SPEED * (joystick.run ? XR_RUN_MULTIPLIER : 1);
        moveDirection.normalize().multiplyScalar(speed * safeDelta);
        origin.position.add(moveDirection);
    });

    return <XROrigin ref={originRef} />;
}
