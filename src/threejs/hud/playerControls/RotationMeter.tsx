import React from 'react';
import { Knob } from 'primereact/knob';
import useGame from "../../../hooks/useGame";
import {Tooltip} from "primereact/tooltip";
export default function CharacterRotationSpeed() {
    const playerRotationSpeed = useGame((state:any)  => state.playerRotationSpeed)
    const setPlayerRotationSpeed = useGame((state:any)  => state.setPlayerRotationSpeed)

    return (
        <div className=" flex flex-col items-center  justify-content-center rotation-meter visible-element" style={{fontSize: '0.7rem'}}>

            <span>Rotation</span>
            <Tooltip target=".knob" content={`Rotation ${playerRotationSpeed} m/s`}/>
            <Knob value={playerRotationSpeed} className="knob visible-element" valueTemplate={'{value}m/s'} min={1} valueColor="#6b7280"
                  onChange={(e) => setPlayerRotationSpeed(e.value)} size={80}/>
        </div>
    )
}
