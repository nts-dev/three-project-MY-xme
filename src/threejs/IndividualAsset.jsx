import { RigidBody } from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { animate as motionAnimate } from "motion";

import CreateSyncedVideoMaterial from "../shaders/CreateSyncedVideoMaterial.jsx";
import CreateGraffitiMaterial from "../shaders/CreateGraffitiMaterial.jsx";
import CreateSequenceMaterial from "../shaders/CreateSequenceMaterial.jsx";
import CreateGlowDotMaterial from "../shaders/CreateGlowDotMaterial.jsx";
import DigitalDisplayMesh from "./DigitalDisplayMesh";
import useGame from "../hooks/useGame";
import { DSL_GAME_TRIGGER, requestDslCommand } from "./dslGameTriggers";


export function IndividualAsset({ data }) {
    const obj = useMemo(() => data.object.clone(), [data.object]);
    const meshRef = useRef();
    const rigidRef = useRef();

    const activatedDoor = useGame(s => s.activatedDoor);
    const setActivatedDoor = useGame(s => s.setActivatedDoor);
    const setNotification = useGame(s => s.setNotification);
    const deleteObject = useGame(s => s.deleteObject);
    const setDeleteAssetId = useGame(s => s.setDeleteAssetId);
    const deleteAssetId = useGame(s => s.deleteAssetId);
    const buttonMode = useGame(s => s.buttonMode);
    const setPlayAssetInfoRequest = useGame(s => s.setPlayAssetInfoRequest);

    const [isDeleted, setIsDeleted] = useState(false);
    const isDoor = useMemo(() => data.name?.includes("Wall_Glass_Door"), [data.name]);

    // ----------------------------------------------------------------
    // DELETE HANDLER (super efficient + safe cleanup)
    // ----------------------------------------------------------------
    useEffect(() => {
        if (deleteAssetId !== data.key) return;

        meshRef.current?.traverse(child => {
            child.disposeDisplay?.();
            if (child.isMesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material))
                    child.material.forEach(m => m.dispose?.());
                else child.material?.dispose?.();
            }
        });

        meshRef.current?.removeFromParent();
        setIsDeleted(true);
    }, [deleteAssetId, data.key]);

    // ----------------------------------------------------------------
    // MATERIAL / DISPLAY ASSIGNMENT (runs ONCE)
    // ----------------------------------------------------------------
    useEffect(() => {
        const [child] = obj.children;

        switch (data.key) {
            case 619914:
                child.material = CreateGraffitiMaterial();
                break;

            case 622772:
                child.material = CreateSyncedVideoMaterial({
                    videoUrl: `${import.meta.env.VITE_FILE_URL}/orb.mp4`,
                });
                break;

            // case 620578:
            //      child.material = CreateGlowDotMaterial();

            //     break;

            case 622770:
                child.material = CreateSequenceMaterial([
                    `./icons/crab.png`,
                    `./icons/bird.png`,
                    `./icons/whale.png`,
                    `./icons/lobster.png`,
                ]);
                break;

            // DIGITAL DISPLAYS
            case 622984:
            case 623632: {
                const box = new THREE.Box3().setFromObject(obj);
                const size = new THREE.Vector3();
                box.getSize(size);

                const display1 = DigitalDisplayMesh({
                    text: data.key === 622984
                        ? "hello World ---------!"
                        : "small Display               ",
                    fontSize: data.key === 622984 ? 1 : 20,
                    meshWidth: size.x * 96,
                    meshHeight: size.y * 50,
                    meshDepth: 0.5,
                    scrollSpeed: data.key === 622984 ? 5 : 3,
                    color: data.key === 622984 ? "#fc941d" : "#00ffcc",
                    position: new THREE.Vector3(
                        0.09,
                        data.key === 622984 ? 0.48 : 1.48,
                        0.0
                    ),
                });
                obj.add(display1);

                if (data.key === 623632) {
                    const display2 = DigitalDisplayMesh({
                        text: "Here comes text 2             ",
                        fontSize: 20,
                        meshWidth: size.x * 96,
                        meshHeight: size.y * 50,
                        meshDepth: 0.5,
                        scrollSpeed: 4,
                        color: "#ff2226",
                        position: new THREE.Vector3(0.09, 0.48, 0),
                    });
                    // display2.rotation.y = Math.PI ;
                    obj.add(display2);

                    // // Optional lamp
                    const light = new THREE.PointLight("#00ff00", 0.009, 1.0);
                    const lamp = new THREE.Mesh(
                        new THREE.SphereGeometry(0.1),
                        new THREE.MeshStandardMaterial({
                            color: "#abc",
                            transparent: true,
                            opacity: 0
                        })
                    );
                    lamp.position.copy(display1.position);
                    lamp.add(light);
                    obj.add(lamp);
                }
                break;
            }
        }
    }, [obj, data.key]);

    // ----------------------------------------------------------------
    // 🚪 DOOR ANIMATION (NO GSAP — PURE GAME LOOP)
    // ----------------------------------------------------------------
    const doorAnim = useRef(null);
    const doorHoldTimerRef = useRef(null);

    const startDoorOpen = useCallback((message = "DSL door trigger opened the door for 20 seconds!") => {
        if (!rigidRef.current) return;
        doorAnim.current?.stop?.();
        if (doorHoldTimerRef.current) {
            clearTimeout(doorHoldTimerRef.current);
            doorHoldTimerRef.current = null;
        }

        const rb = rigidRef.current;
        const start = rb.translation();
        const startVec = new THREE.Vector3(start.x, start.y, start.z);
        const forward = new THREE.Vector3(0, 0, 1)
            .applyEuler(new THREE.Euler(...data.rotation))
            .normalize();
        const openTarget = startVec.clone().add(forward.multiplyScalar((data.halfLength * -2) / 100));
        const state = { progress: 0 };

        const setDoorPosition = (from, to, progress) => {
            const next = from.clone().lerp(to, progress);
            rb.setNextKinematicTranslation(next);
        };

        doorAnim.current = motionAnimate(state, { progress: 1 }, {
            duration: 3,
            ease: "easeInOut",
            onUpdate: () => setDoorPosition(startVec, openTarget, state.progress),
            onComplete: () => {
                doorHoldTimerRef.current = window.setTimeout(() => {
                    const closeState = { progress: 0 };
                    doorAnim.current = motionAnimate(closeState, { progress: 1 }, {
                        duration: 1.5,
                        ease: "easeInOut",
                        onUpdate: () => setDoorPosition(openTarget, startVec, closeState.progress),
                        onComplete: () => {
                            doorAnim.current = null;
                            setActivatedDoor(null);
                        },
                    });
                }, 5000);
            },
        });

        setNotification({
            header: "Success!",
            text: message,
            htmlCode: "&#x2705;",
            position: "center",
            timeout: 5000,
        });
    }, [data.rotation, data.halfLength, setActivatedDoor, setNotification]);

    useEffect(() => {
        if (!activatedDoor || data.key !== activatedDoor?.id || !rigidRef.current) return;

        if (!data.name?.toLowerCase().includes(activatedDoor.color)) {
            setNotification({
                header: "Wrong Key!",
                text: "Key dropped does not match this door!",
                htmlCode: "&#9888;",
                position: "center",
                timeout: 3000,
            });
            return;
        }

        startDoorOpen(`${activatedDoor.color} door opened and will remain open for 5 seconds!`);

    }, [activatedDoor, data.key, data.name, setNotification, startDoorOpen]);

    useEffect(() => {
        const handleGameTrigger = (event) => {
            const detail = event.detail || {};
            if (detail.type !== "door.open") return;
            if (String(detail.payload?.instanceId) !== String(data.key)) return;
            startDoorOpen("DSL door trigger opened the door for 5 seconds!");
        };

        window.addEventListener(DSL_GAME_TRIGGER, handleGameTrigger);
        return () => window.removeEventListener(DSL_GAME_TRIGGER, handleGameTrigger);
    }, [data.key, startDoorOpen]);

    useEffect(() => () => {
        doorAnim.current?.stop?.();
        if (doorHoldTimerRef.current) {
            clearTimeout(doorHoldTimerRef.current);
        }
    }, []);

    // ----------------------------------------------------------------
    // HANDLE CLICKS
    // ----------------------------------------------------------------
    const handleClick = useCallback((e, key) => {
        e.stopPropagation();

        if (buttonMode === "Play mode") {
            setPlayAssetInfoRequest({
                instanceId: key,
                name: data.name,
                instanceIndex: key,
            });
        }

        if (deleteObject) {
            setDeleteAssetId(key);
            return;
        }

       
        if (isDoor) {
            requestDslCommand(`#door.open instance(${key})`, {
                trigger: "door.click",
                instanceId: key,
                name: data.name,
            });
        }
    }, [buttonMode, data.name, deleteObject, isDoor, setDeleteAssetId, setPlayAssetInfoRequest]);

    const handlePointerOver = useCallback(() => {
        document.body.style.cursor = "pointer";
    }, []);

    const handlePointerOut = useCallback(() => {
        document.body.style.cursor = "auto";
    }, []);

    if (isDeleted) return null;

    return (
        <RigidBody
            ref={rigidRef}
            key={data.key}
            type="kinematicPosition"
            colliders="trimesh"
            position={data.position}
            rotation={data.rotation}
            scale={[0.01, 0.01, 0.01]}
        >
            <group
                ref={meshRef}
                onPointerDown={(e) => handleClick(e, data.key)}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
            >
                <primitive object={obj} />
            </group>
        </RigidBody>
    );
}
