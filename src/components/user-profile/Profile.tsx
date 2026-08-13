import { Sidebar } from "primereact/sidebar";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toggle } from "../../features/menuBar/menuSlice";
import * as React from "react";
import { Grid, TextField } from "@mui/material";
import ProfileHeader from "./ProfileHeader";
import Message from "../messages/Message";

export default function Profile() {
    const isUserProfile = useSelector((state: any) => state.menu.isUserProfile);
    const dispatch = useDispatch();

    // Form state for user data
    const [formData, setFormData] = useState({
        contact_id: '',
        contact_firstname: '',
        contact_secondname: '',
        contact_lastname: '',
        contact_email: '', // Assuming you have this field
    });

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };



    return (
        <Sidebar
            visible={isUserProfile}
            position="right"
            onHide={() => dispatch(toggle('isUserProfile'))}
            // header={customHeader}
        >
            {/* User Profile Image and Info */}

           <ProfileHeader formData={formData}/>

            <div style={{padding: '0.75rem'}}>
            {/* Form Content */}
            <Grid container   >
                {/* Contact ID */}
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="Contact ID"
                        value={formData.contact_id || ""}
                        disabled
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                            '& .MuiInputBase-root': { fontSize: '0.7rem' },
                            marginBottom: '0'
                        }}
                    />
                </Grid>

                {/* First Name */}
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="First Name"
                        name="contact_firstname"
                        value={formData.contact_firstname || ""}
                        onChange={handleInputChange}
                        disabled
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                            '& .MuiInputBase-root': { fontSize: '0.7rem' },
                            marginBottom: '0'
                        }}
                    />
                </Grid>

                {/* Second Name */}
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="Second Name"
                        name="contact_secondname"
                        value={formData.contact_secondname || ""}
                        onChange={handleInputChange}
                        disabled
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                            '& .MuiInputBase-root': { fontSize: '0.7rem' },
                            marginBottom: '0'
                        }}
                    />
                </Grid>

                {/* Last Name */}
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="Last Name"
                        name="contact_lastname"
                        value={formData.contact_lastname || ""}
                        onChange={handleInputChange}
                        disabled
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                            '& .MuiInputBase-root': { fontSize: '0.7rem' },
                            marginBottom: '0'
                        }}
                    />
                </Grid>

                {/* Email (assuming email field) */}
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        label="Email"
                        name="contact_email"
                        value={formData.contact_email || ""}
                        onChange={handleInputChange}
                        disabled
                        sx={{
                            '& .MuiInputLabel-root': { fontSize: '0.7rem' },
                            '& .MuiInputBase-root': { fontSize: '0.7rem' },
                            marginBottom: '0'
                        }}
                    />
                </Grid>
            </Grid>

            </div>
        </Sidebar>
    );
}
