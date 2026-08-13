import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import {Save} from "@mui/icons-material";
import React, {useEffect, useRef} from "react";
import {socket} from "../../../socket";
import useGame from "../../../hooks/useGame";
import database from "../../../database";
import {Q} from "@nozbe/watermelondb";
import {Toast} from "primereact/toast";
import SaveSceneAsset from "./SaveSceneAsset";
import DB from "../../../threejs/hud/inventory/IndexedDbFactory";

export default function SaveData({scene, fieldsMap}) {
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    const selectedAsset = useGame((state) => state.selectedAsset);
    const imagesToSave = useGame((state) => state.imagesToSave)
    const setImagesToSave = useGame((state) => state.setImagesToSave)
    const htmlData = useGame((state) => state.htmlData) || ' ';
    const selectedGridIds = useGame((state) => state.selectedGridIds);
    const selectedTableIds = useGame((state) => state.selectedTableIds);
    const gridFieldId = useGame((state) => state.gridFieldId);
    const tableFieldId = useGame((state) => state.tableFieldId);
    const dragObjectProp = useGame((state) => state.dragObjectProp)
    const projectID = useGame((state) => state.projectID);
    const toast = useRef(null);
    const selectedFormTab = useGame((state) => state.selectedFormTab);
    const setFilesToSave = useGame((state) => state.setFilesToSave);
    const filesToSave = useGame((state) => state.filesToSave);
    const saveClick = useGame((state) => state.saveClick);
    const setSaveClick = useGame((state) => state.setSaveClick);
    const checkSaveClick = useGame((state) => state.checkSaveClick);
    const setCheckSaveClick = useGame((state) => state.setCheckSaveClick);
    const comboAssetID = useGame((state) => state.comboAssetID);
    const setComboAssetID = useGame((state) => state.setComboAssetID);
    // const selectedAssetName = useGame((state) => state.selectedAssetName);

    const assetName = useGame((state) => state.assetName);


    const saveFilesLocally = async (localFiles) => {

        if (!selectedAssetId) {
            console.error('Asset ID is not selected');
            return;
        }

        try {
            // Fetch the current asset record based on the instance_id (selectedAssetId)
            const asset = await database.collections.get('assets').query(
                Q.where('instance_id', selectedAssetId)
            ).fetch();

            if (!asset || asset.length === 0) {
                console.error('Asset not found');
                return;
            }

            let currentImages = asset[0]._raw.images;

            // Parse the images field (t's a string, so we need to parse it into an array)
            let imagesArray = currentImages ? JSON.parse(currentImages) : [];
            // Append the new localFiles array to the images array
            imagesArray = [...imagesArray, ...localFiles];

            // Update the images field in the database
            await database.write(async () => {
                await asset[0].update((record) => {
                    record.images = imagesArray;
                });
            });

            console.log('Files updated successfully in the asset record!');
        } catch (error) {
            console.error('Error updating the asset images:', error);
        }
    }

    const saveFiles = async () => {

        const localFiles = []
        if (selectedAssetId > 0 && imagesToSave.length > 0 && selectedFormTab===2) {
            uploadFiles(localFiles,imagesToSave,setImagesToSave)
        }
        if(selectedAssetId > 0 && filesToSave.length > 0 && selectedFormTab===3) {
            uploadFiles(localFiles,filesToSave,setFilesToSave)
        }
    }

    const  uploadFiles = async (localFiles,availableFiles,setFiles) => {
        const formData = new FormData();
        formData.append('asset_id', selectedAssetId);

        availableFiles.forEach((photoDetails, index) => {

            const {blob, capturedImage} = photoDetails
            localFiles.push({name: capturedImage})
            formData.append(`files`, blob, `${capturedImage}`);
        });

        const response = await fetch('https://bo.nts.nl/three-api/upload/', {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            console.log('Photos uploaded successfully!');

            if (toast.current) { // @ts-ignore
                toast.current.show({
                    severity: 'info',
                    summary: 'Data Saved!',
                    detail: `Form saved Successfully`,
                    life: 3000
                });
            }
            setFiles([])
            await saveFilesLocally(localFiles)
        } else {

            if (toast.current) {
                toast.current.show({
                    severity: 'error',
                    summary: 'Asset not saved!',
                    detail: response.statusText,
                    life: 30000
                });
            }
            //console.error('Failed to upload photos:', response.statusText);
        }


    }

    function transformFields(fields) {
        const transformedFields = {};

        for (const key in fields) {
            if (fields.hasOwnProperty(key)) {
                const field = fields[key];
                const {_raw} = field;

                if (_raw) {
                    transformedFields[key] = {
                        instance_id: _raw.instance_id,
                        name: _raw.name,
                        value: _raw.value,
                        value_id: _raw.value_id
                    };
                }
            }
        }

        return transformedFields;
    }

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


    const updateFields = async () => {
        const formData = new FormData();
        for (const i in fieldsMap) {
            const data = fieldsMap[i]
            formData.append(`form_${i}`, data.value);
        }

        const {assetObject: {categoryIndex}} = selectedAsset;
        const template_id = await  fetchCategoryId(categoryIndex);

        try {
            const response = await fetch(
                `${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=24&id=${selectedAssetId}&templ_id=${template_id}&cat_id=${categoryIndex}`, {
                    method: 'POST',
                    body: formData,
                });
            // Check if response is successful
            if (!response.ok) {
                showMessage('error', response.status, response.statusText)

            }

            const result = await response.json();

            if (result.data.success) {
                setComboAssetID(0)
              // setAssetName(null)
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
                showMessage('error', 'Error Saving', 'Failed to complete request.', error)
            }
        }


        if (selectedGridIds.length > 0 && gridFieldId) {
            updateJoinedFieldValue(template_id,selectedGridIds,gridFieldId)
        }
        if (selectedTableIds.length > 0 && tableFieldId) {
            updateJoinedFieldValue(template_id,selectedTableIds,tableFieldId)
        }

    }
    const updateJoinedFieldValue = async (template_id, nValues, fieldId) => {
        const formData = new FormData();
        formData.append(`field_id`, fieldId);
        formData.append(`nValue`, nValues);
        formData.append(`device_id`, selectedAssetId);
        formData.append(`templ_id`, template_id);

        try {
         await fetch(
                `${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=51`, {
                    method: 'POST',
                    body: formData,
                });

            // console.log(response)
        } catch (error) {
            console.error("Error deleting asset:", error);
        }
    }
    const updateInfo = async () => {
        if (htmlData == undefined || htmlData == 'undefined') {

            return null
        }

        const {assetObject: {categoryIndex}} = selectedAsset;
        const template_id = await fetchCategoryId(categoryIndex);
        const formData = new FormData();
        formData.append("content", htmlData);
        formData.append("id", selectedAssetId);
        formData.append("templ_id", template_id);
        try {
            const response = await fetch(`${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=38`, {
                method: 'POST',
                body: formData,
            });

            // Check if response is successful
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.data.response) {

                if (toast.current) {

                    showMessage('info', 'Info saved', result.data.text)
                }

            } else {
                if (toast.current) {
                    showMessage('error', 'Error Saving', result.data.text)
                }

            }
        } catch (error) {
            if (toast.current) {
                showMessage('error', 'Error Saving', 'Failed to complete request.',error)

            }

        }
    }


    const saveData = async () => {

        if(comboAssetID==0){
             SaveSceneAsset(selectedAssetId,fieldsMap,dragObjectProp,selectedAsset,scene)
        }


        DB(projectID,
            null,
            fieldsMap,
            null,
            null,
            null,
            null,
            null,
            selectedAssetId,
            comboAssetID ||null,
        assetName
        )

        selectedAsset.assetObject.fields = transformFields(selectedAsset.assetObject.fields)
        // Object.values(fieldsMap).forEach((field) => {
        //     const id = `${selectedAssetId}_${field.fieldId}`
        //     updateField(id, {value: field.value})
        // });
         socket.emit('createMessage', {map: fieldsMap, assetId: selectedAssetId, asset: selectedAsset});
        await saveFiles()
        await updateInfo()
       await updateFields()
    };

    useEffect(()=>{

        if(checkSaveClick){
            saveData()
        }

    },[saveClick])


    return (
        <>
            <Toast ref={toast}/>
            <Tooltip title="Save Data">
                <IconButton aria-label="save" onClick={()=>{
                    setCheckSaveClick(true)
                    setSaveClick(!saveClick)
                }}>
                    <Save fontSize="small"/>
                </IconButton>
            </Tooltip>
        </>
    )
}
