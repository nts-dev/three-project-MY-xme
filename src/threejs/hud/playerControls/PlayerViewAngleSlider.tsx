import * as React from 'react';
import useGame from "../../../hooks/useGame";

const MIN_VIEW_ANGLE_DEG = -20;
const MAX_VIEW_ANGLE_DEG = 66;

const radiansToDegrees = (radians: number) => radians * 180 / Math.PI;
const degreesToRadians = (degrees: number) => degrees * Math.PI / 180;

export default function PlayerViewAngleSlider() {
    const playerViewAngle = useGame((state: any) => state.playerViewAngle);
    const setPlayerViewAngle = useGame((state: any) => state.setPlayerViewAngle);
    const sliderAngle = Math.round(radiansToDegrees(playerViewAngle));

    return (
        <div className="player-view-angle-meter" aria-label="Viewer vertical angle meter">
            <span className="player-view-angle-meter__label">Angle</span>
            <input
                aria-label="Viewer vertical angle"
                type="range"
                min={MIN_VIEW_ANGLE_DEG}
                max={MAX_VIEW_ANGLE_DEG}
                step={1}
                value={sliderAngle}
                onChange={(event) => setPlayerViewAngle(degreesToRadians(Number(event.target.value)))}
            />
            <span className="player-view-angle-meter__mark player-view-angle-meter__mark--top">+</span>
            <span className="player-view-angle-meter__mark player-view-angle-meter__mark--bottom">-</span>
        </div>
    );
}
