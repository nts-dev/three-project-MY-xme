import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import usePlayerTrackReplay from "./usePlayerTrackReplay";
import { getRtlsRoutePositions } from "./CameraPathReplay";
import { getRobotTrial } from "./robotTrials";
import RaspbotModel, { CAMERA_MOUNT_OFFSET as PROCEDURAL_CAMERA_MOUNT_OFFSET } from "./RaspbotModel";
import RaspbotGLTFModel, { CAMERA_MOUNT_OFFSET as GLTF_CAMERA_MOUNT_OFFSET } from "./RaspbotGLTFModel";

// Switch to the GLB model once confirmed working; flip back to `false` to instantly
// fall back to the procedural placeholder (e.g. if the GLB fails to load, or its
// appearance needs more review) without touching anything else in this file.
const USE_GLB_MODEL = true;
const ACTIVE_CAMERA_MOUNT_OFFSET = USE_GLB_MODEL ? GLTF_CAMERA_MOUNT_OFFSET : PROCEDURAL_CAMERA_MOUNT_OFFSET;

// Placeholder pace until the robot's own recorded speed is correlated to a real-world rate.
const ROBOT_SPEED = 0.6;

// Both RaspbotModel.tsx (procedural) and RaspbotGLTFModel.tsx (the Claude-generated
// GLB) are built facing local +Z — confirmed for the GLB by inspecting its node
// positions directly (Camera_Pan/Ultrasonic_Sensor/Line_Tracker sit at +Z, the rear
// Control_Case sits at -Z, front wheels Wheel_FL/FR are at +Z vs the rear pair at -Z).
// The heading math below assumes that explicitly via this offset rather than baking
// it silently into the atan2 call, so a future model with a different front axis
// only needs this one constant changed.
const MODEL_FORWARD_YAW_OFFSET = THREE.MathUtils.degToRad(0);

// Mecanum wheels make sideways motion physically possible on the real robot; this replay
// only orients the body toward the direction of travel along the recorded path as a
// simplified visualization, not a reproduction of the robot's actual recorded heading.
const HEADING_ROTATION_SMOOTHING = 4; // matches CameraPathReplay's RTLS_ROTATION_SMOOTHING
const HEADING_MAX_ROTATION_SPEED = THREE.MathUtils.degToRad(180); // rad/sec cap on top of the smoothing
const LARGE_TURN_THRESHOLD = THREE.MathUtils.degToRad(30);
const LARGE_TURN_DURATION = 2; // seconds
const MIN_FACING_LENGTH_SQ = 0.000001; // ignore duplicate/near-duplicate RTLS points

const UP_AXIS = new THREE.Vector3(0, 1, 0);

type PathWalker = {
    points: THREE.Vector3[];
    segmentLengths: number[];
    totalLength: number;
    turns: { distance: number; yaw: number }[];
};

const EMPTY_WALKER: PathWalker = { points: [], segmentLengths: [], totalLength: 0, turns: [] };

function buildWalker(points: THREE.Vector3[]): PathWalker {
    const segmentLengths: number[] = [];
    let totalLength = 0;
    const turns: PathWalker["turns"] = [];
    let previousYaw: number | null = null;

    for (let index = 0; index < points.length - 1; index += 1) {
        const length = points[index].distanceTo(points[index + 1]);
        const dx = points[index + 1].x - points[index].x;
        const dz = points[index + 1].z - points[index].z;
        if (dx * dx + dz * dz > MIN_FACING_LENGTH_SQ) {
            const yaw = Math.atan2(dx, dz) + MODEL_FORWARD_YAW_OFFSET;
            if (previousYaw !== null) {
                const angle = Math.abs(Math.atan2(Math.sin(yaw - previousYaw), Math.cos(yaw - previousYaw)));
                if (angle >= LARGE_TURN_THRESHOLD - 1e-6) turns.push({ distance: totalLength, yaw });
            }
            previousYaw = yaw;
        }
        segmentLengths.push(length);
        totalLength += length;
    }

    return { points, segmentLengths, totalLength, turns };
}

