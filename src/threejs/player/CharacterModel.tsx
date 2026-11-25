import {useAnimations} from "@react-three/drei";
import * as React from "react";
import {useEffect, useMemo, useRef, useState} from "react";
import {useFrame} from "@react-three/fiber";
import * as THREE from "three";
import { applyStreetLampLight, updateStreetLampLight } from "../../components/weather/streetLampLight";
import { createAvatarLampShadows, updateAvatarLampShadows } from "../../components/weather/avatarLampShadow";
import {useGame1} from "../../hooks/useGame1";
import useGame from "../../hooks/useGame";
import { sceneHasTerrain } from "../terrain/terrainData";
import { emitFootstep } from "../../components/weather/soundStore";

// Run = the walk cycle played this much faster (the model has no run clip).
// (1/3 of the earlier 2.6: legs at ~1.3x the clip; movement speed is set separately in Ecctrl.)
const RUN_ANIMATION_RATE = 2.6 / 3;

// Walk and run legs follow the avatar's real ground speed, so the feet plant instead of sliding.
// The walk clip at normal speed covers WALK_CLIP_SPEED m/s at full model size (measured: planted
// foot travel x step rate); scaled avatars take proportionally shorter steps. Above MAX_LEG_RATE
// the walk cycle stops looking like walking (there is no run clip), so faster runs glide a little.
const WALK_CLIP_SPEED = 2.5;
const MIN_LEG_RATE = 0.6;
const MAX_LEG_RATE = 3.2;
const LEG_RATE_RESPONSE = 8; // 1/s: how quickly the leg rate follows speed changes

export default function CharacterModel({charModel}: any) {
    const groupRef: any = useRef<THREE.Group>();
    const personColor = useGame((state: any) => state.personColor);
    const projectID = useGame((state: any) => state.projectID);
    const positionY = useRef(0)
    const [charYPosOffset, setcharYPosOffset] = useState(0.35)
    const {animations, scene} = charModel

    // The avatar's material: made once per model / colour (it used to be rebuilt, and the old one
    // leaked, on every re-render, e.g. each idle / walk / run switch), with the street-lamp light
    // added (streetLampLight.js: the lamps light the avatar at night without real lights).
    const person: any = scene.children[0]?.children[0];
    const avatarLook = useMemo(() => {
        if (!person?.material) return null;
        const map = person.material.map;
        if (map) map.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshPhongMaterial({ map, color: personColor });
        return { material, lampUniforms: applyStreetLampLight(material) };
    }, [person, personColor]);
    if (avatarLook && person.material !== avatarLook.material) person.material = avatarLook.material;
    useEffect(() => () => avatarLook?.material.dispose(), [avatarLook]);
    const avatarWorld = useMemo(() => new THREE.Vector3(), []);
    const avatarFeet = useMemo(() => new THREE.Vector3(), []);
    // Street-lamp shadows of the avatar at night (avatarLampShadow.js: projected, no shadow maps).
    const lampShadowsRef = useRef<any>(null);
    useEffect(() => {
        if (!person?.isSkinnedMesh || !person.parent) return undefined;
        const handle = createAvatarLampShadows(person);
        lampShadowsRef.current = handle;
        return () => {
            handle.dispose();
            if (lampShadowsRef.current === handle) lampShadowsRef.current = null;
        };
    }, [person]);

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
    // On the real-world map the avatar is real size, about 1.75 m (unscaled it stood ~3.1 m), to
    // match people and cars in Street View.
    const avatarScale = onTerrain ? 0.57 : 1;

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
    const legActionRef = useRef<any>(null);
    const legRateRef = useRef(1);

    // Footstep sounds in step with the animation: each foot bone's height is tracked, and a step is
    // emitted when a foot stops going down near the lowest point it reached in the last second.
    const feet = useMemo(() => {
        const found: any[] = [];
        scene.traverse((o: any) => {
            if (o.isBone && /foot/i.test(o.name) && !/toe|end|top/i.test(o.name)) found.push(o);
        });
        return found.slice(0, 2).map((bone) => ({ bone, prevY: null as number | null, falling: false, lastStep: 0, lows: [] as { t: number; y: number }[] }));
    }, [scene]);
    const footWorld = useMemo(() => new THREE.Vector3(), []);
    const modelWorld = useMemo(() => new THREE.Vector3(), []);
    const lastStepRef = useRef(0);

    useFrame(({ camera }, delta) => {
        // Street-lamp light on the avatar from the lamps around it (zero when they are off).
        if (avatarLook && groupRef.current) {
            groupRef.current.getWorldPosition(avatarWorld);
            avatarWorld.y += 1; // about chest height
            updateStreetLampLight(avatarLook.lampUniforms, avatarWorld, camera);
        }
        if (lampShadowsRef.current) {
            scene.getWorldPosition(avatarFeet); // the model stands on its origin
            updateAvatarLampShadows(lampShadowsRef.current, avatarFeet);
        }
        const action = legActionRef.current;
        if (!action) return;
        let speed = 0;
        try {
            const velocity = useGame.getState().characterRef?.linvel?.();
            if (velocity) speed = Math.hypot(velocity.x, velocity.z);
        } catch {
            return; // body being replaced
        }
        const target = THREE.MathUtils.clamp(speed / (WALK_CLIP_SPEED * avatarScale), MIN_LEG_RATE, MAX_LEG_RATE);
        legRateRef.current += (target - legRateRef.current) * (1 - Math.exp(-LEG_RATE_RESPONSE * Math.min(delta, 0.1)));
        action.timeScale = legRateRef.current;

        // Foot touch-downs -> footstep sounds (only while actually moving).
        if (speed < 0.3 || !feet.length) return;
        const now = performance.now() / 1000;
        scene.getWorldPosition(modelWorld);
        for (const foot of feet) {
            foot.bone.getWorldPosition(footWorld);
            const y = footWorld.y - modelWorld.y;
            foot.lows = foot.lows.filter((l) => now - l.t < 1.2);
            const low = foot.lows.reduce((m, l) => Math.min(m, l.y), y);
            if (foot.prevY !== null) {
                const falling = y < foot.prevY - 1e-4;
                // One step per touch-down: the foot wobbles at the bottom, so each foot waits 0.25 s
                // and the two feet 0.1 s between steps.
                if (foot.falling && !falling && y - low < 0.04 * avatarScale && now - foot.lastStep > 0.25 && now - lastStepRef.current > 0.1) {
                    foot.lastStep = now;
                    lastStepRef.current = now;
                    emitFootstep({ running: curAnimation === animationSet.run });
                }
                foot.falling = falling;
            }
            foot.lows.push({ t: now, y });
            foot.prevY = y;
        }
    });

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
            legActionRef.current = action;
            legRateRef.current = rate;
        }
        // When any action is clamp and finished reset animation
        action._mixer.addEventListener("finished", () => resetAnimation());

        return () => {
            if (legActionRef.current === action) legActionRef.current = null;
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
        <>
            <group ref={groupRef} key={projectID} >
                <group name="Scene"  position={[0, modelOffsetY, 0]} >
                    <group key={"char"} name="KayKit_Animated_Character">
                        {/* Scaled about the feet (the model origin), so they stay on the ground. */}
                        <group position-y={charYPosOffset} scale={avatarScale}>
                            <primitive object={scene} />
                        </group>
                    </group>
                </group>
            </group>
        </>
    );
}




