import { Sidebar } from "primereact/sidebar";
import { useDispatch, useSelector } from "react-redux";
import { toggle } from "../../features/menuBar/menuSlice";
import { Avatar, Badge, Typography, List, ListItem, ListItemAvatar, ListItemText } from "@mui/material";
import React from "react";
import { styled } from "@mui/system";

// Define custom styles for the Badge to position the status dot on the bottom-right of the avatar
const SmallDotBadge = styled(Badge)(({ theme }) => ({
    '& .MuiBadge-badge': {
        width: '1rem',
        height: '1rem',
        borderRadius: '50%',
        border: `2px solid ${theme.palette.background.paper}`,
        bottom: '0.2rem',
        right: '0.2rem',
    },
}));

export default function Message() {
    const dispatch = useDispatch();
    const isMessage = useSelector((state: any) => state.menu.isMessage);

    // Sample message data
    const messages = [
        {
            id: 1,
            name: "Geoffrey Imbisi",
            avatar: "/path-to-avatar1.jpg",
            time: "10 min ago",
            count: 3,
            status: "online", // online status: "online", "recent", "long_time_ago"
        },
        {
            id: 2,
            name: "Annah Wanjiku",
            avatar: "/path-to-avatar2.jpg",
            time: "15 min ago",
            count: 6,
            status: "recent",
        },
        {
            id: 3,
            name: "Gilbert Gesora",
            avatar: "/path-to-avatar3.jpg",
            time: "3h ago",
            count: 2,
            status: "long_time_ago",
        },
    ];

    // Function to determine the color of the status dot based on user status
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online':
                return 'green';
            case 'recent':
                return 'grey';
            case 'long_time_ago':
                return 'red';
            default:
                return 'grey';
        }
    };

    const customHeader = (
        <div className="flex align-items-center gap-2">
            <span className="font-bold">Messages</span>
        </div>
    );

    return (
        <Sidebar visible={isMessage}
                 onHide={() => dispatch(toggle('isMessage'))}
                 header={customHeader}
                 position="right">
            <div className="card flex justify-content-center p-1">

                <Typography variant="body2" color="textSecondary">
                    You have new messages
                </Typography>

                {/* Messages list */}
                <List sx={{width: '100%', bgcolor: 'background.paper'}}>
                    {messages.map((message) => (
                        <ListItem key={message.id}
                                  sx={{marginBottom: 1, border: '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer'}}>
                            <ListItemAvatar>
                                <SmallDotBadge
                                    overlap="circular"
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                    variant="dot"
                                    sx={{ '& .MuiBadge-dot': { backgroundColor: getStatusColor(message.status) } }}
                                >
                                    <Avatar alt={message.name} src={message.avatar} />
                                </SmallDotBadge>
                            </ListItemAvatar>
                            <ListItemText primary={message.name} secondary={message.time} />
                            <Badge badgeContent={message.count} color="primary" sx={{ marginRight: 1 }} />
                        </ListItem>
                    ))}
                </List>
            </div>
        </Sidebar>
    );
}
