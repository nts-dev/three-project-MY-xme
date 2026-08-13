import {Grid} from "@mui/material";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import React, {useRef} from "react";
import FileUpload from "../FileUpload";
import SaveData from "../saveData";
import {ConfirmDialog, confirmDialog} from "primereact/confirmdialog";
import {Toast} from "primereact/toast";
import useGame from "../../../../hooks/useGame";

export default function FilesButtons({scene, fieldsMap}){
    const toast = useRef(null);
    const setFiles = useGame((state) => state.setFiles)
    const files = useGame((state) => state.files)
    const selectedFileIndex = useGame((state) => state.selectedFileIndex)

    const deleteImage =  async () => {
        try {
            if(!files[selectedFileIndex]) return

           const {id,name} =  files[selectedFileIndex]

            if(!id){
              const newFiles =  files.filter((item) => item.name !== name)
                setFiles(newFiles)
                toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'File Removed', life: 3000 });
                return
            }
            const response = await fetch(
                `${import.meta.env.VITE_DATA_URL}/Controller/php/data_files.php?action=2&id=${id}`
            );
            const result = await response.json();
            if (result.response) {
                toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'Image Deleted', life: 3000 });
                const newFiles =  files.filter((item) => item.name !== name)
                setFiles(newFiles)

            }
        } catch (error) {
            console.error("Error deleting asset:", error);
        }
    }

    const accept = () => {
        deleteImage()
    }
    const reject = () => {
        toast.current?.show({severity: 'warn', summary: 'Rejected', detail: 'You have rejected', life: 3000});
    }

    const confirmDelete = () => {
        confirmDialog({
            message: 'Do you want to delete selected document?',
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

                <FileUpload key="file-upload-pdf" type="pdf" nameType="pdf files"/>
                <Tooltip title="Delete selected file" key="tooltip-delete">
                    <IconButton
                        aria-label="delete"
                        onClick={() => {
                             confirmDelete()
                        }}
                        key="icon-button-delete"
                    >
                        <DeleteOutlinedIcon fontSize="small" key="icon-delete" />
                    </IconButton>
                </Tooltip>
                <SaveData
                    scene={scene}
                    fieldsMap={fieldsMap}
                    key="save-data-component"
                />


            </Stack>
        </Grid>
            </>
    )
}