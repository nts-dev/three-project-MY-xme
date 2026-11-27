import * as React from "react";
import {useEffect, useRef, useState} from "react";
import * as THREE from "three";
import { useAnimations } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";
import { useFrame } from "@react-three/fiber";
import { applyStreetLampLight, updateStreetLampLight } from "../../components/weather/streetLampLight";
import {RigidBody, CapsuleCollider} from "@react-three/rapier";
import useGame from "../../hooks/useGame";
import PlayerLabel from "./PlayerLabel";
import { avatarPlacement } from "./CharacterModel";
import { sceneHasTerrain } from "../terrain/terrainData";

const IDLE_ANIMATIONS = new Set(["Idle", "Idle 1", "idle"]);
const WALK_ANIMATION_CANDIDATES = ["Walk", "Walking", "walk", "walking"];
const IDLE_ANIMATION_CANDIDATES = ["Idle", "Idle 1", "idle"];
const GPS_WALK_DISTANCE = 0.015;
const REMOTE_LERP_SPEED = 5;
const REMOTE_TARGET_SMOOTHING = 7;
const REMOTE_TURN_SPEED = 10;
const LAMP_UPDATE_FRAMES = 4; // the street-lamp light on a remote avatar is refreshed every few frames
const REMOTE_SNAP_DISTANCE = 25; // metres: farther than this (respawn, teleport) the avatar jumps there

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

