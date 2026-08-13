import {Grid} from "@mui/material";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import {CameraAlt, Refresh} from "@mui/icons-material";
import FileUpload from "../FileUpload";
import SaveData from "../saveData";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import React, {useRef} from "react";
import {ConfirmDialog, confirmDialog} from "primereact/confirmdialog";
import {Toast} from "primereact/toast";
import useGame from "../../../../hooks/useGame";

export default function MediaButtons({setIsCamera,scene,fieldsMap,refreshAssetData}) {
    const toast = useRef(null);
    const selectedImageProps = useGame((state) => state.selectedImageProps);
    const setSelectedImageProps = useGame((state) => state.setSelectedImageProps);
    const setImages = useGame((state) => state.setImages)
    const images = useGame((state) => state.images)

    const deleteImage =  async () => {
        const {id, blob,activeIndex} = selectedImageProps
        if(blob){
            images.splice(activeIndex, 1);
            setImages(images)
            setSelectedImageProps({id: 0,isDeleted:true, blob})
        }
        if(!id) return

        try {
            const response = await fetch(
                `${import.meta.env.VITE_DATA_URL}/Controller/php/data_files.php?action=2&id=${id}`
            );
            const result = await response.json();
            if (result.response) {
                toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'Image Deleted', life: 3000 });
                setSelectedImageProps({id: 0,isDeleted:true})
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
            message: 'Do you want to delete this photo?',
            header: 'Delete Confirmation',
            icon: 'pi pi-info-circle',
            defaultFocus: 'reject',
            acceptClassName: 'p-button-danger',
            position: 'top',
            accept: () => accept(),
            reject
        });
    };



    return (

        <>
            <ConfirmDialog/>
            <Toast ref={toast} key={`toast-media-btn`}/>

        <Grid container justifyContent="center" sx={{ paddingTop: 0.5 }} key="grid-center-container">
            <Stack direction="row" key="stack-row">

                <Tooltip title="Take photo/video" key="tooltip-camera">
                    <IconButton
                        aria-label="camera"
                        onClick={() => setIsCamera(true)}
                        key="icon-button-camera"
                    >
                        <CameraAlt fontSize="small" key="icon-camera" />
                    </IconButton>
                </Tooltip>
                <FileUpload key="file-upload-component" type="image" nameType='photos/videos'/>

                <Tooltip title="Refresh" key="tooltip-refresh">
                    <IconButton
                        aria-label="refresh"
                        onClick={() => {
                            refreshAssetData()
                        }}
                        key="icon-button-refresh"
                    >
                        <Refresh fontSize="small" key="icon-refresh" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete photo/video" key="tooltip-delete-photo">
                    <IconButton
                        aria-label="refresh"
                        onClick={() => {
                            confirmDelete()
                        }}
                        key="icon-button-delete-photo"
                    >
                        <DeleteOutlinedIcon fontSize="small" key="icon-delete-photo" />
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