import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import React, {useRef} from "react";
import {Toast} from "primereact/toast";
import useGame from "../../../../hooks/useGame";


export default function DeleteAsset({assetId,}) {
    const toast= useRef(null);
    const setDeleteAssetId = useGame((state) => state.setDeleteAssetId);

    return(
        <>

            <Toast ref={toast} key={`toast-`}/>
                <Tooltip title="Delete Asset" key="tooltip-delete-asset">
                    <IconButton
                        aria-label="refresh"
                        onClick={() => {

                            setDeleteAssetId(assetId)
                        }}
                        key="icon-button-delete-photo"
                    >
                        <DeleteOutlinedIcon fontSize="small" key="icon-delete-photo" />
                    </IconButton>
                </Tooltip>
            </>
    )
}