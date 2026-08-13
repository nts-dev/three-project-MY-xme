import {useEffect} from "react";
import useGame from "../../hooks/useGame";
import {socket} from "../../socket";

export default function PlayerHudCleanUp({client}:any){
    const character: any = useGame((state: any) => state.character)
    const firstPerson: any = useGame((state: any) => state.firstPerson)
    const projectID = useGame((state: any) => state.projectID);

    useEffect(() => {

        if (client && (!character && !firstPerson)) {
            const clientInfo = JSON.parse(client)
            socket.emit('playerDisconnect', clientInfo.clientId);

        }
    },[character,firstPerson,projectID])
    return null
}
