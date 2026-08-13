import {useEffect} from 'react';
import {connectSocket, disconnectSocket, socket} from './socket';
import UpdateAsset from "./threejs/scene/UpdateAsset.jsx";
import useGame from "./hooks/useGame";
import {Q} from "@nozbe/watermelondb";
import database from "./database";

export default function SocketController() {
    const setFormStatus = useGame((state) => state.setFormStatus);
    const setClientId = useGame((state) => state.setClientId);
    const buttonMode = useGame((state) => state.buttonMode);
    const updateField = async (id, data) => {
        const fieldsCollection = database.collections.get('fields');
        // Query the record by value_id
        const fields = await fieldsCollection.query(Q.where('value_id', id)).fetch();

        if (fields.length === 0) {
            console.log(`No field found with id: ${id}`);
            return;
        }

        await database.write(async () => {
            fields.forEach(field => {
                field.update(record => {
                    // @ts-ignore
                    record.value = data.value;
                });
            });
        });
    }

    useEffect(() => {
        if (buttonMode !== 'Play mode') {
            disconnectSocket();
            return undefined;
        }

        connectSocket();

        function onConnect() {
            // setClientId
             console.log('connected',socket.id)

        }

        function setClient(clientId) {
            setClientId(clientId)
        }

        function onDisconnect() {
        }

        async function onNewMessageEvent(value) {

            UpdateAsset(value.map, value.assetId, value.asset);
            for (const field of Object.values(value.map)) {
                const id = `${value.assetId}_${field.fieldId}`

                await updateField(id, {value: field.value});
            }

            setFormStatus(Math.random().toString(36).substring(2, 7));
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('newMessage', onNewMessageEvent);
        socket.on('defaultClientId', setClient);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('newMessage', onNewMessageEvent);
            socket.off('defaultClientId', setClient);
            disconnectSocket();

        };
    }, [buttonMode, setClientId, setFormStatus]);

    return null;
}
