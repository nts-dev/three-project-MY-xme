import {useEffect, useState, useMemo} from "react";
import {socket} from "../../socket";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";
import RemotePlayer from "./RemotePlayer";
import useGame from "../../hooks/useGame";

export default function RemotePlayerList({playerObject}: any) {
    const {scene, animations} = playerObject;
    const [players, setPlayers] = useState<any[]>([]);
    const localClientId = useGame((state: any) => state.clientId);
    const projectID = useGame((state: any) => state.projectID);
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

    return (
        <>
            {players.map((player: any) => {
               
                       console.log(player)
                    if (localClientId === undefined || localClientId === null || localClientId.trim().length==0 || localClientId == player.clientId || !String(projectID).includes(String(player.projectID))) {
                        return null
                    }

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
