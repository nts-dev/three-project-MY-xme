import * as React from "react";
import {useEffect, useRef, useState} from "react";
import * as THREE from "three";
import { useAnimations } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";
import { useFrame } from "@react-three/fiber";
import {RigidBody, CapsuleCollider} from "@react-three/rapier";
import useGame from "../../hooks/useGame";
import PlayerLabel from "./PlayerLabel";

const IDLE_ANIMATIONS = new Set(["Idle", "Idle 1", "idle"]);
const WALK_ANIMATION_CANDIDATES = ["Walk", "Walking", "walk", "walking"];
const IDLE_ANIMATION_CANDIDATES = ["Idle", "Idle 1", "idle"];
const GPS_WALK_DISTANCE = 0.015;
const REMOTE_LERP_SPEED = 5;
const REMOTE_TARGET_SMOOTHING = 7;
const REMOTE_TURN_SPEED = 10;

function findAnimationName(actions: Record<string, any>, candidates: string[]) {
    return candidates.find((name) => actions?.[name]) || "";
}

function resolveAnimationName(actions: Record<string, any>, desiredAnimation: string, autoWalking: boolean) {
    if (desiredAnimation && actions?.[desiredAnimation]) return desiredAnimation;
    if (autoWalking) return findAnimationName(actions, WALK_ANIMATION_CANDIDATES);
    return findAnimationName(actions, IDLE_ANIMATION_CANDIDATES);
}

function lerpAngle(from: number, to: number, alpha: number) {
    const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + delta * alpha;
}

export default function RemotePlayer({ player, rPlayer, animations }: any) {
    const playerRef = useRef<THREE.Group>(null);
    const rigidBodyRef = useRef<any>(null);
    const targetPositionRef = useRef(new THREE.Vector3());
    const smoothedTargetPositionRef = useRef(new THREE.Vector3());
    const currentPositionRef = useRef(new THREE.Vector3());
    const newPositionRef = useRef(new THREE.Vector3());
    const moveDirectionRef = useRef(new THREE.Vector3());
    const facingDirectionRef = useRef(0);
    const autoWalkingRef = useRef(false);
    const hasTargetRef = useRef(false);
    const [capsuleHalfHeight, setCapsuleHalfHeight] = useState(0.25);
    const [capsuleRadius, setCapsuleRadius] = useState(0.3);
    const [autoWalking, setAutoWalking] = useState(false);

    const {
        clientId, posX, posY, posZ, speed, currentAnimation,
        userName, direction, noOfLivesRemaining,position
    } = player;

    const projectID = useGame((state: any) => state.projectID);
    const [yOffset, setYOffset] = useState(-0.64)
    // Clone the model for independent animation control
    const clonedModel = React.useMemo(() => SkeletonUtils.clone(rPlayer), [rPlayer]);
    const { actions } = useAnimations(animations, playerRef);
    const shouldUseGpsWalk = !currentAnimation || IDLE_ANIMATIONS.has(currentAnimation);
    const desiredAnimation = shouldUseGpsWalk && autoWalking
        ? findAnimationName(actions, WALK_ANIMATION_CANDIDATES) || "Walk"
        : currentAnimation || findAnimationName(actions, IDLE_ANIMATION_CANDIDATES) || "Idle";

    useEffect(() => {
        const animationName = resolveAnimationName(actions, desiredAnimation, autoWalking);

        if (!clonedModel || !playerRef.current || !animationName) return;

        const pSpeed = 1 + (speed / 100) * 5;
        const action: any = actions[animationName];

        if (!action) return;

        Object.values(actions).forEach((otherAction: any) => {
            if (otherAction !== action) otherAction?.fadeOut?.(0.2);
        });

        if (animationName === "Jump") {
            action
                .reset()
                .fadeIn(0.2)
                .setLoop(projectID === 144 ? THREE.LoopRepeat : THREE.LoopOnce)
                .setDuration(action.getClip().duration / pSpeed)
                .play();
            action.clampWhenFinished = true;
        } else if (IDLE_ANIMATIONS.has(animationName)) {
            action.reset().fadeIn(0.2).setDuration(action.getClip().duration).play();
        } else if (animationName === "Fail" || animationName === "Recover") {
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
    }, [desiredAnimation, autoWalking, projectID, actions, rPlayer, clonedModel, speed]);

    useFrame((_, delta) => {
        if (!rigidBodyRef.current) return;

        // Move rigid body smoothly to target position
        const currentPosition = rigidBodyRef.current.translation();
        currentPositionRef.current.set(currentPosition.x, currentPosition.y, currentPosition.z);
        targetPositionRef.current.set(posX / 100, posY / 100, posZ / 100);

        if (!hasTargetRef.current) {
            hasTargetRef.current = true;
            smoothedTargetPositionRef.current.copy(targetPositionRef.current);
            currentPositionRef.current.copy(targetPositionRef.current);
            rigidBodyRef.current.setTranslation(targetPositionRef.current, true);
        } else {
            smoothedTargetPositionRef.current.lerp(
                targetPositionRef.current,
                Math.min(delta * REMOTE_TARGET_SMOOTHING, 1)
            );
        }

        const moveDistance = currentPositionRef.current.distanceTo(smoothedTargetPositionRef.current);
        const nextAutoWalking = shouldUseGpsWalk && moveDistance > GPS_WALK_DISTANCE;
        if (autoWalkingRef.current !== nextAutoWalking) {
            autoWalkingRef.current = nextAutoWalking;
            setAutoWalking(nextAutoWalking);
        }

        newPositionRef.current.lerpVectors(
            currentPositionRef.current,
            smoothedTargetPositionRef.current,
            Math.min(delta * REMOTE_LERP_SPEED, 1)
        );

        newPositionRef.current.y = smoothedTargetPositionRef.current.y
        rigidBodyRef.current.setTranslation(newPositionRef.current, true);

        const explicitDirection = Number(direction);
        let targetDirection = Number.isFinite(explicitDirection) ? explicitDirection : null;
        moveDirectionRef.current.subVectors(smoothedTargetPositionRef.current, currentPositionRef.current);
        moveDirectionRef.current.y = 0;

        if (targetDirection === null && moveDirectionRef.current.lengthSq() > 0.000001) {
            targetDirection = Math.atan2(moveDirectionRef.current.x, moveDirectionRef.current.z);
        }

        if (targetDirection !== null) {
            facingDirectionRef.current = lerpAngle(
                facingDirectionRef.current,
                targetDirection,
                Math.min(delta * REMOTE_TURN_SPEED, 1)
            );
            const quaternion = new THREE.Quaternion();
            quaternion.setFromEuler(new THREE.Euler(0, facingDirectionRef.current, 0));
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
