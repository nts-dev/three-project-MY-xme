import {useAnimations} from "@react-three/drei";
import {useEffect, useMemo, useRef, useState} from "react";
import * as THREE from "three";
import useGame from "../../../../hooks/useGame";
import {useGame1} from "../../../../hooks/useGame1";
import {useLoader} from "@react-three/fiber";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import * as React from "react";


export default function CharacterModelNew() {
    const character = useGame((state) => state.firstPerson);
    const firstPerson = useGame((state) => state.character);
    const [characterModel, setCharacterModel] = useState(null);
    const resetAnimation = useGame1((state) => state.reset);
    const initializeAnimationSet = useGame1((state) => state.initializeAnimationSet);
    const curAnimation = useGame1((state) => state.curAnimation);
    const playerSpeed = useGame((state) => state.playerSpeed);
    const movingSpeed = useGame((state) => state.movingSpeed);
    const uColor = useGame((state) => state.uColor);

   const groupRef = useRef();
    const buttonMode = useGame((state) => state.buttonMode);
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

    useEffect(() => {
        initializeAnimationSet(animationSet);
    }, []);

    useEffect(() => {
        resetAnimation();

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
                .setDuration(action.getClip().duration / (speed * 1.5))
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
    }, [curAnimation, playerSpeed, buttonMode, movingSpeed]);



    // Load GLB model
    useEffect(() => {
        if (charModel.scene) {
            const model = charModel.scene;
            model.scale.set(0.1, 0.1, 0.1);

            const parent = model.children[0];
            const guard = parent?.children[0];

            if (guard) {
                // parent.remove(guard);
                // console.log('Removed guard:', guard);
            }

            setCharacterModel(model);
        }
    }, []);


    useEffect(() => {



        const colorMap = {
            YL: 0xffff00, // Yellow (bright)
            BL: 0x3399ff, // Lighter Blue
            RD: 0xff6666, // Lighter Red
            BR: 0xcd853f, // Lighter Brown (peru/tan-like)
            GR: 0x00ff00, // Green (bright)
        };
        if (characterModel) {
            characterModel.traverse((child) => {
                if (child.isMesh) {
                    // ✅ keep your existing logic
                    child.layers.mask = character ? 0 : 1;

                    // ✅ set color from selected uColor
                    if (uColor && colorMap[uColor.code]) {
                        child.material.color = new THREE.Color(colorMap[uColor.code]);
                        child.material.shininess = 10
                        child.material.needsUpdate = true;
                    }
                }
            });
        }
    }, [character, uColor, characterModel]);
    if(!characterModel){
        return null
    }

    return (
        <>
            <group ref={groupRef} >
                <group name="Scene"   >
                    <group key={"char"} name="KayKit_Animated_Character">
                        <primitive object={characterModel} />
                    </group>
                </group>
            </group>
        </>
    )

}