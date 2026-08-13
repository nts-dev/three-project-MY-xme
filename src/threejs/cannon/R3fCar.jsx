import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { useBox, useRaycastVehicle } from '@react-three/cannon';
import * as THREE from 'three'

// Wheel component
const Wheel = ({ position, flip, wheelModel }) => {
    const [wheelBody] = useBox(() => ({
        mass: 1,
        args: [0.35, 0.35, 0.175], // radius, radius, width/2
        position,
        isKinematic: true,
    }));

    const wheelRef = useRef();

    useEffect(() => {
        if (wheelModel.scene && wheelRef.current) {
            const wheel = wheelModel.scene.clone();
            if (flip) {
                wheel.scale.set(-1, 1, -1);
            }
            wheelRef.current = wheel;
        }
    }, [wheelModel, flip]);

    return <primitive object={wheelRef.current || new THREE.Object3D()} ref={wheelBody} />;
};

const R3fCar = ({ camera, orbitControls }) => {

    const carRef = useRef();
    const chassisRef = useRef();
    const [isMoving, setIsMoving] = useState(false);

    const chassisDimension = { x: 1.96, y: 1, z: 4.3 };
    const chassisModelPos = { x: 0, y: -0.629999999999999, z: 0 };
    const mass = 250;

    // Load models
    const chassisModel = useGLTF(`${import.meta.env.VITE_FILE_URL}/chassis.gltf`);
    const wheelModel = useGLTF(`${import.meta.env.VITE_FILE_URL}/wheel.gltf`);

    // Physics setup for chassis
    const [chassisBody] = useBox(() => ({
        mass,
        args: [chassisDimension.x, chassisDimension.y, chassisDimension.z],
        position: [0, 4, 0],
    }));

    const wheelPositions = [
        [0.75, 0.1, -1.32],  // Front right
        [-0.78, 0.1, -1.32], // Front left
        [0.75, 0.1, 1.25],   // Rear right
        [-0.78, 0.1, 1.25],  // Rear left
    ];

    // Create refs for wheel bodies
    const wheelRefs = [useRef(), useRef(), useRef(), useRef()];

    // Setup raycast vehicle
    const [vehicle, vehicleApi] = useRaycastVehicle(() => ({
        chassisBody,
        wheelInfos: wheelPositions.map((pos) => ({
            radius: 0.35,
            directionLocal: [0, -1, 0],
            suspensionStiffness: 55,
            suspensionRestLength: 0.5,
            frictionSlip: 30,
            dampingRelaxation: 2.3,
            dampingCompression: 4.3,
            maxSuspensionForce: 10000,
            rollInfluence: 0.01,
            axleLocal: [-1, 0, 0],
            chassisConnectionPointLocal: pos,
            maxSuspensionTravel: 1,
            customSlidingRotationalSpeed: 30,
        })),
        wheels: wheelRefs.map(ref => ref.current),
        indexRightAxis: 0,
        indexUpAxis: 1,
        indexForwardAxis: 2,
    }));

    useEffect(() => {
        // Setup chassis visuals
        if (chassisModel.scene) {
            chassisRef.current = chassisModel.scene;
            chassisRef.current.traverse(object => {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.material = new THREE.MeshPhongMaterial({ color: '#f831a9' });
                }
            });
        }
    }, [chassisModel]);

    // Controls
    useEffect(() => {
        const maxSteerVal = 0.5;
        const maxForce = 450;
        const brakeForce = 36;
        const slowDownCar = 22;
        const keysPressed = [];

        const handleKeyDown = e => {
            if (!keysPressed.includes(e.key.toLowerCase())) keysPressed.push(e.key.toLowerCase());
            handleMovement();
        };

        const handleKeyUp = e => {
            keysPressed.splice(keysPressed.indexOf(e.key.toLowerCase()), 1);
            handleMovement();
        };

        const handleMovement = () => {
            if (keysPressed.includes("r")) resetCar();

            if (!keysPressed.includes(" ")) {
                vehicleApi.setBrake({ force: 0, wheelIndex: 0 });
                vehicleApi.setBrake({ force: 0, wheelIndex: 1 });
                vehicleApi.setBrake({ force: 0, wheelIndex: 2 });
                vehicleApi.setBrake({ force: 0, wheelIndex: 3 });

                if (keysPressed.includes("a") || keysPressed.includes("arrowleft")) {
                    vehicleApi.setSteeringValue({ value: maxSteerVal, wheelIndex: 2 });
                    vehicleApi.setSteeringValue({ value: maxSteerVal, wheelIndex: 3 });
                    setIsMoving(true);
                } else if (keysPressed.includes("d") || keysPressed.includes("arrowright")) {
                    vehicleApi.setSteeringValue({ value: -maxSteerVal, wheelIndex: 2 });
                    vehicleApi.setSteeringValue({ value: -maxSteerVal, wheelIndex: 3 });
                    setIsMoving(true);
                } else {
                    vehicleApi.setSteeringValue({ value: 0, wheelIndex: 2 });
                    vehicleApi.setSteeringValue({ value: 0, wheelIndex: 3 });
                }

                if (keysPressed.includes("w") || keysPressed.includes("arrowup")) {
                    vehicleApi.applyEngineForce({ force: -maxForce, wheelIndex: 0 });
                    vehicleApi.applyEngineForce({ force: -maxForce, wheelIndex: 1 });
                    vehicleApi.applyEngineForce({ force: -maxForce, wheelIndex: 2 });
                    vehicleApi.applyEngineForce({ force: -maxForce, wheelIndex: 3 });
                    setIsMoving(true);
                } else if (keysPressed.includes("s") || keysPressed.includes("arrowdown")) {
                    vehicleApi.applyEngineForce({ force: maxForce, wheelIndex: 0 });
                    vehicleApi.applyEngineForce({ force: maxForce, wheelIndex: 1 });
                    vehicleApi.applyEngineForce({ force: maxForce, wheelIndex: 2 });
                    vehicleApi.applyEngineForce({ force: maxForce, wheelIndex: 3 });
                    setIsMoving(true);
                } else {
                    vehicleApi.setBrake({ force: slowDownCar, wheelIndex: 0 });
                    vehicleApi.setBrake({ force: slowDownCar, wheelIndex: 1 });
                    vehicleApi.setBrake({ force: slowDownCar, wheelIndex: 2 });
                    vehicleApi.setBrake({ force: slowDownCar, wheelIndex: 3 });
                    setIsMoving(false);
                }
            } else {
                vehicleApi.setBrake({ force: brakeForce, wheelIndex: 0 });
                vehicleApi.setBrake({ force: brakeForce, wheelIndex: 1 });
                vehicleApi.setBrake({ force: brakeForce, wheelIndex: 2 });
                vehicleApi.setBrake({ force: brakeForce, wheelIndex: 3 });
            }
        };

        const resetCar = () => {
            chassisBody.position?.set(0, 4, 0);
            chassisBody.quaternion?.set(0, 0, 0, 1);
            chassisBody.angularVelocity?.set(0, 0, 0);
            chassisBody.velocity?.set(0, 0, 0);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [vehicleApi, chassisBody]);

    // Update loop
    useFrame(() => {
        if (chassisRef.current && vehicle && chassisBody.position) {
            // Update chassis position
            chassisRef.current.position.set(
                chassisBody.position.x + chassisModelPos.x,
                chassisBody.position.y + chassisModelPos.y,
                chassisBody.position.z + chassisModelPos.z
            );
            chassisRef.current?.quaternion.copy(chassisBody.quaternion);

            // Camera follow
            if (camera && orbitControls) {
                const followDistance = 1;
                const followHeight = 0.3;
                const forward = new THREE.Vector3(0, 0, 1)
                    .applyQuaternion(chassisBody.quaternion);
                const cameraOffset = new THREE.Vector3(
                    -forward.x * followDistance,
                    followHeight,
                    -forward.z * followDistance
                );
                const camPos = new THREE.Vector3()
                    .copy(chassisBody.position)
                    .multiplyScalar(0.1)
                    .add(cameraOffset);
                camera.position.lerp(camPos, 0.1);

                const targetOffset = new THREE.Vector3(forward.x, 0, forward.z).multiplyScalar(2);
                const tagPos = new THREE.Vector3()
                    .copy(chassisBody.position)
                    .multiplyScalar(0.1)
                    .add(targetOffset);
                orbitControls.current.target.copy(tagPos);
                orbitControls.current.update();
            }
        }
    });

    return (
        <group ref={carRef}>
            <primitive object={chassisModel.scene} ref={chassisRef} />
            {wheelPositions.map((pos, i) => (
                <Wheel
                    key={i}
                    position={pos}
                    flip={i === 1 || i === 3}
                    wheelModel={wheelModel}
                    ref={wheelRefs[i]}
                />
            ))}
        </group>
    );
};

export default R3fCar;