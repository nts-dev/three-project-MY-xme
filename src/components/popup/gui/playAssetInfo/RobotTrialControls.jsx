import React, { useCallback } from "react";
import useGame from "../../../../hooks/useGame";
import { ROBOT_TRIALS } from "../../../../threejs/player/robotTrials";

// Compact T1/T2/T3 trial selector + an "All/Active" dot-visibility toggle. Reads
// and writes the same robotSelectedTrial/robotTrialVisibilityMode store fields
// RobotTrackReplay and CameraPathReplay's dot rendering already key off of, so
// this component only ever expresses user intent — it never touches playback or
// trajectory data itself (single responsibility; see robotTrials.ts for the
// shared T1/T2/T3 metadata this and the trajectory indicator both read from).
export default function RobotTrialControls() {
    const robotRouteDots = useGame((state) => state.robotRouteDots);
    const robotSelectedTrial = useGame((state) => state.robotSelectedTrial);
    const setRobotSelectedTrial = useGame((state) => state.setRobotSelectedTrial);
    const robotTrialVisibilityMode = useGame((state) => state.robotTrialVisibilityMode);
    const setRobotTrialVisibilityMode = useGame((state) => state.setRobotTrialVisibilityMode);

    const toggleVisibilityMode = useCallback(() => {
        setRobotTrialVisibilityMode(robotTrialVisibilityMode === "all" ? "active" : "all");
    }, [robotTrialVisibilityMode, setRobotTrialVisibilityMode]);

    if (!robotRouteDots) return null;

    return (
        <div className="robot-trial-controls" role="group" aria-label="Robot trajectory trial">
            {ROBOT_TRIALS.map((trial) => (
                <button
                    key={trial.id}
                    type="button"
                    className={`robot-trial-controls__button${robotSelectedTrial === trial.id ? " is-selected" : ""}`}
                    style={{ "--robot-trial-color": trial.color }}
                    aria-label={`Follow ${trial.id} — ${trial.colorName}`}
                    aria-pressed={robotSelectedTrial === trial.id}
                    data-tooltip={`${trial.id} — ${trial.colorName}`}
                    onClick={() => setRobotSelectedTrial(trial.id)}
                >
                    <span className="robot-trial-controls__dot" aria-hidden="true" />
                    {trial.id}
                </button>
            ))}
            <button
                type="button"
                className="robot-trial-controls__visibility"
                aria-label={robotTrialVisibilityMode === "all" ? "Show active trial only" : "Show all trials"}
                data-tooltip={robotTrialVisibilityMode === "all" ? "Show active trial only" : "Show all trials"}
                onClick={toggleVisibilityMode}
            >
                {robotTrialVisibilityMode === "all" ? "All" : "Active"}
            </button>
        </div>
    );
}
