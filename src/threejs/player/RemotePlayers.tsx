import {useEffect, useState, useRef} from "react";
import {useFrame, useThree} from "@react-three/fiber";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import {Object3D} from "three";
import useGame from "../../hooks/useGame";
import {socket} from "../../socket";

interface PlayerActions {
    [key: string]: {
        actions: any;
        mixer: THREE.AnimationMixer;
        player: Object3D;
        clientId: string;
    };
}

export default function RemotePlayers(props: any) {
    const {scene, camera} = useThree();
    const {fbx, animations} = props;
    const [playerActions, setPlayerActions] = useState<PlayerActions>({});
    const nonRealtime: Set<string> = useGame((state: any) => state.nonRealtime);
    const setPlayerActionList = useGame((state: any) => state.setPlayerActions);
    const pLabel = useGame((state: any) => state.pLabel);
    const [remoteDetails, setRemoteDetails] = useState<any>({});
    const playerActionsRef = useRef<PlayerActions>({});
    const iPlayer = useRef<any>()
    const iPlayerList = useRef<any>({})
    const localPersonColor = useGame((state: any) => state.personColor);
    const localClientId = useGame((state: any) => state.clientId);
    useEffect(() => {
        playerActionsRef.current = playerActions;
    }, [playerActions]);

    const updateCharacterTextures = (rPlayer: any, personColor: string) =>{
        if(rPlayer.children[0].children[0]){

            if(rPlayer.children[0].children[0].material){
                rPlayer.children[0].children[0].material = new THREE.MeshPhongMaterial({
                    map: rPlayer.children[0].children[0].material.map,
                    color: personColor
                })
                rPlayer.children[0].children[0].material.needsUpdate = true
            }


        }
    }

    const addPlayer = (clientId: string, personColor: string) => {
        const rPlayer: any = SkeletonUtils.clone(fbx);
        rPlayer.children[0].name = clientId;
        updateCharacterTextures(rPlayer, personColor)

        const mixer = new THREE.AnimationMixer(rPlayer);
        const idleAction = mixer.clipAction(animations[0]);
        const walkAction = mixer.clipAction(animations[2]);
        const jumpAction = mixer.clipAction(animations[1]);

        const newPlayerData = {
            [clientId]: {
                actions: {
                    Idle: idleAction,
                    Walk: walkAction,
                    Jump: jumpAction,
                },
                mixer,
                player: rPlayer,
                clientId,
            },
        };
        // Update playerActions and playerActionsRef at the same time
        setPlayerActions((prev) => {
            const updated = {...prev, ...newPlayerData};
            playerActionsRef.current = updated; // Update the ref immediately
            return updated;
        });

        scene.add(rPlayer)
        iPlayerList.current[clientId] = rPlayer.children[0]
        return rPlayer.children[0]
    };

    const handlePlayerMove = (transform: any) => {

        const {
            mType,
            position,
            currentAnimation,
            speed,
            clientId,
            prevAnimation,
            userName,
            angle,
            personColor
        } = transform;

        if (!clientId || (nonRealtime.has(clientId) && transform.moveType === "realtime") ||
            (!nonRealtime.has(clientId) && transform.moveType === "playback")
        ) return;

        if (mType !== "player") return;


        iPlayer.current = iPlayerList.current[clientId]

        if (!iPlayer.current) {
            iPlayer.current = addPlayer(clientId, personColor)
            socket.emit('getPlayers', 'grid');

        }
        if (iPlayer.current.parent) {
            setRemoteDetails((prevDetails: any) => {
                const previous = prevDetails[clientId];
                if (previous?.position === position && previous?.speed === speed && previous?.currentAnimation === currentAnimation) {
                    return prevDetails; // No changes, no need to update
                }

                return {
                    ...prevDetails,
                    [clientId]: {
                        ...previous,
                        position,
                        clientId,
                        speed,
                        currentAnimation,
                        userName,
                        angle,
                        prevAnimation: prevAnimation || null,
                        animationChanged: prevAnimation !== currentAnimation,  // Mark if the animation changed
                    },
                };
            });

            if (
                position.x !== iPlayer.current.parent.position.x ||
                position.z !== iPlayer.current.parent.position.z
            ) {
                iPlayer.current.parent.lookAt(position.x, iPlayer.current.parent.position.y, position.z);

            }
            if (position.y != 0)
                position.y -= 0.6;

            // Adjust for player's feet
            iPlayer.current.parent.position.copy(position);

        }

    };

    const handleAvailableRemotePlayers = (players: any) => {

        for (const player of players) {
            handlePlayerMove(player)
        }
    }
    useEffect(() => {

        if (!playerActions || Object.keys(playerActions).length === 0) return;

        Object.entries(remoteDetails).forEach(([clientId, playerDetails]: any) => {
            if (!playerActions[clientId]) return;
            const {actions, mixer} = playerActions[clientId];
            if (!playerDetails) return;

            const curAnim = playerDetails.currentAnimation;
            const prevAnim = playerDetails.prevAnimation;
            const speed = playerDetails.speed || 1;
            const rSpeed = 1 + (speed / 100) * 2;
            const curAction = actions[curAnim];
            const prevAction = actions[prevAnim];


            if (!curAction) return;

            if (playerDetails.animationChanged || curAnim !== prevAnim || !curAction.isRunning()) {
                // Fade out previous action if it exists
                if (!curAction.isRunning()) {
                    actions['Idle']?.fadeOut(0.01).stop();
                }
                if (prevAction !== curAction) {
                    prevAction?.fadeOut(0.01).stop();
                }
                // Handle the new animation (e.g., Jump or others)
                if (curAnim === "Jump") {
                    curAction
                        .reset()
                        .fadeIn(0)
                        .setLoop(THREE.LoopOnce, 0)
                        .play();
                    curAction.clampWhenFinished = true;
                } else {
                    curAction
                        .reset()
                        .fadeIn(0.2)
                        .setDuration(curAction.getClip().duration / rSpeed)
                        .play();
                }

                // After applying the animation, update the details
                setRemoteDetails((prevDetails: any) => ({
                    ...prevDetails,
                    [clientId]: {
                        ...prevDetails[clientId],
                        prevAnimation: curAnim, // Mark the current as previous
                        animationChanged: false, // Reset animation change flag
                    },
                }));
            } else {
                // Update the speed if the animation hasn't changed
                curAction.setDuration(curAction.getClip().duration / rSpeed);

            }
        });

    }, []);
    useEffect(() => {
        socket.on("remotePlayers", handleAvailableRemotePlayers)

    }, []);
    const disconnect = (clientID: string) => {

        const iPlayer: any = iPlayerList.current[clientID]// scene.getObjectByName(clientID);
        if (iPlayer) {
            scene.remove(iPlayer.parent);
        }
        delete iPlayerList.current[clientID]
        setPlayerActions((prev) => {
            const updatedActions = {...prev};
            delete updatedActions[clientID]; // Remove the disconnected player's actions
            return updatedActions;
        });

        // Remove the specific clientId from remoteDetails
        setRemoteDetails((prev: any) => {
            const updatedDetails = {...prev};
            delete updatedDetails[clientID]; // Remove the disconnected player's details
            return updatedDetails;
        });

        const labelDiv = document.getElementById(clientID);
        if (labelDiv) {
            labelDiv.remove();
        }
        socket.emit('getPlayers', 'grid');
    }

    useEffect(() => {
        setPlayerActionList(remoteDetails)

    }, [remoteDetails]);

    useEffect(() => {

        socket.emit('getPlayers', JSON.stringify({localPersonColor,localClientId }));

    }, []);

    useEffect(() => {
        socket.on("disconnected", disconnect);

        socket.on("remotePlayerMove", handlePlayerMove);

        return () => {
            setPlayerActionList({})
            setRemoteDetails({})
            setPlayerActions({})
            socket.off("disconnected", disconnect);
            socket.off("remotePlayerMove", handlePlayerMove);

        };
    }, []);

    useEffect(() => {
        if (!playerActions || Object.keys(playerActions).length === 0) return;

        Object.entries(remoteDetails).forEach(([clientId, playerDetails]: any) => {
            if (!playerActions[clientId]) return;
            const {actions, mixer} = playerActions[clientId];
            if (!playerDetails) return;

            const curAnim = playerDetails.currentAnimation;
            const prevAnim = playerDetails.prevAnimation;
            const speed = playerDetails.speed || 1;
            const rSpeed = 1 + (speed / 100) * 2;
            const curAction = actions[curAnim];
            const prevAction = actions[prevAnim];


            if (!curAction) return;

            if (playerDetails.animationChanged || curAnim !== prevAnim || !curAction.isRunning()) {
                // Fade out previous action if it exists
                if (!curAction.isRunning()) {
                    actions['Idle']?.fadeOut(0.01).stop();
                }
                if (prevAction !== curAction) {
                    prevAction?.fadeOut(0.01).stop();
                }
                // Handle the new animation (e.g., Jump or others)
                if (curAnim === "Jump") {
                    curAction
                        .reset()
                        .fadeIn(0)
                        .setLoop(THREE.LoopOnce, 0)
                        .play();
                    curAction.clampWhenFinished = true;
                } else {
                    curAction
                        .reset()
                        .fadeIn(0.2)
                        .setDuration(curAction.getClip().duration / rSpeed)
                        .play();
                }

                // After applying the animation, update the details
                setRemoteDetails((prevDetails: any) => ({
                    ...prevDetails,
                    [clientId]: {
                        ...prevDetails[clientId],
                        prevAnimation: curAnim, // Mark the current as previous
                        animationChanged: false, // Reset animation change flag
                    },
                }));
            } else {
                // Update the speed if the animation hasn't changed
                curAction.setDuration(curAction.getClip().duration / rSpeed);

            }
        });
    }, [remoteDetails, playerActions]);

    const updatePlayerLabel = (
        position: THREE.Vector3,
        clientId: string,
        speed: string,
        userName: string,
        angle: number
    ) => {
        let labelDiv = document.getElementById(clientId);
        if (!labelDiv) {
            labelDiv = document.createElement("div");
            labelDiv.classList.add("p-description");
            labelDiv.id = clientId;

            const textDiv = document.createElement("div");
            textDiv.id = `${clientId}-details`;
            textDiv.classList.add("t-header");

            labelDiv.appendChild(textDiv);
            document.body.append(labelDiv);
        }

        const details = document.getElementById(`${clientId}-details`);
        if (details) {

            details.innerHTML = `${userName} <br>
                                 (X:${(position.x * 100).toFixed(1)},Y:${(position.y * 100).toFixed(1)},Z:${(position.z * 100).toFixed(1)})
                                ${THREE.MathUtils.radToDeg(angle).toFixed(1)}&deg; <br>
                                 Speed: ${speed}`;
        }

        const labelPosition = new THREE.Vector3(position.x, position.y + 2, position.z);
        labelPosition.project(camera);
        const left = (labelPosition.x * 0.5 + 0.5) * window.innerWidth;
        const top = -(labelPosition.y * 0.5 - 0.5) * window.innerHeight;
        const verticalOffset = 100;
        const zoomFactor = camera instanceof THREE.PerspectiveCamera ? camera.zoom : 1;
        labelDiv.style.position = "absolute";
        labelDiv.style.left = `${left}px`;
        labelDiv.style.top = `${top - verticalOffset / zoomFactor}px`;

    };
    useFrame((state, delta) => {
        Object.values(playerActions).forEach(({clientId, mixer}) => {
            mixer.update(delta);
            const details = remoteDetails[clientId];
            if (details && pLabel) {
                updatePlayerLabel(details.position, clientId, details.speed, details.userName, details.angle);
            }
        });
    });

    return null;
}
