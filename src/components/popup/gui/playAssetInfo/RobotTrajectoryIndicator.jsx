import React from "react";
import useGame from "../../../../hooks/useGame";
import { getRobotTrial } from "../../../../threejs/player/robotTrials";
import "./PlayAssetInfoHud.css";

// Reflects robotActiveTrial, not robotSelectedTrial — robotActiveTrial is only set
// by RobotTrackReplay once the selected trial's recorded data has actually loaded
// and is driving the robot (see RobotTrackReplay.tsx), so this can never disagree
// with the robot's real movement, even for a moment while a trial is loading.
export default function RobotTrajectoryIndicator() {
    const robotRouteDots = useGame((state) => state.robotRouteDots);
    const robotActiveTrial = useGame((state) => state.robotActiveTrial);

    if (!robotRouteDots) return null;

    const trial = getRobotTrial(robotActiveTrial);

    return (
        <section className="robot-trajectory-indicator" role="status" aria-live="polite">
            <span
                className={`robot-trajectory-indicator__dot${trial ? "" : " is-inactive"}`}
                style={trial ? { background: trial.color } : undefined}
                aria-hidden="true"
            />
            <span className="robot-trajectory-indicator__label">
                {trial ? `Active Robot Trajectory: ${trial.id} — ${trial.colorName}` : "No Active Trial"}
            </span>
        </section>
    );
}
