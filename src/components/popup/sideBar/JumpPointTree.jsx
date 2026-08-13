import {Tree} from "primereact/tree";
import * as React from "react";
import {useEffect, useState} from "react";
import useGame from "../../../hooks/useGame";
import {locationPoints} from "../../../threejs/player/puzzle/character/Constants";


export default function JumpPointTree(){
    const [nodes, setNodes] = useState([]);
    const branch = useGame((state)  => state.branch);
    const setFloorValue = useGame((state)  => state.setFloorValue);
    const [selectedNodeKey, setSelectedNodeKey] = useState('');
    const  setSearchItem  = useGame((state) => state.setSearchItem);

    const isMobileDevice = ()=> {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    useEffect(() => {
       const branchObj = {
            key: 'branch',
            label: branch,
            data: '',
            icon: 'pi pi-folder',
            children: locationPoints
        }

            setNodes([branchObj])

    }, [locationPoints]);

    const selectPoint = (event)=>{

        setSelectedNodeKey(event.value)
    }
    const onSelect = (event) => {
        if (event.node.data == "") {
            return
        }
        const floorVal = ((event.node.floor)*4.5) - 0.6
        setFloorValue(floorVal)

        setSearchItem({id:event.node.data,type: null})
    };



    return (
        <div className="card flex justify-content-center channel">
            <Tree
                value={isMobileDevice()?locationPoints: nodes}
                selectionMode="single"
                onSelect={onSelect}
                selectionKeys={selectedNodeKey}
                onSelectionChange={selectPoint}
                className={'document-tree'}
                   style={{fontSize:'0.5rem'}}/>
        </div>
    )
}
