import React, { useCallback } from "react";
import { FaVideo } from "react-icons/fa";
import useGame from "../../../../hooks/useGame";
import { publicAssetUrl } from "../../../../puzzleUi/publicAssetUrl";

const characterIconUrl = publicAssetUrl("character.svg");
const freeCameraIconUrl = publicAssetUrl("freecamera.svg");
const navigationIconUrl = publicAssetUrl("navigation.svg");

const VIEW_CONTROLS = [
    {
        id: "firstPerson",
        label: "First person view",
        Icon: FaVideo,
    },
    {
        id: "character",
        label: "Character view",
        src: characterIconUrl,
    },
    {
        id: "orbit",
        label: "Free navigation view",
        src: freeCameraIconUrl,
    },
];

export default function PlayModeViewControls() {
    const firstPerson = useGame((state) => state.firstPerson);
    const character = useGame((state) => state.character);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setCharacter = useGame((state) => state.setCharacter);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const controlClose = useGame((state) => state.controlClose);
    const setControlClose = useGame((state) => state.setControlClose);

    const activeView = firstPerson ? "firstPerson" : character ? "character" : "orbit";

    const setViewMode = useCallback(
        (mode) => {
            if (mode === "firstPerson") {
                setButtonMode("Play mode");
                setFirstPerson(true);
                setCharacter(false);
                return;
            }

            if (mode === "character") {
                setButtonMode("Play mode");
                setFirstPerson(false);
                setCharacter(true);
                return;
            }

            setButtonMode("Edit Mode");
            setFirstPerson(false);
            setCharacter(false);
        },
        [setButtonMode, setCharacter, setFirstPerson]
    );

    return (
        <div className="play-view-controls" role="toolbar" aria-label="Play mode view controls">
            <div className="play-view-controls__radio" role="radiogroup" aria-label="Camera mode">
                {VIEW_CONTROLS.map(({ id, label, Icon: ViewIcon, src }) => {
                    return (
                        <button
                            key={id}
                            type="button"
                            className={`play-view-controls__button${activeView === id ? " is-active" : ""}`}
                            aria-label={label}
                            aria-checked={activeView === id}
                            data-tooltip={label}
                            role="radio"
                            onClick={() => setViewMode(id)}
                        >
                            {src ? (
                                <img className={`play-view-controls__asset-icon play-view-controls__asset-icon--${id}`} src={src} alt="" aria-hidden="true" />
                            ) : (
                                React.createElement(ViewIcon, { className: `play-view-controls__svg-icon play-view-controls__svg-icon--${id}`, "aria-hidden": "true" })
                            )}
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                className={`play-view-controls__button play-view-controls__button--navigation${controlClose ? " is-active" : ""}`}
                aria-label="Navigation controls"
                aria-pressed={controlClose}
                data-tooltip="Navigation controls"
                onClick={() => setControlClose(!controlClose)}
            >
                <img className="play-view-controls__asset-icon play-view-controls__asset-icon--navigation" src={navigationIconUrl} alt="" aria-hidden="true" />
            </button>
        </div>
    );
}
