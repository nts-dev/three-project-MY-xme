import * as React from 'react';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import { useEffect, useRef, useState } from "react";
import database from "../../../database";
import { Q } from "@nozbe/watermelondb";
import useGame from "../../../hooks/useGame";

export default function PlayerHeightSlider({classIndenfier, direction, height}: any) {
    const floorHeight = useGame((state: any) => state.floorHeight);
    const setFloorHeight = useGame((state: any) => state.setFloorHeight);
    const projectId: number = useGame((state: any) => state.projectID);

    const previousHeightValue = useRef(floorHeight);
    const [marks, setMarks] = useState<any>([]);
    const [min, setMin] = useState<number>(0);
    const [max, setMax] = useState<number>(100);

    const getProjectsFloorDetails = async () => {
        const roomsCollection = database.collections.get('rooms');
        const rooms = await roomsCollection.query(Q.where('room_id', parseInt(projectId.toString()))).fetch();

        // @ts-ignore
        const floors = rooms[0]?._raw?.floors;
        if (!floors) return;

        const floorList = JSON.parse(floors);
        const minFloor = floorList[0] / 100;
        const maxFloor = floorList[floorList.length - 1] / 100;

        setMin(minFloor);
        setMax(maxFloor);


        const floorMarks = [
            { value: minFloor, label: direction=='vertical'?<i className="pi pi-arrow-down visible-element"></i>:'' },
            { value: (minFloor + maxFloor) / 2, label:direction=='vertical'? <span className="visible-element">50%</span>: '' },
            { value: maxFloor, label:direction=='vertical'? <i className="pi pi-arrow-up visible-element"></i>: '' },
        ];



        setMarks(floorMarks);
    };

    useEffect(() => {
        getProjectsFloorDetails();
    }, [projectId]);

    const handleZoomChange = (event: Event, newValue: number | number[]) => {
        const newHeightValue = newValue as number;
        const heightDifference = newHeightValue - previousHeightValue.current;

        setFloorHeight((floorHeight+heightDifference))
        previousHeightValue.current = newHeightValue;
    };

    return (
        <Stack sx={{ height: height, color: '#8c8c8c' }} spacing={1} direction='row' className={classIndenfier}>
            <Slider
                getAriaLabel={() => 'Floor Height'}
                orientation={direction}
                value={floorHeight}  // Now using value instead of defaultValue
                min={min}
                max={max}
                marks={marks}
                valueLabelDisplay="auto"
                step={0.1}
                onChange={handleZoomChange}
                sx={{
                    '& .MuiSlider-markLabel': { transform: 'translate(-3.5rem, 10px)' },
                    '& .MuiSlider-thumb': { backgroundColor: '#8c8c8c' },
                    '& .MuiSlider-track': { backgroundColor: '#8c8c8c' },
                    '& .MuiSlider-rail': { backgroundColor: '#8d8c8c' },
                }}
            />
        </Stack>
    );
}
