import React, {useEffect, useState} from "react";
import {
    DialogContent,
    Grid,
} from '@mui/material';
import useGame from "../../../hooks/useGame";
import {Dialog} from 'primereact/dialog';
import database from "../../../database";
import {Q} from "@nozbe/watermelondb";
import RefreshAsset from "./RefreshAsset";
import FormWithTWeakPane from "./FormWithTweakpane";
import SpecsButtons from "./spec/SpecsButtons";
import FilesButtons from "./files/FilesButtons";
import PlanningButtons from "./planning/PlanningButtons";
import MediaButtons from "./media/MediaButtons";
import InfoButtons from "./info/InfoButtons";
import {sceneAssets} from "../../../threejs/player/puzzle/character/Constants.jsx";


function WireInfo({scene}) {
    const [rooms, setRooms] = useState([]);
    const [selectedBId, setSelectedBId] = useState(null);
    const [branches, setBranches] = useState([]);
    const editPopup = useGame((state) => state.editPopup);
    const formValues = useGame((state) => state.formValues);
    const setFormValues = useGame((state) => state.setFormValues);
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    const setSelectedAssetId = useGame((state) => state.setSelectedAssetId);
    const editable = useGame((state) => state.editable);
    const setEditable = useGame((state) => state.setEditable);
    const projectID = useGame((state) => state.projectID);
    const setEditPopup = useGame((state) => state.setEditPopup);
    const selectedAsset = useGame((state) => state.selectedAsset);
    const formStatus = useGame((state) => state.formStatus);
    const [fieldsMap, setFieldsMap] = useState({});
    const setIsCamera = useGame((state) => state.setIsCamera);
    const setShowDetails = useGame((state) => state.setShowDetails);
    const setAssetIndexArray = useGame((state) => state.setAssetIndexArray);
    const setIndexId = useGame((state) => state.setIndexId);
    const setFieldId = useGame((state) => state.setFieldId);
    const setSelectedGridIds = useGame((state) => state.setSelectedGridIds);
    const setSelectedTableIds = useGame((state) => state.setSelectedGridIds);
    const setGridFieldId = useGame((state) => state.setGridFieldId);
    const setTableFieldId = useGame((state) => state.setTableFieldId);
    const [assetMap, setAssetMap] = useState('')
    const rawCategories = useGame((state) => state.rawCategories);
    const setEditAssetId = useGame((state) => state.setEditAssetId);
    const dragObjectProp = useGame((state) => state.dragObjectProp);
    const selectedFormTab = useGame((state) => state.selectedFormTab);
    const setShowQR = useGame((state) => state.setShowQR);
    const scan = useGame((state) => state.scan);
    const setAssetSettings = useGame((state) => state.setAssetSettings);
    const setRotationValue =      useGame((state) => state.setRotationValue);
    // const[showQR, setShowQR] = useState(false)
    const [formData, setFormData] = useState(formValues)
    const [refresh, setRefresh] = useState(false)
      const [qrData, setQrData] = useState()



    function parseConfig(input) {
        const lines = input.split('\n');

        const result = {};

        for (const line of lines) {
            const [categoryCode, rest] = line.split('|');

            const [name, meta] = rest.split('=');
            const [defaultValueStr, rangeStr, stepStr] = meta.split(';');
            const [startStr, endStr] = rangeStr.split('-');

            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            const step = parseInt(stepStr, 10);
            const defaultValue = parseFloat(defaultValueStr);

            const values = [];
            for (let i = start; i <= end; i += step) {
                values.push(i);
            }

            // Initialize category if not yet in result
            if (!result[categoryCode]) {
                result[categoryCode] = {
                    category: categoryCode,
                    variables: []
                };
            }

            result[categoryCode].variables.push({
                name: name.trim(),
                default: defaultValue,
                range: {
                    start,
                    end,
                    step,
                    values
                }
            });
        }

        return Object.values(result);
    }

    const extractAngle = (angle)=> {
        try {
            const obj = JSON.parse(angle);
            if (typeof obj === 'object' && obj !== null) {
                return obj; // Return parsed object if valid
            }
        } catch (error) {
            console.log(error)
            // If parsing fails, return the original string
        }
        return {x: 0,y: angle || 0, z: 0 }; // Return original string if it's not a valid object
    }
    const fetchAssetFields = async () => {

        if (!selectedAssetId) return;

        const categoryIndex = sceneAssets[selectedAssetId]?.categoryIndex;
    
        if(!categoryIndex) return

        const fieldsCollection = database.collections.get('fields');
        const fields = await fieldsCollection.query(Q.where('instance_id', selectedAssetId), Q.sortBy('field_id', Q.asc)).fetch();
        const templateCollection = database.collections.get('templates');
        const template = await templateCollection
            .query(
                Q.and(
                    Q.where('category_id', categoryIndex?.toString())
                )
            )
            .fetch();


        const optionsCollection = database.collections.get('options');
        setAssetSettings({})
        const updatedArray = [];
        const assetNameObj = fields.find(item2 =>  (item2?._raw?.name === 'AssetName'))?._raw;
        const settingsString = fields.find(item2 =>  (item2?._raw?.name === 'Settings'))?._raw;
        const templateString = template.find(item2 =>  (item2?._raw?.name === 'Settings'))?._raw;


                if(settingsString && settingsString.value ){
                    const settingObj = parseConfig(settingsString.value)

                    if(settingObj[0]?.category=='EN'){
                        setAssetSettings({
                            field_id: settingsString.field_id,
                            dbFieldId: templateString.field_id,
                            id:selectedAssetId,
                            settingObj: settingObj[0]
                        })
                    }



                // else if(defaultSettingsString && defaultSettingsString.value){
                //     setAssetSettings({
                //         field_id: settingsFieldId.field_id,
                //         id:selectedAssetId,
                //         settingObj: parseConfig(defaultSettingsString.value)[0]
                //     })
                //
                // }
            }

        const qrDataList = []
        for (const templateItem of template) {
            const match = fields.find(item2 =>  (item2._raw.field_id === templateItem._raw.field_id));
            templateItem._raw.value = null

            if (match ) {

                match._raw.value = match._raw.value.replace('[]undefined', 'Not connected');
                templateItem._raw.value = `${match._raw.value}`;
                templateItem._raw.instance_id = match._raw.instance_id;
                templateItem._raw.read_only = match._raw.read_only;
                templateItem._raw.visible = match._raw.visible;
                templateItem._raw.index_id = match._raw.index_id;

                if(match._raw.name?.includes('NTS SKU') || match._raw.name?.includes('Model')|| match._raw.name?.includes('LocationID')) {
                    qrDataList.push({
                        fieldId: match._raw.field_id,
                        value: match._raw.value,
                        name: match._raw.name
                    })
                }else if(match._raw.name?.includes('Angle')) {
                    const angle = extractAngle(match._raw.value || 0)
                    setRotationValue(angle.y.toString())
                }
                // else if(match._raw.name?.includes('Settings')) {

                // }


            }
                 updatedArray.push(templateItem);


        }
        setQrData(qrDataList)

        const fieldMap = updatedArray.reduce((map, item) => {

            if (item._raw.viewer == "1" ) {

                map[item._raw.field_id] = {
                    fieldId: item._raw.field_id,
                    parentId: item._raw.parent_id,
                    name: item._raw.name,
                    value: item._raw.value || "",
                    type: item._raw.type || null,
                    readOnly: item._raw.read_only || null,
                    visible: item._raw.visible || null,
                    indexId: item._raw.index_id || null,
                    isDescription: item._raw.description,
                    childrencheck: {},
                    children: []
                };
            }

            return map;
        }, {});
        //constructing description field
        const description = []
        for (const i in fieldMap) {
            const item = fieldMap[i]
            if(item.isDescription=='1'){
                description.push(item.value)
            }

        }


        const result = {
            fields: {}
        };
        const rawFieldMap = updatedArray.reduce((map, item) => {
            map[item._raw.field_id] = {
                fieldId: item._raw.field_id,
                parentId: item._raw.parent_id,
                name: item._raw.name,
                value: item._raw.value || "",
                type: item._raw.type || null,
                readOnly: item._raw.read_only || null,
                visible: item._raw.visible || null,
                indexId: item._raw.index_id || null,
                isDescription: item._raw.description,
                childrencheck: {},
                children: []
            };
            return map;
        }, {});
        const fallbackGroupName = 'Specifications'
        const headerField = {fieldId: 10, parentId: 0, name: fallbackGroupName, value: '', type: 'label', childrencheck: {}, activeIndex: true}
        const id = {fieldId: 1, parentId: 0, name: 'ID', value: selectedAssetId, type: 'input', childrencheck: {}}
        const AssetName = {fieldId: assetNameObj?.field_id|| 2, parentId: 0, name: assetNameObj?.name||'AssetName' , value: assetNameObj?.value|| 'Not Defined', type: 'input', childrencheck: {}}
        headerField.children = [id,AssetName]

        const ensureGroup = (sourceField = headerField) => {
            const groupName = sourceField?.name || fallbackGroupName;
            if (!result.fields[groupName]) {
                result.fields[groupName] = {
                    ...sourceField,
                    value: '',
                    type: 'label',
                    childrencheck: {},
                    children: []
                };
            }
            return result.fields[groupName];
        };

        const addFieldToGroup = (group, field) => {
            if (!group || !field || group.childrencheck[field.fieldId]) return;
            group.childrencheck[field.fieldId] = field.fieldId;
            group.children.push(field);
        };

        const findParentLabel = (field) => {
            let parent = fieldMap[field.parentId] || rawFieldMap[field.parentId];
            const visited = new Set();

            while (parent && !visited.has(parent.fieldId)) {
                visited.add(parent.fieldId);
                if (parent.type === 'label') {
                    return parent;
                }
                parent = fieldMap[parent.parentId] || rawFieldMap[parent.parentId];
            }

            return null;
        };

        const fallbackGroup = ensureGroup(headerField);
        addFieldToGroup(fallbackGroup, id);
        addFieldToGroup(fallbackGroup, AssetName);

        for (const item of updatedArray) {
            const field = fieldMap[item._raw.field_id];

            if (field) {
                if (field.name === 'Branch') {
                    setSelectedBId(field.value);
                }
                if (field.name === "Description") {
                    field.value = description.join(' ')
                }

                if (field.parentId === 0) {
                    if (field.type == 'combo') {
                        const options = await optionsCollection.query(Q.where('field_id', parseInt(field.fieldId))).fetch();
                        field.children = options.map((option => ({id: option._raw.field_id, name: option._raw.name})))
                        field.value = field.value ? field.value : options[0]?._raw.name
                    }

                    // add specified headers
                    if (field.type === 'label') {
                        ensureGroup(field);
                    }
                    //add default header specification
                    else if (field.value?.length > 0) {
                        addFieldToGroup(fallbackGroup, field)
                    }

                }
                // add children to parent
                else {
                    if (field.type == 'combo') {
                        const options = await optionsCollection.query(Q.where('field_id', parseInt(field.fieldId))).fetch();
                        const optionData = options.map((option => ({id: option._raw.field_id, name: option._raw.name})))
                        field.children = optionData
                    }
                    if (fieldMap[field.parentId] && !fieldMap[field.parentId].childrencheck[field.fieldId] && field.value.length > 0) {
                        fieldMap[field.parentId].childrencheck[field.fieldId] = field.fieldId
                        fieldMap[field.parentId].children.push(field);
                    }

                    const parentLabel = findParentLabel(field);
                    if (parentLabel && field.value.length > 0) {
                        addFieldToGroup(ensureGroup(parentLabel), field);
                    }
                }

            }
        }

        if (fallbackGroup.children.length <= 2 && Object.keys(result.fields).length > 1) {
            delete result.fields[fallbackGroupName];
        }

        setFieldsMap(fieldMap);

        setFormValues(result.fields)

    };
    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const branchCollection = database.collections.get('branches');
                const branches = await branchCollection.query().fetch();
                const branchList = branches.map((branch) => ({
                    label: branch.name,
                    value: branch.branchId,
                }));
                setBranches(branchList);
            } catch (error) {
                console.error('Failed to fetch data from IndexedDB:', error);
            }
        };
        fetchBranches();
    }, [projectID]);

    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const roomsCollection = database.collections.get('rooms');
                const rooms = await roomsCollection.query(Q.where('parent', parseInt(selectedBId))).fetch();
                const roomList = rooms.map((room) => ({
                    label: room.name,
                    value: room.roomId,
                }));

                setRooms(roomList);
            } catch (error) {
                console.error('Failed to fetch data from IndexedDB:', error);
            }
        };
        if (selectedBId) fetchRooms();


    }, [selectedBId, projectID]);

    useEffect(() => {

        setFieldsMap({});
        setFormValues({});
        setSelectedGridIds('')
        setSelectedTableIds('')
        setGridFieldId(0)
        setTableFieldId(0)
        setShowQR(false)
          
        if (projectID === 0 || selectedAssetId === 0 || !editPopup ){

            return;
        }
        fetchAssetFields();


        const assetMap = findAssetMap()

        setAssetMap(assetMap)

    }, [formStatus, selectedAssetId, editPopup,selectedBId,scan]);

    useEffect(() => {
        setFormData(formValues)
    }, [formValues,refresh]);

    const findAssetMap = () => {
        const categoryIndex = selectedAsset?.assetObject?.categoryIndex
       
        if (categoryIndex) {
            for (const category of rawCategories) {
                for (const subCategory of category.children) {

                    if (subCategory.id == Number(categoryIndex)) {
                        return `${category.name} / ${subCategory.name}`
                    }
                }
            }
        }
    }

    const updateFormValue = (formValues, fieldId, newValue) => {
        // Find the field by its fieldId in formValues
        const result = findFieldById(formValues, fieldId);

        if (result) {
            // Update the field's value in formValues
            result.value = newValue;  // Update the field value
            return {...formValues}; // Return the updated formValues
        }
        return formValues; // Return original formValues if no field was found
    };
    const handleInputChange = (value, fieldId) => {

        const newFormValues = updateFormValue(formValues, fieldId, value)
        setFormValues(newFormValues)
    };

