import React, { useEffect, useState } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import useGame from "../../hooks/useGame.tsx";

const InvisibleMesh = React.memo(function InvisibleMesh({
                                                texture,
                                                position,
                                                rotation,
                                                size,
                                                id,
                                            }) {

    const resetGame = useGame((state) => state.resetGame);
    const [collected, setCollected] = useState(false);
    const [droppedVisible, setDroppedVisible] = useState(false);
    const [dropPosition, setDropPosition] = useState(null);
    const setItemsDictionary = useGame((state) => state.setItemsDictionary);
    const itemsDictionary = useGame((state) => state.itemsDictionary);
    // Reset on game restart
    useEffect(() => {

        setCollected(false);
        setDroppedVisible(false);
        setDropPosition(null);

    }, [resetGame]);



    // Add key to dictionary
    const addKeyToDictionary = (name, image, type) => {

        const existing = itemsDictionary[name];

        if (existing) {
            itemsDictionary[name].count++;

            setItemsDictionary({
                ...itemsDictionary
            });

        }
        else{

            setItemsDictionary({
                ...itemsDictionary,
                [name]: {
                    id,
                    name,
                    color: null,
                    attributes: { attack: 1 },
                    image: `${import.meta.env.VITE_VIDEO_URL}/assets/treasure/${image}`,
                    stackable: true,
                    type,
                    count: 1,
                    active: true,
                },
            });
        };



    };


    const onCollision = () => {
        if (!collected) {
            setCollected(true);

            const image = `invisible.png`;
            const type = `invisible`;
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

            >
                <planeGeometry args={[size.width * 0.01, size.length * 0.01]} />
                <meshBasicMaterial
                    map={texture}
                    transparent
                    opacity={1}
                    depthWrite
                    depthTest
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

export default InvisibleMesh;
