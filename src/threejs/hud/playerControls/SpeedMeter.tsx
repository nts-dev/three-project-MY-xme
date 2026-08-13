import React from 'react';
import { Knob } from 'primereact/knob';
import useGame from "../../../hooks/useGame";
import {Tooltip} from "primereact/tooltip";
export default function CharacterSpeed() {
    const playerSpeed = useGame((state:any)  => state.playerSpeed)
    const setPlayerSpeed = useGame((state:any)  => state.setPlayerSpeed)

    return (
        <div className=" flex flex-col items-center  justify-content-center speed-meter visible-element" style={{fontSize: '0.7rem'}}>

            <span>Speed</span>
            <Tooltip target=".knob" content={`Speed ${playerSpeed} m/s`}/>
            <Knob value={playerSpeed} className="knob visible-element" valueTemplate={'{value}m/s'} min={1} valueColor="#6b7280"
                  onChange={(e) => setPlayerSpeed(e.value)} size={80}/>
        </div>
    )
}