function sampleWalker(walker: PathWalker, distance: number, outPosition: THREE.Vector3, outDirection: THREE.Vector3) {
    if (walker.points.length < 2) return;

    let remaining = THREE.MathUtils.clamp(distance, 0, walker.totalLength);

    for (let index = 0; index < walker.segmentLengths.length; index += 1) {
        const length = walker.segmentLengths[index];
        const isLastSegment = index === walker.segmentLengths.length - 1;

        if (remaining <= length || isLastSegment) {
            const from = walker.points[index];
            const to = walker.points[index + 1];
            const t = length > 0 ? THREE.MathUtils.clamp(remaining / length, 0, 1) : 0;
            outPosition.copy(from).lerp(to, t);
            outDirection.copy(to).sub(from);
            if (outDirection.lengthSq() > 0.000001) outDirection.normalize();
            return;
        }

        remaining -= length;
    }
}

export default function RobotTrackReplay({ projectID }: { projectID: any }) {
    const { pathGroups } = usePlayerTrackReplay(projectID, true, "robot");
    const robotSelectedTrial = useGame((state: any) => state.robotSelectedTrial);
    const setRobotActiveTrial = useGame((state: any) => state.setRobotActiveTrial);
    const setRobotGroupRef = useGame((state: any) => state.setRobotGroupRef);
    const setRobotCameraOffset = useGame((state: any) => state.setRobotCameraOffset);
    const groupRef = useRef<THREE.Group>(null);
    const distanceRef = useRef(0);
    const previousDistanceRef = useRef(0);
    const positionRef = useRef(new THREE.Vector3());
    const directionRef = useRef(new THREE.Vector3(0, 0, -1));
    const facingRef = useRef(new THREE.Vector3());
    const desiredQuaternionRef = useRef(new THREE.Quaternion());
    const nextTurnIndexRef = useRef(0);
    const turnStartQuaternionRef = useRef(new THREE.Quaternion());
    const turnTargetQuaternionRef = useRef(new THREE.Quaternion());
    const turnElapsedRef = useRef(LARGE_TURN_DURATION);
    const hasHeadingRef = useRef(false);
    // Raw signed distance traveled, in meters — NOT pre-divided by any wheel radius,
    // since the procedural model and the GLB model have different measured wheel
    // radii and each converts this to a spin angle using its own.
    const wheelDistanceRef = useRef(0);

    // Only the selected trial (T1/T2/T3) drives the robot — never a blend of all
    // three — so the Feature 1 indicator and the robot's actual movement can't
    // disagree (see robotTrials.ts for the T1/T2/T3 -> pathGroups.id mapping).
    const selectedSourceId = getRobotTrial(robotSelectedTrial)?.sourceId;
    const selectedGroup = useMemo(
        () => pathGroups.find((group) => group.id === selectedSourceId) || null,
        [pathGroups, selectedSourceId]
    );
    const hasUsableData = Boolean(selectedGroup && selectedGroup.points.length > 1);

    const walker = useMemo(() => {
        distanceRef.current = 0;
        previousDistanceRef.current = 0;
        hasHeadingRef.current = false;
        turnElapsedRef.current = LARGE_TURN_DURATION;
        nextTurnIndexRef.current = 0;
        wheelDistanceRef.current = 0;
        if (!selectedGroup) return EMPTY_WALKER;
        return buildWalker(getRtlsRoutePositions(selectedGroup.points, projectID));
    }, [selectedGroup, projectID]);

    // Report what's actually driving the robot (vs. merely selected) so the
    // trajectory indicator never shows a trial the robot isn't really following.
    useEffect(() => {
        setRobotActiveTrial(hasUsableData ? robotSelectedTrial : null);
    }, [hasUsableData, robotSelectedTrial, setRobotActiveTrial]);

    // Publish this instance's live transform + camera mount point so
    // RobotFirstPersonCamera can follow it without re-deriving the walk logic above.
    useEffect(() => {
        setRobotGroupRef(groupRef);
        setRobotCameraOffset(ACTIVE_CAMERA_MOUNT_OFFSET);
        return () => setRobotGroupRef(null);
    }, [setRobotGroupRef, setRobotCameraOffset]);

    // Update before the first-person camera reads this transform each frame.
    useFrame((_, delta) => {
        const group = groupRef.current;
        if (!group || walker.totalLength <= 0) return;

        // Hold position and wheel travel until the three-second turn finishes.
        if (turnElapsedRef.current < LARGE_TURN_DURATION) {
            turnElapsedRef.current = Math.min(turnElapsedRef.current + delta, LARGE_TURN_DURATION);
            group.quaternion.slerpQuaternions(
                turnStartQuaternionRef.current,
                turnTargetQuaternionRef.current,
                turnElapsedRef.current / LARGE_TURN_DURATION
            );
            return;
        }

        // Stop at the final point and hold there until the selected path changes.
        const nextTurn = walker.turns[nextTurnIndexRef.current];
        distanceRef.current = Math.min(
            distanceRef.current + delta * ROBOT_SPEED,
            nextTurn?.distance ?? walker.totalLength
        );
        const reachedTurn = nextTurn && distanceRef.current >= nextTurn.distance;

        // Wheel spin tracks actual distance covered this frame (not the synthetic
        // playback speed directly), so it naturally stops if distance ever stalls —
        // e.g. duplicate recorded points collapsing to a zero-length path segment.
        // Each model component divides this by its own measured wheel radius.
        const stepDistance = distanceRef.current - previousDistanceRef.current;
        previousDistanceRef.current = distanceRef.current;
        wheelDistanceRef.current += stepDistance;

        sampleWalker(walker, distanceRef.current, positionRef.current, directionRef.current);
        group.position.copy(positionRef.current);

        if (reachedTurn) {
            // Stop exactly at the corner, then face the outgoing segment before moving.
            turnStartQuaternionRef.current.copy(group.quaternion);
            turnTargetQuaternionRef.current.setFromAxisAngle(UP_AXIS, nextTurn.yaw);
            desiredQuaternionRef.current.copy(turnTargetQuaternionRef.current);
            hasHeadingRef.current = true;
            turnElapsedRef.current = 0;
            nextTurnIndexRef.current += 1;
            return;
        }

        // Duplicate/near-duplicate RTLS points produce a near-zero segment direction;
        // skip updating the desired heading that frame instead of snapping toward a
        // meaningless (near-zero-length) vector, and keep holding the last valid one.
        facingRef.current.copy(directionRef.current);
        if (facingRef.current.lengthSq() > MIN_FACING_LENGTH_SQ) {
            const yaw = Math.atan2(facingRef.current.x, facingRef.current.z) + MODEL_FORWARD_YAW_OFFSET;
            desiredQuaternionRef.current.setFromAxisAngle(UP_AXIS, yaw);
            hasHeadingRef.current = true;
        }

        if (hasHeadingRef.current) {
            const angle = group.quaternion.angleTo(desiredQuaternionRef.current);
            const step = Math.min(
                HEADING_MAX_ROTATION_SPEED * delta,
                angle * (1 - Math.exp(-HEADING_ROTATION_SMOOTHING * delta))
            );
            group.quaternion.rotateTowards(desiredQuaternionRef.current, step);
        }
    }, -1);

    if (!hasUsableData || walker.totalLength <= 0) return null;

    return (
        <group ref={groupRef} name="raspbot-v2-track-replay">
            {USE_GLB_MODEL ? (
                <RaspbotGLTFModel wheelDistanceRef={wheelDistanceRef} />
            ) : (
                <RaspbotModel wheelDistanceRef={wheelDistanceRef} />
            )}
        </group>
    );
}
