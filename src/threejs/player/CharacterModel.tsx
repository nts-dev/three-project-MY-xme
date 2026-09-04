import {useAnimations} from "@react-three/drei";
import * as React from "react";
import {useEffect,  useRef, useState} from "react";
import * as THREE from "three";
import {useGame1} from "../../hooks/useGame1";
import useGame from "../../hooks/useGame";

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

    const animationSet = {
        idle: "Idle",
        walk: "Walk",
        jump: "Jump",
        run: "Walk",
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
       
        const action: any = actions[curAnimation ? curAnimation : animationSet.idle];

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
            action
                .reset()
                .fadeIn(0.2)
                .setDuration(action.getClip().duration/speed )
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
                <group name="Scene"  position={[0, -1.4 , 0]} >
                    <group key={"char"} name="KayKit_Animated_Character">
                        <primitive object={scene} position-y={charYPosOffset}/>
                    </group>
                </group>
            </group>
        </>
    );
}




