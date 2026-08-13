import { useEffect, useMemo, useState } from "react";
import useGame from "../../../hooks/useGame.tsx";
import { publicAssetCssUrl } from "../../../puzzleUi/publicAssetUrl";
import "./GameConfirm.css";

const DEFAULT_PLAYER = {
    username: "",
    colorName: "Yellow",
    colorCode: "YL"
};

const FALLBACK_COLORS = [
    { name: "Yellow", code: "YL" },
    { name: "Blue", code: "BL" },
    { name: "Red", code: "RD" },
    { name: "Green", code: "GR" },
    { name: "Brown", code: "BR" },
    { name: "White", code: "WH" },
    { name: "Purple", code: "PU" },
    { name: "Orange", code: "OR" }
];

const SWATCH_COLORS = {
    YL: "#f8e84b",
    BL: "#33a4ff",
    RD: "#ff6262",
    GR: "#2dff88",
    BR: "#c9854a",
    WH: "#f0f0f0",
    PU: "#4a4cc9",
    OR: "#f87603"
};

const buttonBgUrl = publicAssetCssUrl("button-bg.svg");
const leftAnchorUrl = publicAssetCssUrl("left.svg");
const rightAnchorUrl = publicAssetCssUrl("right.svg");

function readPlayerDefaults() {
    if (typeof window === "undefined") {
        return DEFAULT_PLAYER;
    }

    const params = new URLSearchParams(window.location.search);

    return {
        username: params.get("username") || DEFAULT_PLAYER.username,
        colorName: params.get("color") || DEFAULT_PLAYER.colorName,
        colorCode: params.get("colorCode") || DEFAULT_PLAYER.colorCode
    };
}

function getColorPreview(option) {
    const code = String(option?.code || "").toUpperCase();
    const name = String(option?.name || "").toLowerCase();

    if (SWATCH_COLORS[code]) return SWATCH_COLORS[code];
    if (name.includes("yellow")) return SWATCH_COLORS.YL;
    if (name.includes("blue")) return SWATCH_COLORS.BL;
    if (name.includes("red")) return SWATCH_COLORS.RD;
    if (name.includes("green")) return SWATCH_COLORS.GR;
    if (name.includes("brown")) return SWATCH_COLORS.BR;
    if (name.includes("white")) return SWATCH_COLORS.WH;
    if (name.includes("purple")) return SWATCH_COLORS.PU;
    if (name.includes("orange")) return SWATCH_COLORS.OR;

    return "#31e5e8";
}

