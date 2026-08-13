import * as THREE from 'three';
import { RigidBody } from '@react-three/rapier';
import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

const ArrowShooter = ({ data, object, realTimeChaPosition }) => {
    const arrowRef = useRef();

    useEffect(() => {
        if (arrowRef.current && realTimeChaPosition) {
            // Set initial elevated position
            const basePosition = new THREE.Vector3().fromArray(data.position || [0, 0, 0]);
            const initialPosition = basePosition.clone().add(new THREE.Vector3(0, 5, 0)); // Elevate by 5 units

            arrowRef.current?.setTranslation(initialPosition.x, initialPosition.y, initialPosition.z, true);
        }
    }, [arrowRef, realTimeChaPosition, data.position]);

    useFrame((_, delta) => {
        if (arrowRef.current && realTimeChaPosition) {
            // Use the current position of the arrow
            const currentPosition = new THREE.Vector3().fromArray(data.position || [0, 0, 0]);
            const targetPosition = new THREE.Vector3(realTimeChaPosition.x, realTimeChaPosition.y, realTimeChaPosition.z);
            const direction = targetPosition.clone().sub(currentPosition).normalize();
            const speed = 5;
            const nextPosition = currentPosition.add(direction.multiplyScalar(speed * delta));

            // Update position directly
            arrowRef.current?.setTranslation(nextPosition.x, nextPosition.y, nextPosition.z, true);
        }
    });

    return (
        <RigidBody
            key={data.key}
            ref={arrowRef}
            type="fixed" // Set to fixed to prevent physics simulation
            position={data.position || [0, 0, 0]} // Initial position before elevation
            rotation={data.rotation || [0, 0, 0]}
            scale={data.scale || [1, 1, 1]}
            colliders="hull"
        >
            <primitive object={object.clone(true)} />
        </RigidBody>
    );
};

export default ArrowShooter;