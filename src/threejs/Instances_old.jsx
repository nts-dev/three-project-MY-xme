import {InstancedRigidBodies} from "@react-three/rapier";
import * as THREE from "three";
import {Matrix4, Quaternion, Vector3} from "three";
import React, {useEffect, useRef} from "react";
import {useFrame} from "@react-three/fiber";
import useGame from "../hooks/useGame";

const Instances = ({object, name, properties, createInstances}) => {
    const ref = useRef();
    const basePosition = useRef([]);
    const baseRotation = useRef([]);
    const ladders = useRef({})
    const setGameInstances = useGame((state) => state.setGameInstances);
    const gameInstances = useGame((state) => state.gameInstances);
    const checkReload = useGame((state) => state.checkReload);
    const ladderList = useGame((state) => state.ladderList);
    const setLadderList = useGame((state) => state.setLadderList);
    const setScannedId = useGame((state) => state.setScannedId);
    const setScan = useGame((state) => state.setScan);
    const scan = useGame((state) => state.scan);
    const setSearchItem = useGame((state) => state.setSearchItem);

    useEffect(() => {
        if (ref.current) {
            basePosition.current = [];
            baseRotation.current = [];
            ladders.current = {};

            ref.current.forEach((instance, i) => {

                if (properties['isLadder']?.value === "1") {
                    const translation = instance.translation();
                    const start = new Vector3(translation.x, translation.y, translation.z);

                    const rotationQuaternion = new Quaternion().copy(instance.rotation());

                    const rotationMatrix = new Matrix4().makeRotationFromQuaternion(rotationQuaternion);
                    const upVector = new Vector3(0, 0, 1).applyMatrix4(rotationMatrix).normalize();
                    const key = instance.userData.instance_id;
                    const baseHeight = parseFloat(instance.userData.height) || 0;


                    const height = baseHeight*3 ;
                    const rotatedDisplacement = upVector.multiplyScalar(height);

                    const end = start.clone().add(rotatedDisplacement);
                    ladders[key] = {start, end, direction: upVector}

                    setLadderList({
                        ...ladders,
                        [key]: {start, end, direction: upVector}
                    });


                }

                basePosition.current[i] = {
                    x: instance.translation().x,
                    y: instance.translation().y,
                    z: instance.translation().z
                };

                baseRotation.current[i] = new THREE.Quaternion(
                    instance.rotation().x,
                    instance.rotation().y,
                    instance.rotation().z,
                    instance.rotation().w
                );

            });


            setGameInstances({
                ...gameInstances,
                [name]: ref.current,
            });
        }
    }, [ref.current, checkReload]);


    useFrame(({clock}, delta) => {
        if (!ref.current) return;

        if (properties) {
            ref.current.forEach((instance, i) => {
                const currentPos = instance.translation();

                // Movement (Oscillation)
                if (basePosition.current[i] !== undefined) {
                    if (properties['Move_X']?.value === "1") {
                        const xAmplitude = parseFloat(properties['Amplitude_X']?.value || 1);
                        const xSpeed = parseFloat(properties['Speed_X']?.value || 1);
                        const xOffset = basePosition.current[i].x + Math.sin(clock.elapsedTime * xSpeed) * xAmplitude;
                        instance.setTranslation({x: xOffset, y: currentPos.y, z: currentPos.z}, true);
                    }

                    if (properties['Move_Y']?.value === "1") {
                        const yAmplitude = parseFloat(properties['Amplitude_Y']?.value || 1);
                        const ySpeed = parseFloat(properties['Speed_Y']?.value || 1);
                        const yOffset = basePosition.current[i].y + Math.sin(clock.elapsedTime * ySpeed) * yAmplitude;
                        instance.setTranslation({x: currentPos.x, y: yOffset, z: currentPos.z}, true);
                    }

                    if (properties['Move_Z']?.value === "1") {
                        const zAmplitude = parseFloat(properties['Amplitude_Z']?.value || 1);
                        const zSpeed = parseFloat(properties['Speed_Z']?.value || 1);
                        const zOffset = basePosition.current[i].z + Math.sin(clock.elapsedTime * zSpeed) * zAmplitude;
                        instance.setTranslation({x: currentPos.x, y: currentPos.y, z: zOffset}, true);
                    }
                }

                // Rotation (Oscillation)
                if (baseRotation.current[i] !== undefined) {
                    const deltaQuat = new THREE.Quaternion();

                    if (properties['Can Rotate_X']?.value === "1") {
                        const rotateAmplitude = THREE.MathUtils.degToRad(parseFloat(properties['Rotate_Amplitude_X']?.value || 1));
                        const rotateSpeed = parseFloat(properties['Rotate_Speed_X']?.value || 1);
                        const oscillatingAngle = Math.sin(clock.elapsedTime * rotateSpeed) * rotateAmplitude;
                        deltaQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), oscillatingAngle);
                    }

                    if (properties['Can Rotate_Y']?.value === "1") {
                        const rotateAmplitude = THREE.MathUtils.degToRad(parseFloat(properties['Rotate_Amplitude_Y']?.value || 1));
                        const rotateSpeed = parseFloat(properties['Rotate_Speed_Y']?.value || 1);
                        const oscillatingAngle = Math.sin(clock.elapsedTime * rotateSpeed) * rotateAmplitude;
                        deltaQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), oscillatingAngle);
                    }

                    if (properties['Can Rotate_Z']?.value === "1") {
                        const rotateAmplitude = THREE.MathUtils.degToRad(parseFloat(properties['Rotate_Amplitude_Z']?.value || 1));
                        const rotateSpeed = parseFloat(properties['Rotate_Speed_Z']?.value || 1);
                        const oscillatingAngle = Math.sin(clock.elapsedTime * rotateSpeed) * rotateAmplitude;
                        deltaQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), oscillatingAngle);
                    }

                    // Apply oscillating rotation relative to the base rotation
                    const newRotation = baseRotation.current[i].clone().multiply(deltaQuat);
                    instance.setRotation(newRotation, true);
                }
            });
        }
    });
    if(object.geometry===undefined){
        return null
    }

    return (
        <InstancedRigidBodies
            key={`${name}RidgidBody`}
            ref={ref}
            instances={createInstances}
            type={properties['Collider Type']?.value || "kinematicPosition"}
            colliders={properties['Colliders']?.value || "hull"}
        >
            <instancedMesh

                args={[null, null, createInstances.length]}
                frustumCulled={false}
                geometry={object.geometry}
                material={object.material}

                // onDoubleClick={(e) => {
                //     e.stopPropagation();
                //     const instanceIndex = e.instanceId;
                //
                //     if (instanceIndex !== undefined && ref.current) {
                //         // const instancedMesh = ref.current;
                //         // const instanceMatrix = new THREE.Matrix4();
                //         // instancedMesh.getMatrixAt(instanceIndex, instanceMatrix);
                //
                //         const userData = createInstances[instanceIndex].userData;
                //
                //         // console.log('Double clicked instance index:', instanceIndex);
                //         // console.log('Instance ID from userData:', userData.instance_id);
                //
                //         // setScannedId(`${userData.instance_id}_click`)
                //         // setScan(!scan)
                //         // setSearchItem({noZoom: true})
                //
                //         // You can now use this ID for selection or other logic
                //     }
                // }}
            />
        // </InstancedRigidBodies>
    );

};

export default Instances;