export default function AvatarSetupConfirm() {
    const setAvatarColor = useGame((state) => state.setAvatarColor);
    const setUName = useGame((state) => state.setUName);
    const setGameStartTick = useGame((state) => state.setGameStartTick);
    const setUColor = useGame((state) => state.setUColor);
    const setWaiting = useGame((state) => state.setWaiting);
    const setPauseGame = useGame((state) => state.setPauseGame);
    const setCharacter = useGame((state) => state.setCharacter);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const avatarColors = useGame((state) => state.avatarColors);
    const defaults = useMemo(() => readPlayerDefaults(), []);
    const colorOptions = avatarColors?.length ? avatarColors : FALLBACK_COLORS;
    const [isOpen, setIsOpen] = useState(true);
    const [playerName, setPlayerName] = useState(() => defaults.username);
    const [selectedColorCode, setSelectedColorCode] = useState("");
    const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);

    useEffect(() => {
        setPauseGame(true);
    }, [setPauseGame]);

    const selectedColor = useMemo(() => (
        colorOptions.find((option) => String(option.code) === selectedColorCode) || null
    ), [colorOptions, selectedColorCode]);

    useEffect(() => {
        if (!selectedColorCode || colorOptions.some((option) => String(option.code) === selectedColorCode)) {
            return;
        }

        setSelectedColorCode("");
    }, [colorOptions, selectedColorCode]);

    const handleSubmit = (event) => {
        event.preventDefault();

        const safeName = playerName.trim();
        if (!safeName || !selectedColor) {
            return;
        }

        setUName(safeName);
        setWaiting("true");
        setUColor(selectedColor);
        setAvatarColor(selectedColor.code);
        setPauseGame(false);
        setGameStartTick();
        setIsOpen(false);
    };

    const handleCancel = async () => {
        setPauseGame(false);
        setCharacter(false);
        setFirstPerson(false);
        setButtonMode("Edit Mode");
        setIsOpen(false);

        if (document.fullscreenElement) {
            try {
                await document.exitFullscreen();
            } catch (error) {
                console.warn("Fullscreen exit failed:", error);
            }
        }
    };

    if (!isOpen) {
        return null;
    }

    const canStart = Boolean(playerName.trim() && selectedColor && colorOptions.length);

    return (
        <div
            className="game-confirm-overlay"
            style={{
                "--game-button-bg-url": buttonBgUrl,
                "--game-left-anchor-url": leftAnchorUrl,
                "--game-right-anchor-url": rightAnchorUrl,
            }}
        >
            <form className="game-confirm-panel" onSubmit={handleSubmit}>
                <span className="game-confirm-panel__glass" aria-hidden="true" />
                <span className="game-confirm-anchor game-confirm-anchor--tl" aria-hidden="true" />
                <span className="game-confirm-anchor game-confirm-anchor--tr" aria-hidden="true" />
                <span className="game-confirm-anchor game-confirm-anchor--bl" aria-hidden="true" />
                <span className="game-confirm-anchor game-confirm-anchor--br" aria-hidden="true" />
                <div className="game-confirm-panel__header">
                    <span className="game-confirm-panel__icon" aria-hidden="true" />
                    <span>PLAYER SETUP</span>
                </div>

                <label className="game-confirm-field">
                    <span>USER NAME</span>
                    <input
                        value={playerName}
                        onChange={(event) => setPlayerName(event.target.value)}
                        maxLength={24}
                        required
                        autoFocus
                    />
                </label>

                <label className="game-confirm-field game-confirm-field--color">
                    <span>COLOR</span>
                    <div
                        className={`game-confirm-dropdown${isColorMenuOpen ? " is-open" : ""}`}
                        onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                                setIsColorMenuOpen(false);
                            }
                        }}
                    >
                        <button
                            type="button"
                            className="game-confirm-dropdown__trigger"
                            aria-haspopup="listbox"
                            aria-expanded={isColorMenuOpen}
                            onClick={() => setIsColorMenuOpen((current) => !current)}
                        >
                            {selectedColor ? (
                                <span className="game-confirm-dropdown__value">
                                    <span
                                        className="game-confirm-dropdown__swatch"
                                        style={{ backgroundColor: getColorPreview(selectedColor) }}
                                        aria-hidden="true"
                                    />
                                    <span>{selectedColor.name}</span>
                                </span>
                            ) : (
                                <span>Select player color</span>
                            )}
                            <span className="game-confirm-dropdown__chevron" aria-hidden="true" />
                        </button>
                        {isColorMenuOpen && (
                            <div className="game-confirm-dropdown__menu" role="listbox" tabIndex={-1}>
                                {colorOptions.map((option) => {
                                    const isSelected = selectedColorCode === option.code;

                                    return (
                                        <button
                                            key={`${option.name}-${option.code}`}
                                            type="button"
                                            className={`game-confirm-dropdown__option${isSelected ? " is-selected" : ""}`}
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={() => {
                                                setSelectedColorCode(option.code);
                                                setIsColorMenuOpen(false);
                                            }}
                                        >
                                            <span
                                                className="game-confirm-dropdown__swatch"
                                                style={{ backgroundColor: getColorPreview(option) }}
                                                aria-hidden="true"
                                            />
                                            <span>{option.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </label>

                <div className="game-confirm-actions">
                    <button className="game-confirm-action game-confirm-action--cancel" type="button" onClick={handleCancel}>
                        CANCEL
                    </button>
                    <button className="game-confirm-action game-confirm-action--start" type="submit" disabled={!canStart}>
                        START
                    </button>
                </div>
            </form>
        </div>
    );
}
