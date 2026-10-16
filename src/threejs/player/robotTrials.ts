// Single source of truth for the three recorded Raspbot V2 trial runs (T1/T2/T3).
// The trajectory dots, the trial selector, the active-trial indicator, and the
// backend track-source URLs (see usePlayerTrackReplay's "robot" branch) all read
// from this list so they can never drift out of sync with each other.
export type RobotTrialId = "T1" | "T2" | "T3";

export type RobotTrialConfig = {
    id: RobotTrialId;
    // Matches the track source `id` produced by usePlayerTrackReplay's "robot"
    // branch, and therefore the `pathGroups` key RobotTrackReplay/CameraPathReplay
    // key off of to find this trial's recorded points.
    sourceId: string;
    // Backend database filename (without ".json"), relative to the player track
    // endpoint — see E:\three-project-ws\database\GR100F*.json.
    fileName: string;
    colorName: "Blue" | "Red" | "Green";
    color: string;
};

export const ROBOT_TRIALS: RobotTrialConfig[] = [
    { id: "T1", sourceId: "GR100F_1", fileName: "GR100F", colorName: "Blue", color: "#1e7bff" },
    { id: "T2", sourceId: "GR100F_2", fileName: "GR100F (2)", colorName: "Red", color: "#ff1f2f" },
    { id: "T3", sourceId: "GR100F_3", fileName: "GR100F (3)", colorName: "Green", color: "#21d86f" },
];

export function getRobotTrial(id: RobotTrialId | null | undefined): RobotTrialConfig | null {
    if (!id) return null;
    return ROBOT_TRIALS.find((trial) => trial.id === id) ?? null;
}

export function getRobotTrialBySourceId(sourceId: string | null | undefined): RobotTrialConfig | null {
    if (!sourceId) return null;
    return ROBOT_TRIALS.find((trial) => trial.sourceId === sourceId) ?? null;
}
