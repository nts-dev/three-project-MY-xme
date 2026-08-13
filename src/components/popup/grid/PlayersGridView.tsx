import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { toggle } from '../../../features/menuBar/menuSlice';
import { socket } from '../../../socket';
import debounce from 'lodash/debounce'; // Using lodash for debouncing

export default function PlayersGridView() {
    const dispatch = useDispatch();
    const showPlayers = useSelector((state: any) => state.menu.playersList);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [playerList, setPlayerList] = useState<any[]>([]);
    const toast = useRef<any>(null);

    const updatePlayerList = useCallback(
        debounce((data) => {
            setPlayerList((prevList) => {
                const updatedList = [...prevList];
                data.forEach((update: any) => {
                    const index = updatedList.findIndex((player) => player.clientId === update.clientId);
                    if (index > -1) {
                        updatedList[index] = { ...updatedList[index], ...update };
                    } else {
                        updatedList.push(update);
                    }
                });
                return updatedList;
            });
        }, 3),
        [] // Debounce the updates
    );

    useEffect(() => {
        if (showPlayers) {
            socket.emit('getPlayers', 'grid');
            socket.on('playersUpdate', updatePlayerList);

            return () => {
                socket.off('getPlayers');
                socket.off('playersUpdate', updatePlayerList);
            };
        }
    }, [showPlayers, updatePlayerList]);

    const onRowSelect = (event: any) => {
        if (toast.current) {
            toast.current.show([
                {
                    severity: 'success',
                    sticky: false,
                    content: (
                        <React.Fragment>
                            <img alt="logo" src="https://primefaces.org/cdn/primereact/images/avatar/amyelsner.png" width="32" />
                            <div style={{ marginRight: 'auto' }} className="ml-2">
                                {event.data.userName} here, How may I help you?
                            </div>
                        </React.Fragment>
                    ),
                },
            ]);
        }
    };

    return (
        <div>
            <Toast ref={toast} />
            <Dialog header="Remote Players" modal={false} visible={showPlayers} position="bottom"
                    style={{ width: '50vw' }}
                    onHide={() => {
                        if (!showPlayers) return;
                        dispatch(toggle('playersList'));
                        // setPlayersGrid(false);
                    }}
                    draggable={false} resizable={false}
                    className="popup-player-list">

                <DataTable value={playerList} stripedRows selectionMode="single"
                           selection={selectedProduct}
                           onSelectionChange={(e) => setSelectedProduct(e.value)}
                           dataKey="clientId"
                           onRowSelect={onRowSelect}
                           metaKeySelection={false}>
                    <Column field="userName" header="Name" sortable />
                    <Column field="posX" header="PosX" sortable />
                    <Column field="posY" header="PosY" sortable />
                    <Column field="posZ" header="PosZ" sortable />
                    <Column field="angle" header="Angle" sortable />
                    <Column field="speed" header="Speed" sortable />
                    <Column field="dateTime" header="DateTime" sortable />
                    <Column field="longitude" header="Longitude" sortable />
                    <Column field="latitude" header="Latitude" sortable />
                    <Column field="altitude" header="Altitude" sortable />
                </DataTable>
            </Dialog>
        </div>
    );
}
