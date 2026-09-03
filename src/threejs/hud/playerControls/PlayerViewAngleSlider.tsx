import * as React from 'react';
import useGame from "../../../hooks/useGame";

const MIN_VIEW_ANGLE = -0.35;
const MAX_VIEW_ANGLE = 2;

export default function PlayerViewAngleSlider() {
    const playerViewAngle = useGame((state: any) => state.playerViewAngle);
    const setPlayerViewAngle = useGame((state: any) => state.setPlayerViewAngle);

    return (
        <div className="player-view-angle-meter" aria-label="Viewer vertical angle meter">
            <span className="player-view-angle-meter__label">Angle</span>
            <input
                aria-label="Viewer vertical angle"
                type="range"
                min={MIN_VIEW_ANGLE}
                max={MAX_VIEW_ANGLE}
                step={0.01}
                value={playerViewAngle}
                onChange={(event) => setPlayerViewAngle(Number(event.target.value))}
            />
            <span className="player-view-angle-meter__mark player-view-angle-meter__mark--top">+</span>
            <span className="player-view-angle-meter__mark player-view-angle-meter__mark--bottom">-</span>
        </div>
    );
}
