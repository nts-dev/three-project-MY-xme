import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import usePlayerTrackReplay from "./usePlayerTrackReplay";

const CAMERA_ROUTE_HEIGHT = 1.7;
const PROJECT_126_CAMERA_HEIGHT_SCALE = -0.21;
const CAMERA_ROUTE_SPEED = 3.2;
const RTLS_CAMERA_ROUTE_SPEED = CAMERA_ROUTE_SPEED / 2;
const RTLS_ROTATION_SMOOTHING = 4;
const RTLS_MAX_ROTATION_SPEED = THREE.MathUtils.degToRad(45);
const RTLS_STOP_TURN_ANGLE = THREE.MathUtils.degToRad(35);
const RTLS_RESUME_TURN_ANGLE = THREE.MathUtils.degToRad(2);
const CAMERA_ROUTE_LOOK_AHEAD = 7.5;
const POSITION_SMOOTHING = 7;
const TARGET_SMOOTHING = 4;
const CAMERA_ROUTE_DOT_COLOR = "#ff1f2f";
const CAMERA_ROUTE_DOT_SPACING = 0.25;

type PathSegment = {
    from: THREE.Vector3;
    to: THREE.Vector3;
    direction: THREE.Vector3;
    startDistance: number;
    length: number;
};

type SampledPath = {
    point: THREE.Vector3;
    direction: THREE.Vector3;
};

