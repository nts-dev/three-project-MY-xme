import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import useGame from "../../hooks/useGame";

const DEFAULT_DIRECTION = new THREE.Vector3(0, 0, 1);
const DEFAULT_LIGHT_POSITION = [5, 10, 5];
const DEFAULT_LIGHT_TARGET = [0, 0, 0];

export default function AvatarEyeDirectionalLight({
    lightRef,
    enabled = true,
    eyeHeight = 1.45,
    targetDistance = 16,
    backOffset = 8,
    defaultPosition = DEFAULT_LIGHT_POSITION,
    defaultTarget = DEFAULT_LIGHT_TARGET,
}) {
    const targetRef = useRef(null);
    const lastLookDirectionRef = useRef(DEFAULT_DIRECTION.clone());
    const vectors = useMemo(() => ({
        eye: new THREE.Vector3(),
        direction: new THREE.Vector3(),
        quaternion: new THREE.Quaternion(),
    }), []);

    useEffect(() => {
        if (lightRef?.current && targetRef.current) {
            lightRef.current.target = targetRef.current;
            targetRef.current.updateMatrixWorld();
        }
    }, [lightRef]);

    useEffect(() => {
        const light = lightRef?.current;
        const target = targetRef.current;

        if (!enabled && light && target) {
            light.position.set(defaultPosition[0], defaultPosition[1], defaultPosition[2]);
            target.position.set(defaultTarget[0], defaultTarget[1], defaultTarget[2]);
            target.updateMatrixWorld();
        }
    }, [defaultPosition, defaultTarget, enabled, lightRef]);

    useFrame(() => {
        const light = lightRef?.current;
        const target = targetRef.current;
        const character = useGame.getState().characterRef;

        if (!enabled || !light || !target || !character) {
            return;
        }

        const position = character.translation?.();
        if (!position) {
            return;
        }

        vectors.eye.set(position.x, position.y + eyeHeight, position.z);

        const velocity = character.linvel?.();
        const horizontalSpeedSq = velocity ? ((velocity.x * velocity.x) + (velocity.z * velocity.z)) : 0;
        const lastLookDirection = lastLookDirectionRef.current;

        if (horizontalSpeedSq > 0.0001) {
            const invSpeed = 1 / Math.sqrt(horizontalSpeedSq);
            vectors.direction.set(velocity.x * invSpeed, 0, velocity.z * invSpeed);
            lastLookDirection.copy(vectors.direction);
        } else if (lastLookDirection.lengthSq() > 0.0001) {
            vectors.direction.copy(lastLookDirection);
        } else {
            const rotation = character.rotation?.();
            if (rotation) {
                vectors.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
                vectors.direction.copy(DEFAULT_DIRECTION).applyQuaternion(vectors.quaternion);
                vectors.direction.y = 0;
                if (vectors.direction.lengthSq() > 0.0001) {
                    vectors.direction.normalize();
                    lastLookDirection.copy(vectors.direction);
                } else {
                    vectors.direction.copy(DEFAULT_DIRECTION);
                }
            } else {
                vectors.direction.copy(DEFAULT_DIRECTION);
            }
        }

        light.position.set(
            vectors.eye.x - (vectors.direction.x * backOffset),
            vectors.eye.y - (vectors.direction.y * backOffset),
            vectors.eye.z - (vectors.direction.z * backOffset)
        );
        target.position.set(
            vectors.eye.x + (vectors.direction.x * targetDistance),
            vectors.eye.y + (vectors.direction.y * targetDistance),
            vectors.eye.z + (vectors.direction.z * targetDistance)
        );
        target.updateMatrixWorld();
    });

    return <object3D ref={targetRef} />;
}
