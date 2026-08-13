import React, { useEffect, useRef, useState } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import useGame from "../../hooks/useGame.tsx";
 import { realTimeChaPosition } from "../player/puzzle/character/CharacterController.jsx";

const KeyMesh = React.memo(function KeyMesh({
                                                color,
                                                texture,
                                                position,
                                                rotation,
                                                size,
                                                id,
                                            }) {
    const keys = useGame((state) => state.keys);
    const setKeys = useGame((state) => state.setKeys);
    const setItemsDictionary = useGame((state) => state.setItemsDictionary);
    const itemsDictionary = useGame((state) => state.itemsDictionary);
    const resetGame = useGame((state) => state.resetGame);
    const setDroppedToken = useGame((state) => state.setDroppedToken);
    const doorList = useGame((state) => state.doorList);
    const setActivatedDoor = useGame((state) => state.setActivatedDoor);
    const hitPoint = useGame((state) => state.hitPoint);

    const [collected, setCollected] = useState(false);
    const [droppedVisible, setDroppedVisible] = useState(false);
    const [dropPosition, setDropPosition] = useState(null);

    const lastOpenedDoorRef = useRef(null);
    const tempVec = useRef(new THREE.Vector3()); // avoid GC churn

    // Reset on game restart
    useEffect(() => {

        setKeys(0);
        setItemsDictionary({});
        setCollected(false);
        setDroppedVisible(false);
        setDropPosition(null);
        setDroppedToken(null);
    }, [resetGame, setDroppedToken, setItemsDictionary, setKeys]);

    // Door opening check
    useFrame(() => {
        if (!doorList?.length || !hitPoint) return;

        const name = `${color}_key`;
        const charPos = tempVec.current.copy(realTimeChaPosition);

        let nearestDoor = null;
        let minDist = Infinity;

        for (const door of doorList) {
            if (!door.position) continue;
            const doorPos = new THREE.Vector3(...door.position);;
            const dist = charPos.distanceTo(doorPos);

            if (dist < 0.1 && dist < minDist) {
                minDist = dist;
                nearestDoor = door;

            }
        }

        if (nearestDoor && lastOpenedDoorRef.current !== nearestDoor.key) {

            const key = itemsDictionary[name];
            if (!key) return;
            if (!nearestDoor.name.toLowerCase().includes(key.color)) return;

            // open the door
            setActivatedDoor({ id: nearestDoor.key, color });
            lastOpenedDoorRef.current = nearestDoor.key;

            // consume the key
            const updatedDictionary = { ...itemsDictionary };
            if (updatedDictionary[name].count > 1) {
                updatedDictionary[name].count -= 1;
            } else {
                delete updatedDictionary[name];
            }
            setItemsDictionary(updatedDictionary);
        }
    });

    // Add key to dictionary
    const addKeyToDictionary = (name, image, type) => {
        setItemsDictionary({
            ...itemsDictionary,
            [name]: {
                id,
                name,
                color,
                attributes: { attack: 1 },
                image: `${import.meta.env.VITE_VIDEO_URL}/assets/treasure/${image}`,
                stackable: true,
                type,
                count: 1,
                active: true,
            },
        });
    };

    const onCollision = () => {
        if (!collected) {
            setCollected(true);
            setKeys(keys + 1);

            const image = `${color}_key.png`;
            const type = `${color}_key`;
            addKeyToDictionary(type, image, type);
        }
    };

    // If collected and not dropped => hide
    if (collected && !droppedVisible) return null;

    // Position (dropped or original)
    const renderPosition =
        collected && droppedVisible ? dropPosition : position;

    return (
        <RigidBody
            type="fixed"
            colliders={false}
            sensor
            onIntersectionEnter={!collected ? onCollision : undefined}
        >
            <mesh
                position={renderPosition}
                rotation={rotation}
                name={`key_${color}`}
            >
                <planeGeometry args={[size.width * 0.01, size.length * 0.01]} />
                <meshBasicMaterial
                    map={texture}
                    alphaTest={0.5}
                    // transparent
                    // opacity={1}
                    // depthWrite
                    // depthTest
                    side={THREE.DoubleSide}
                />
            </mesh>

            {!collected && (
                <CuboidCollider
                    args={[size.width * 0.0075, size.length * 0.0075, 0.01]}
                    position={position}
                    sensor
                />
            )}
        </RigidBody>
    );
});

export default KeyMesh;
