import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";

type PathWalkingAvatarProps = {
    charModel: any;
    points?: [number, number, number][];
    start?: [number, number, number];
    end?: [number, number, number];
    speed?: number;
    coordinateScale?: number;
    onRouteProgress?: (progress: { segmentIndex: number; directionSign: 1 | -1 }) => void;
};

const DEFAULT_START: [number, number, number] = [1003, 600, 915];
const DEFAULT_END: [number, number, number] = [2150, 600, 915];
const DEFAULT_SPEED = 90;

export default function PathWalkingAvatar({
    charModel,
    points,
    start = DEFAULT_START,
    end = DEFAULT_END,
    speed = DEFAULT_SPEED,
    coordinateScale = 1,
    onRouteProgress,
}: PathWalkingAvatarProps) {
    const groupRef = useRef<THREE.Group>(null);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const progressRef = useRef(0);
    const directionSignRef = useRef(1);
    const routeProgressRef = useRef({ segmentIndex: -1, directionSign: 1 });

    const scaledPoints = useMemo(() => {
        const sourcePoints = points?.length ? points : [start, end];
        return sourcePoints.map((point) => new THREE.Vector3(...point).multiplyScalar(coordinateScale));
    }, [coordinateScale, end, points, start]);
    const scaledSpeed = speed * coordinateScale;

    const path = useMemo(() => {
        const segments = [];
        let length = 0;

        for (let index = 0; index < scaledPoints.length - 1; index += 1) {
            const from = scaledPoints[index];
            const to = scaledPoints[index + 1];
            const vector = to.clone().sub(from);
            const segmentLength = vector.length();

            if (segmentLength <= 0) {
                continue;
            }

            segments.push({
                from,
                index,
                length: segmentLength,
                startDistance: length,
                direction: vector.normalize(),
            });
            length += segmentLength;
        }

        return { segments, length };
    }, [scaledPoints]);

    const clonedScene = useMemo(() => {
        const clone = SkeletonUtils.clone(charModel.scene);
        clone.scale.set(0.8, 0.8, 0.8);
        return clone;
    }, [charModel]);

    useEffect(() => {
        progressRef.current = 0;
        directionSignRef.current = 1;
        routeProgressRef.current = { segmentIndex: -1, directionSign: 1 };
        groupRef.current?.position.copy(scaledPoints[0] || new THREE.Vector3());
        onRouteProgress?.({ segmentIndex: 0, directionSign: 1 });
    }, [scaledPoints]);

    useEffect(() => {
        const mixer = new THREE.AnimationMixer(clonedScene);
        mixerRef.current = mixer;

        const walkClip = THREE.AnimationClip.findByName(charModel.animations || [], "Walk")
            || charModel.animations?.[2]
            || charModel.animations?.[0];

        if (walkClip) {
            mixer.clipAction(walkClip)
                .reset()
                .setLoop(THREE.LoopRepeat, Infinity)
                .play();
        }

        return () => {
            mixer.stopAllAction();
            mixerRef.current = null;
        };
    }, [charModel.animations, clonedScene]);

    useFrame((_, delta) => {
        mixerRef.current?.update(delta);

        const group = groupRef.current;
        if (!group || path.length <= 0 || !path.segments.length) {
            return;
        }

        progressRef.current += delta * scaledSpeed * directionSignRef.current;

        if (progressRef.current >= path.length) {
            progressRef.current = path.length;
            directionSignRef.current = -1;
        } else if (progressRef.current <= 0) {
            progressRef.current = 0;
            directionSignRef.current = 1;
        }

        const targetDistance = progressRef.current;
        let activeSegment = path.segments[path.segments.length - 1];

        if (directionSignRef.current > 0) {
            activeSegment = path.segments.find((segment) =>
                targetDistance <= segment.startDistance + segment.length
            ) || activeSegment;
        } else {
            for (let index = path.segments.length - 1; index >= 0; index -= 1) {
                const segment = path.segments[index];
                if (targetDistance >= segment.startDistance) {
                    activeSegment = segment;
                    break;
                }
            }
        }

        const distanceOnSegment = THREE.MathUtils.clamp(
            targetDistance - activeSegment.startDistance,
            0,
            activeSegment.length
        );

        group.position.copy(activeSegment.from).addScaledVector(activeSegment.direction, distanceOnSegment);

        const directionSign = directionSignRef.current as 1 | -1;
        if (
            routeProgressRef.current.segmentIndex !== activeSegment.index
            || routeProgressRef.current.directionSign !== directionSign
        ) {
            routeProgressRef.current = {
                segmentIndex: activeSegment.index,
                directionSign,
            };
            onRouteProgress?.(routeProgressRef.current);
        }

        const activeDirection = activeSegment.direction.clone().multiplyScalar(directionSign);
        group.rotation.y = Math.atan2(activeDirection.x, activeDirection.z);
    });

    const startPosition = useMemo(() => (scaledPoints[0] || new THREE.Vector3()).toArray(), [scaledPoints]);

    return (
        <group ref={groupRef} name="project-135-path-avatar" position={startPosition}>
            <group name="Scene" position={[0, 0.1, 0]}>
                <group name="KayKit_Animated_Path_Avatar">
                    <primitive object={clonedScene} position-y={-0.08} />
                </group>
            </group>
        </group>
    );
}
