import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import useGame from '../../hooks/useGame.tsx';

import { socket } from '../../socket.js';
import {realTimeChaPosition} from "../player/puzzle/character/Constants.jsx";

export default function InstancedCoins({ instanceData, size, coinTexture, onCollision, gameId, alternateWorld }) {
    const meshRef = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const coinPositions = useMemo(
        () => instanceData.map(d => new THREE.Vector3(...d.position)),
        [instanceData]
    );

    const activeCoins = useRef(new Set());
    const lastPickupTime = useRef(0);
    const matrixNeedsUpdate = useRef(false);
    const spawnRequestSignature = useRef('');

    const setNoOfCoins = useGame(state => state.setNoOfCoins);
    const noOfCoins = useGame(state => state.noOfCoins);
    const setTotalCoins = useGame(state => state.setTotalCoins);
    const clientId = useGame((state) => state.clientId);
    const gameStartTick = useGame((state) => state.gameStartTick);

    const coinKeys = useMemo(
        () => instanceData.map(({ key }) => key).filter(Boolean),
        [instanceData]
    );
    const alternateWorldIndex = alternateWorld ? Number(alternateWorld.worldIndex) || 0 : null;

    // Initialize matrices and key maps
    useEffect(() => {
        if (!meshRef.current || !instanceData?.length) return;

        meshRef.current.userData.keyToIndex = {};
        meshRef.current.userData.indexToKey = {};

        for (let i = 0; i < instanceData.length; i++) {
            const data = instanceData[i];
            dummy.position.set(0, 0, 0);
            dummy.scale.set(0, 0, 0);
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            dummy.updateMatrix();

            meshRef.current.setMatrixAt(i, dummy.matrix);
            meshRef.current.userData.keyToIndex[data.key] = i;
            meshRef.current.userData.indexToKey[i] = data.key;
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        setTotalCoins(instanceData.length);
    }, [dummy, instanceData, setTotalCoins]);

    // Listen for server command to clear all coins
    useEffect(() => {
        const handleClear = ({ keys }) => {
            keys.forEach(key => {
                const index = meshRef.current?.userData?.keyToIndex?.[key];
                if (typeof index !== 'number') return;

                dummy.scale.set(0, 0, 0);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(index, dummy.matrix);

                activeCoins.current.delete(index);
            });
            if (meshRef.current?.instanceMatrix) {
                meshRef.current.instanceMatrix.needsUpdate = true;
            }
            matrixNeedsUpdate.current = false;
        };

        socket.on('clearAllCoins', handleClear);
        return () => socket.off('clearAllCoins', handleClear);
    }, [dummy]);


    // Request all coins after the player clicks Start in the setup popup.
    useEffect(() => {
        if (!gameStartTick || !coinKeys.length) return;

        const signature = `${gameStartTick}:${alternateWorldIndex ?? 'default'}:${coinKeys.join('|')}`;
        if (spawnRequestSignature.current === signature) return;

        spawnRequestSignature.current = signature;
        socket.emit('requestSpawnCoin', {
            key: coinKeys[0],
            keys: coinKeys,
            gameId,
            alternateWorld
        });
    }, [alternateWorld, alternateWorldIndex, coinKeys, gameId, gameStartTick]);

    // Listen for server coin spawns
    useEffect(() => {
      
        const handleSpawn = ({ key, keys }) => {
            const spawnKeys = (Array.isArray(keys) ? keys : [key]).filter(Boolean);
            if (!spawnKeys.length) return;

            spawnKeys.forEach(spawnKey => {
                const index = meshRef.current?.userData?.keyToIndex?.[spawnKey];
                if (typeof index !== 'number') return;

                const pos = coinPositions[index];
                dummy.position.set(pos.x, pos.y + 0.011, pos.z);
                dummy.scale.set(1, 1, 1);
                dummy.rotation.set(-Math.PI / 2, 0, 0);
                dummy.updateMatrix();

                meshRef.current.setMatrixAt(index, dummy.matrix);
                activeCoins.current.add(index);
            });
            if (meshRef.current?.instanceMatrix) {
                meshRef.current.instanceMatrix.needsUpdate = true;
            }
            matrixNeedsUpdate.current = false;
        };

        socket.on('coinSpawned', handleSpawn);
        return () => socket.off('coinSpawned', handleSpawn);
    }, [coinPositions, dummy]);

    // Listen for server coin collections
    useEffect(() => {
        const handleCollected = ({ key }) => {
            const index = meshRef.current?.userData?.keyToIndex?.[key];
            if (typeof index !== 'number') return;

            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(index, dummy.matrix);

            activeCoins.current.delete(index);
            matrixNeedsUpdate.current = true;

            if (onCollision) onCollision(index);
            setNoOfCoins(parseInt(noOfCoins) + 1);
            if (meshRef.current?.instanceMatrix) {
                meshRef.current.instanceMatrix.needsUpdate = true;
            }
            matrixNeedsUpdate.current = false;
        };

        socket.on('coinCollected', handleCollected);
        return () => socket.off('coinCollected', handleCollected);
    }, [dummy, noOfCoins, onCollision, setNoOfCoins]);

    // Proximity check for collection
    useFrame(() => {
        const now = performance.now();
        if (!realTimeChaPosition || activeCoins.current.size === 0 || now - lastPickupTime.current < 200) return;

        let closestIndex = -1;
        let minDistance = Infinity;

        activeCoins.current.forEach(index => {
            const pos = coinPositions[index];
            if (!pos) return;
            const dx = pos.x - realTimeChaPosition.x;
            const dy = pos.y - realTimeChaPosition.y;
            const dz = pos.z - realTimeChaPosition.z;
            const distance = Math.hypot(dx, dy, dz);

            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = index;
            }
        });

        const threshold = 0.07;
        if (minDistance < threshold && closestIndex !== -1) {
            const key = meshRef.current.userData.indexToKey[closestIndex];
            socket.emit('requestCollectCoin', { key, clientId });
            lastPickupTime.current = now;
        }

        if (matrixNeedsUpdate.current) {
            meshRef.current.instanceMatrix.needsUpdate = true;
            matrixNeedsUpdate.current = false;
        }
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[null, null, instanceData.length]}
            frustumCulled={false}
            name="coin"
        >
            <planeGeometry args={[size.width * 0.01, size.length * 0.01]} />
            <meshBasicMaterial
                map={coinTexture || null}
                // alphaMap={memoAlphaTexture}
                alphaTest={0.5}
                transparent={false}
                // depthWrite={true}
                // depthTest={true}
                // side={THREE.DoubleSide}
            />
        </instancedMesh>
    );
}