export default function RemotePlayer({ player, rPlayer, animations, rtlsMotions, liveRef, modelScale }: any) {
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
    const liveRtls = Boolean(player?.rtls && !player?.isTrackReplay);
    const rtlsRotation = useRef(new THREE.Quaternion());
    const rtlsEuler = useRef(new THREE.Euler());
    const facingQuaternion = useRef(new THREE.Quaternion());
    const facingEuler = useRef(new THREE.Euler());

    const {
        clientId, posX, posY, posZ, speed, currentAnimation,
        userName, direction, noOfLivesRemaining,position
    } = player;

    const projectID = useGame((state: any) => state.projectID);
    const onTerrain = useGame((state: any) => sceneHasTerrain(state, state.projectID));
    // Other players' avatars (walked in character mode) are placed exactly like the local avatar:
    // same model scale, same scale about the feet and the same height on the body.
    const matchLocal = !liveRtls && !player?.isTrackReplay && projectID !== 144;
    const placement = avatarPlacement(onTerrain);
    const [yOffset, setYOffset] = useState(-1)
    // Clone the model for independent animation control
    const clonedModel = React.useMemo(() => {
        const model = SkeletonUtils.clone(rPlayer);
        if (player?.isTrackReplay) {
            setYOffset(-0.4)
            
        } 
        // else {
        //     model.scale.multiplyScalar(1.7);
        // }
   
        if (modelScale) model.scale.copy(modelScale); // the local model's own scale
        else model.scale.multiplyScalar(2);
        
            
        
        return model;
    }, [rPlayer, player?.isTrackReplay, modelScale]);
    // The same look as the local avatar (CharacterModel.tsx): the body in a Phong material with the
    // model's texture and the player's colour, lit by the street lamps at night. The model file's
    // own material (what a plain clone kept) looked darker, and being a different shader it was
    // compiled when the first other player appeared (a frame freeze).
    const bodyLook = React.useMemo(() => {
        const body: any = clonedModel.children[0]?.children[0];
        if (!body?.material) return null;
        const map = body.material.map || null;
        if (map) map.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshPhongMaterial({ map, color: player?.personColor || "#ffffff" });
        const lampUniforms = applyStreetLampLight(material);
        body.material = material;
        return { body, material, lampUniforms };
    }, [clonedModel, player?.personColor]);
    useEffect(() => () => bodyLook?.material.dispose(), [bodyLook]);
    const lampWorld = useRef(new THREE.Vector3());
    const lampFrame = useRef(Math.floor(Math.random() * LAMP_UPDATE_FRAMES));

    const { actions } = useAnimations(animations, playerRef);
    const shouldUseGpsWalk = !currentAnimation || IDLE_ANIMATIONS.has(currentAnimation);
    const desiredAnimation = liveRtls
        ? findAnimationName(actions, autoWalking ? WALK_ANIMATION_CANDIDATES : IDLE_ANIMATION_CANDIDATES)
        : shouldUseGpsWalk && autoWalking
        ? findAnimationName(actions, WALK_ANIMATION_CANDIDATES) || "Walk"
        : currentAnimation || findAnimationName(actions, IDLE_ANIMATION_CANDIDATES) || "Idle";
    const animationSpeed = liveRtls ? 1 : 1 + (speed / 100) * 5;

    useEffect(() => {
        const animationName = resolveAnimationName(actions, desiredAnimation, autoWalking);

        if (!clonedModel || !playerRef.current || !animationName) return;

        const pSpeed = animationSpeed;
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
    }, [desiredAnimation, autoWalking, projectID, actions, rPlayer, clonedModel, animationSpeed]);

    useFrame(({ camera }, delta) => {
        if (!rigidBodyRef.current) return;
        if (bodyLook && ++lampFrame.current % LAMP_UPDATE_FRAMES === 0) {
            bodyLook.body.getWorldPosition(lampWorld.current);
            updateStreetLampLight(bodyLook.lampUniforms, lampWorld.current, camera);
        }

        if (liveRtls) {
            const motion = rtlsMotions?.get(String(clientId));
            const walking = Boolean(motion?.ready && motion.speed > 0.01);
            if (autoWalkingRef.current !== walking) {
                autoWalkingRef.current = walking;
                setAutoWalking(walking);
            }
            if (!motion?.ready) return;
            // The model's existing yOffset places its feet below the rigid-body origin.
            newPositionRef.current.copy(motion.position);
            newPositionRef.current.y -= yOffset;
            rigidBodyRef.current.setTranslation(newPositionRef.current, true);
            rtlsRotation.current.setFromEuler(rtlsEuler.current.set(0, motion.heading, 0));
            rigidBodyRef.current.setRotation(rtlsRotation.current, true);
            return;
        }

        // Move rigid body smoothly to target position (the latest snapshot: positions arrive without
        // re-rendering this component).
        const latest = (!player?.isTrackReplay && liveRef?.current?.get(String(clientId))) || player;
        const currentPosition = rigidBodyRef.current.translation();
        currentPositionRef.current.set(currentPosition.x, currentPosition.y, currentPosition.z);
        targetPositionRef.current.set(Number(latest.posX) / 100, Number(latest.posY) / 100, Number(latest.posZ) / 100);
        if (!Number.isFinite(targetPositionRef.current.x) || !Number.isFinite(targetPositionRef.current.z)) return;

        if (!hasTargetRef.current || currentPositionRef.current.distanceTo(targetPositionRef.current) > REMOTE_SNAP_DISTANCE) {
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

        const explicitDirection = Number(latest.direction ?? direction);
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
            facingQuaternion.current.setFromEuler(facingEuler.current.set(0, facingDirectionRef.current, 0));
            rigidBodyRef.current.setRotation(facingQuaternion.current, true);
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
            {/* <PlayerLabel
                key={clientId}
                userName={userName}
                playerSpeed={speed}
                noOfLivesRemaining={noOfLivesRemaining}
                angle={direction}
                isLocal={false}
                remotePosition={position}
            /> */}

            {/* Player model inside the rigid body */}
            <group ref={playerRef} name={userName}>
                {matchLocal ? (
                    <group position-y={placement.offsetY} scale={placement.scale}>
                        <primitive object={clonedModel} />
                    </group>
                ) : (
                    <primitive object={clonedModel}  position-y={ yOffset } />
                )}
            </group>
        </RigidBody>
    );
}
