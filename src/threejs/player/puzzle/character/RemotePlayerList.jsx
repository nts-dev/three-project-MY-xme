import { useCallback, useEffect, useMemo } from "react";

import useGame from "../../../../hooks/useGame";
import {socket} from "../../../../socket";
import RemotePlayer from "./RemotePlayer";
import * as THREE from "three";
import useRemotePlayersWorker from "./remotePlayers/useRemotePlayersWorker";


export default function RemotePlayerList({playerObject}) {
    const {scene, animations} = playerObject;
    const localClientId = useGame((state) => state.clientId);
    const projectID = useGame((state) => state.projectID);
    const textureCache = useMemo(()=>  new Map(),[]);
    const materialCache = useMemo(()=>new Map(),[]);
    const { players, handlePlayersSnapshot } = useRemotePlayersWorker({
        localClientId,
        projectID,
    });

    const alphaTexture = useMemo(()=>{

        const alphaTexture = new THREE.TextureLoader().load(
            `${import.meta.env.VITE_FILE_URL}/Opacity.jpg`
        )
        alphaTexture.colorSpace = THREE.NoColorSpace;
        alphaTexture.wrapS = alphaTexture.wrapT = THREE.RepeatWrapping;
        alphaTexture.needsUpdate = true;
        return alphaTexture;

    },[]);

    const handleDisconnect = useCallback(() => {
        socket.emit('getPlayers', '');
    }, []);


    const remotePlayer = (players) => {
//  console.log(players)
    }
    useEffect(() => {
       
        socket.on("disconnected", handleDisconnect);
        socket.on("playersUpdate", handlePlayersSnapshot);
        socket.on("remotePlayers", remotePlayer);
        socket.emit('getPlayers', '');

        return () => {
            socket.off("playersUpdate", handlePlayersSnapshot);
            socket.off("remotePlayers", remotePlayer);
            socket.off("disconnected", handleDisconnect);
        };
    }, [handleDisconnect, handlePlayersSnapshot]);

 


    const remotePlayers = players.map((player) => {
       
            return (
                scene && (
                    <RemotePlayer
                        key={player.clientId}
                        rPlayer={scene}
                        player={player}
                        animations={animations}
                        textureCache={textureCache}
                        materialCache={materialCache}
                        alphaTexture={alphaTexture}
                    />
                )
            )
        }
    )

    return (remotePlayers);
}
