import React from "react";
import {InputSwitch} from "primereact/inputswitch";
import useGame from "../../hooks/useGame";
import FloorController from "./FloorController";
import PlayerHeightSlider from "../hud/playerControls/PlayerHeightSlider";

export default function PlayerControls() {
    const setFloorMap = useGame((state: any) => state.setFloorMap)
    const floorMap = useGame((state: any) => state.floorMap)
    const setCollision = useGame((state: any) => state.setCollision);
    const collision = useGame((state: any) => state.collision);
    const setPlabel = useGame((state: any) => state.setPlabel);
    const pLabel = useGame((state: any) => state.pLabel);
    const setForwardOnly: any = useGame((state: any) => state.setForwardOnly)
    const forwardOnly: any = useGame((state: any) => state.forwardOnly)
    return (
        <div className="card flex justify-content-center">

            <div className="flex flex-column py-2   ">
                <p>Player Height</p>
                <PlayerHeightSlider direction='horizontal' classIndenfier='' height='auto'/>
            </div>

            <div className="flex flex-row justify-items-center  justify-between  py-2 ">
                <div>Forward Only</div>
                <InputSwitch checked={forwardOnly} onChange={(e) => setForwardOnly(e.value)}/>
            </div>
            <div className="flex flex-row justify-items-center  justify-between  py-2 ">
                <div>Show Label</div>
                <InputSwitch checked={pLabel} onChange={(e) => setPlabel(e.value)}/>
            </div>
            <div className="flex flex-row justify-items-center  justify-between  py-2 ">
                <div>Colliders</div>
                <InputSwitch checked={collision} onChange={(e) => setCollision(e.value)}/>
            </div>
            <div className="flex flex-row justify-items-center justify-between  py-2  ">
                <div>FloorMap</div>
                <InputSwitch checked={floorMap} onChange={(e) => setFloorMap(e.value)}/>
            </div>

            <div className="flex flex-row justify-items-center justify-between  py-2  ">
                <FloorController/>
            </div>

        </div>
    )
}
