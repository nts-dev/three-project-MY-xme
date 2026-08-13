import useGame from "../../../hooks/useGame";
import React, {useEffect, useRef, useState} from "react";
import SwapVerticalCircleIcon from '@mui/icons-material/SwapVerticalCircle';
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import {Switch} from "@mui/material";
import {Toast} from "primereact/toast";
import database from "../../../database";
import {Q} from "@nozbe/watermelondb";

export default function PopupInfo() {
    const {x, y, visible, size, mouse, instanceId, assetObj,projectId,renderer,categoryIndex,statusFieldId,inUse} = useGame((state) => state.popupInfo);
    const popupRef = useRef(null);
    const setEditAssetId = useGame((state) => state.setEditAssetId);
    const setHideAssetProps = useGame((state) => state.setHideAssetProps);
    const label = { inputProps: { 'aria-label': 'Size switch demo' } };
    const [btnState, setBtnState] = useState("")
    const toast = useRef(null);
    const [checked, setChecked] = useState(false);


    const fetchCategoryId = async (id) => {

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/getTemplateId/${id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data[0].id;


        } catch (error) {
            console.error("Failed to fetch categories:", error);
        }
    };

    const showMessage = (severity, summary, details) => {
        if (toast.current) {
            toast.current.show({
                severity: severity,
                summary: summary,
                detail: details,
                life: 10000
            });
        }
    }

    const updateRemoteDb = async (fieldId, value) => {
        const formData = new FormData();
            formData.append(`form_${fieldId}`, value);

        const template_id = await fetchCategoryId(categoryIndex);
        try {
            const response = await fetch(
                `${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=24&id=${instanceId}&templ_id=${template_id}&cat_id=${categoryIndex}`, {
                    method: 'POST',
                    body: formData,
                });
            // Check if response is successful
            if (!response.ok) {
                // showMessage('error', response.status, response.statusText)

            }

            const result = await response.json();

            if (result.data.success) {

                if (toast.current) {
                     showMessage('info', 'Fields saved', result.data.text)
                }

            } else {
                if (toast.current) {
                    showMessage('error', 'Error Saving', result.data.text)
                }
            }
        } catch (error) {
            if (toast.current) {
               showMessage('error', 'Error Saving', 'Failed to complete request.')
            }
        }
    }

    const handleChange = (event) => {
        setChecked(event.target.checked);


        setHideAssetProps({instanceId,isHidden: !event.target.checked })
        if(event.target.checked){
            setBtnState("Not ")
        }
        else{
            setBtnState("")
        }
         updateRemoteDb(statusFieldId, event.target.checked ? "In Use" : "Not in Use" )
        updateLocalDb(instanceId,statusFieldId,event.target.checked ? "In Use" : "Not in Use" )
    };


    const updateLocalDb = async (instanceId, fieldId, value) => {
        const fieldsCollection = database.collections.get('fields');
        const operations = [];
            const existingFields = await fieldsCollection.query(
                Q.where('value_id', `${instanceId}_${fieldId}`)
            ).fetch();

            if (existingFields.length > 0 ) {
                const existingField = existingFields[0];
                const update = existingField.prepareUpdate((record) => {
                    record.value = value;
                });

                operations.push(update);

            }

        await database.write(async () => {
            await database.batch(operations);
        });
    };

    useEffect(() => {

        setChecked(inUse ?? false)
        if (visible && popupRef.current) {
            adjustTextColor(popupRef.current, renderer, x, y);
        }
    }, [visible, x, y, inUse]);
    if (!visible) return null;



    function getBackgroundColor(renderer, x, y) {
        const pixelBuffer = new Uint8Array(4);

        return `rgb(${pixelBuffer[0]}, ${pixelBuffer[1]}, ${pixelBuffer[2]})`;
    }

    function getLuminance(color) {
        const rgb = color.match(/\d+/g).map(Number);
        return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]);
    }

    function adjustTextColor(popupElement, renderer, x, y) {
        const bgColor = getBackgroundColor(renderer, x, y);
        const luminance = getLuminance(bgColor);

        if (luminance > 128) {
            // Light background -> Dark text
            popupElement.style.color = "black";
            popupElement.style.textShadow = "2px 2px 4px rgba(255, 255, 255, 0.8)";
        } else {
            // Dark background -> Light text
            popupElement.style.color = "rgb(255, 6, 6)";
            popupElement.style.textShadow = "rgb(127, 127, 128) 1px 0px 0px";
        }
    }




    const {position, description, content, angle} = assetObj;
    const name = description.join(' ') || content || 'No Description';

    const popupStyle = {
        position: "absolute",
        left: x+110,
        top: y,
        // background: "rgba(40,41,46,0.77)",
        // color: "rgb(156, 157, 162)",
        padding: "0.5rem",
        borderRadius: "8px",
        fontFamily: "Roboto Mono, Source Code Pro, Menlo, Courier, monospace",
        fontSize: "0.75rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        width: "auto", // Ensure it grows with content
        minWidth: "350px", // Prevent excessive shrinking
        // textShadow: "rgb(247, 248, 251) 0px 0px 3px, rgb(15, 14, 14) 0px 0px 1px"
    };

    const borderStyle = {
        position: "absolute",
        width: "50px",
        height: "2px",
        background: "rgb(255, 6, 6)",
        left: "-50px",
        top: "20px",
    };

    const circleStyle = {
        position: "absolute",
        width: "8px",
        height: "8px",
        background: "rgb(255, 6, 6)",
        borderRadius: "50%",
        left: "-56px",
        top: "17px",
    };

    const verticalLineStyle = {
        position: "absolute",
        width: "2px",
        height: "100%",
        background: "rgb(255, 6, 6)",
        left: "0",
        top: "0",
    };

