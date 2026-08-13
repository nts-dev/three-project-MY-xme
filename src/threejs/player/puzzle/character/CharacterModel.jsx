import {
    useAnimations,
    useGLTF,
    Trail
} from "@react-three/drei";
import {Suspense, useEffect, useMemo, useRef, useState} from "react";
import * as THREE from "three";
// import { useGame } from "./stores/useGame";
import useGame from "../../../../hooks/useGame";
import { BallCollider, RapierCollider, vec3 } from "@react-three/rapier";
import {useLoader} from "@react-three/fiber";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {useGame1} from "../../../../hooks/useGame1.js";
import * as React from "react";

export default function CharacterModel() {

    const initializeAnimationSet = useGame1((state) => state.initializeAnimationSet);
    const curAnimation = useGame1((state) => state.curAnimation);
    const playerSpeed = useGame((state) => state.playerSpeed);
    const movingSpeed = useGame((state) => state.movingSpeed);
    const [characterModel, setCharacterModel] = useState(null);
    // Change the character src to yours
    const group = useRef();


    const gltf = useLoader(GLTFLoader, `${import.meta.env.VITE_FILE_URL}/avatar.glb`);

    const charModel = useMemo(() => {

        return gltf;
    }, [gltf]);

    const { animations } = charModel;

    const animationSet = {
        idle: 'Idle 1',
        walk: 'Walk',
        jump: 'Jump',
        run: 'Run',
        fail: 'Backwards Dying',
        recover: 'Stand Up',
        climb: 'Climbing',
        left: 'Turn Left',
        right: 'Turn Right',


    };


    const { actions } = useAnimations(animations, characterModel);


    /**
     * Prepare hands ref for attack action
     */

    const leftHandColliderRef = useRef();


    useEffect(() => {
        // Initialize animation set
        initializeAnimationSet(animationSet);
    }, []);


    useEffect(() => {
        const speed = 1 + (40 * movingSpeed) * 0.8;

        const action = actions[curAnimation ?? animationSet.idle];
        if (!action) return;

        if (curAnimation === animationSet.jump) {
            action
                .reset()
                .fadeIn(0.2)
                .setLoop(THREE.LoopOnce, 1) // play once
                .setDuration(action.getClip().duration )
                .play();

            action.clampWhenFinished = true;
        } else if (curAnimation === animationSet.idle) {
            action
                .reset()
                .fadeIn(0.2)
                .setLoop(THREE.LoopRepeat) // idle loops
                .play();
        } else if ([animationSet.fail, animationSet.recover].includes(curAnimation)) {
            action
                .reset()
                .fadeIn(0.2)
                .setLoop(THREE.LoopOnce, 1) // play once
                .setDuration(action.getClip().duration)
                .play();

            action.clampWhenFinished = true;
        } else if (curAnimation === animationSet.walk || curAnimation === animationSet.run) {
            action
                .reset()
                .fadeIn(0.2)
                .setLoop(THREE.LoopRepeat) // walk repeats
                .setDuration(action.getClip().duration / speed * 0.8)
                .play();
        } else {
            action
                .reset()
                .fadeIn(0.2)
                .setLoop(THREE.LoopOnce, 1) // play once
                .setDuration(action.getClip().duration / speed)
                .play();

            action.clampWhenFinished = true;
        }


        return () => {
            action.fadeOut(0.2);
        };
    }, [curAnimation, playerSpeed, movingSpeed]);

    // Load GLB model
    useEffect(() => {
        if (charModel.scene) {
            const model = charModel.scene;
            model.scale.set(0.1, 0.1, 0.1);

            setCharacterModel(model);
        }
    }, []);
    if(!characterModel) return null;

    return (
        <Suspense fallback={<capsuleGeometry args={[0.3, 0.7]} />}>


            {/* Replace yours model here */}

            {/* Head collider */}
            <BallCollider args={[0.5]} position={[0, 0.45, 0]} />

            {/*<BallCollider args={[0.1]} ref={leftHandColliderRef} />*/}

            <group
                ref={group}

                dispose={null}
            >
                <group name="Scene" scale={0.8} position={[0, -0.6, 0]}>
                    <group name="KayKit_Animated_Character">

                        <Trail
                            width={1.5}
                            color={'violet'}
                            length={1.5}
                            attenuation={(width) => width}
                        >
                            <primitive object={characterModel} />
                        </Trail>
                    </group>
                </group>

            </group>
        </Suspense>
    );
}

// Change the character src to yours
// useGLTF.preload("/Floating Character.glb");
