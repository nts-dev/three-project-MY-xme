import {Grid} from "@mui/material";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import AddTaskOutlinedIcon from "@mui/icons-material/AddTaskOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import UpdateIcon from '@mui/icons-material/Update';
import React, {useRef} from "react";
import {ConfirmDialog, confirmDialog} from "primereact/confirmdialog";
import {Toast} from "primereact/toast";
import useGame from "../../../../hooks/useGame";

export default function PlanningButtons(){
    const toast = useRef(null);
    const selectedLogIndex = useGame((state) => state.selectedLogIndex)
    const logs = useGame((state) => state.logs)
    const setLogs = useGame((state) => state.setLogs)
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    const refreshPlanning = useGame((state) => state.refreshPlanning);
    const setRefreshPlanning = useGame((state) => state.setRefreshPlanning);
    const logFormData = useGame((state) => state.logFormData);

    const updateEvent = async ()=>{
        const {event_id} = logFormData
        if(!event_id) return



        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/updateEvent`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(logFormData)
                }
            );
            const result = await response.json();

            if (result.success) {
                // setRefreshPlanning(!refreshPlanning)
                toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'Log/Event Updated', life: 3000 });
            }
        } catch (error) {
            console.error("Error deleting asset:", error);
        }


    }

    const addEvent = async () => {
        const contact_id = 0;

        try {
            const response = await fetch(
                `${import.meta.env.VITE_DATA_URL}/Controller/php/data_planning.php?action=1&id=${selectedAssetId}&eid=${contact_id}`
            );
            const result = await response.json();
           //console.log(result)
            if (result.data.success) {
                 setRefreshPlanning(!refreshPlanning)
                toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'New Log/Event Added', life: 3000 });
            }
        } catch (error) {
            console.error("Error deleting asset:", error);
        }
    }

    const deleteLog =  async () => {
        try {
            if(!logs[selectedLogIndex]) return

            const {id} =  logs[selectedLogIndex]
            if(!id){
                const newLogs =  logs.filter((item) => item.id !== id)
                setLogs(newLogs)
                toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'Log Removed', life: 3000 });
                return
            }
            const response = await fetch(
                `${import.meta.env.VITE_DATA_URL}/Controller/php/data_planning.php?action=2&id=${id}`
            );
            const result = await response.json();
            if (result.response) {
                const newLogs =  logs.filter((item) => item.id !== id)
                setLogs(newLogs)
                toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'Log Removed', life: 3000 });

            }
        } catch (error) {
            console.error("Error deleting asset:", error);
        }
    }

    const accept = () => {
        deleteLog()
    }
    const reject = () => {
        toast.current?.show({severity: 'warn', summary: 'Rejected', detail: 'You have rejected', life: 3000});
    }

    const confirmDelete = () => {
        confirmDialog({
            message: 'Do you want to delete selected Log/Event?',
            header: 'Delete Confirmation',
            icon: 'pi pi-info-circle',
            defaultFocus: 'reject',
            acceptClassName: 'p-button-danger',
            position: 'top',
            accept: () => accept(),
            reject
        });
    };

    return(
        <>
        <ConfirmDialog/>
        <Toast ref={toast} key={`toast-media-btn`}/>
        <Grid container justifyContent="center" sx={{ paddingTop: 0.5 }} key="grid-center-container">
            <Stack direction="row" key="stack-row">
                <Tooltip title="Add new event" key="tooltip-add-log">
                    <IconButton
                        aria-label="add"
                        onClick={() => {
                            addEvent()
                        }}
                        key="icon-button-add"
                    >
                        <AddTaskOutlinedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete selected event" key="tooltip-delete-log">
                    <IconButton
                        aria-label="delete"
                        onClick={() => {
                            confirmDelete()
                        }}
                        key="icon-button-delete-log"
                    >
                        <DeleteOutlinedIcon fontSize="small" key="icon-delete" />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Update selected event" key="tooltip-save-log">
                    <IconButton
                        aria-label="save"
                        onClick={() => {
                            updateEvent()
                        }}
                        key="icon-button-save-log"
                    >
                        <UpdateIcon fontSize="small" key="icon-update" />
                    </IconButton>
                </Tooltip>

            </Stack>
        </Grid>
        </>
    )
}