// Horizontal line styles (left and right)
    const topLeftHorizontalLineStyle = {
        position: "absolute",
        width: "30px",
        height: "2px",
        background: "rgb(255, 6, 6)",
        left: "0", // Move to the left
        top: "0",
    };


    const bottomLeftHorizontalLineStyle = {
        position: "absolute",
        width: "30px",
        height: "2px",
        background: "rgb(255, 6, 6)",
        left: "0", // Move to the left
        bottom: "0",
    };




    const imageStyle = {
        width: "80px",
        height: "80px",
        objectFit: "cover",
        borderRadius: "8px",
        marginBottom: "10px",
    };

    const getImageSrc = () => {
        const { category_images, images } = assetObj;

        // if (projectId > 0) {
            if (images.length > 0) {
                return `${import.meta.env.VITE_FILE_URL}/${images[0].name}`;
            } else if (category_images.length > 0 && category_images[0].name !== "no_image.png") {
                return `${import.meta.env.VITE_FILE_URL}/${category_images[0].name}`;
            }
        // }
        return `${import.meta.env.VITE_FILE_URL}/no_image.png`; // Default fallback
    };


    return (
        <>
            <Toast ref={toast}/>
        <div ref={popupRef} style={popupStyle}>

                <div className={'flex gap-2'}>
                <img src={getImageSrc()} alt="Portrait" style={imageStyle} />
                {/* Vertical line */}
                <div style={verticalLineStyle}></div>

                {/* Top horizontal lines */}
                <div style={topLeftHorizontalLineStyle}></div>
                {/*<div style={topRightHorizontalLineStyle}></div>*/}

                {/* Bottom horizontal lines */}
                <div style={bottomLeftHorizontalLineStyle}></div>
                {/*<div style={bottomRightHorizontalLineStyle}></div>*/}
                <div style={circleStyle}></div>
                <div style={borderStyle}></div>
               <div className={'flex flex-col justify-center content-center items-center'}>
                <p style={{margin: "0 0 5px", fontSize: "1rem", fontWeight: "bolder"}}>{name}</p>
                <p style={{margin: "0 0 10px"}}>
                    #{instanceId}
                    ({((position.x) * 1).toFixed(1)},{((position.y) * 1).toFixed(1)},{((position.z) * 1).toFixed(1)})
                    {angle}&deg;
                </p>
                 <div className={"flex gap-1"}>
                     <Tooltip title="Edit 3D" key="tooltip-edit-3d">
                         <IconButton
                             aria-label="refresh"
                             onClick={() => setEditAssetId(instanceId)}
                             key="icon-button-refresh-3d"
                         >
                             <SwapVerticalCircleIcon fontSize="small" key="icon-refresh" />
                         </IconButton>
                     </Tooltip>

                     <Tooltip title= {`Set ${btnState}In Use`} key="tooltip-set-in-use">
                         <Switch
                             checked={checked}
                             onChange={handleChange}
                             {...label}
                             color="default"
                         />
                     </Tooltip>
               {/*    <Button*/}
               {/*        label="EDIT"*/}
               {/*        icon="pi pi-edit"*/}
               {/*        onClick={()=>setEditAssetId(instanceId)}*/}
               {/*        // variant="outlined"*/}
               {/*        style={{*/}
               {/*             background: "#bdbec6",*/}
               {/*            color: "hsl(230, 7%, 16.9%)",*/}
               {/*        }}*/}
               {/*        endIcon={<SwapVerticalCircleIcon />}>*/}
               {/*        EDIT*/}
               {/*</Button>*/}
                 </div>

               </div>
            </div>
        </div>
        </>
    );
}
