import * as React from "react";
import {useEffect, useMemo, useRef, useState} from "react";
import * as THREE from "three";
import { useAnimations } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";
import { useFrame } from "@react-three/fiber";
import {RigidBody, CapsuleCollider} from "@react-three/rapier";
import useGame from "../../hooks/useGame";
import PlayerLabel from "./PlayerLabel";

export default function RemotePlayer({ player, rPlayer, animations }: any) {
    const playerRef = useRef<THREE.Group>(null);
    const rigidBodyRef = useRef<any>(null);
    const [capsuleHalfHeight, setCapsuleHalfHeight] = useState(0.25);
    const [capsuleRadius, setCapsuleRadius] = useState(0.3);

    const {
        clientId, posX, posY, posZ, speed, currentAnimation,
        userName, direction, noOfLivesRemaining,position
    } = player;

    const projectID = useGame((state: any) => state.projectID);
    const [yOffset, setYOffset] = useState(-0.64)
    // Clone the model for independent animation control
    const clonedModel = React.useMemo(() => SkeletonUtils.clone(rPlayer), [rPlayer]);
    const { actions } = useAnimations(animations, playerRef);

    useEffect(() => {
        if (!clonedModel || !playerRef.current || !actions[currentAnimation]) return;

        const pSpeed = 1 + (speed / 100) * 5;
        const action: any = actions[currentAnimation || "Idle"];

        if (!action) return;

        if (currentAnimation === "Jump") {
            action
                .reset()
                .fadeIn(0.2)
                .setLoop(projectID === 144 ? THREE.LoopRepeat : THREE.LoopOnce)
                .setDuration(action.getClip().duration / pSpeed)
                .play();
            action.clampWhenFinished = true;
        } else if (currentAnimation === "Idle") {
            action.reset().fadeIn(0.2).setDuration(action.getClip().duration).play();
        } else if (currentAnimation === "Fail" || currentAnimation === "Recover") {
            action
                .reset()
                .fadeIn(0.2)
                .setLoop(THREE.LoopOnce, undefined as unknown as number)
                .setDuration(action.getClip().duration)
                .play();
            action.clampWhenFinished = true;
        } else {
            action.reset().fadeIn(0.2).setDuration(action.getClip().duration / pSpeed).play();
        }
        if(projectID==144){
           setYOffset(-0.45)
        }

        return () => {
            action.fadeOut(0.2);
        };
    }, [currentAnimation, projectID,  actions, rPlayer]);

    useFrame((_, delta) => {
        if (!rigidBodyRef.current) return;

        // Move rigid body smoothly to target position
        const targetPosition = new THREE.Vector3(posX / 100, posY / 100, posZ / 100);
        const newPosition = new THREE.Vector3().lerpVectors(rigidBodyRef.current.translation(), targetPosition, delta * 5);

        newPosition.y = targetPosition.y
        rigidBodyRef.current.setTranslation(newPosition, true);

        // Update rotation if direction is provided
        if (direction !== undefined) {
            const quaternion = new THREE.Quaternion();
            quaternion.setFromEuler(new THREE.Euler(0, direction, 0));
            rigidBodyRef.current.setRotation(quaternion, true);
        }

    });

    useEffect(() => {
        if (projectID === 144) {
            setCapsuleHalfHeight(0.25);
            setCapsuleRadius(0.2);
        } else {
            setCapsuleHalfHeight(0.45);
            setCapsuleRadius(0.3);
        }
    },[projectID])

    return (
        <RigidBody
            ref={rigidBodyRef}
            type="kinematicPosition"
            colliders={false} // Disable default collider, using custom CapsuleCollider
        >
            {/* Capsule Collider to match player shape */}
            <CapsuleCollider args={[capsuleHalfHeight, capsuleRadius]} position={[0, 0, 0]} />
            <PlayerLabel
                key={clientId}
                userName={userName}
                playerSpeed={speed}
                noOfLivesRemaining={noOfLivesRemaining}
                angle={direction}
                isLocal={false}
                remotePosition={position}
            />

            {/* Player model inside the rigid body */}
            <group ref={playerRef} name={userName}>
                <primitive object={clonedModel}  position-y={ yOffset } />
            </group>
        </RigidBody>
    );
}
