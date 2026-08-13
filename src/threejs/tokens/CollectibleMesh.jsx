import React, {useCallback, useEffect, useRef, useState} from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import useGame from "../../hooks/useGame.tsx";
import {socket} from "../../socket.js";
import {enPc, realTimeChaPosition} from "../player/puzzle/character/Constants.jsx";

const itemCollectedHandlers = new Map();
let itemCollectedSocketSubscribers = 0;

const handleSocketItemCollected = ({ itemId }) => {
    itemCollectedHandlers.get(String(itemId))?.();
};

const handleSocketError = (error) => console.error('Socket error:', error.message);

const CollectibleMesh = React.memo(function CollectibleMesh({
                                                                type, // 'key' or 'invisible'
                                                                color, // Required for 'key', ignored for 'invisible'
                                                                texture,
                                                                rPosition,
                                                                rotation,
                                                                size,
                                                                id,
                                                                collectable,
                                                                token
                                                            }) {

    const setKeys = useGame((state) => state.setKeys);
    const setItemsDictionary = useGame((state) => state.setItemsDictionary);
    const resetGame = useGame((state) => state.resetGame);
    const setDroppedToken = useGame((state) => state.setDroppedToken);
    const setActivatedTile = useGame((state) => state.setActivatedTile);
    const gameId = useGame((state) => state.projectID);
    const clientId = useGame((state) => state.clientId);
    const droppedTokenData = useGame((state) => state.droppedTokenData);
    const setSpeedFactor = useGame((state) => state.setSpeedFactor);
    const registerCollectibleCollider = useGame((state) => state.registerCollectibleCollider);
    const unregisterCollectibleCollider = useGame((state) => state.unregisterCollectibleCollider);
    const [collected, setCollected] = useState(false);
    const [droppedVisible, setDroppedVisible] = useState(false);
    const [dropPosition, setDropPosition] = useState(null);
    const [collisionEnabled, setCollisionEnabled] = useState(true); // ✅ new state to disable collisions
    const colliderRef = useRef(null);
    const lastProcessedRayHitTickRef = useRef(0);
    const collectedRef = useRef(false);
    const setCollectedState = useCallback((value) => {
        collectedRef.current = value;
        setCollected(value);
    }, []);

    const [position, setPosition] = useState(() => {
        const pos = [...(rPosition || [0, 0, 0])];

        return pos;
    });

   useEffect(() => {


        if(droppedTokenData && droppedTokenData.id === id){

            enPc.current = Math.min(100, enPc.current + 10);
            const speedF = Math.min(1,(useGame.getState().speedFactor + 0.04))
            setSpeedFactor(speedF)
            setCollectedState(false)
            setCollisionEnabled(false); // ✅ disable collisions when dropped
            const position = { ...realTimeChaPosition };
            const pos = [position.x, position.y, position.z];

            // ✅ enable collisions again after 30 seconds
            setTimeout(() => {
                setCollisionEnabled(true);
            }, 30000);
            pos[1]-=0.025
            setPosition(pos)
        }


    }, [droppedTokenData, id, setCollectedState, setSpeedFactor]);
    // Reset on game restart
    useEffect(() => {

        setKeys(0);
        setItemsDictionary({});
        setCollectedState(false);
        setDroppedVisible(false);
        setDropPosition(null);
        setDroppedToken(null);
    }, [resetGame, setCollectedState, setDroppedToken, setItemsDictionary, setKeys]);

    // Listen for itemCollected events
    useEffect(() => {

        itemCollectedHandlers.set(String(id), () => setCollectedState(true));

        if (itemCollectedSocketSubscribers === 0) {
            socket.on('itemCollected', handleSocketItemCollected);
            socket.on('error', handleSocketError);
        }
        itemCollectedSocketSubscribers += 1;

        return () => {
            itemCollectedHandlers.delete(String(id));
            itemCollectedSocketSubscribers = Math.max(0, itemCollectedSocketSubscribers - 1);
            if (itemCollectedSocketSubscribers === 0) {
                socket.off('itemCollected', handleSocketItemCollected);
                socket.off('error', handleSocketError);
            }
        };
    }, [id, setCollectedState]);

    // Door opening check (only for keys)
    // useFrame(() => {
    //     if (type !== 'key' || !doorList?.length || !hitPoint) return;
    //
    //     // const name = `${color}_key`;
    //     const charPos = tempVec.current.copy(realTimeChaPosition);
    //
    //     let nearestDoor = null;
    //     let minDist = Infinity;
    //
    //     for (const door of doorList) {
    //         if (!door.position) continue;
    //         const doorPos = new THREE.Vector3(...door.position);
    //         const dist = charPos.distanceTo(doorPos);
    //
    //         if (dist < 0.1 && dist < minDist) {
    //             minDist = dist;
    //             nearestDoor = door;
    //         }
    //     }
    //
    //     if (nearestDoor && lastOpenedDoorRef.current !== nearestDoor.key) {
    //         const key = itemsDictionary[id];
    //         if (!key) return;
    //         if (!nearestDoor.name.toLowerCase().includes(key.color)) return;
    //
    //         setActivatedDoor({ id: nearestDoor.key, color });
    //         lastOpenedDoorRef.current = nearestDoor.key;
    //
    //         const updatedDictionary = { ...itemsDictionary };
    //         if (updatedDictionary[id].count > 1) {
    //             updatedDictionary[id].count -= 1;
    //         } else {
    //             delete updatedDictionary[id];
    //         }
    //         setItemsDictionary(updatedDictionary);
    //     }
    // });

    const addItemToDictionary = useCallback(() => {
        const name = type === 'key' ? `${color}_key` : type;
        const image = type === 'key' ? `${color}_key.png` : `${type}.png`;
        const itemColor = type === 'key' ? color : null;
        const { itemsDictionary } = useGame.getState();

        // const existing = itemsDictionary[name];
        // if(existing) return
        // if (existing) {
        //     setItemsDictionary({
        //         ...itemsDictionary,
        //         [name]: { ...existing, count: existing.count + 1 },
        //     });
        // } else {
            setItemsDictionary({
                ...itemsDictionary,
                [id]: {
                    id,
                    name,
                    color: itemColor,
                    attributes: { attack: 1 },
                    image: `${import.meta.env.VITE_VIDEO_URL}/assets/treasure/${image}`,
                    stackable: true,
                    type: name,
                    count: 1,
                    active: true,
                },
            });
        // }
    }, [color, id, setItemsDictionary, type]);

    const onCollision = useCallback(() => {


        if (!collectedRef.current && collectable && collisionEnabled ) {
            const { itemsDictionary, speedFactor } = useGame.getState();
            const isFull = Object.values(itemsDictionary).length === 5;
            if(isFull) return;
            setCollectedState(true);
            // Broadcast item collection to server
            socket.emit('collectItem', { gameId, itemId: id, clientId, subtype: token.subtype, category: token.category });
            enPc.current = Math.max(0, (enPc.current - 10));
            const speedF = Math.max(0.8,(speedFactor - 0.04))
            setSpeedFactor(speedF)
            addItemToDictionary();
            return
        }
        if (token.category === 'movement') {
            setActivatedTile({ id, direction: token.direction, distance: token.distance });
            return;
        }
        setDroppedToken({
            type:token.subtype,
            category:token.category
        })

    }, [
        collectable,
        collisionEnabled,
        gameId,
        id,
        clientId,
        token,
        addItemToDictionary,
        setCollectedState,
        setSpeedFactor,
        setActivatedTile,
        setDroppedToken,
    ]);

    // Ray-based pickup bridge: KinematicPlayer emits id from feet-ray hit.
    useEffect(() => {
        const unsubscribe = useGame.subscribe((state, previousState) => {
            const collectibleRayHit = state.collectibleRayHit;
            if (collectibleRayHit === previousState?.collectibleRayHit) return;
            if (!collectibleRayHit) return;
            if (collectibleRayHit.id !== id) return;
            const tick = Number(collectibleRayHit.tick || 0);
            if (tick <= 0) return;
            if (lastProcessedRayHitTickRef.current === tick) return;
            lastProcessedRayHitTickRef.current = tick;
            onCollision();
        });

        return unsubscribe;
    }, [id, onCollision]);

    useEffect(() => {
        if (collected) return;
        const getHandle = () => {
            const c = colliderRef.current;
            if (!c) return null;
            if (typeof c.handle === "function") {
                const v = c.handle();
                return v === undefined || v === null ? null : String(v);
            }
            const v = c.handle;
            return v === undefined || v === null ? null : String(v);
        };
        let raf = requestAnimationFrame(() => {
            const handle = getHandle();
            if (!handle) return;
            registerCollectibleCollider(handle, id);
        });

        return () => {
            cancelAnimationFrame(raf);
            const handle = getHandle();
            if (!handle) return;
            unregisterCollectibleCollider(handle);
        };
    }, [collected, id, registerCollectibleCollider, unregisterCollectibleCollider]);

    if (collected && !droppedVisible) return null;

    const renderPosition = collected && droppedVisible ? dropPosition : position;

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
                name={type === 'key' ? `key_${color}` : type}
            >
                <planeGeometry args={[size.width * 0.01, size.length * 0.01]} />
                <meshBasicMaterial
                    map={texture}
                    // transparent={false}
                    alphaTest={0.5}
                    // side={THREE.DoubleSide}
                />
            </mesh>

            {!collected && (
                <CuboidCollider
                    ref={colliderRef}
                    args={[size.length * 0.0075, size.width * 0.0075, 0.001]}
                    position={position}
                    rotation={rotation}
                    sensor
                    userData={{ collectibleId: id, category: token?.category, subtype: token?.subtype }}
                />
            )}
        </RigidBody>
    );
});

export default CollectibleMesh;
