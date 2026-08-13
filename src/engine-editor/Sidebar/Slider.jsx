import React from "react";
import ReactSlider from "react-slider";

const Slider = ({ value, onChange, min = 0, max = 360 }) => {
    const onSliderChange = newSliderValue => {
        onChange(Number.parseFloat(Number(newSliderValue).toFixed(3)));
    };

    return (
        <ReactSlider
            className="slider"
            thumbClassName="slider-thumb"
            trackClassName="slider-track"
            markClassName="slider-mark"
            min={min}
            marks={false}
            max={max}
            defaultValue={0}
            value={value}
            onChange={onSliderChange}
            renderMark={(props) => {
            if (props.key < value) {
                props.className = "slider-mark slider-mark-before";
            } else if (props.key === value) {
                props.className = "slider-mark slider-mark-active";
            }
            return <span {...props} />;
            }}
        />
    );
}

export default Slider;
