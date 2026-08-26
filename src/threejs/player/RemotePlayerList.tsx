import {useEffect, useState, useMemo} from "react";
import {socket} from "../../socket";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";
import RemotePlayer from "./RemotePlayer";
import useGame from "../../hooks/useGame";
import usePlayerTrackReplay from "./usePlayerTrackReplay";

export default function RemotePlayerList({playerObject}: any) {
    const {scene, animations} = playerObject;
    const [players, setPlayers] = useState<any[]>([]);
    const localClientId = useGame((state: any) => state.clientId);
    const projectID = useGame((state: any) => state.projectID);
    const playerTrackReplay = useGame((state: any) => state.playerTrackReplay);
    const trackPlayers = usePlayerTrackReplay(projectID, playerTrackReplay);
    const setPlayerActionList = useGame((state: any) => state.setPlayerActions);
    const disconnect = (clientID: string) => {
        const labelDiv = document.getElementById(clientID);
        if (labelDiv) {
            labelDiv.remove();
        }

        socket.emit('getPlayers', '');
        setPlayers(players)

    }

    useEffect(() => {

        socket.on("disconnected", disconnect);
        socket.on("playersUpdate", setPlayers);
        socket.emit('getPlayers', '');

        return () => {
            socket.off("playersUpdate", setPlayers);
            socket.off("disconnected", disconnect);
        };
    }, []);

    const handleAvailableRemotePlayers = (aPlayers: any)=>{
        setPlayerActionList(aPlayers)

        setPlayers(aPlayers)
    }
    useEffect(() => {

        socket.on("remotePlayers", handleAvailableRemotePlayers)

    }, []);


    // Clone the model **once** and reuse it
    const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene,playerObject]);
    useEffect(() => {
          
        if (projectID == 144) {
            clonedScene.scale.set(0.3,0.3,0.3)

        } else {
            clonedScene.scale.set(0.8,0.8,0.8)
        }
    }, [projectID,playerObject]);

    const visiblePlayers = useMemo(() => {
        const localClientIdValue = String(localClientId || "").trim();
        const socketClientIds = new Set(players.map((player: any) => player?.clientId).filter(Boolean));
        const mergedPlayers = [
            ...players,
            ...trackPlayers.filter((player: any) => !socketClientIds.has(player?.clientId)),
        ];

        return mergedPlayers.filter((player: any) => {
            if (!player?.clientId) return false;
            return !localClientIdValue || localClientIdValue !== player.clientId;
        });
    }, [players, trackPlayers, localClientId]);

    return (
        <>
            {visiblePlayers.map((player: any) => {
                    return (
                        <RemotePlayer
                            key={player.clientId}
                            player={player}
                            rPlayer={clonedScene}
                            animations={animations}
                        />
                    )
                }
            )

            }
        </>
    );
}
