import * as THREE from 'three';
import {RigidBody} from '@react-three/rapier';
import React, {useRef, useEffect, useState, useMemo} from 'react';
import { useAnimations } from '@react-three/drei';
import {useFrame, useThree} from '@react-three/fiber';
import useGame from '../../hooks/useGame';

export default function InstanceAnimation({ data, name, object, animations }) {

    const mesh = useMemo(() => object.clone(), [object]);
    const [animateId, setAnimateId] = useState(null);
    const meshRef = useRef();
    const trackedActionsRef = useRef([]);
    const [isNearCharacter, setIsNearCharacter] = React.useState(false);
    const [isDoorOpen, setIsDoorOpen] = useState(false); // New state to track door collision state
    const [isSensor, setIsSensor] = useState(false);

    const {
        setScan,
        scan,
        setSearchItem,
        setScannedId,
        setAnimationRef,
        setMovingSpeed,
        blackListedCoins,
        setBlackListedCoins,
        setNoOfCoins,
        noOfCoins,
        setSoundParams,
        assetSettings,
        keys,
        setKeys,
        setItemsDictionary,
        itemsDictionary,
        curAnimation,
        inventoryDragObject,
        setIsDraggingInventory,
        setHasDied,
        setDeleteAssetId,
        deleteObject
    } = useGame();

    const key = data.key;
    const colliderRef = useRef();
    const {   gl,pointer, camera} = useThree();
    const { actions, names } = useAnimations(animations,meshRef);
     const [activateAnimation, setActivateAnimation] = useState(false);




    useEffect(() => {
        
        if (!animations || animations.length === 0) return;

        let variablesMap = null;
        if (assetSettings?.id === key && assetSettings.settingObj?.variables) {
            variablesMap = Object.fromEntries(
                assetSettings.settingObj.variables.map(v => [v.name, v.default])
            );
        } else if (data?.settings) {
            const parsed = parseConfig(data.settings)[0];
            if (parsed?.variables) {
                variablesMap = Object.fromEntries(
                    parsed.variables.map(v => [v.name, v.default])
                );
            }
        }

        const shootDistance = variablesMap?.Shoot_distance ?? 50;
        const shootTime = variablesMap?.Shoot_time ?? 1;

        trackedActionsRef.current = [];

        if (actions && names.length > 0) {
            names.forEach((aName) => {
                const action = actions[aName];
                const clip = action?.getClip?.();
                if (!action || !clip) return;
                const fullDuration = clip.duration;
                const fraction = Math.min(shootDistance / 50, 1);
                const playbackDuration = fullDuration * fraction;

                if (aName.includes('Frog')) {
                    if (isNearCharacter && aName === names[0]) {
                        const timeScale = playbackDuration / shootTime;
                        action.setLoop(THREE.LoopOnce); // Use LoopOnce to detect end
                        action.clampWhenFinished = true;
                        action.timeScale = timeScale > 0 ? timeScale : 1;
                        action.reset().play();
                        // Calculate real animation duration in seconds after timescaling
                        const actionDuration = action.getClip().duration / timeScale;
                        const dieAfter = actionDuration / 3;

                        const dieTimeout = setTimeout(() => {
                            setHasDied(true);
                        }, dieAfter * 1000);
                        // Convert to milliseconds
                        // Add listener for animation completion
                        const onFinished = () => {
                            // setHasDied(true);
                        };
                        action.getMixer().addEventListener('finished', onFinished);
                        // Cleanup listener on unmount or reset
                        return () => {
                            action.getMixer().removeEventListener('finished', onFinished);
                            clearTimeout(dieTimeout);
                        };
                    }
                    else {
                        action.stop();
                    }
                } else {
                    const Loop_once = parseSettings(data.settings)?.loop_once;

                    action.setLoop(Loop_once === 'FALSE' ? THREE.LoopRepeat : THREE.LoopOnce);
                    if (Loop_once === 'TRUE' && activateAnimation && animateId === key) {
                        action.reset().play();
                        action.clampWhenFinished = true;

                        // Add listener for non-Frog animation completion
                        const onFinished = () => {

                        };
                        action.getMixer().addEventListener('finished', onFinished);

                        // Cleanup listener
                        return () => {
                            action.getMixer().removeEventListener('finished', onFinished);
                        };
                    } else {
                        if (!action?.isRunning()) {
                            action.play();
                        }
                    }
                }

                trackedActionsRef.current.push({
                    action,
                    limitTime: playbackDuration,
                });
            });
        }

        // Cleanup function
        return () => {
            trackedActionsRef.current.forEach(({ action }) => {
                action.stop();
            });
            trackedActionsRef.current = [];
        };
    }, [names, actions, isNearCharacter, assetSettings, key, activateAnimation, animateId]);

    function parseConfig(input) {
        const lines = input.split('\n');
        const result = {};
        for (const line of lines) {
            const [categoryCode, rest] = line.split('|');
            const [name, meta] = rest.split('=');
            const [defaultValueStr, rangeStr, stepStr] = meta.split(';');
            const [startStr, endStr] = rangeStr.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            const step = parseInt(stepStr, 10);
            const defaultValue = parseFloat(defaultValueStr);
            const values = [];
            for (let i = start; i <= end; i += step) {
                values.push(i);
            }
            if (!result[categoryCode]) {
                result[categoryCode] = { category: categoryCode, variables: [] };
            }
            result[categoryCode].variables.push({
                name: name.trim(),
                default: defaultValue,
                range: { start, end, step, values }
            });
        }
        return Object.values(result);
    }
    const parseSettings = useMemo(() => {
        return (settings) => {
            if (!settings) return;
            const lines = settings.split('\n');
            const parsed = {};
            lines.forEach(line => {
                const [, keyValue] = line.split('|');
                const [key, value] = keyValue.split('=');
                parsed[key.trim().toLowerCase()] = value.replace(';;', '').trim();
            });
            return parsed;
        };
    }, []);


    const handleClick = (e, key) => {
        e.stopPropagation();
        setAnimationRef(meshRef.current);
        setScannedId(`${key}t_click`);
        setSearchItem({ noZoom: true });
        setScan(!scan);
    };

    const handlePointerOut = (e) => {
        e.stopPropagation();
    };

    const handlePointerOver = (e) => {
        gl.domElement.style.cursor = 'pointer';

        e.stopPropagation();
    };

    const addItemFromSettings = (settings) => {
        const parsed = parseSettings(settings);

        if(!parsed) return;

        const name = parsed["name"];
        const type = parsed["type"];
        const image = parsed["image"];
        let found = false;
        const updatedDictionary = { ...itemsDictionary };

        for (const key in updatedDictionary) {
            if (updatedDictionary[key].type === type) {
                updatedDictionary[key] = {
                    ...updatedDictionary[key],
                    count: updatedDictionary[key].count + 1
                };
                found = true;
                break;
            }
        }

        if (!found) {
            const newId = Object.keys(updatedDictionary).length;

            updatedDictionary[newId] = {
                id: newId,
                name,
                attributes: { attack: 1 },
                image: `${import.meta.env.VITE_ASSET_URL}/assets/treasure/${image}`,
                stackable: true,
                type,
                count: 1,
                active: true,
            };
        }

        if (name.toLowerCase().includes('booster')) {
            setMovingSpeed(0.02);
        }
        if (name.toLowerCase().includes('coin')) {
            setNoOfCoins(noOfCoins + 1);
            setSoundParams({
                url: `${import.meta.env.VITE_VIDEO_URL}/audio/coin.mp3`,
                volume: 1,
                position: null,
                distance: 0,
                speed: 0.02,
                pitch: 1,
                loop: false,
                isPlaying: true,
                isLooping: false,
                curAnimation
            });


        }
        if(name.toLowerCase().includes('key')) {
            setKeys(keys + 1);
        }
        setItemsDictionary(updatedDictionary);
        if (meshRef.current) {
            meshRef.current.parent.removeFromParent();
            setBlackListedCoins(new Set(blackListedCoins).add(key));
        }
    }

    const handleIntersectionEnter = (e) => {

        if (blackListedCoins.has(key)) return;
        if(data.settings ) {
            addItemFromSettings(data.settings)
        }

    };

    useFrame((_, delta) => {
        if (!name.toLowerCase().includes('frog')) {
            trackedActionsRef.current.forEach(({ action, limitTime }) => {
                if (action.time > limitTime) {
                    action.reset().play();
                }
            });
        }

        // if (realTimeChaPosition && meshRef.current && name.toLowerCase().includes('frog')) {
        //     const frogPosition = new THREE.Vector3().setFromMatrixPosition(meshRef.current.matrixWorld);
        //     const characterPosition = new THREE.Vector3(realTimeChaPosition.x, realTimeChaPosition.y, realTimeChaPosition.z);
        //     const distance = frogPosition.distanceTo(characterPosition);
        //     const isWithinRadius = distance <= 0.3;
        //     setIsNearCharacter(isWithinRadius);
        //
        //     if (isNearCharacter) {
        //         trackedActionsRef.current.forEach(({ action, limitTime }) => {
        //             if (action.time > limitTime) {
        //                 action.reset().play();
        //             }
        //         });
        //         const targetPosition = characterPosition.clone();
        //         meshRef.current.lookAt(targetPosition);
        //         const correctionQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        //         meshRef.current.quaternion.multiply(correctionQuaternion);
        //         const targetQuaternion = meshRef.current.quaternion.clone();
        //         meshRef.current.quaternion.slerp(targetQuaternion, 0.1);
        //     }
        // }
    });
    const handleDrop = (event) => {
        if(animateId === key) return;
        event.stopPropagation();
        event.preventDefault();
        const rect = event.currentTarget?.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(meshRef.current);

        if (intersects.length > 0 ) {
            const settings = parseSettings(data.settings)
            const affected_by = settings?.affected_by;
            const dragType = inventoryDragObject?.type
            if(affected_by === dragType) {
                setActivateAnimation(true)
            }
            setAnimateId(key)
            setIsDoorOpen(true);
            setIsSensor(true);
            // Get the handle of the first collider
            setIsDraggingInventory(false)

        }
    };

    useEffect(() => {
        const overlay = document.getElementById("root");
        overlay?.addEventListener("drop", handleDrop);

        return () => {
            overlay?.removeEventListener("drop", handleDrop);
        };

    }, [inventoryDragObject, animateId]);

    const handleOnpointerDown = (e, id) => {
        e.stopPropagation();
        // e.preventDefault();
        if (deleteObject && id>0) {
            setDeleteAssetId(id);
            if (meshRef.current) {
                meshRef.current.parent.remove(meshRef.current);
            }
        }
    }

    return (
        <>

      <RigidBody
            key={key}
            type={'fixed'}
            position={data.position || [0, 0, 0]}
            rotation-y={isSensor ? (data.rotation[2] + Math.PI/2): (data.rotation[2] || 0)}
            scale={data.scale}
            sensor={parseSettings(data.settings)?.pass_through === 'TRUE' || isSensor}
            name={key}
            colliders="trimesh"
            onIntersectionEnter={handleIntersectionEnter}
            ref={colliderRef}
        >
            <group
                ref={meshRef}
                key={key}
                onPointerOver={(e) => handlePointerOver(e, key)}
                onPointerOut={(e)  => handlePointerOut(e)}
                onDoubleClick={(e) => handleClick(e, key)}
                onPointerDown={(e) => handleOnpointerDown(e, key)}
                userData={{id: key}}
            >
                <primitive object={mesh} />
            </group>
        </RigidBody>

        </>
    );
}