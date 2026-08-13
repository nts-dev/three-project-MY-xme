import React, { useMemo, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import useGame from "../../hooks/useGame";


export default function TreasureInstance({ inst, index, object }) {
    const rbRef = useRef(null);
    const meshRef = useRef(null);
    const setSoundName = useGame((state) => state.setSoundName);
    const soundName = useGame((state) => state.soundName);
    const setNotification = useGame((state) => state.setNotification);
    const setItemsDictionary = useGame((state) => state.setItemsDictionary);
    const itemsDictionary = useGame((state) => state.itemsDictionary);
    const buttonMode = useGame((state) => state.buttonMode);
    const setPlayAssetInfoRequest = useGame((state) => state.setPlayAssetInfoRequest);
    const hasCollided = useRef(false)
    const [hasPicked, setHasPicked] = useState(false)
    // Animation state
    const animRef = useRef(null);

    // Material clone
    const material = useMemo(() => {
        if (!object?.material) return null;
        const mat = object.material.clone();
        mat.transparent = true;
        mat.opacity = 0.7; // start semi-transparent
        return mat;
    }, [object]);

    // Add to inventory dictionary
    const addItemToDictionary = (id) => {

        if (!id) return; // safety



        const name = "yellow_key";
        const image = `${name}.png`;

        setItemsDictionary({
            ...itemsDictionary,
            [id]: {
                id,
                name,
                color: null,
                attributes: { attack: 1 },
                image: `${import.meta.env.VITE_VIDEO_URL}/assets/treasure/${image}`,
                stackable: true,
                type: name,
                count: 1,
                active: true,
                alphabet: true,
            },
        });

        setHasPicked(true)
        //setRemovedObject({ name: meshName, id });
    };

    const onCollisionEnter = useCallback((e) => {
        const otherRb = e.other?.rigidBody;
        const otherName = e.other?.rigidBodyObject?.name || "";

        if (otherName === "character") {
            addItemToDictionary(inst.key);
            setSoundName("t_pickup.wav");
        }

        // 🔥 only block the unlock animation part
        if (!otherRb || hasCollided.current) return;

       


       setSoundName("unlock.wav");
        setNotification({
            header: 'Key Unlocked!',
            text: `New key Unlocked you can pick it!`,
            htmlCode: '&#9432;',
            position: 'center',
            id: inst.key,
            timeout: 3000
        });

        if (material) {
            material.opacity = 1.0;
            material.needsUpdate = true;
        }

        if (!animRef.current) {
            startLiftAndSideAnim();
        }
    }, [material, soundName]);


    const startLiftAndSideAnim = () => {
        const lift = 0.1;
        const sideMove = Math.random() < 0.5 ? -0.1 : 0.1;
        const duration = 1.8;

        animRef.current = {
            t: 0,
            dur: duration,
            phase: "lift",
            x0: inst.position[0],
            y0: inst.position[1],
            z0: inst.position[2],
            y1: inst.position[1] + lift,
            sideMove,
            scale: new THREE.Vector3(...inst.scale),
        };
    };

    const handlePlayInfoClick = useCallback((e) => {
        e.stopPropagation();
        const instanceId =
            inst?.key || inst?.assetId || inst?.assetID || inst?.instanceId || inst?.instance_id || inst?.userData?.instance_id;

        if (!instanceId) return;

        setPlayAssetInfoRequest({
            instanceId,
            name: inst?.name || object?.name || `treasure_${index}`,
            instanceIndex: index,
        });
    }, [index, inst, object?.name, setPlayAssetInfoRequest]);

    useFrame((_, delta) => {
        const a = animRef.current;
        const rb = rbRef.current;
        const mesh = meshRef.current;

        if (!a || !mesh || !rb || hasCollided.current) return

        let x = a.x0;
        let y = a.y0;
        let z = a.z0;


        a.t = Math.min(a.t + delta / a.dur, 1);
        const s = THREE.MathUtils.smoothstep(a.t, 0, 1);



        if (a.phase === "lift") {
            y = THREE.MathUtils.lerp(a.y0, a.y1, s);

            if (a.t >= 1) {
                a.phase = "side";
                a.t = 0;
            }
        } else if (a.phase === "side") {
            y = a.y1;
            x = THREE.MathUtils.lerp(a.x0, a.x0 + a.sideMove, s);
        }

        // also clamp the kinematic target y so your animation can’t drive it below


        if (a.t >= 1) {
            rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
            rb.setBodyType(0); // fixed
            rb.setGravityScale(0.5);
     
             hasCollided.current = true;
            animRef.current = null;
        } else {
            rb.setNextKinematicTranslation({ x, y, z }, true);
        }
    });


    if (!object?.geometry || !material || hasPicked) return null;

    return (
        <RigidBody
            ref={rbRef}
            name={`treasure_${index}`}
            type="kinematicPosition"
            colliders="hull"
            position={inst.position}
            rotation={inst.rotation}
            onCollisionEnter={onCollisionEnter}
            scale={[0.05,0.05,0.05]}
            gravityScale={0.5} // no gravity during scripted motion
            friction={1}
            restitution={0}
        >
            <mesh
                ref={meshRef}
                geometry={object.geometry}
                material={material}
                onPointerDown={buttonMode === "Play mode" ? handlePlayInfoClick : undefined}
            />
        </RigidBody>
    );
}
