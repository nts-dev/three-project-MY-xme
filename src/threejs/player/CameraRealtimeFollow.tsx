import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import { socket } from "../../socket";

const CAMERA_FOLLOW_DISTANCE = 8.5;
const CAMERA_FOLLOW_HEIGHT = -6;
const MIN_CAMERA_ELEVATION = THREE.MathUtils.degToRad(-20);
const MAX_CAMERA_ELEVATION = THREE.MathUtils.degToRad(66);
const CAMERA_POSITION_SMOOTHING = 7;
const CAMERA_TARGET_SMOOTHING = 8;
const MOVEMENT_DIRECTION_EPSILON = 0.00004;
const GPS_UPDATE_TIMEOUT_MS = 3000;

function toNumber(value: any, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toScenePosition(player: any, target: THREE.Vector3) {
    const position = player?.position || {};
    target.set(
        toNumber(position.x, toNumber(player?.three_x, toNumber(player?.posX) / 100)),
        toNumber(position.y, toNumber(player?.posY) / 100),
        toNumber(position.z, toNumber(player?.three_z, toNumber(player?.posZ) / 100))
    );
    return target;
}

function getCameraFollowHeight(_projectID: any) {
    return CAMERA_FOLLOW_HEIGHT
}

function getClampedViewElevation(playerViewAngle: any) {
    return THREE.MathUtils.clamp(
        toNumber(playerViewAngle),
        MIN_CAMERA_ELEVATION,
        MAX_CAMERA_ELEVATION
    );
}

function getForwardTargetY(cameraY: number, viewElevation: number) {
    return cameraY - Math.tan(viewElevation) * CAMERA_FOLLOW_DISTANCE;
}

export default function CameraRealtimeFollow() {
    const { camera } = useThree();
    const projectID = useGame((state: any) => state.projectID);
    const cameraRealtimeFollow = useGame((state: any) => state.cameraRealtimeFollow);
    const playerViewAngle = useGame((state: any) => state.playerViewAngle);
    const orbitControlsRef = useGame((state: any) => state.orbitControlsRef);
    const followedPlayerRef = useRef<any>(null);
    const lastGpsUpdateAtRef = useRef(0);
    const currentPositionRef = useRef(new THREE.Vector3());
    const previousPositionRef = useRef(new THREE.Vector3());
    const remotePositionRef = useRef(new THREE.Vector3());
    const followDirectionRef = useRef(new THREE.Vector3(0, 0, 1));
    const desiredCameraRef = useRef(new THREE.Vector3());
    const desiredTargetRef = useRef(new THREE.Vector3());
    const smoothedTargetRef = useRef(new THREE.Vector3());
    const hasPositionRef = useRef(false);

    useEffect(() => {
        if (!cameraRealtimeFollow) {
            followedPlayerRef.current = null;
            lastGpsUpdateAtRef.current = 0;
            hasPositionRef.current = false;
            return undefined;
        }

        const handlePlayers = (players: any[]) => {
            const nextPlayer = Array.isArray(players)
                ? players.find((player) => player?.position || player?.posX !== undefined || player?.three_x !== undefined)
                : null;

            followedPlayerRef.current = nextPlayer || null;
            lastGpsUpdateAtRef.current = nextPlayer ? performance.now() : 0;
        };

        socket.on("playersUpdate", handlePlayers);

        return () => {
            socket.off("playersUpdate", handlePlayers);
        };
    }, [cameraRealtimeFollow]);

    useEffect(() => {
        const controls = orbitControlsRef?.current;
        if (!cameraRealtimeFollow || !controls) return undefined;

        const previousEnabled = controls.enabled;
        controls.enabled = false;
        camera.position.set(0, getCameraFollowHeight(projectID), 0);
        const originTargetY = getForwardTargetY(camera.position.y, getClampedViewElevation(playerViewAngle));
        camera.lookAt(0, originTargetY, -CAMERA_FOLLOW_DISTANCE);
        controls.target.set(0, originTargetY, -CAMERA_FOLLOW_DISTANCE);
        controls.update?.();
        smoothedTargetRef.current.copy(controls.target);

        return () => {
            controls.enabled = previousEnabled;
        };
    }, [cameraRealtimeFollow, camera, orbitControlsRef, projectID]);

    useFrame((_, delta) => {
        if (!cameraRealtimeFollow) return;

        const hasFreshGpsUpdate = followedPlayerRef.current
            && performance.now() - lastGpsUpdateAtRef.current <= GPS_UPDATE_TIMEOUT_MS;

        if (!hasFreshGpsUpdate && !hasPositionRef.current) {
            followedPlayerRef.current = null;
            camera.position.set(0, getCameraFollowHeight(projectID), 0);
            const originTargetY = getForwardTargetY(camera.position.y, getClampedViewElevation(playerViewAngle));
            const controls = orbitControlsRef?.current;
            if (controls?.target) {
                controls.target.set(0, originTargetY, -CAMERA_FOLLOW_DISTANCE);
                controls.update?.();
            } else {
                camera.lookAt(0, originTargetY, -CAMERA_FOLLOW_DISTANCE);
            }
            camera.updateMatrixWorld();
            return;
        }

        if (hasFreshGpsUpdate) {
            toScenePosition(followedPlayerRef.current, currentPositionRef.current);
        } else {
            followedPlayerRef.current = null;
        }

        if (!hasPositionRef.current) {
            hasPositionRef.current = true;
            previousPositionRef.current.copy(currentPositionRef.current);
            smoothedTargetRef.current.copy(currentPositionRef.current);
            smoothedTargetRef.current.y += getCameraFollowHeight(projectID);
        }

        const movementDirection = remotePositionRef.current
            .copy(currentPositionRef.current)
            .sub(previousPositionRef.current);
        movementDirection.y = 0;

        if (movementDirection.lengthSq() > MOVEMENT_DIRECTION_EPSILON) {
            followDirectionRef.current.lerp(movementDirection.normalize(), 1 - Math.exp(-9 * delta)).normalize();
        }

        const baseCameraHeight = getCameraFollowHeight(projectID);
        const viewElevation = getClampedViewElevation(playerViewAngle);

        desiredCameraRef.current
            .copy(currentPositionRef.current)
            .addScaledVector(followDirectionRef.current, -CAMERA_FOLLOW_DISTANCE);
        desiredCameraRef.current.y += baseCameraHeight;

        desiredTargetRef.current
            .copy(currentPositionRef.current)
            .addScaledVector(followDirectionRef.current, CAMERA_FOLLOW_DISTANCE);
        desiredTargetRef.current.y = getForwardTargetY(desiredCameraRef.current.y, viewElevation);

        const positionAlpha = 1 - Math.exp(-CAMERA_POSITION_SMOOTHING * delta);
        const targetAlpha = 1 - Math.exp(-CAMERA_TARGET_SMOOTHING * delta);
        camera.position.lerp(desiredCameraRef.current, positionAlpha);
        smoothedTargetRef.current.lerp(desiredTargetRef.current, targetAlpha);

        const controls = orbitControlsRef?.current;
        if (controls?.target) {
            controls.target.copy(smoothedTargetRef.current);
            controls.update?.();
        } else {
            camera.lookAt(smoothedTargetRef.current);
        }

        camera.updateMatrixWorld();
        previousPositionRef.current.copy(currentPositionRef.current);
    });

    return null;
}