function toNumber(value: any, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getPointPosition(point: any) {
    const position = point?.position || {};

    return new THREE.Vector3(
        toNumber(position.x, toNumber(point?.posX) / 100),
        toNumber(position.y, toNumber(point?.posY) / 100),
        toNumber(position.z, toNumber(point?.posZ) / 100)
    );
}

function getProjectBaseId(projectID: any) {
    return String(projectID || "").replace(/_L\d+$/i, "");
}

function getCameraRouteHeight(projectID: any) {
    return getProjectBaseId(projectID) === "126"
        ? CAMERA_ROUTE_HEIGHT * PROJECT_126_CAMERA_HEIGHT_SCALE
        : CAMERA_ROUTE_HEIGHT;
}

function buildPathSegments(points: any[]) {
    const segments: PathSegment[] = [];
    let totalLength = 0;

    for (let index = 0; index < points.length - 1; index += 1) {
        const from = getPointPosition(points[index]);
        const to = getPointPosition(points[index + 1]);
        const delta = to.clone().sub(from);
        const length = delta.length();

        if (length <= 0.001) continue;

        segments.push({
            from,
            to,
            direction: delta.clone().normalize(),
            startDistance: totalLength,
            length,
        });
        totalLength += length;
    }

    return { segments, totalLength };
}

function samplePath(segments: PathSegment[], distance: number, target: SampledPath) {
    if (segments.length === 0) return target;

    let segment = segments[segments.length - 1];

    for (let index = 0; index < segments.length; index += 1) {
        const candidate = segments[index];
        if (distance <= candidate.startDistance + candidate.length) {
            segment = candidate;
            break;
        }
    }

    const localDistance = Math.max(0, Math.min(segment.length, distance - segment.startDistance));
    target.point.copy(segment.from).addScaledVector(segment.direction, localDistance);
    target.direction.copy(segment.direction);
    return target;
}

function getRtlsRoutePositions(points: any[]): THREE.Vector3[] {
    const positions: THREE.Vector3[] = [];

    for (const point of points) {
        const position = getPointPosition(point);
        const previous = positions[positions.length - 1];
        if (!previous || previous.distanceToSquared(position) > 0.000001) {
            positions.push(position);
        }
    }

    // Reduce small tracking jitters while preserving both route endpoints.
    const smoothed = positions.map((position, index) => {
        if (index === 0 || index === positions.length - 1) return position.clone();
        return position.clone().multiplyScalar(0.5)
            .addScaledVector(positions[index - 1], 0.25)
            .addScaledVector(positions[index + 1], 0.25);
    });

    let dotPositions = smoothed;
    if (smoothed.length >= 2) {
        const curve = new THREE.CatmullRomCurve3(smoothed, false, "centripetal");
        curve.arcLengthDivisions = Math.max(200, smoothed.length * 20);
        const divisions = Math.max(1, Math.ceil(curve.getLength() / CAMERA_ROUTE_DOT_SPACING));
        dotPositions = curve.getSpacedPoints(divisions);
    }

    return dotPositions.map((position) => {
        position.x -= 0.8;
        position.z -= 1.4;
        position.y -= 1.3;
        return position;
    });
}

function CameraRouteDots({ points }: { points: any[] }) {
    const geometry = useMemo(() => new THREE.SphereGeometry(0.088, 10, 8), []);
    const material = useMemo(() => new THREE.MeshBasicMaterial({
        color: CAMERA_ROUTE_DOT_COLOR,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.9,
    }), []);

    const matrices = useMemo(() => {
        const matrix = new THREE.Matrix4();
        return getRtlsRoutePositions(points).map((position) => matrix.clone().setPosition(position));
    }, [points]);

    useEffect(() => {
        return () => {
            geometry.dispose();
            material.dispose();
        };
    }, [geometry, material]);

    if (matrices.length === 0) return null;

    return (
        <instancedMesh
            args={[geometry, material, matrices.length]}
            frustumCulled={false}
            renderOrder={20}
            onUpdate={(mesh) => {
                matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
                mesh.instanceMatrix.needsUpdate = true;
            }}
        />
    );
}

function RtlsRouteDots({ projectID }: { projectID: any }) {
    const { pathGroups } = usePlayerTrackReplay(projectID, true, "rtls");

    return <>{pathGroups.map((group) => (
        <CameraRouteDots key={group.id} points={group.points} />
    ))}</>;
}

export default function CameraPathReplay() {
    const { camera } = useThree();
    const projectID = useGame((state: any) => state.projectID);
    const cameraPathReplay = useGame((state: any) => state.cameraPathReplay);
    const cameraPathSource = useGame((state: any) => state.cameraPathSource);
    const rtlsRouteDots = useGame((state: any) => state.rtlsRouteDots);
    const setCameraPathReplay = useGame((state: any) => state.setCameraPathReplay);
    const orbitControlsRef = useGame((state: any) => state.orbitControlsRef);
    const { pathGroups } = usePlayerTrackReplay(projectID, cameraPathReplay, cameraPathSource);
    const distanceRef = useRef(0);
    const pointSampleRef = useRef<SampledPath>({
        point: new THREE.Vector3(),
        direction: new THREE.Vector3(0, 0, -1),
    });
    const lookSampleRef = useRef<SampledPath>({
        point: new THREE.Vector3(),
        direction: new THREE.Vector3(0, 0, -1),
    });
    const desiredPositionRef = useRef(new THREE.Vector3());
    const desiredTargetRef = useRef(new THREE.Vector3());
    const controlTargetRef = useRef(new THREE.Vector3());
    const rotationMatrixRef = useRef(new THREE.Matrix4());
    const desiredRotationRef = useRef(new THREE.Quaternion());
    const turningInPlaceRef = useRef(false);
    const turnRotationRef = useRef(new THREE.Quaternion());

    const activePoints = useMemo(() => {
        return pathGroups.find((group) => group.points.length > 1)?.points || [];
    }, [pathGroups]);

    const route = useMemo(() => {
        const points = cameraPathSource === "rtls"
            ? getRtlsRoutePositions(activePoints).map((position) => ({ position }))
            : activePoints;
        return buildPathSegments(points);
    }, [activePoints, cameraPathSource]);

    useEffect(() => {
        distanceRef.current = 0;
        turningInPlaceRef.current = false;
    }, [cameraPathReplay, cameraPathSource, route]);

    useEffect(() => {
        const controls = orbitControlsRef?.current;
        if (!cameraPathReplay || !controls) return undefined;

        const previousEnabled = controls.enabled;
        controls.enabled = false;
        controlTargetRef.current.copy(controls.target);

        return () => {
            controls.enabled = previousEnabled;
        };
    }, [cameraPathReplay, orbitControlsRef]);

    useFrame((_, delta) => {
        if (!cameraPathReplay || route.segments.length === 0 || route.totalLength <= 0) return;

        const nextDistance = Math.min(
            route.totalLength,
            distanceRef.current + delta * (cameraPathSource === "rtls" ? RTLS_CAMERA_ROUTE_SPEED : CAMERA_ROUTE_SPEED)
        );

        const currentSample = samplePath(route.segments, nextDistance, pointSampleRef.current);
        if (cameraPathSource === "rtls") {
            // Stay directly above the dotted route and face its forward tangent.
            const position = desiredPositionRef.current.copy(currentSample.point);
            position.y += CAMERA_ROUTE_HEIGHT;
            const target = desiredTargetRef.current.copy(position)
                .add(currentSample.direction);
            rotationMatrixRef.current.lookAt(position, target, camera.up);
            desiredRotationRef.current.setFromRotationMatrix(rotationMatrixRef.current);

            if (!turningInPlaceRef.current && camera.quaternion.angleTo(desiredRotationRef.current) >= RTLS_STOP_TURN_ANGLE) {
                turningInPlaceRef.current = true;
                turnRotationRef.current.copy(desiredRotationRef.current);
            }

            if (turningInPlaceRef.current) {
                // Freeze route progress and hold a fixed heading until the turn finishes.
                samplePath(route.segments, distanceRef.current, pointSampleRef.current);
                position.copy(pointSampleRef.current.point);
                position.y += CAMERA_ROUTE_HEIGHT;
                desiredRotationRef.current.copy(turnRotationRef.current);
            } else {
                distanceRef.current = nextDistance;
            }
            camera.position.copy(position);
            const angle = camera.quaternion.angleTo(desiredRotationRef.current);
            const rotationStep = Math.min(
                RTLS_MAX_ROTATION_SPEED * delta,
                angle * (1 - Math.exp(-RTLS_ROTATION_SMOOTHING * delta))
            );
            camera.quaternion.rotateTowards(desiredRotationRef.current, rotationStep);
            if (turningInPlaceRef.current && camera.quaternion.angleTo(desiredRotationRef.current) <= RTLS_RESUME_TURN_ANGLE) {
                turningInPlaceRef.current = false;
            }
            const controls = orbitControlsRef?.current;
            if (controls?.target) {
                // Keep manual controls aligned with the smoothed view when playback stops.
                controls.target.set(0, 0, -1).applyQuaternion(camera.quaternion).add(position);
            }
            camera.updateMatrixWorld();
            if (distanceRef.current >= route.totalLength && !turningInPlaceRef.current) setCameraPathReplay(false);
            return;
        }

        distanceRef.current = nextDistance;
        const lookSample = samplePath(
            route.segments,
            Math.min(route.totalLength, distanceRef.current + CAMERA_ROUTE_LOOK_AHEAD),
            lookSampleRef.current
        );

        const desiredPosition = desiredPositionRef.current
            .copy(currentSample.point)
            .addScaledVector(currentSample.direction, -0.35);
        desiredPosition.y += getCameraRouteHeight(projectID);

        const desiredTarget = desiredTargetRef.current
            .copy(lookSample.point)
            .addScaledVector(lookSample.direction, 1.2);
        desiredTarget.y = desiredPosition.y;

        const positionAlpha = 1 - Math.exp(-POSITION_SMOOTHING * delta);
        const targetAlpha = 1 - Math.exp(-TARGET_SMOOTHING * delta);
        camera.position.lerp(desiredPosition, positionAlpha);

        const controls = orbitControlsRef?.current;
        if (controls?.target) {
            controlTargetRef.current.lerpVectors(controls.target, desiredTarget, targetAlpha);
            controls.target.copy(controlTargetRef.current);
            controls.update?.();
        } else {
            camera.lookAt(desiredTarget);
        }

        camera.updateMatrixWorld();

        if (distanceRef.current >= route.totalLength) {
            setCameraPathReplay(false);
        }
    });
    return rtlsRouteDots ? <RtlsRouteDots projectID={projectID} /> : null;
}
