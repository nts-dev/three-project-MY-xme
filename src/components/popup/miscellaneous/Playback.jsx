import React, {useEffect, useState} from 'react';
import {Dialog} from 'primereact/dialog';
import {RadioButton} from 'primereact/radiobutton';
import {InputText} from 'primereact/inputtext';
import {Dropdown} from 'primereact/dropdown';
import {Button} from 'primereact/button';
import useGame from "../../../hooks/useGame";
import {socket} from "../../../socket";

import 'primereact/resources/themes/saga-blue/theme.css';  // Choose your theme
// import 'primereact/resources/primereact.min.css';
// import 'primeicons/primeicons.css';

const MyDialogForm = () => {
    // const [displayDialog, setDisplayDialog] = useState(true);
    const setDisplayDialog = useGame((state) => state.setDisplayDialog);
    const displayDialog = useGame((state) => state.displayDialog);
    const [selection, setSelection] = useState('realtime');
    const [start, setStart] = useState('');
    const [selectedClient, setSelectedClient] = useState('749f9e1b7d6636cb');
    const [clients, setClients] = useState([]);
    const [end, setEnd] = useState('');
    const [errors, setErrors] = useState({});

    const setNonRealtime = useGame((state) => state.setNonRealtime);
    const nonRealtime = useGame((state) => state.nonRealtime);
    const projectId = useGame((state) => state.projectID);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/clients`); // Replace with your API endpoint
                const data = await response.json();
                const clientOptions = data.map(client => ({
                    label: client.device_name,
                    value: client.device_id
                }));
                setClients(clientOptions);
            } catch (error) {
                console.error('Error fetching projects:', error);
            }
        };

        fetchClients();
    }, []);

    const closeDialog = () => {
        setDisplayDialog(false);
        // setSelection(null);
        setStart('');
        setEnd('');
        // setSelectedClient(null);
        setErrors({});
    };

    const validate = () => {
        const newErrors = {};
        if (!selectedClient) {
            newErrors.selectedClient = 'Client is required';
        }
        if (!start) {
            newErrors.start = 'Start is required';
        }
        if (!end) {
            newErrors.end = 'End is required';
        }
        return newErrors;
    };

    async function getData() {
        const clientId = selectedClient;
        const url = `${import.meta.env.VITE_API_URL}/location/${clientId}/moves/${start}-${end}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) return;

            nonRealtime.add(clientId);
            setNonRealtime(nonRealtime);


            const players = result.players;
            const locations = result.data;
            const total = locations.length;
            let current = 0;

            for (const location of locations) {

                const x = projectId == 48 ? (parseFloat(location.posx) / 100) - 4 : (parseFloat(location.posx) / 100)
                const z = projectId == 48 ? ((parseFloat(location.posz)) / 100) - 4 : (parseFloat(location.posz) / 100) - 3

                let currentPos = {x: x, y: 0.6, z: z};
                let animation = "Walk";

                current++;

                if (current == total) animation = "Idle";

                const transformation = {
                    mType: "player",
                    clientId: clientId,
                    position: currentPos,
                    currentAnimation: animation,
                    angle: 0,
                    speed: 10,
                    dateTime: ""
                }


                const transform = {
                    ClientID: clientId,
                    posX: parseInt(String(transformation.position?.x * 100)),
                    posY: parseInt(String(transformation.position?.y * 100)),
                    posZ: parseInt(String(transformation.position?.z * 100)),
                    angle: parseInt(String(transformation.angle * 57.2958)),
                    dateTime: transformation.dateTime,
                    speed: `${transformation.speed}%`,
                    latitude: `${transformation.latitude}`,
                    longitude: `${transformation.longitude}`,
                    altitude: `${transformation.altitude}`,
                }

                socket.emit('playbackMove', {clientId: clientId, transfrm: transform, transformation: transformation});

                // Add a delay of 2 seconds
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            nonRealtime.delete(clientId);
            setNonRealtime(nonRealtime);
            // console.log(nonRealtime)
            // socket.emit('playbackMoveEnd', {clientId: clientId});

        } catch (error) {
            console.error(error.message);
        }
    }

    const handleSubmit = () => {

        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        // Handle form submission
        // console.log({ selection, start, end });
        if (selection === 'playback') {
            getData();
        } else {
            nonRealtime.delete(selectedClient);
            setNonRealtime(nonRealtime);
        }
        closeDialog();
    };

    const renderFooter = () => {
        return (<div>
            <Button label="Submit" icon="pi pi-check" onClick={handleSubmit}/>
            <Button label="Cancel" icon="pi pi-times" onClick={closeDialog} className="p-button-secondary"/>
        </div>);
    };

    return (<div>
        <Dialog header="Movement Type" visible={displayDialog} style={{width: '20vw', height: '30vw'}}
                footer={renderFooter()}
                onHide={closeDialog}>
            <div className="flex flex-col space-y-4">
                <div className="flex flex-col">
                    <label htmlFor="projects" className="mb-2">Clients</label>
                    <Dropdown
                        id="clients"
                        value={selectedClient}
                        options={clients}
                        onChange={(e) => setSelectedClient(e.value)}
                        placeholder="Select a Client"
                        className={`w-full md:w-14rem ${errors.selectedClient ? 'p-invalid' : ''}`}
                    />
                    {errors.selectedClient && <small className="p-error">{errors.selectedClient}</small>}
                </div>
                <div className="flex items-center space-x-2">
                    <RadioButton inputId="realtime" name="option" value="realtime"
                                 onChange={(e) => setSelection(e.value)} checked={selection === 'realtime'}/>
                    <label htmlFor="realtime" className="cursor-pointer">Realtime</label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioButton inputId="playback" name="option" value="playback"
                                 onChange={(e) => setSelection(e.value)} checked={selection === 'playback'}/>
                    <label htmlFor="playback" className="cursor-pointer">Playback</label>
                </div>

                {selection === 'playback' && (
                    <div className="flex flex-col space-y-4">
                        <div className="flex flex-col">
                            <label htmlFor="start" className="mb-2">Start</label>
                            <InputText
                                id="start"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                                className={`p-inputtext p-component p-filled ${errors.start ? 'p-invalid' : ''}`}
                            />
                            {errors.start && <small className="p-error">{errors.start}</small>}
                        </div>
                        <div className="flex flex-col">
                            <label htmlFor="end" className="mb-2">End</label>
                            <InputText
                                id="end"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                className={`p-inputtext p-component p-filled ${errors.end ? 'p-invalid' : ''}`}
                            />
                            {errors.end && <small className="p-error">{errors.end}</small>}
                        </div>
                    </div>
                )}
            </div>
        </Dialog>
    </div>);
};

export default MyDialogForm;
