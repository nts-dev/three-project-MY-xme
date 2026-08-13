import React, { useEffect, useState } from "react";
import useGame from "../../../hooks/useGame";
import {Dialog} from 'primereact/dialog';
import { TextField, MenuItem, Grid, Button, Typography,  DialogContent } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { IconButton, InputAdornment } from '@mui/material';
import { Q } from "@nozbe/watermelondb";
import { Calendar } from "primereact/calendar";
import database from "../../../database";
import { socket } from "../../../socket";
import UpdateAsset from "../../../threejs/scene/UpdateAsset";
// import ImageAlbum from "../form/ImageAlbum";

export default function NewPopup() {
    const [rooms, setRooms] = useState<any[]>([]);
    const [selectedBId, setSelectedBId] = useState<any>(null);
    const [branches, setBranches] = useState<any[]>([]);
    const editPopup = useGame((state: any) => state.editPopup);
    const selectedAssetId = useGame((state: any) => state.selectedAssetId);
    const editable = useGame((state: any) => state.editable);
    const setEditable = useGame((state: any) => state.setEditable);
    const projectID = useGame((state: any) => state.projectID);
    const setEditPopup = useGame((state: any) => state.setEditPopup);
    const [fields, setFields] = useState<any[]>([]);
    const selectedAsset = useGame((state: any) => state.selectedAsset);
    const formStatus = useGame((state: any) => state.formStatus);
    const [fieldsMap, setFieldsMap] = useState<any>({});
    const [date, setDate] = useState<any>(null);

    const [showPassword, setShowPassword] = useState(false);

    const handleClickShowPassword = () => setShowPassword((show) => !show);


    const updateField = async (id: string, data: any) => {
        const fieldsCollection = database.collections.get('fields');
        const fields = await fieldsCollection.query(Q.where('value_id', id)).fetch();

        if (fields.length === 0) {
            console.log(`No field found with id: ${id}`);
            return;
        }

        await database.write(async () => {
            fields.forEach(field => {
                field.update((record:any) => {
                    record.value = data.value;
                });
            });
        });
    }
    function transformFields(fields: any) {
        const transformedFields: any = {};

        for (const key in fields) {
            if (fields.hasOwnProperty(key)) {
                const field = fields[key];
                const { _raw} = field;

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

    const saveData = async () => {
        UpdateAsset(fieldsMap, selectedAssetId, selectedAsset);

        Object.values(fieldsMap).forEach((field: any, index) => {
            updateField(field.id, {value: field.value})
        });
        selectedAsset.assetObject.fields = transformFields(selectedAsset.assetObject.fields)

        socket.emit('createMessage', {map: fieldsMap, assetId: selectedAssetId, asset: selectedAsset});
    };

    useEffect(() => {
        if (!editPopup || selectedAssetId === 0) return;
        fetchAssetFields();
    }, [selectedAssetId, editPopup, formStatus]);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const branchCollection = database.collections.get('branches');
                const branches = await branchCollection.query().fetch();
                const branchList = branches.map((branch: any) => ({
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
                const roomList = rooms.map((room: any) => ({
                    label: room.name,
                    value: room.roomId,
                }));
                setRooms(roomList);
            } catch (error) {
                console.error('Failed to fetch data from IndexedDB:', error);
            }
        };
        if (selectedBId) fetchRooms();
    }, [selectedBId]);

    const makeFieldsMap = (fields: any) => {
        let brId = 0;
        const fieldMap = fields.reduce((map: any, field: any) => {
            map[field.valueId] = {
                id: field.valueId,
                instanceId: field.instanceId,
                fieldId: field.fieldId,
                name: field.name,
                value: field.value,
            };
            if (field.name === 'Branch') {
                brId = field.value;
            }
            return map;
        }, {});

        setSelectedBId(brId);
        setFieldsMap(fieldMap);
    };

    const fetchAssetFields = async () => {
        if (selectedAssetId === undefined) return;

        const fieldsCollection = database.collections.get('fields');
        const fields = await fieldsCollection.query(Q.where('instance_id', selectedAssetId), Q.sortBy('field_id', Q.asc)).fetch();

        const templateCollection = database.collections.get('templates');
        const template = await templateCollection.query(Q.where('category_id', selectedAsset.assetObject.categoryIndex.toString())).fetch();
        // console.log(selectedAsset.assetObject.categoryIndex)

        const updatedArray = template
            .map((item1: any) => {
                // Find the corresponding object in array2 where field_id matches
                const match: any = fields.find((item2: any) => item2._raw.field_id === item1._raw.field_id);

                if (match) {
                    // Add the value and instance_id properties to the first array object
                    item1._raw.value = match._raw.value;
                    item1._raw.instance_id = match._raw.instance_id;
                }else{
                   //
                }

                return item1;
            })
            // Filter out any objects where viewer is "0"
            .filter(item => item._raw.viewer !== "0");

        console.log(updatedArray)
        // console.log(fields)
        setFields(fields);
        makeFieldsMap(fields);
    };

    const handleInputChange = (key: any, value: any) => {

        setFieldsMap((prevFieldsMap: any) => ({
            ...prevFieldsMap,
            [key]: {
                ...prevFieldsMap[key],
                value: value,
            },
        }));

    };
    function convertStringToDate(dateString: string): Date {

        const date = new Date(dateString);

        // Check if the date is valid
        // @ts-ignore
        if (isNaN(date)) {
            throw new Error("Invalid date string");
        }
        return date;
    }

    // @ts-ignore
    return (
        <div>
            <Dialog header="Asset Details" visible={editPopup} modal={false} position='top-right'
                    onHide={() => {
                        if (!editPopup) return;
                        setEditPopup(false);
                    }} draggable={false} resizable={false}  className="popup"
           >
                <DialogContent>
                    <Grid container>
                        <Grid item xs={true}>
                            <Grid container direction="row" sx={{ padding: 2 }}>

                                <Grid item xs={12} key='name' sx={{
                                    '& .MuiInputLabel-root': { fontSize: '0.7rem' }, // Adjust label font size
                                    '& .MuiInputBase-root': { fontSize: '0.7rem' },  // Adjust input font size
                                    marginBottom: '0',  // Adjust spacing beneath fields
                                }}>
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        label="ID"
                                        value={selectedAsset && selectedAsset.assetId ? selectedAsset.assetId : ''}
                                        size="small"
                                        name='name'
                                        // onChange={(e) => handleInputChange(key, e.target.value)}
                                        margin="dense"
                                        disabled={true}
                                    />
                                </Grid>

                                <Grid item xs={12} key='name' sx={{
                                    '& .MuiInputLabel-root': { fontSize: '0.7rem' }, // Adjust label font size
                                    '& .MuiInputBase-root': { fontSize: '0.7rem' },  // Adjust input font size
                                    marginBottom: '0',  // Adjust spacing beneath fields
                                }}>
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        label="Asset Name"
                                        value={selectedAsset && selectedAsset.fileName ? selectedAsset.fileName.split('.')[0] : ''}
                                        size="small"
                                        name='name'
                                        // onChange={(e) => handleInputChange(key, e.target.value)}
                                        margin="dense"
                                        disabled={true}
                                    />
                                </Grid>


                                    {Object.entries(fieldsMap).map(([key, field]: any) => {
                                            if (field.name === "Branch") {
                                                return (
                                                    <Grid item xs={12} key={key} sx={{
                                                        '& .MuiInputLabel-root': { fontSize: '0.7rem' }, // Adjust label font size
                                                        '& .MuiInputBase-root': { fontSize: '0.7rem' },  // Adjust input font size
                                                        marginBottom: '0',  // Adjust spacing beneath fields
                                                    }}>
                                                        <TextField
                                                            label="Branch"
                                                            fullWidth
                                                            select
                                                            value={field.value}
                                                            size="small"
                                                            onChange={(e) => handleInputChange(key, e.target.value)}
                                                            InputProps={{
                                                                readOnly: !editable,
                                                            }}
                                                            // disabled={!editable}
                                                        >
                                                            {branches.map((option: any) => (
                                                                <MenuItem key={option.value} value={option.value}>
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
                                                    fullWidth
                                                    variant="outlined"
                                                    label="Password"
                                                    type={showPassword ? "text" : "password"}
                                                    value={field.value}
                                                    name={key}
                                                    onChange={(e) => handleInputChange(key, e.target.value)}
                                                    margin="dense"
                                                    disabled={!editable}
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    aria-label="toggle password visibility"
                                                                    onClick={handleClickShowPassword}
                                                                    edge="end"
                                                                >
                                                                    {showPassword ? <Visibility /> : <VisibilityOff />}
                                                                </IconButton>
                                                            </InputAdornment>
                                                        ),
                                                    }}
                                                />
                                            );
                                        }
                                        if (field.name === "Date In") {
                                            return (
                                                <Grid item xs={12} key={key} sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '0.7rem' }, // Adjust label font size
                                                    '& .MuiInputBase-root': { fontSize: '0.7rem' },  // Adjust input font size
                                                    marginBottom: '0',  // Adjust spacing beneath fields
                                                }}>
                                                    <Calendar
                                                        value={field.value ? new Date(field.value) : null}
                                                        onChange={(e) => handleInputChange(key, e.value)}
                                                        showIcon
                                                        dateFormat="mm/dd/yy"
                                                        disabled={!editable}
                                                    />
                                                </Grid>
                                            );
                                        }

                                            if (field.name === "Room") {
                                                return (
                                                    <Grid item xs={12} key={key} sx={{
                                                        '& .MuiInputLabel-root': { fontSize: '0.7rem' }, // Adjust label font size
                                                        '& .MuiInputBase-root': { fontSize: '0.7rem' },  // Adjust input font size
                                                        marginBottom: '0',  // Adjust spacing beneath fields
                                                    }}>
                                                        <TextField
                                                            label="Room"
                                                            fullWidth
                                                            select
                                                            value={field.value}
                                                            size="small"
                                                            InputProps={{
                                                                readOnly: !editable,
                                                            }}
                                                            onChange={(e) => handleInputChange(key, e.target.value)}
                                                            margin="dense"
                                                        >
                                                            {rooms.map((option: any) => (
                                                                <MenuItem key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </MenuItem>
                                                            ))}
                                                        </TextField>
                                                    </Grid>
                                                );
                                            }
                                        if (field.name === "Email") {
                                            return (
                                                <Grid item xs={12} key={key} sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '0.7rem' }, // Adjust label font size
                                                    '& .MuiInputBase-root': { fontSize: '0.7rem' },  // Adjust input font size
                                                    marginBottom: '0',  // Adjust spacing beneath fields
                                                }}>
                                                    <TextField
                                                        fullWidth
                                                        variant="outlined"
                                                        label="Email"
                                                        type="email"
                                                        value={field.value}
                                                        name={key}
                                                        disabled={!editable}
                                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                                        margin="dense"
                                                    />
                                                </Grid>
                                            );
                                        }

                                            return (
                                                <Grid item xs={12} key={key} sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '0.7rem' }, // Adjust label font size
                                                    '& .MuiInputBase-root': { fontSize: '0.7rem' },  // Adjust input font size
                                                    marginBottom: '0',  // Adjust spacing beneath fields
                                                }}>
                                                    <TextField
                                                        fullWidth
                                                        variant="outlined"
                                                        label={field.name}
                                                        value={field.value}
                                                        size="small"
                                                        name={key}
                                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                                        margin="dense"
                                                        disabled={!editable}
                                                    />
                                                </Grid>
                                            );
                                        })}

                            </Grid>
                        </Grid>

                        <Grid container  justifyContent="flex">
                            <Grid item sx={{  marginRight: '4px' }} >
                                <Button fullWidth variant="contained" color="primary" sx={{ fontSize: '0.6rem' }} onClick={() => setEditable(true)}>
                                    Edit
                                </Button>
                            </Grid>
                            <Grid item >
                                <Button fullWidth type="submit" variant="contained" color="primary" sx={{ fontSize: '0.6rem' }} onClick={saveData}>
                                    SAVE
                                </Button>
                            </Grid>
                        </Grid>
                    </Grid>
                    {/*<ImageAlbum/>*/}
                </DialogContent>
            </Dialog>
        </div>
    );
}
