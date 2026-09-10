import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import { socket } from "../../socket";

const CAMERA_FOLLOW_DISTANCE = 8.5;
const CAMERA_FOLLOW_HEIGHT = 0;
const CAMERA_FOLLOW_Y_SCALE = 0.5;
const MIN_CAMERA_ELEVATION = THREE.MathUtils.degToRad(-20);
const MAX_CAMERA_ELEVATION = THREE.MathUtils.degToRad(66);
const CAMERA_POSITION_SMOOTHING = 7;
const CAMERA_TARGET_SMOOTHING = 8;
const CAMERA_ROTATION_SMOOTHING = 5;
const CAMERA_ROTATION_DEADZONE = THREE.MathUtils.degToRad(1);
const CAMERA_STRAIGHT_PATH_DOT = Math.cos(CAMERA_ROTATION_DEADZONE);
const MOVEMENT_DIRECTION_EPSILON = 0.00004;
const GPS_UPDATE_TIMEOUT_MS = 3000;
const TELEMETRY_EMIT_INTERVAL_MS = 160;
const TELEMETRY_DISTANCE_EPSILON = 0.001;

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

function getCameraY(playerY: number, projectID: any) {
    return playerY * CAMERA_FOLLOW_Y_SCALE + getCameraFollowHeight(projectID);
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

function normalizeHeading(degrees: number) {
    return (degrees + 360) % 360;
}

function getHeadingFromDirection(direction: THREE.Vector3) {
    return normalizeHeading(THREE.MathUtils.radToDeg(Math.atan2(direction.x, direction.z)));
}

function readPlayerNumber(player: any, keys: string[], fallback = Number.NaN) {
    for (const key of keys) {
        const rawValue = key.split(".").reduce((value, part) => value?.[part], player);
        const value = Number(rawValue);
        if (Number.isFinite(value)) return value;
    }
    return fallback;
}

function hasGpsFix(player: any) {
    return player?.gps !== null;
}

function hasPositionPayload(player: any) {
    return player?.position || player?.posX !== undefined || player?.three_x !== undefined;
}

function normalizePlayersPayload(players: any) {
    if (Array.isArray(players)) return players;
    if (players && typeof players === "object") return Object.values(players);
    return [];
}

export default function CameraRealtimeFollow() {
    const { camera } = useThree();
    const projectID = useGame((state: any) => state.projectID);
    const cameraRealtimeFollow = useGame((state: any) => state.cameraRealtimeFollow);
    const playerViewAngle = useGame((state: any) => state.playerViewAngle);
    const orbitControlsRef = useGame((state: any) => state.orbitControlsRef);
    const cameraRealtimeTelemetryResetTick = useGame((state: any) => state.cameraRealtimeTelemetryResetTick);
    const setCameraRealtimeTelemetry = useGame((state: any) => state.setCameraRealtimeTelemetry);
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
    const telemetryPreviousPositionRef = useRef(new THREE.Vector3());
    const hasTelemetryPositionRef = useRef(false);
    const totalDistanceRef = useRef(0);
    const speedSamplesRef = useRef<number[]>([]);
    const lastTelemetryEmitAtRef = useRef(0);

    useEffect(() => {
        if (!cameraRealtimeFollow) {
            followedPlayerRef.current = null;
            lastGpsUpdateAtRef.current = 0;
            hasPositionRef.current = false;
            hasTelemetryPositionRef.current = false;
            totalDistanceRef.current = 0;
            speedSamplesRef.current = [];
            setCameraRealtimeTelemetry({
                currentSpeed: 0,
                averageSpeed: 0,
                distance: 0,
                heading: getHeadingFromDirection(followDirectionRef.current),
                hasGpsUpdate: false,
            });
            return undefined;
        }

        const handlePlayers = (players: any[]) => {
            const nextPlayer = normalizePlayersPayload(players)
                .find((player: any) => hasGpsFix(player) && hasPositionPayload(player));

            followedPlayerRef.current = nextPlayer || null;
            lastGpsUpdateAtRef.current = nextPlayer ? performance.now() : 0;
        };

        socket.on("playersUpdate", handlePlayers);

        return () => {
            socket.off("playersUpdate", handlePlayers);
        };
    }, [cameraRealtimeFollow, setCameraRealtimeTelemetry]);

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
        setCameraRealtimeTelemetry({
            currentSpeed: 0,
            averageSpeed: 0,
            distance: totalDistanceRef.current,
            heading: getHeadingFromDirection(followDirectionRef.current),
            hasGpsUpdate: false,
        });

        return () => {
            controls.enabled = previousEnabled;
        };
    }, [cameraRealtimeFollow, camera, orbitControlsRef, projectID, setCameraRealtimeTelemetry]);

    useEffect(() => {
        if (!cameraRealtimeFollow) return;

        totalDistanceRef.current = 0;
        speedSamplesRef.current = [];
        if (hasPositionRef.current) {
            telemetryPreviousPositionRef.current.copy(currentPositionRef.current);
            hasTelemetryPositionRef.current = true;
        } else {
            hasTelemetryPositionRef.current = false;
        }
        setCameraRealtimeTelemetry({
            currentSpeed: 0,
            averageSpeed: 0,
            distance: 0,
            heading: getHeadingFromDirection(followDirectionRef.current),
        });
    }, [cameraRealtimeFollow, cameraRealtimeTelemetryResetTick, setCameraRealtimeTelemetry]);

    useFrame((_, delta) => {
        if (!cameraRealtimeFollow) return;

        const now = performance.now();
        const hasFreshGpsUpdate = followedPlayerRef.current
            && now - lastGpsUpdateAtRef.current <= GPS_UPDATE_TIMEOUT_MS;

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
            if (now - lastTelemetryEmitAtRef.current >= TELEMETRY_EMIT_INTERVAL_MS) {
                lastTelemetryEmitAtRef.current = now;
                setCameraRealtimeTelemetry({
                    currentSpeed: 0,
                    averageSpeed: 0,
                    distance: totalDistanceRef.current,
                    heading: getHeadingFromDirection(followDirectionRef.current),
                    hasGpsUpdate: false,
                });
            }
            return;
        }

        const activePlayer = followedPlayerRef.current;
        if (hasFreshGpsUpdate) {
            toScenePosition(activePlayer, currentPositionRef.current);
        } else {
            followedPlayerRef.current = null;
        }

        if (!hasPositionRef.current) {
            hasPositionRef.current = true;
            previousPositionRef.current.copy(currentPositionRef.current);
            telemetryPreviousPositionRef.current.copy(currentPositionRef.current);
            hasTelemetryPositionRef.current = true;
            smoothedTargetRef.current.copy(currentPositionRef.current);
            smoothedTargetRef.current.y += getCameraFollowHeight(projectID);
        }

        const movementDirection = remotePositionRef.current
            .copy(currentPositionRef.current)
            .sub(previousPositionRef.current);
        movementDirection.y = 0;
        const movementDistance = movementDirection.length();

        if (movementDistance * movementDistance > MOVEMENT_DIRECTION_EPSILON) {
            movementDirection.normalize();
            const dot = THREE.MathUtils.clamp(followDirectionRef.current.dot(movementDirection), -1, 1);
            if (dot < CAMERA_STRAIGHT_PATH_DOT) {
                followDirectionRef.current
                    .lerp(movementDirection, 1 - Math.exp(-CAMERA_ROTATION_SMOOTHING * delta))
                    .normalize();
            }
        }

        const viewElevation = getClampedViewElevation(playerViewAngle);

        desiredCameraRef.current
            .copy(currentPositionRef.current)
            .addScaledVector(followDirectionRef.current, -CAMERA_FOLLOW_DISTANCE);
        desiredCameraRef.current.y = getCameraY(currentPositionRef.current.y, projectID);

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

        if (hasFreshGpsUpdate && hasTelemetryPositionRef.current) {
            const horizontalTelemetryDelta = remotePositionRef.current
                .copy(currentPositionRef.current)
                .sub(telemetryPreviousPositionRef.current);
            horizontalTelemetryDelta.y = 0;
            const distanceDelta = horizontalTelemetryDelta.length();
            if (distanceDelta > TELEMETRY_DISTANCE_EPSILON) {
                totalDistanceRef.current += distanceDelta;
            }
            telemetryPreviousPositionRef.current.copy(currentPositionRef.current);
        }

        if (now - lastTelemetryEmitAtRef.current >= TELEMETRY_EMIT_INTERVAL_MS) {
            lastTelemetryEmitAtRef.current = now;
            const computedSpeed = movementDistance / Math.max(delta, 0.001);
            const currentSpeed = readPlayerNumber(
                activePlayer,
                [
                    "current_speed",
                    "currentSpeed",
                    "speed",
                    "playerSpeed",
                    "walkTracker.currentSpeed",
                    "tracker.currentSpeed",
                    "telemetry.currentSpeed",
                ],
                computedSpeed
            );
            if (Number.isFinite(currentSpeed)) {
                speedSamplesRef.current.push(currentSpeed);
                if (speedSamplesRef.current.length > 40) {
                    speedSamplesRef.current.shift();
                }
            }
            const sampledAverage = speedSamplesRef.current.length
                ? speedSamplesRef.current.reduce((sum, speed) => sum + speed, 0) / speedSamplesRef.current.length
                : 0;
            const averageSpeed = readPlayerNumber(
                activePlayer,
                [
                    "average_speed",
                    "averageSpeed",
                    "avgSpeed",
                    "avg_speed",
                    "walkTracker.averageSpeed",
                    "tracker.averageSpeed",
                    "telemetry.averageSpeed",
                ],
                sampledAverage
            );
            const distance = readPlayerNumber(
                activePlayer,
                [
                    "distance_covered",
                    "distanceCovered",
                    "distanceMoved",
                    "distance_moved",
                    "totalDistance",
                    "total_distance",
                    "distance",
                    "walkTracker.distance",
                    "tracker.distance",
                    "telemetry.distance",
                ],
                totalDistanceRef.current
            );
            const playerHeading = readPlayerNumber(
                activePlayer,
                ["direction", "heading", "phone_sensor_direction", "location_direction"],
                Number.NaN
            );
            const heading = Number.isFinite(playerHeading)
                ? normalizeHeading(playerHeading)
                : getHeadingFromDirection(followDirectionRef.current);

            setCameraRealtimeTelemetry({
                currentSpeed: Number.isFinite(currentSpeed) ? currentSpeed : 0,
                averageSpeed: Number.isFinite(averageSpeed) ? averageSpeed : 0,
                distance: Number.isFinite(distance) ? distance : totalDistanceRef.current,
                heading,
                hasGpsUpdate: Boolean(hasFreshGpsUpdate),
            });
        }

        previousPositionRef.current.copy(currentPositionRef.current);
    });

    return null;
}
