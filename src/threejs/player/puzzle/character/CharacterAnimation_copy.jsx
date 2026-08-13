import {useAnimations, useKeyboardControls} from "@react-three/drei";
import {useEffect, useMemo, useRef, useState} from "react";
import * as THREE from "three";
import useGame from "../../../../hooks/useGame";
import {useGame1} from "../../../../hooks/useGame1";
import {useLoader} from "@react-three/fiber";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import CharacterController from "./CharacterController";
import RemotePlayerList from "./RemotePlayerList.jsx";


export default function CharacterAnimation({orbitControlsRef,client}) {
    const character = useGame((state) => state.firstPerson);
    const [characterModel, setCharacterModel] = useState(null);
    const resetAnimation = useGame1((state) => state.reset);
    const initializeAnimationSet = useGame1((state) => state.initializeAnimationSet);
    const curAnimation = useGame1((state) => state.curAnimation);
    const playerSpeed = useGame((state) => state.playerSpeed);
    const movingSpeed = useGame((state) => state.movingSpeed);

    const buttonMode = useGame((state) => state.buttonMode);
    const gltf = useLoader(GLTFLoader, `${import.meta.env.VITE_FILE_URL}/sonic.glb`);

    const charModel = useMemo(() => {
        const { animations } = gltf;

        if (animations && animations.length) {
            animations.forEach((animation, index) => {
                switch (index) {
                    case 8:
                        gltf.animations[index].name = 'Idle';
                        break;
                    case 15:
                        gltf.animations[index].name = 'Walk';
                        break;
                    case 4:
                        gltf.animations[index].name = 'Fail';
                        break;
                    case 5:
                        gltf.animations[index].name = 'Recover';
                        break;
                    case 10:
                        gltf.animations[index].name = 'Run';
                        break;
                }
            });
        }
        return gltf;
    }, [gltf]);

    const { animations, scene } = charModel;

    const animationSet = {
        idle: 'Idle',
        walk: 'Walk',
        jump: 'Jump',
        run: 'Run',
        fail: 'Fail',
        recover: 'Recover',
        climb: 'Climb',
    };

    const { actions } = useAnimations(animations, characterModel);

    useEffect(() => {
        initializeAnimationSet(animationSet);
    }, []);

    useEffect(() => {
            resetAnimation();

    }, []);
    // useEffect(() => {
    //     if(buttonMode ==='play Mode'){
    //         resetAnimation();
    //     }
    //
    // }, [buttonMode]);

    useEffect(() => {
        const speed = 1 + ((40 * movingSpeed*100)/ 100) * 5;
        const action = actions[curAnimation ?? animationSet.idle];
        if (!action) return;

        if (curAnimation === animationSet.jump) {
            action.reset().fadeIn(0.2).setLoop(THREE.LoopRepeat).setDuration(action.getClip().duration / speed).play();
            action.clampWhenFinished = true;
        } else if (curAnimation === animationSet.idle) {
            action.reset().fadeIn(0.2).setDuration(action.getClip().duration).play();
        } else if ([animationSet.fail, animationSet.recover].includes(curAnimation)) {
            action.reset().fadeIn(0.2).setLoop(THREE.LoopOnce).setDuration(action.getClip().duration).play();
            action.clampWhenFinished = true;

        } else {
            action.reset().fadeIn(0.2).setDuration(action.getClip().duration / speed).play();
        }

        const onFinish = () => {
            if ([animationSet.fail, animationSet.recover].includes(curAnimation)){

            }else{
                resetAnimation()
            }



        };
        // action._mixer.addEventListener('finished', onFinish);

        return () => {
            action.fadeOut(0.2);
            // action._mixer.removeEventListener('finished', onFinish);
            action._mixer._listeners = [];
        };
    }, [curAnimation, playerSpeed,buttonMode,movingSpeed]);

    // Load GLB model
    useEffect(() => {
        if (charModel.scene) {
            const model = charModel.scene;
            model.scale.set(0.05, 0.04, 0.05);
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            setCharacterModel(model);
        }
    }, []);

    useEffect(() => {
        if (characterModel) {
            characterModel.traverse((child) => {
                if (child.isMesh) {
                    child.layers.mask = character ? 0 : 1;
                }
            });
        }
    }, [character])

    return (
        <>
        <CharacterController orbitControlsRef={orbitControlsRef} characterModel={characterModel} client={client} />
            {characterModel && <RemotePlayerList playerObject={charModel}/>}
        </>
    )

}