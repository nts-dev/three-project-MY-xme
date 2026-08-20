import * as React from 'react';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import useGame from "../../../hooks/useGame";

const MIN_VIEW_ANGLE = -0.35;
const MAX_VIEW_ANGLE = 0.55;

export default function PlayerViewAngleSlider() {
    const playerViewAngle = useGame((state: any) => state.playerViewAngle);
    const setPlayerViewAngle = useGame((state: any) => state.setPlayerViewAngle);

    const handleAngleChange = (_event: Event, newValue: number | number[]) => {
        setPlayerViewAngle(newValue as number);
    };

    return (
        <Stack
            className="player-view-angle-meter"
            sx={{ height: '12rem', color: '#23f4f8' }}
            spacing={1}
            direction="row"
        >
            <Slider
                getAriaLabel={() => 'Viewer vertical angle'}
                orientation="vertical"
                value={playerViewAngle}
                min={MIN_VIEW_ANGLE}
                max={MAX_VIEW_ANGLE}
                step={0.01}
                valueLabelDisplay="auto"
                onChange={handleAngleChange}
                marks={[
                    { value: MIN_VIEW_ANGLE, label: <i className="pi pi-angle-down visible-element" /> },
                    { value: 0, label: <span className="visible-element">0</span> },
                    { value: MAX_VIEW_ANGLE, label: <i className="pi pi-angle-up visible-element" /> },
                ]}
                sx={{
                    '& .MuiSlider-markLabel': { transform: 'translate(-3.2rem, 10px)', color: '#d8ffff' },
                    '& .MuiSlider-thumb': {
                        width: 18,
                        height: 18,
                        backgroundColor: '#23f4f8',
                        boxShadow: '0 0 16px rgba(35, 244, 248, 0.65)',
                    },
                    '& .MuiSlider-track': { backgroundColor: '#23f4f8' },
                    '& .MuiSlider-rail': { backgroundColor: 'rgba(216, 255, 255, 0.28)' },
                }}
            />
        </Stack>
    );
}
