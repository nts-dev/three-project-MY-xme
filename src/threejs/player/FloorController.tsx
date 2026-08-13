
import React, {useEffect, useRef, useState} from 'react';
import { SplitButton } from 'primereact/splitbutton';
import { Toast } from 'primereact/toast';
import {Q} from "@nozbe/watermelondb";
import useGame from "../../hooks/useGame";
import database from "../../database";

export default function FloorController() {

    const toast = useRef<Toast>(null);
    const projectId: number = useGame((state: any) => state.projectID)
    const [floorList, setFloorList] = useState([])
    const setFloorHeight = useGame((state:any)  => state.setFloorHeight)

    const fetchFloors = async () => {
        const roomsCollection = database.collections.get('rooms');
        const rooms = await roomsCollection.query(Q.where('room_id', parseInt(projectId.toString()))).fetch()
        // @ts-ignore
        const floors = rooms[0]?._raw?.floors

        const selectFloor = (floor:any,  index:number) => {
            setFloorHeight(floor/100)
            toast.current?.show({ severity: 'success', summary: 'Updated', detail: `Moved to Floor ${index}` });
        }

        if(floors){
            const fFloor: any = []
            const floorList = JSON.parse(floors)
            // const height =
            floorList.map((floor: any, index: number)=>{
                fFloor.push(
                    {
                        label: `Floor ${index+1}`,
                        command: ()=> selectFloor(floor, index)
                    }
                )
            })
            setFloorList(fFloor)

        }

    }

    useEffect(() => {
        fetchFloors()
    }, [projectId]);


    const save = () => {
        toast.current?.show({ severity: 'success', summary: 'Success', detail: 'Data Saved' });
    };

    return (
        <div className="flex justify-content-center" style={{borderRadius:'0.37rem', borderWidth: '0.015rem', borderColor: '#c7c7c8'}}>
            <Toast ref={toast}></Toast>
            <SplitButton label="Select Floor" icon="pi pi-warehouse" onClick={save} model={floorList} />
        </div>
    )
}
