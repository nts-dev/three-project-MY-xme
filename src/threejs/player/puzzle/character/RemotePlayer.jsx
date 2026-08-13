import * as React from "react";
import {useEffect, useMemo, useRef} from "react";
import * as THREE from "three";
import { useAnimations } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";
import { useFrame } from "@react-three/fiber";
import {RigidBody, CapsuleCollider} from "@react-three/rapier";
import useGame from "../../../../hooks/useGame";
import Status from "./Status.jsx";
import RemoteStatus from "./RemoteStatus.jsx";
import { color } from "framer-motion";


export default function RemotePlayer({ player, rPlayer, animations,textureCache,materialCache,alphaTexture }) {
    const playerRef = useRef(null);
    const rigidBodyRef = useRef(null);
    const projectID = useGame((state) => state.projectID);
    const setRemovedObject = useGame((state) => state.setRemovedObject);
    const tmpCurrentPos = new THREE.Vector3();
    const tmpTargetPos = new THREE.Vector3();
    const tmpNewPos = new THREE.Vector3();
    const tmpMoveDir = new THREE.Vector3();
    const prevAnimationRef = useRef(null);
    const facingAngleRef = useRef(0);
    const {
        clientId, posX, posY, posZ, speed, currentAnimation,
        userName, quaternion,removedObject,movingSpeed,hpPct,enPct,avatarColor
    } = player;

    const clonedModel = useMemo(()=>{
       
        const color = avatarColor 
        if (!color) return null;

        const mat = materialCache?.get(color);

        if (mat) {

            const clone = SkeletonUtils.clone(rPlayer)
            clone.traverse((child) => {
                if (child.isMesh) {
                    child.material = mat;
                }
            });

            return clone;

        }

        let colorTexture = textureCache.get(color);
        if (!colorTexture) {
            colorTexture = new THREE.TextureLoader().load(
                `${import.meta.env.VITE_FILE_URL}/${color}`
            );
            colorTexture.colorSpace = THREE.SRGBColorSpace;
            colorTexture.wrapS = colorTexture.wrapT = THREE.RepeatWrapping;
            colorTexture.needsUpdate = true;
            textureCache.set(color, colorTexture);
        }

        const newMat = new THREE.MeshStandardMaterial({
            map: colorTexture,
            emissiveMap: colorTexture,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 1.5,
            alphaMap: alphaTexture,
            // transparent: true,
            alphaTest: 0.5,
            // side: THREE.DoubleSide,
        });

        materialCache.set(color, newMat);

        const clone = SkeletonUtils.clone(rPlayer)
        clone.traverse((child) => {
            if (!child.isMesh) return;
            // Only apply to meshes that support UVs
            if (!child.geometry.attributes.uv) {
                console.warn(`Skipping ${child.name} → no UVs`);
                return;
            }

                child.material = newMat;

        });

       
        return clone;
        },[avatarColor]);

    // Clone the model for independent animation control

    const animationRef = useMemo(()=>animations,[]);

    const { actions } = useAnimations(animationRef, playerRef);

    useEffect(() => {
        setRemovedObject(removedObject);

    }, []);

    useEffect(() => {
        const speed = 1 + (40 * movingSpeed * 100 / 100) * 5;

        if (!clonedModel || !playerRef.current || !actions[currentAnimation]) return;

        const action = actions[currentAnimation || "Idle 1"];
        if (!action) return;

        // --- determine transition duration based on prev → current ---
        let fadeDuration = 0.2; // default
        const prevAnim = prevAnimationRef.current;

        // 🟩 idle <-> walk transitions
        if (
            (prevAnim === "Idle 1" && currentAnimation === "Walk") ||
            (prevAnim === "Walk" && currentAnimation === "Idle 1")
        ) {
            fadeDuration = 1.0;
        }

        // 🟦 walk <-> run transitions
        else if (
            (prevAnim === "Walk" && currentAnimation === "Run") ||
            (prevAnim === "Run" && currentAnimation === "Walk")
        ) {
            fadeDuration = 2.0;
        }

        // --- smoothly fade out all other active actions ---
        Object.values(actions).forEach((a) => {
            if (a !== action) a.fadeOut(fadeDuration);
        });

        // --- play current animation with computed fade time ---
        if (currentAnimation === "Jump" || currentAnimation === "jumpDown") {
            action
                .reset()
                .fadeIn(fadeDuration)
                .setLoop(THREE.LoopOnce, 1)
                .setDuration(action.getClip().duration / (speed * 1.5))
                .play();
            action.clampWhenFinished = true;

        } else if (currentAnimation === "Idle 1") {
            action
                .reset()
                .fadeIn(fadeDuration)
                .setLoop(THREE.LoopRepeat)
                .play();

        } else if (["Backwards Dying", "Stand Up"].includes(currentAnimation)) {
            action
                .reset()
                .fadeIn(fadeDuration)
                .setLoop(THREE.LoopOnce, 1)
                .setDuration(action.getClip().duration)
                .play();
            action.clampWhenFinished = true;

        } else if (["Walk", "Run","Ladder Climb",].includes(currentAnimation)) {
            action
                .reset()
                .fadeIn(fadeDuration)
                .setLoop(THREE.LoopRepeat)
                .setDuration(
                    action.getClip().duration /
                    (speed * (currentAnimation === "Walk" ? 0.65 : 0.4))
                )
                .play();

        } else {
            action
                .reset()
                .fadeIn(fadeDuration)
                .setLoop(THREE.LoopOnce, 1)
                .setDuration(action.getClip().duration / speed)
                .play();
            action.clampWhenFinished = true;
        }

        // --- store current animation for next transition ---
        prevAnimationRef.current = currentAnimation;

        // --- fade out when animation changes ---
        return () => {
            action.fadeOut(fadeDuration);
        };
    }, [currentAnimation, projectID, speed, actions, rPlayer, movingSpeed]);

    useFrame(() => {
        if (!rigidBodyRef.current) return;
        // Get current and target positions
        const currentPos = rigidBodyRef.current.translation();
        tmpCurrentPos.set(currentPos.x, currentPos.y, currentPos.z);
        tmpTargetPos.set(posX / 100, posY / 100, posZ / 100);

        // Interpolate position (lerp)
        tmpNewPos.lerpVectors(tmpCurrentPos, tmpTargetPos, 0.1);
        rigidBodyRef.current.setTranslation(tmpNewPos, true);

        // --- Rotation logic ---
        tmpMoveDir.subVectors(tmpTargetPos, tmpNewPos);
        tmpMoveDir.y = 0;

        // Default: keep current facing
        // let targetAngle = facingAngleRef.current;

        if (currentAnimation === "Turn Left") {
            facingAngleRef.current += THREE.MathUtils.degToRad(2); // turn step
            // targetAngle = facingAngleRef.current;

        }
        else if (currentAnimation === "Turn Right") {
            facingAngleRef.current -= THREE.MathUtils.degToRad(2); // turn step
            // targetAngle = facingAngleRef.current;
        }

        // if (direction) {
        //     const quat = new THREE.Quaternion().setFromEuler(
        //         new THREE.Euler(0, direction, 0)
        //     );
        //     rigidBodyRef.current.setRotation(quat, true);
        // }
         if (quaternion) {
            const quat = new THREE.Quaternion(
                quaternion[0],
                quaternion[1],
                quaternion[2],
                quaternion[3]
            );
            rigidBodyRef.current.setRotation(quat, true);
        }
        // else
        //     if (tmpMoveDir.lengthSq() > 0.0001) {
        //     // If moving forward, align facing with movement smoothly
        //     tmpMoveDir.normalize();
        //     const moveAngle = Math.atan2(tmpMoveDir.x, tmpMoveDir.z);
        //     // interpolate facing angle toward move angle
        //     facingAngleRef.current = THREE.MathUtils.lerp(facingAngleRef.current, moveAngle, 0.1);
        //     targetAngle = facingAngleRef.current;
        // }
        // // Apply rotation
        // tmpEuler.set(0, targetAngle, 0);
        // tmpTargetQuat.setFromEuler(tmpEuler);
        //
        // rigidBodyRef.current.setRotation(tmpTargetQuat, true);
    });

if(!clonedModel) { return null; }

    return (
        <RigidBody
            key={`${clientId}_player`}
            ref={rigidBodyRef}
            type="kinematicPosition"
            enabledRotations={[false, false, false]}
            colliders={false} // Disable default collider, using custom CapsuleCollider

        >
            <CapsuleCollider args={[0.0051, 0.0145]} />
            {/* Player model inside the rigid body */}
            <group ref={playerRef}>
                <primitive object={clonedModel} position={[0, -0.02, 0]} scale={[0.01, 0.01, 0.01]} rotation={[0, 0, 0]}  />
            </group>
            <RemoteStatus userName={userName} hpPct={hpPct} enPct={enPct} />
        </RigidBody>
    );
}
