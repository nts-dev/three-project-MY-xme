import React, {useEffect, useState} from "react";
import {
    DialogContent,
    Grid,
    InputAdornment,
    MenuItem,
    TextField,
} from '@mui/material';
import {Accordion, AccordionTab} from 'primereact/accordion';
import useGame from "../../../hooks/useGame";
import {Dialog} from 'primereact/dialog';
import database from "../../../database";
import {Q} from "@nozbe/watermelondb";
// import ImageAlbum from "./ImageAlbum";
import {Calendar} from "primereact/calendar";
import {FloatLabel} from "primereact/floatlabel";
import {Visibility, VisibilityOff, BorderColor, CameraAlt, Refresh} from "@mui/icons-material";
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import FileUpload from "./FileUpload";
import SaveData from "./saveData";
import Info from "./Info";
import InfoIcon from '@mui/icons-material/Info';
import SwapVerticalCircleIcon from '@mui/icons-material/SwapVerticalCircle';
import RefreshAsset from "./RefreshAsset";


function WireInfo({scene}) {
    const [rooms, setRooms] = useState([]);
    const [selectedBId, setSelectedBId] = useState(null);
    const [branches, setBranches] = useState([]);
    const editPopup = useGame((state) => state.editPopup);
    const formValues = useGame((state) => state.formValues);
    const setFormValues = useGame((state) => state.setFormValues);
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    const editable = useGame((state) => state.editable);
    const setEditable = useGame((state) => state.setEditable);
    const projectID = useGame((state) => state.projectID);
    const setEditPopup = useGame((state) => state.setEditPopup);
    const selectedAsset = useGame((state) => state.selectedAsset);
    const formStatus = useGame((state) => state.formStatus);
    const [fieldsMap, setFieldsMap] = useState({});
    const [showPassword, setShowPassword] = useState(false);
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
    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const setEditAssetId = useGame((state) => state.setEditAssetId);
    const dragObjectProp = useGame((state) => state.dragObjectProp);
    const [formData, setFormData] = useState(formValues)
    const [refresh, setRefresh] = useState(false)

    const fetchAssetFields = async () => {

        if (!selectedAssetId) return;


        const fieldsCollection = database.collections.get('fields');

        const fields = await fieldsCollection.query(Q.where('instance_id', selectedAssetId), Q.sortBy('field_id', Q.asc)).fetch();

        const templateCollection = database.collections.get('templates');
        const template = await templateCollection
            .query(
                Q.and(
                    Q.where('category_id', selectedAsset.assetObject.categoryIndex.toString())
                )
            )
            .fetch();


        const optionsCollection = database.collections.get('options');

        const updatedArray = [];
        const assetNameObj = fields.find(item2 =>  (item2?._raw?.name === 'AssetName'))?._raw;

        for (const templateItem of template) {
            const match = fields.find(item2 =>  (item2._raw.field_id === templateItem._raw.field_id));

            if (match) {
                templateItem._raw.value = `${match._raw.value}`;
                templateItem._raw.instance_id = match._raw.instance_id;
                templateItem._raw.read_only = match._raw.read_only;
                templateItem._raw.visible = match._raw.visible;
                templateItem._raw.index_id = match._raw.index_id;
            }
            updatedArray.push(templateItem);
        }


        const fieldMap = updatedArray.reduce((map, item) => {

            if (item._raw.viewer == "1") {
                map[item._raw.field_id] = {
                    fieldId: item._raw.field_id,
                    parentId: item._raw.parent_id,
                    name: item._raw.name,
                    value: item._raw.value || "",
                    type: item._raw.type || null,
                    readOnly: item._raw.read_only || null,
                    visible: item._raw.visible || null,
                    indexId: item._raw.index_id || null,
                    childrencheck: {},
                    children: []
                };
            }

            return map;
        }, {});


        const result = {
            fields: {}
        };
        const name = 'Specifications'// selectedAsset.assetObject.description.length > 0 ? selectedAsset.assetObject.description.join(' ') :'Specifications'
        const headerField = {fieldId: 10, parentId: 0, name: name, value: '', type: 'label', childrencheck: {}, activeIndex: true}
        const id = {fieldId: 1, parentId: 0, name: 'ID', value: selectedAssetId, type: 'input', childrencheck: {}}
        const AssetName = {fieldId: assetNameObj?.field_id|| 2, parentId: 0, name: assetNameObj?.name||'AssetName' , value: assetNameObj?.value|| 'Not Defined', type: 'input', childrencheck: {}}
        headerField.children = [id,AssetName]
        result.fields[name] = headerField;

        for (const item of updatedArray) {
            const field = fieldMap[item._raw.field_id];
            if (field) {
                if (field.name === 'Branch') {
                    setSelectedBId(field.value);
                }
                if (field.name === "Description") {
                    field.value = selectedAsset.assetObject.description.join(' ')
                }

                if (field.parentId === 0) {
                    if (field.type == 'combo') {
                        const options = await optionsCollection.query(Q.where('field_id', parseInt(field.fieldId))).fetch();
                        field.children = options.map((option => ({id: option._raw.field_id, name: option._raw.name})))
                        field.value = field.value ? field.value : options[0]?._raw.name
                    }
                    // add specified headers
                    if (field.type === 'label') {

                        result.fields[field.name] = field;
                    }
                    //add default header specification
                    else if (!result.fields[name].childrencheck[field.fieldId] && field.value?.length > 0) {
                        result.fields[name].childrencheck[field.fieldId] = field.fieldId

                        result.fields[name].children.push(field)
                    }

                }
                // add children to parent
                else if (fieldMap[field.parentId]) {
                    if (field.type == 'combo') {
                        const options = await optionsCollection.query(Q.where('field_id', parseInt(field.fieldId))).fetch();
                        const optionData = options.map((option => ({id: option._raw.field_id, name: option._raw.name})))
                        field.children = optionData
                    }
                    if (!fieldMap[field.parentId].childrencheck[field.fieldId] && field.value.length > 0) {
                        fieldMap[field.parentId].childrencheck[field.fieldId] = field.fieldId
                        fieldMap[field.parentId].children.push(field);
                    }
                }

            }
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

        if (projectID === 0 || selectedAssetId === 0 || !editPopup) return;
        fetchAssetFields();

        const assetMap = findAssetMap()
        setAssetMap(assetMap)

    }, [formStatus, selectedAssetId, editPopup]);

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
    const handleInputChange = (event, fieldId) => {
        const {value} = event.target;
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
    const parseDate = (dateString) => {
        const [day, month, year] = dateString.split('-');
        return new Date(`${year}-${month}-${day}`);
    };
    const parseDateIn = (dateString) => {
        const [year, month, day] = dateString.split('-');
        return new Date(`${year}-${month}-${day}`);
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


    const renderField = (field, index) => {
        if (field == null || field.name == null) {
            return;
        }

        if (field.name === "Branch") {
            return (
                <Grid item key={`${field.fieldId}_${index}`} xs={12}>
                    <TextField
                        key={`${field.fieldId}_${index}_textField`} xs={12}
                        fullWidth
                        variant="outlined"
                        select
                        label={field.name}
                        InputProps={{
                            readOnly: !editable,
                        }}
                        value={field.value}
                        onChange={(e) => handleInputChange(e, field.fieldId)}
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                            '& .MuiInputBase-root': { fontSize: '0.7rem' },
                            marginBottom: '0',
                        }}
                    >
                        {branches.map((option) => (
                            <MenuItem
                                sx={{ '& .MuiMenuItem-root': { fontSize: '0.7rem' } }}
                                key={`${field.fieldId}_${index}_${option.value}`}
                                value={option.value}
                            >
                                {option.label}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>
            );
        }

        if (field.name === "Room") {
            return (
                <Grid item key={`${field.fieldId}_${index}`} xs={12}>
                    <TextField
                        key={`${field.fieldId}_${index}_textField`}
                        fullWidth
                        variant="outlined"
                        select
                        label={field.name}
                        InputProps={{
                            readOnly: !editable,
                        }}
                        value={field.value}
                        onChange={(e) => handleInputChange(e, field.fieldId)}
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                            '& .MuiInputBase-root': { fontSize: '0.7rem' },
                            marginBottom: '0',
                        }}
                    >
                        {rooms.map((option, optionIndex) => (
                            <MenuItem
                                sx={{ '& .MuiMenuItem-root': { fontSize: '0.7rem' } }}
                                key={`${field.fieldId}_${index}_${option.value}_${optionIndex}`}
                                value={option.value}
                            >
                                {option.label}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>
            );
        }

        if (field.name === "Password") {
            return (
                <TextField
                    key={`${field.fieldId}_${index}_textField`}
                    fullWidth
                    variant="outlined"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={field.value}
                    name={`${field.fieldId}_${index}`}
                    onChange={(e) => handleInputChange(e, field.fieldId)}
                    margin="dense"
                    disabled={!editable}
                    sx={{
                        '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                        '& .MuiInputBase-root': { fontSize: '0.7rem' },
                        marginBottom: '0',
                    }}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label="toggle password visibility"
                                    onClick={handleClickShowPassword}
                                    edge="end"
                                    key={`password-icon_${index}`}
                                >
                                    {showPassword ? (
                                        <Visibility sx={{ fontSize: 15 }} />
                                    ) : (
                                        <VisibilityOff sx={{ fontSize: 15 }} />
                                    )}
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            );
        }

        if (field.name === "Day of birth") {
            return (
                <Grid
                    item
                    xs={12}
                    key={`${field.fieldId}_${index}`}
                    sx={{
                        '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                        '& .MuiInputBase-root': { fontSize: '0.7rem' },
                        marginBottom: '0',
                    }}
                >
                    <FloatLabel>
                        <Calendar
                            value={field.value ? parseDate(field.value) : null}
                            onChange={(e) => handleInputChange(e, field.fieldId)}
                            showIcon
                            dateFormat="dd-mm-yy"
                            disabled={!editable}
                            key={`calendar_${index}`}
                        />
                        <label htmlFor="birth_date">Birth Date</label>
                    </FloatLabel>
                </Grid>
            );
        }

        if (field.indexId) {
            return (
                <TextField
                    key={`${field.fieldId}_${index}_textField`}
                    fullWidth
                    variant="outlined"
                    label={field.name}
                    type={"text"}
                    value={field.value}
                    name={`${field.fieldId}_${index}`}
                    onChange={(e) => handleInputChange(e, field.fieldId)}
                    margin="dense"
                    disabled={true}
                    sx={{
                        '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                        '& .MuiInputBase-root': { fontSize: '0.7rem' },
                        marginBottom: '0',
                    }}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    aria-label="toggle info"
                                    onClick={() => handleInfoClicked(field.fieldId, field.indexId, field.value)}
                                    edge="end"
                                    key={`info-icon_${index}`}
                                >
                                    <InfoIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            );
        }

        if (field.name === "Date In") {
            return (
                <Grid
                    item
                    xs={12}
                    key={`${field.fieldId}_${index}`}
                    sx={{
                        '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                        '& .MuiInputBase-root': { fontSize: '0.7rem' },
                        marginBottom: '0',
                    }}
                >
                    <FloatLabel>
                        <Calendar
                            value={field.value ? parseDateIn(field.value) : null}
                            onChange={(e) => handleInputChange(e, field.fieldId)}
                            showIcon
                            dateFormat="yy-mm-dd"
                            disabled={!editable}
                            key={`calendar-date-in_${index}`}
                        />
                        <label htmlFor="date_in">{field.name}</label>
                    </FloatLabel>
                </Grid>
            );
        }

        if (field.type === "combo" && field.name !== "Room" && field.name !== "Branch") {
            return (
                <Grid item key={`${field.fieldId}_${index}`} xs={12}>
                    <TextField
                        key={`${field.fieldId}_${index}_textField`}
                        fullWidth
                        variant="outlined"
                        select
                        label={field.name}
                        value={field.value}
                        onChange={(e) => handleInputChange(e, field.fieldId)}
                        InputProps={{
                            readOnly: !editable,
                        }}
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                            '& .MuiInputBase-root': { fontSize: '0.7rem' },
                            marginBottom: '0',
                        }}
                    >
                        {field.children.map((option, childIndex) => (
                            <MenuItem
                                sx={{ '& .MuiMenuItem-root': { fontSize: '0.7rem' } }}
                                key={`${field.fieldId}_${index}_${option.id}_${childIndex}`}
                                value={option.name}
                            >
                                {option.name}
                            </MenuItem>
                        ))}
                    </TextField>
                </Grid>
            );
        }

        if (field.children && field.children.length > 0) {
            return (
                // <Accordion key={`${field.fieldId}_${index}`} style={{ color: 'white' }} activeIndex={field.activeIndex??0}>
                    <AccordionTab key={`${field.fieldId}_${index}`} header={<span style={{ fontSize: '0.75rem', color: 'white' }}>
                        {field.name}</span>}>
                        {field.children.map((childField, childIndex) => renderField(childField, `${index}_${childIndex}`))}
                    </AccordionTab>
                // </Accordion>
            );
        }

        if (field.type !== "label") {
            return (
                <Grid item key={`${index}_${field.name}`} xs={12}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label={field.name}
                        value={field.value || ""}
                        disabled={field.name=='ID' || field.name=='AssetName' || field.name=='Description'? true : !editable}
                        onChange={(e) => handleInputChange(e, field.fieldId)}
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                            '& .MuiInputBase-root': { fontSize: '0.7rem' },
                            marginBottom: '0',
                        }}
                    />
                </Grid>
            );
        }
    };

    const customHeader = (
        <div className="flex align-items-center flex-column">
               <span>
                    Information
                </span>
            <span style={{fontSize: '0.65rem', padding: '0.5rem 0 0.5rem 0'}}>
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
                            {/* Adding keys to dynamically rendered fields */}
                    <Accordion key={`${selectedAssetId}_Acord`} style={{ color: 'white' }} activeIndex={0} >
                            {Object.values(formData).map((field, index) =>
                                renderField(field, `${index}_header`) // Ensure renderField handles keys internally
                            )}
                    </Accordion>

                            <Info key="info-component" />

                            <Grid container justifyContent="center" sx={{ paddingTop: 1 }} key="grid-center-container">
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
                                    <Tooltip title="Take photo/video" key="tooltip-camera">
                                        <IconButton
                                            aria-label="camera"
                                            onClick={() => setIsCamera(true)}
                                            key="icon-button-camera"
                                        >
                                            <CameraAlt fontSize="small" key="icon-camera" />
                                        </IconButton>
                                    </Tooltip>
                                    <FileUpload key="file-upload-component" />

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
                                            <SwapVerticalCircleIcon fontSize="small" key="icon-refresh" />
                                        </IconButton>
                                    </Tooltip>

                                </Stack>
                            </Grid>

                {/*<ImageAlbum key="image-album" />*/}
            </DialogContent>

        </Dialog>
    );
}


export default WireInfo;
