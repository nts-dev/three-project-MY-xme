// WireInfo.js
import React, {useState} from "react";
// import PropTypes from "prop-types";
import { styled } from '@mui/material/styles';
import { MenuItem, Dialog, DialogContent, Grid, Divider, IconButton, Button, Typography, TextField, Icon } from '@mui/material';

import { teal, grey } from '@mui/material/colors';

const StyledDialog = styled(Dialog)(({ theme }) => ({
    root: {
        flexGrow: 1
    },
    primaryColor: {
        color: teal[500]
    },
    secondaryColor: {
        color: grey[700]
    },
    padding: {
        padding: 0
    },
    mainHeader: {
        backgroundColor: grey[100],
        padding: 10,
        alignItems: "center"
    },
    mainContent: {
        padding: 40
    },
    secondaryContainer: {
        padding: "20px 25px",
        backgroundColor: grey[200]
    }
}));

const branches = [
    { value: "TradeStar Kenya Ltd", label: "TradeStar Kenya Ltd" },

];
const rooms = [
    { value: "Floor 1", label: "Floor 1" },

];

function WireInfo({ open, onClose }) {

    const device = {
        "category": "Users",
        "subcategory": "Intranet - Employees",
        "cat_id": "89",
        "mTem_id": "2054",
        "templ_id": "69",
        "room": "Floor 1<>Room<>0<>0><481",
        "datein": "2015-08-03<>Date In<>0<>0><483",
        "status": "In Use<>Status<>1<>0><485",
        "xpos": "2815<>X-pos<>1<>0><487",
        "ypos": "1405<>Y-pos<>1<>0><489",
        "userid": "15683<>User ID<>1<>0><1861",
        "zpos": "0<>Z-pos<>1<>0><19281",
        "pictureid": "1586<>Picture ID<>0<>0><3457",
        "contactid": "15683<>Contact ID<>0<>0><6632",
        "description": "Daniel Mkony Obilo",
        "dayofbirth": "22-08-1989<>Day of birth<>1<>0><4016",
        "mobilenumber": "+254 720 055 729<>Mobile number<>1<>1><4018",
        "companyemailaddress": "daniel@nts.nl<>Company Emailaddress<>1<>1><5116",
        "privateemailddress": "danobilo@gmail.com<>Private Emailddress<>1<>0><5118",
        "profession": "Programmer<>Profession<>1<>0><5112",
        "employment": "Variable<>Employment<>1<>1><5114",
        "angle": "180<>Angle<>1<>0><7019",
        "gender": "Male<>Gender<>1<>1><8345",
        "telefoon": "+254 720 055 729<>Telefoon<>1<>1><9876",
        "skype": "daniel.mkony<>Skype<>1<>1><10624",
        "unrealassetid": "313<>Unreal AssetID<>0<>1><20691",
        "tasks": "Web Admin Console\nDatabase Program\nProjects Program\nSystem Entry\nHRM<>Tasks<>1<>0><26166",
        "unrealprojectid": "28<>UnrealProjectID<>0<>0><26170",
        "assetid": "313<>Asset ID<>0<>0><28820",
        "gmail": "danobilo@gmail.com<>Gmail<>1<>1><29258"
    };
    const parseValue = (value) => {
        const [data, label] = value.split('<>');
        return { data, label };
    };
    const formFields = Object.entries(device).map(([key, value]) => {

        if (typeof value === 'string' && value.includes('<>') ) {
            const { data, label } = parseValue(value);
            return { key, data, label };
        }
        return { key, data: value, label: key };
    });
    const initialState = formFields.reduce((acc, { key, data }) => {
        acc[key] = data || '';
        return acc;
    }, {});

    const [formValues, setFormValues] = useState(initialState);

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormValues({
            ...formValues,
            [name]: value,
        });
    };

    return (
        <StyledDialog
            fullWidth
            maxWidth="sm"
            open={open}
            onClose={() => onClose("wireModal")}
        >
            <DialogContent>
                <Grid container>
                    <Grid item xs={7}>
                        <Grid container direction="row" sx={{ backgroundColor: grey[100], padding: 1, alignItems: "center", fontSize: '0.9rem' }}>
                            <Grid item xs={6.3}>
                                <Typography sx={{ color: teal[500] }} variant="h5">
                                    Asset Info
                                </Typography>
                            </Grid>
                        </Grid>
                        <Grid container direction="row" sx={{ padding: 2 }} >
                            <Grid item xs={6.3}>
                                <TextField
                                    sx={{ marginBottom: 0}}
                                    fullWidth
                                    select
                                    margin="dense"
                                    variant="outlined"
                                    label="Branch"
                                    value={branches.value}
                                    id="branch-name"
                                >
                                    {branches.map(option => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>

                            <Grid item xs={6.3}>
                                <TextField

                                    label="Room"
                                    fullWidth
                                    select
                                    variant="outlined"
                                    value={rooms.value}
                                    id="country"
                                    margin="dense"
                                >
                                    {rooms.map(option => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>

                                {formFields.map(({ key, data, label }) => (

                                    <Grid item    sx={{
                                        '& .MuiInputLabel-root': { fontSize: '0.7rem' }, // Adjust label font size
                                        '& .MuiInputBase-root': { fontSize: '0.7rem' },  // Adjust input font size
                                        marginBottom: '0'  // Adjust spacing beneath fields
                                    }} key={key} >
                                        <TextField
                                            fullWidth
                                            variant="outlined"
                                            label={label || key}
                                            value={formValues[key]}
                                            name={key}
                                            onChange={handleInputChange}
                                            margin="dense"
                                        />
                                    </Grid>
                                ))}

                        </Grid>
                    </Grid>

                    <Grid container spacing={0.5} justifyContent="flex-start">
                        <Grid item xs={2}>
                            <Button fullWidth variant="contained" color="primary" sx={{ fontSize: '0.6rem' }}>
                                Edit
                            </Button>
                        </Grid>
                        <Grid item xs={2}>
                            <Button fullWidth type="submit" variant="contained" color="primary" sx={{ fontSize: '0.6rem' }}>
                                SAVE
                            </Button>
                        </Grid>
                    </Grid>

                </Grid>
            </DialogContent>
      </StyledDialog>
    );
}



export default WireInfo;
