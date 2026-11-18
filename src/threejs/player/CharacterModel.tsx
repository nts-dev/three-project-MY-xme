import {useAnimations} from "@react-three/drei";
import * as React from "react";
import {useEffect,  useRef, useState} from "react";
import * as THREE from "three";
import {useGame1} from "../../hooks/useGame1";
import useGame from "../../hooks/useGame";
import { sceneHasTerrain } from "../terrain/terrainData";

// Run = the walk cycle played this much faster (the model has no run clip).
// (1/3 of the earlier 2.6: legs at ~1.3x the clip; movement speed is set separately in Ecctrl.)
const RUN_ANIMATION_RATE = 2.6 / 3;

export default function CharacterModel({charModel}: any) {
    const groupRef: any = useRef<THREE.Group>();
    const personColor = useGame((state: any) => state.personColor);
    const projectID = useGame((state: any) => state.projectID);
    const positionY = useRef(0)
    const [charYPosOffset, setcharYPosOffset] = useState(0.35)
    const {animations, scene} = charModel

    if (scene.children[0].children[0]) {
        const person: any = scene.children[0].children[0]
        if(person.material){
            person.material.map.colorSpace = THREE.SRGBColorSpace;
            person.material = new THREE.MeshPhongMaterial({
                map: person.material.map,
                color: personColor
            })
        }
    }

    /**
     * Character animations setup
     */

    const resetAnimation = useGame1((state) => state.reset);
    const initializeAnimationSet = useGame1((state) => state.initializeAnimationSet);
    const curAnimation = useGame1((state) => state.curAnimation);
    const playerSpeed = useGame((state: any) => state.playerSpeed)
    const setPlayerSpeed = useGame((state: any) => state.setPlayerSpeed)
    const floorValue = useGame((state: any) => state.floorValue) ;
    // The -1.4 model offset assumes the capsule floats 0.3 m above the ground, but the controller
    // runs without the float spring, so the feet end up 0.3 m below the ground. Older levels make
    // up for that in their floors (153_L1: +0.4); terrain scenes stand on the real ground, so
    // there the model is lifted to put the feet on the capsule bottom.
    const onTerrain = useGame((state: any) => sceneHasTerrain(state, state.projectID));
    const modelOffsetY = onTerrain ? -1.1 : -1.4;

    const animationSet = {
        idle: "Idle",
        walk: "Walk",
        jump: "Jump",
        // Nathan_man.glb has no run clip (Idle, Jump, Walking): "Run" plays the walk clip faster.
        run: "Run",
        fail: "Fail",
        recover: "Recover",
        climb: "Climb"
    };

    useEffect(() => {

        initializeAnimationSet(animationSet);
    }, [scene,projectID]);

    useEffect(() => {
  
        resetAnimation()

    }, [projectID]);

    const {actions} = useAnimations(animations, groupRef);

    useEffect(() => {
        const speed = 1 + (playerSpeed / 100) *5
       
        const isRun = curAnimation === animationSet.run;
        const clipName = isRun && !actions[animationSet.run] ? animationSet.walk : (curAnimation || animationSet.idle);
        const action: any = actions[clipName];

       if(action==undefined)
           return
        // For jump and jump land animation, only play once and clamp when finish
        if (curAnimation === animationSet.jump) {
            action
                .reset()
                .fadeIn(0.05)
                 .setLoop(projectID==144 ? THREE.LoopRepeat : THREE.LoopOnce, undefined as unknown as number)
                .setDuration(action.getClip().duration / speed)
                .play();
            action.clampWhenFinished = true;
        } else if(curAnimation === animationSet.idle) {
            action
                .reset()
                .fadeIn(0.2)
                .setDuration(action.getClip().duration)
                .play();
        }
        else if(curAnimation === animationSet.fail || curAnimation === animationSet.recover){
            action
                .reset()
                .fadeIn(0.2)
                .setLoop( THREE.LoopOnce, undefined as unknown as number)
                .setDuration(action.getClip().duration )
                .play();
            action.clampWhenFinished = true;
        }
        else {
            //   console.log(speed)
            const rate = isRun ? speed * RUN_ANIMATION_RATE : speed;
            action
                .reset()
                .fadeIn(0.2)
                .setDuration(action.getClip().duration / rate)
                .play();
        }
        // When any action is clamp and finished reset animation
        action._mixer.addEventListener("finished", () => resetAnimation());

        return () => {
            action.fadeOut(0.2);
            action._mixer.removeEventListener("finished", () =>
                resetAnimation()
            );
            action._mixer._listeners = [];
            scene.remove()
        };

    }, [curAnimation, scene, projectID,playerSpeed]);
    useEffect(() => {
     //scene.scale.set(0.6,0.6,0.6)
    }, [projectID]);

    return (
        <>d
            <group ref={groupRef} key={projectID} >
                <group name="Scene"  position={[0, modelOffsetY, 0]} >
                    <group key={"char"} name="KayKit_Animated_Character">
                        <primitive object={scene} position-y={charYPosOffset}/>
                    </group>
                </group>
            </group>
        </>
    );
}




