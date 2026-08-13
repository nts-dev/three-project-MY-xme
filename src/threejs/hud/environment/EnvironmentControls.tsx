
import {Slider} from "primereact/slider";
import React from "react";
import useGame from "../../../hooks/useGame";
import {ColorPicker} from "primereact/colorpicker";


export default function EnvironmentControls() {

    const lightIntensity = useGame((state: any) => state.lightIntensity);
    const setLightIntensity = useGame((state: any) => state.setLightIntensity);
    const lightColor = useGame((state: any) => state.lightColor);
    const setLightColor = useGame((state: any) => state.setLightColor);

    const onLightIntensityChanged = (e: any) =>{
        setLightIntensity(e.value)

    }
    const onColorChange = (e: any) =>{
        setLightColor(e.value)

    }

    return (
        <div className="card flex justify-content-center">
            <div className="flex flex-column py-2 ">

                <div className="flex flex-row justify-items-center gap-2  py-2 ">
                    <p className="pi pi-sun " style={{ fontSize: '1.5rem', color: 'grey' }}></p>
                    <p className='env'>Light Intensity</p>
                </div>

                <Slider value={lightIntensity} onChange={onLightIntensityChanged} className="w-14rem" step={0.1}/>
            </div>

            <div className="flex flex-row justify-items-center gap-2  py-3 ">
                <ColorPicker value={lightColor} format="hex" onChange={onColorChange}/>
                <p className='env'>Light Color</p>
            </div>




        </div>
    )
}
