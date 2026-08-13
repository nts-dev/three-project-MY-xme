import { Avatar, Typography, IconButton } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import * as React from "react";
import { useState } from "react";

export default function ProfileHeader({ formData }: any) {
    const [avatar, setAvatar] = useState(`${import.meta.env.VITE_JSON_URL}/icons/avatar.PNG`);
    const [imageFile, setImageFile] = useState<File | null>(null);

    // Handle file selection
    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            // Preview the new image
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatar(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div style={{ textAlign: 'center', padding: '0.75rem', position: 'relative' }}>
            {/* Avatar with file input */}
            <label htmlFor="avatar-upload" style={{ cursor: 'pointer' }}>
                <input
                    accept="image/*"
                    id="avatar-upload"
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleImageChange}
                />
                <Avatar
                    alt="User Image"
                    src={avatar} // Previewed avatar image
                    sx={{ width: 70, height: 70, margin: '0 auto' }}
                />

            {/* Small round edit icon on top of avatar */}
            <IconButton
                color="primary"
                component="span"
                sx={{
                    position: 'absolute',
                    top: 'calc(50% - 20px)',
                    right: 'calc(50% - 30px)', // Adjust the position over the avatar
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    padding: '3px',
                    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
                    '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    }
                }}
            >

                <EditIcon sx={{ fontSize: 18 }} />
            </IconButton>
            </label>
            <Typography variant="h6" gutterBottom>
                {formData.contact_firstname} {formData.contact_lastname}
            </Typography>
            <Typography variant="body2" color="textSecondary">
                {formData.contact_email}
            </Typography>
        </div>
    );
}
