import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

const Panel = ({ label, children, actions, className }) => {
    return (
        <Paper
            className={"sidebar-panel" + (className ? ` ${className}` : '')}
            elevation={0}
            square={false}
            sx={{
                background: 'transparent',
                color: 'inherit',
            }}
        >
            <Box className="sidebar-panel-header">
                <Typography className="sidebar-panel-label" component="h2" variant="subtitle2">
                    {label}
                </Typography>
                {(actions || []).map((action, index) => (
                    <Button
                        className="sidebar-panel-action"
                        key={index}
                        onClick={action.onClick}
                        size="small"
                        variant="outlined"
                        disableElevation
                        sx={{
                            minWidth: 'auto',
                            height: 24,
                            px: 1,
                            py: 0,
                            borderRadius: '4px',
                            fontSize: 11,
                            fontWeight: 600,
                            lineHeight: 1,
                            textTransform: 'none',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {action.label || action.icon}
                    </Button>
                ))}
            </Box>
            <Box className="sidebar-panel-content">
                {children}            
            </Box>
        </Paper>
    );
};

export default Panel;
