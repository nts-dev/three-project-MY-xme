import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Dropdown } from "primereact/dropdown";
import useGame from "../../../../hooks/useGame";
import { MotionControl, MotionLevelToolbar, MotionToolbarItems, ToolbarButton } from "./MotionLevelToolbar";
import { blurCurrentTarget, suppressSpaceButtonActivation } from "../../../../utils/keyboardEvents";
import { DEFAULT_LEVEL_CODE } from "../../../../engine-editor/viewport-levels/levelUtils";
import FloorItems from "../../../floor-items/FloorItems.jsx";
import "./style.css";


const states = ["Play mode", "Preview Mode #2", "Edit Mode", "View Mode", "Preview Mode #1"];
const PLAY_MODE_INDEX = states.indexOf("Play mode");
const EDIT_MODE_INDEX = states.indexOf("Edit Mode");

const modeIcons = {
    "Play mode": "pi pi-play",
    "Preview Mode #2": "pi pi-eye",
    "Edit Mode": "pi pi-pencil",
    "View Mode": "pi pi-window-maximize",
    "Preview Mode #1": "pi pi-eye",
};

function shouldForceEditModeFromUrl() {
    if (typeof window === "undefined") {
        return false;
    }

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("projectId");
    const isLevelProject = typeof projectId === "string" && /_L\d+$/i.test(projectId);

    if (isLevelProject) {
        return true;
    }

    return params.get("mode") === "edit"
        || params.get("skipMenu") === "1"
        || params.get("source") === "theia";
}

