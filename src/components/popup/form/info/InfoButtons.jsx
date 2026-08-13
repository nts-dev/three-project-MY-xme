import {Grid} from "@mui/material";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import {BorderColor, Refresh} from "@mui/icons-material";
import SaveData from "../saveData";
import React from "react";

export default function InfoButtons({setEditable,refreshAssetData,scene,fieldsMap}){

    return (
        <Grid container justifyContent="center" sx={{ paddingTop: 0.5 }} key="grid-center-container">
            <Stack direction="row" key="stack-row">
                <Tooltip title="Edit Fields" key="tooltip-edit-fields">
                    <IconButton
                        aria-label="edit"
                        onClick={() => setEditable(true)}
                        key="icon-button-edit"
                    >
                        <BorderColor fontSize="small" key="icon-edit" />
                    </IconButton>
                </Tooltip>

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
                <SaveData
                    scene={scene}
                    fieldsMap={fieldsMap}
                    key="save-data-component"
                />
            </Stack>
        </Grid>
    )
}