// Helper function to find and update the field by its fieldId
    const findFieldById = (fields, fieldId) => {

        for (let key in fields) {

            if (fields[key] && fields[key].fieldId === fieldId) {
                return fields[key];
            }

            if (fields[key] && fields[key].children && fields[key].children.length > 0) {
                const childField = findFieldById(fields[key].children, fieldId);
                if (childField) {
                    return childField;
                }

            }
        }
        return null;
    };

    const extractNumbers = (str) => {
        // Match all numbers inside square brackets
        const numbers = str.match(/\[(\d+)\]/g);

        // If there are no matches, return an empty array
        if (!numbers) return [];

        // Extract the numbers from the matches and return them as an array of integers
        return numbers.map(num => parseInt(num.replace(/\[|\]/g, ''), 10));
    };
    const handleInfoClicked = (fieldId, indexId, assetValue) => {
        const assetNumber = extractNumbers(assetValue)
        setAssetIndexArray(assetNumber)
        setShowDetails(true)
        setIndexId(indexId)
        setFieldId(fieldId)

    };
    const refreshAssetData = async () =>{

       const formData = await RefreshAsset(selectedAssetId,selectedAsset,dragObjectProp, scene,projectID,selectedAsset.assetObject.categoryIndex, formValues)
        setFormData(formData)
        setRefresh(!refresh)

    }

    const customHeader = (
        <div className="flex align-items-center flex-column popup-header">
               <span>
                    Information
                </span>
            <span >
                    {`[${assetMap}]`}
                </span>
        </div>
    );

    return (
        <Dialog header={customHeader} visible={editPopup} modal={false} position='top-right'
                onHide={() => {
                    if (!editPopup) return;
                    setEditPopup(false);
                    setFieldsMap({});
                    setFormValues({})
                }} draggable={false} resizable={false} className="popup"
        >
                <DialogContent key={`${selectedAssetId}_dialog`}>

                    {selectedFormTab === 0 && <SpecsButtons
                                     selectedAssetId={selectedAssetId}
                                     setEditable={setEditable}
                                     refresh={refreshAssetData}
                                     selectedAsset={selectedAsset}
                                     setFormValues={setFormValues}
                                     refreshAssetData={refreshAssetData}
                                     scene={scene}
                                     fieldsMap={fieldsMap}
                                     setFieldsMap={setFieldsMap}
                                     setEditAssetId={setEditAssetId}
                                     editPopup={editPopup}
                                     setEditPopup={setEditPopup}
                                     setIsCamera={setIsCamera}
                                     categoryIndex={selectedAsset?.assetObject?.categoryIndex}

                       />}
                    {selectedFormTab===3 && <FilesButtons key="files-btn" scene={scene} fieldsMap={fieldsMap}/>}
                    {selectedFormTab===4 && <PlanningButtons key="planning-btn" />}
                    {selectedFormTab===2 && <MediaButtons key="media-btn" setIsCamera={setIsCamera} scene={scene} fieldsMap={fieldsMap} refreshAssetData={refreshAssetData}/>}

                    {selectedFormTab===1 && <InfoButtons setEditable={setEditable} refreshAssetData={refreshAssetData} scene={scene} fieldsMap={fieldsMap}/> }
                    <FormWithTWeakPane
                        formData={formData}
                        branches={branches}
                        rooms={rooms}
                        editable={editable}
                        refresh={refresh}
                        handleInputChange={handleInputChange}
                        handleInfoClicked={handleInfoClicked}
                        selectedAssetId={selectedAssetId}
                        selectedAsset={selectedAsset}
                        scene={scene}
                        qrData={qrData}
                        setSelectedAssetId={setSelectedAssetId}
                    />

                    {/*<Info key="info-component" />*/}

                {/*<ImageAlbum key="image-album" />*/}
            </DialogContent>

        </Dialog>
    );
}


export default WireInfo;