function syncProjectIdInUrl(nextProjectId) {
    if (typeof window === "undefined" || !nextProjectId) {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    params.set("projectId", String(nextProjectId));
    const nextSearch = params.toString();
    const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
}

const TopLeftControls = () => {
    const [stateIndex, setStateIndex] = useState(EDIT_MODE_INDEX);

    const [isMin, setIsMin] = useState(false);
    const [loadingLevels, setLoadingLevels] = useState(false);
    const [loadingRow, setLoadingRow] = useState(false);

    const selectedLevel = useGame((s) => s.selectedLevel);
    const setSelectedLevel = useGame((s) => s.setSelectedLevel);
    const levels = useGame((s) => s.levels);
    const setLevels = useGame((s) => s.setLevels);
    const setButtonMode = useGame((s) => s.setButtonMode);
    const buttonMode = useGame((s) => s.buttonMode);
    const setRestart = useGame((s) => s.setRestart);
    const restart = useGame((s) => s.restart);
    const setSoundUrl = useGame((s) => s.setSoundUrl);
    const isPuzzleGame = useGame((s) => s.isPuzzleGame);

    const character = useGame((s) => s.character);
    const firstPerson = useGame((s) => s.firstPerson);

    const resetGame = useGame((s) => s.resetGame);
    const setResetGame = useGame((s) => s.setResetGame);

    const isMobile = useGame((s) => s.isMobile);

    const projectID = useGame((s) => s.projectID);
    const setProjectID = useGame((s) => s.setProjectID);

    const setAddLevel = useGame((s) => s.setAddLevel);
    const setPauseGame = useGame((s) => s.setPauseGame);

    const setGridSize = useGame((s) => s.setGridSize);
    const setIsPuzzleGame = useGame((s) => s.setIsPuzzleGame);
    const setShowConfirmDelete = useGame((s) => s.setShowConfirmDelete);

    const abortRowRef = useRef(null);
    const requestedLevelCodeRef = useRef(null);
    const hasAppliedInitialModeRef = useRef(false);
    const buildLevelOptions = useCallback((rows) => {
        const optionMap = new Map();
        optionMap.set("0", { name: "L 0", code: "0" });

        (Array.isArray(rows) ? rows : rows?.levels || []).forEach((row) => {
            const num = String(row.level).replace(/[^\d]/g, "") || "0";
            optionMap.set(num, { name: `L ${num}`, code: num, id: row.id });
        });

        return Array.from(optionMap.values()).sort((left, right) => Number(left.code) - Number(right.code));
    }, []);

    const audioUrl = useMemo(() => {
        const audioUrls = [
            "love-clemens.mp3",
            "abandoned-places.mp3",
            "silo-adi.mp3",
            "liquid-acid.mp3",
            "Forged-NVU.mp3",
            "Spiderbot-Remake.mp3",
            "BOYZ-NOIZE.mp3",
            "goetia-adi.mp3",
            "em.mp3",
            "feral-aavirall-main-version",
        ];
        return audioUrls[0];
    }, []);

    const baseProjectId = useMemo(() => String(projectID || "").split("_")[0], [projectID]);
    const currentLevelCode = useMemo(() => {
        const match = /_L(\d+)$/i.exec(String(projectID || ""));
        return match?.[1] ?? null;
    }, [projectID]);
    const selectedLevelCode = useMemo(
        () => String(currentLevelCode ?? DEFAULT_LEVEL_CODE),
        [currentLevelCode]
    );
    const shouldForceEditMode = useMemo(() => shouldForceEditModeFromUrl(), []);
    const showLevelControls = Boolean(isPuzzleGame);

    const handleButtonClick = (event) => {
        event.preventDefault();
        blurCurrentTarget(event);
        setStateIndex((prev) => {
            if (states[prev] === "Edit Mode") {
                return PLAY_MODE_INDEX;
            }

            return (prev + 1) % states.length;
        });
    };

    const handleKeyDown = suppressSpaceButtonActivation;

    useEffect(() => {
        setButtonMode(states[stateIndex]);
    }, [stateIndex, setButtonMode]);

    useEffect(() => {
        if (shouldForceEditMode && !hasAppliedInitialModeRef.current) {
            hasAppliedInitialModeRef.current = true;
            setStateIndex(EDIT_MODE_INDEX);
            return;
        }

        if (shouldForceEditMode) {
            return;
        }

        if (character || firstPerson) {
            setStateIndex(PLAY_MODE_INDEX);
        }
    }, [character, firstPerson, shouldForceEditMode]);

    useEffect(() => {
        setSoundUrl(audioUrl);
    }, [audioUrl, setSoundUrl]);

    // -----------------------------
    // Load levels list for dropdown
    // -----------------------------
    useEffect(() => {
        if (!showLevelControls) return;
        if (!baseProjectId) return;

        const controller = new AbortController();

        (async () => {
            try {
                setLoadingLevels(true);

                const res = await fetch(
                    `${import.meta.env.VITE_API_URL}/get-game-levels?project_id=${encodeURIComponent(baseProjectId)}`,
                    { signal: controller.signal }
                );

                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || `Failed to load levels (${res.status})`);
                }

                const rows = await res.json();

                const finalOptions = buildLevelOptions(rows);
                const defaultLevel = finalOptions.find((option) => String(option.code) === DEFAULT_LEVEL_CODE)
                    || finalOptions[0]
                    || { name: `L ${DEFAULT_LEVEL_CODE}`, code: DEFAULT_LEVEL_CODE };

                setLevels(finalOptions);

                const initialLevel = currentLevelCode
                    ? finalOptions.find((option) => String(option.code) === String(currentLevelCode))
                    : undefined;
                setSelectedLevel(initialLevel ?? defaultLevel);
            } catch (err) {
                if (err?.name === "AbortError") return;
                console.error("❌ load levels error:", err);

                const fallback = [{ name: `L ${DEFAULT_LEVEL_CODE}`, code: DEFAULT_LEVEL_CODE }];
                setLevels(fallback);
                // setSelectedLevel(fallback[0]);
            } finally {
                setLoadingLevels(false);
            }
        })();

        return () => controller.abort();
    }, [baseProjectId, buildLevelOptions, currentLevelCode, setLevels, setSelectedLevel, showLevelControls]);

    useEffect(() => {
        if (!showLevelControls) return;
        const desiredCode = currentLevelCode ? String(currentLevelCode) : DEFAULT_LEVEL_CODE;
        const nextSelectedLevel = levels.find((option) => String(option?.code) === desiredCode);

        if (!nextSelectedLevel) {
            return;
        }

        if (String(selectedLevel?.code) === desiredCode && selectedLevel === nextSelectedLevel) {
            return;
        }

        setSelectedLevel(nextSelectedLevel);
    }, [currentLevelCode, levels, selectedLevel, selectedLevel?.code, setSelectedLevel, showLevelControls]);

    // ---------------------------------------
    // Fetch selected row and apply to the game
    // ---------------------------------------
    const applyLevelRow = useCallback(
        async (levelCode) => {
            if (!baseProjectId || !levelCode) return;

            // cancel any previous in-flight row request
            if (abortRowRef.current) abortRowRef.current.abort();
            const controller = new AbortController();
            abortRowRef.current = controller;
            requestedLevelCodeRef.current = String(levelCode);

            try {
                setLoadingRow(true);

                const res = await fetch(
                    `${import.meta.env.VITE_API_URL}/get-game-level/one?project_id=${encodeURIComponent(
                        baseProjectId
                    )}&level=${encodeURIComponent(levelCode)}`,
                    { signal: controller.signal }
                );

                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || `Failed to load level row (${res.status})`);
                }

                const row = await res.json();
                if (requestedLevelCodeRef.current !== String(levelCode)) {
                    return;
                }

                // ✅ update store
                // setIsPuzzleGame(1);

                setGridSize({
                    x: parseInt(row.x_length, 10),
                    y: parseInt(row.y_length, 10),
                    z: parseInt(row.z_length, 10),
                    backgroundColor: row.bg_color?.startsWith("#") ? row.bg_color : `#${row.bg_color || "000"}`,
                });

                // ✅ update project id to include the selected level
                const nextProjectId = `${baseProjectId}_L${levelCode}`;
                if (String(useGame.getState().projectID || "") !== nextProjectId) {
                    syncProjectIdInUrl(nextProjectId);
                    setProjectID(nextProjectId);
                }
            } catch (err) {
                if (err?.name === "AbortError") return;
                console.error("❌ load level row error:", err);
            } finally {
                setLoadingRow(false);
            }
        },
        [baseProjectId, setGridSize, setProjectID, setIsPuzzleGame]
    );

    useEffect(() => {
        if (!showLevelControls) return;
        if (!baseProjectId) {
            return;
        }

        applyLevelRow(currentLevelCode || DEFAULT_LEVEL_CODE);
    }, [applyLevelRow, baseProjectId, currentLevelCode, showLevelControls]);

    // When dropdown selection changes
    const onLevelChange = async (e) => {
        const optionCode = String(e.value ?? DEFAULT_LEVEL_CODE);
        const option = levels.find((level) => String(level?.code) === optionCode) || { name: `L ${optionCode}`, code: optionCode };
        setSelectedLevel(option);
        if (String(option?.code) === '0') {
            requestedLevelCodeRef.current = "0";
            const nextProjectId = `${baseProjectId}_L0`;
            syncProjectIdInUrl(nextProjectId);
            setProjectID(nextProjectId);
            return;
        }

        await applyLevelRow(option?.code);
    };

    return (
        <div
            id="btn-container"
            className={` top-left-container-max  top-left-container`}
        >
            <MotionLevelToolbar>
                <div style={{ display: "flex", flexDirection: "row", gap: "0.2rem" }}>
                    <MotionControl>
                        <ToolbarButton
                            icon={isMin ? "pi pi-angle-right" : "pi pi-angle-left"}
                            className="max-min-action-btn"
                            onClick={() => setIsMin(!isMin)}
                            aria-label={isMin ? "Expand controls" : "Collapse controls"}
                        />
                    </MotionControl>

                    <MotionToolbarItems collapsed={isMin}>
                        <MotionControl className={buttonMode === "Edit Mode" ? "is-active-mode" : ""}>
                            <ToolbarButton
                                className="motion-mode-btn"
                                icon={modeIcons[states[stateIndex]]}
                                label={states[stateIndex]}
                                pulseIcon={buttonMode === "Edit Mode"}
                                onClick={handleButtonClick}
                                onKeyDown={handleKeyDown}
                                onKeyUp={handleKeyDown}
                            />
                        </MotionControl>

                        <MotionControl className="motion-level-dropdown-wrap">
                            {showLevelControls ? (
                                <Dropdown
                                    id="level"
                                    value={selectedLevelCode}
                                    onChange={onLevelChange}
                                    options={levels}
                                    optionLabel="name"
                                    optionValue="code"
                                    placeholder={loadingLevels ? "Loading..." : "Select level"}
                                    className="l-input-field motion-level-dropdown"
                                    disabled={loadingLevels || loadingRow}
                                />
                            ) : (
                                <div className="motion-floor-dropdown">
                                    <FloorItems colorValue={false} independent />
                                </div>
                            )}
                        </MotionControl>

                        {showLevelControls && !isMobile && (
                            <MotionControl>
                                <ToolbarButton
                                    icon="pi pi-plus"
                                    label="Add level"
                                    onClick={(event) => {
                                        blurCurrentTarget(event);
                                        setAddLevel(true);
                                    }}
                                    onKeyDown={handleKeyDown}
                                    onKeyUp={handleKeyDown}
                                />
                            </MotionControl>
                        )}

                        <MotionControl>
                            <ToolbarButton
                                icon="pi pi-refresh"
                                label="Restart"
                                onClick={(event) => {
                                    blurCurrentTarget(event);
                                    setRestart(!restart);
                                }}
                                onKeyDown={handleKeyDown}
                                onKeyUp={handleKeyDown}
                            />
                        </MotionControl>

                        <MotionControl>
                            <ToolbarButton
                                icon="pi pi-sparkles"
                                label="New Game"
                                pulseIcon
                                onClick={(event) => {
                                    blurCurrentTarget(event);
                                    setResetGame(!resetGame);
                                }}
                                onKeyDown={handleKeyDown}
                                onKeyUp={handleKeyDown}
                            />
                        </MotionControl>

                        <MotionControl>
                            <ToolbarButton
                                icon="pi pi-pause"
                                label="Pause"
                                onClick={(event) => {
                                    blurCurrentTarget(event);
                                    setPauseGame(true);
                                }}
                                onKeyDown={handleKeyDown}
                                onKeyUp={handleKeyDown}
                            />
                        </MotionControl>
                        {showLevelControls && buttonMode === 'Edit Mode' && !isMobile && isNaN(projectID) && (
                            <MotionControl className="motion-danger-control">
                                <ToolbarButton
                                    icon="pi pi-trash"
                                    label="Delete level"
                                    onClick={(event) => {
                                        blurCurrentTarget(event);
                                        setShowConfirmDelete(true);
                                    }}
                                    onKeyDown={handleKeyDown}
                                    onKeyUp={handleKeyDown}
                                />
                            </MotionControl>
                        )}
                    </MotionToolbarItems>
                </div>
            </MotionLevelToolbar>
        </div>
    );
};

export default TopLeftControls;
