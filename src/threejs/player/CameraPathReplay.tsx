import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import usePlayerTrackReplay from "./usePlayerTrackReplay";

const CAMERA_ROUTE_HEIGHT = 1.7;
const CAMERA_ROUTE_SPEED = 3.2;
const CAMERA_ROUTE_LOOK_AHEAD = 7.5;
const POSITION_SMOOTHING = 7;
const TARGET_SMOOTHING = 4;
const CAMERA_ROUTE_DOT_COLOR = "#ff1f2f";

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

function CameraRouteDots({ points }: { points: any[] }) {
    const geometry = useMemo(() => new THREE.SphereGeometry(0.44, 10, 8), []);
    const material = useMemo(() => new THREE.MeshBasicMaterial({
        color: CAMERA_ROUTE_DOT_COLOR,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.9,
    }), []);

    const matrices = useMemo(() => {
        const matrix = new THREE.Matrix4();

        return points.map((point) => {
            const position = getPointPosition(point);
            position.y += 0.08;
            return matrix.clone().setPosition(position);
        });
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

export default function CameraPathReplay() {
    const { camera } = useThree();
    const projectID = useGame((state: any) => state.projectID);
    const cameraPathReplay = useGame((state: any) => state.cameraPathReplay);
    const setCameraPathReplay = useGame((state: any) => state.setCameraPathReplay);
    const orbitControlsRef = useGame((state: any) => state.orbitControlsRef);
    const { pathGroups } = usePlayerTrackReplay(projectID, cameraPathReplay);
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

    const activePoints = useMemo(() => {
        return pathGroups.find((group) => group.points.length > 1)?.points || [];
    }, [pathGroups]);

    const route = useMemo(() => buildPathSegments(activePoints), [activePoints]);

    useEffect(() => {
        distanceRef.current = 0;
    }, [cameraPathReplay, route.totalLength]);

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

        distanceRef.current = Math.min(
            route.totalLength,
            distanceRef.current + delta * CAMERA_ROUTE_SPEED
        );

        const currentSample = samplePath(route.segments, distanceRef.current, pointSampleRef.current);
        const lookSample = samplePath(
            route.segments,
            Math.min(route.totalLength, distanceRef.current + CAMERA_ROUTE_LOOK_AHEAD),
            lookSampleRef.current
        );

        const desiredPosition = desiredPositionRef.current
            .copy(currentSample.point)
            .addScaledVector(currentSample.direction, -0.35);
        desiredPosition.y += CAMERA_ROUTE_HEIGHT;

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
     return null;
    // return cameraPathReplay && activePoints.length > 1
    //     ? <CameraRouteDots points={activePoints} />
    //     : null;
}
