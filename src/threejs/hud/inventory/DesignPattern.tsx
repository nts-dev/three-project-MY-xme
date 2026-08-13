
import React, {useState} from 'react';
import { Panel } from 'primereact/panel';
import { InputText } from 'primereact/inputtext';
import useGame from "../../../hooks/useGame";
import {Vector3} from "three";

export default function DesignPattern() {
    const [collapsed, setCollapsed] = useState(true);
    const dragObjectProperties = useGame((state: any) => state.dragObjectProperties);
    const setDragObjectProperties = useGame((state: any) => state.setDragObjectProperties);
    const togglePanel = () => {
        setCollapsed(!collapsed);
    };
    const updateDistance = (values: number[]) => {
        const distance = new Vector3(values[0], values[1], values[2]);
        // object?.position?.set(scaledPosition.x, scaledPosition.y, scaledPosition.z);
        setDragObjectProperties(
            {
                position:  dragObjectProperties?.position,
                rotation: dragObjectProperties?.rotation,
                distance: distance,
                interval: dragObjectProperties?.interval,

            });
    };

    const updateInterval = (values: number[]) => {
        const interval = new Vector3(values[0], values[1], values[2]);
        // object?.position?.set(scaledPosition.x, scaledPosition.y, scaledPosition.z);
        setDragObjectProperties(
            {
                position:  dragObjectProperties?.position,
                rotation: dragObjectProperties?.rotation,
                distance: dragObjectProperties?.distance,
                interval:interval,

            });
    };
    const handleInputChange = (axis: string, value: number, type: string) => {

        const updatedValue = {...dragObjectProperties[type], [axis]: value};
        if(type==='interval'){
            updateInterval([updatedValue.x, updatedValue.y, updatedValue.z]);
        }
        else if(type==='distance'){
             updateDistance([updatedValue.x, updatedValue.y, updatedValue.z]);
        }

    };

    return (

            <Panel
                header={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem'}}>
                        <span>Design Pattern</span>
                        <button
                            onClick={togglePanel}
                            style={{
                                color: '#007bff',
                                cursor: 'pointer',
                            }}
                        >
                            {collapsed ? 'See More...' : 'Hide'}
                        </button>
                    </div>
                }
                toggleable
                collapsed={collapsed}
                onToggle={(e) => setCollapsed(e.value)}
                icons={() => null}  // Disable default toggle icons
            >
                <div className="m-0">
                    <div className="form-container">
                        {["x", "y", "z"].map((value, index) => (
                            <div className="form-row" key={index}>
                                <div className="form-field">
                                    <label>{`${value.toUpperCase()}-Distance`}</label>
                                    <InputText
                                        className="input-field"
                                        value={parseInt(String(dragObjectProperties?.distance[value] )).toString()}
                                         onChange={(e) => handleInputChange(value, parseInt(e.target.value) || 0, 'distance')}
                                    />
                                </div>
                                <div className="form-field">
                                    <label>{`${value.toUpperCase()}-Interval`}</label>
                                    <InputText
                                        className="input-field"
                                        value={parseInt(String(dragObjectProperties?.interval[value] )).toString()}
                                        onChange={(e) => handleInputChange(value, parseInt(e.target.value) || 0, 'interval')}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Panel>
    )
}
