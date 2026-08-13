import React from "react";
import {Slider} from "primereact/slider";
import {InputSwitch} from "primereact/inputswitch";
import useGame from "../../hooks/useGame";
import FloorItems from "../../components/floor-items/FloorItems.jsx";

export default function ProjectControls() {
    const setFloorMap = useGame((state: any) => state.setFloorMap)
    const floorMap = useGame((state: any) => state.floorMap);
    const setWallsOpacity: any = useGame((state: any) => state.setWallsOpacity)
    const wallsOpacity: number = useGame((state: any) => state.wallsOpacity)
    const setGrid = useGame((state: any) => state.setGrid);
    const grid = useGame((state: any) => state.grid);
    const roof = useGame((state: any) => state.roof);
    const setRoof = useGame((state: any) => state.setRoof);
    const onWallsRangeChange = (e: any) => {
        setWallsOpacity(e.value)

    }

    return (
        <div className="card flex justify-content-center">

            <div className="flex flex-column py-2   ">
                <p>Walls</p>
                <Slider value={wallsOpacity} onChange={onWallsRangeChange} className="w-14rem" step={0.1}/>
            </div>

            <div className="flex flex-row justify-items-center  justify-between  py-2 ">
                <div>Grid</div>
                <InputSwitch checked={grid} onChange={(e) => setGrid(e.value)}/>
            </div>
            <div className="flex flex-row justify-items-center justify-between  py-2  ">
                <div>Roof</div>
                <InputSwitch checked={roof} onChange={(e) => setRoof(e.value)}/>
            </div>
            <div className="flex flex-row justify-items-center justify-between  py-2  ">
                <div>Ground</div>
                <InputSwitch checked={floorMap} onChange={(e) => setFloorMap(e.value)}/>
            </div>

            <div className="flex flex-row justify-items-center justify-between  py-2  ">
                <FloorItems colorValue={true} />
            </div>

        </div>
    )
}
