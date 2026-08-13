import React, { useState } from 'react';
import { Button, Label, Panel, SliderInput, TextInput } from '@playcanvas/pcui/react';
import '@playcanvas/pcui/styles';
import './PcuiTestPanel.css';

export default function PcuiTestPanel() {
    const [name, setName] = useState('Three editor');
    const [intensity, setIntensity] = useState(0.5);
    const [clicks, setClicks] = useState(0);

    return (
        <div className="pcui-test-panel">
            <Panel headerText="PCUI Test" collapsible>
                <Label text={`Loaded in ${name}`} />
                <TextInput
                    value={name}
                    placeholder="Project name"
                    onChange={setName}
                />
                <SliderInput
                    value={intensity}
                    min={0}
                    max={1}
                    sliderMin={0}
                    sliderMax={1}
                    precision={2}
                    step={0.01}
                    onChange={setIntensity}
                />
                <Button
                    text={`Clicked ${clicks}`}
                    onClick={() => setClicks((value) => value + 1)}
                />
            </Panel>
        </div>
    );
}
