import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import {BorderColor, Refresh} from "@mui/icons-material";
import SaveData from "../saveData";
import ThreeDRotationIcon from "@mui/icons-material/ThreeDRotation";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import {Grid} from "@mui/material";
import React from "react";
import useGame from "../../../../hooks/useGame";
import PrintIcon from '@mui/icons-material/Print';
import DeleteAsset from "./DeleteAsset";


export default function SpecsButtons({setEditable,refreshAssetData,scene,fieldsMap,setFieldsMap,setEditAssetId,selectedAssetId,editPopup,setEditPopup,setFormValues}) {
    const setShowQR = useGame((state) => state.setShowQR);
    const showQR = useGame((state) => state.showQR);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);



    const openPrintQrCodeWindow = () => {
        const targetUrl = `https://bo.nts.nl/scanner-info/?asset=${selectedAssetId}`;
        const qrServerUrl = `https://api.qrserver.com/v1/create-qr-code/?size=189x189&data=${encodeURIComponent(targetUrl)}`;

        const w = window.open('', '', 'width=700,height=600,top=150');

        let content = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style type="text/css" media="print">
                @page { size: auto; margin: 0; }
            </style>
        </head>
        <body>
            <img id="qrImage" src="${qrServerUrl}" onload="window.print(); window.close();">
        </body>
        </html>`;

        w.document.open();
        w.document.write(content);
        w.document.close();
    };

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
                {/*<Tooltip title="Take photo/video" key="tooltip-camera">*/}
                {/*    <IconButton*/}
                {/*        aria-label="camera"*/}
                {/*        onClick={() => setIsCamera(true)}*/}
                {/*        key="icon-button-camera"*/}
                {/*    >*/}
                {/*        <CameraAlt fontSize="small" key="icon-camera" />*/}
                {/*    </IconButton>*/}
                {/*</Tooltip>*/}
                {/*<FileUpload key="file-upload-component" />*/}

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
                <Tooltip title="Edit 3D" key="tooltip-edit-3d">
                    <IconButton
                        aria-label="refresh"
                        onClick={() => {
                            setEditAssetId(selectedAssetId)
                            if (!editPopup) return;
                            setEditPopup(false);
                            setFieldsMap({});
                            setFormValues({})

                        }}
                        key="icon-button-refresh-3d"
                    >
                        <ThreeDRotationIcon fontSize="small" key="icon-refresh" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Show QR Code" key="tooltip-show-qr">
                    <IconButton
                        aria-label="qrcode"
                        onClick={() => {
                            setShowQR(!showQR)

                        }}
                        key="icon-button-qr-code"
                    >
                        <QrCode2Icon fontSize="small" key="icon-qr" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Print QR Code" key="tooltip-print-qr">
                    <IconButton
                        aria-label="print"
                        onClick={() => {
                            openPrintQrCodeWindow()

                        }}
                        key="icon-button-qr-code-print"
                    >
                        <PrintIcon fontSize="small" key="icon-qr-print" />
                    </IconButton>
                </Tooltip>
                { isPuzzleGame &&
                  <DeleteAsset assetId={selectedAssetId} />
                }
            </Stack>
        </Grid>
    )
}