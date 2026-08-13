import React from 'react';
import { Knob } from 'primereact/knob';
import useGame from "../../../hooks/useGame";
import {Tooltip} from "primereact/tooltip";
export default function CharacterJumpSpeed() {
    const jumpSpeed = useGame((state:any)  => state.jumpSpeed)
    const setJumpSpeed = useGame((state:any)  => state.setJumpSpeed)

    return (
        <div className=" flex flex-col items-center  justify-content-center jump-meter visible-element" style={{fontSize: '0.7rem'}}>

            <span>Jump Height</span>
            <Tooltip target=".knob" content={`Rotation ${jumpSpeed}` }/>
            <Knob value={jumpSpeed} className="knob visible-element" valueTemplate={'{value}m/s'} min={1} valueColor="#6b7280"
                  onChange={(e) => setJumpSpeed(e.value)} size={80}/>
        </div>
    )
}
