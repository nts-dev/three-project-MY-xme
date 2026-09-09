import React, { useCallback } from "react";
import { FaEye, FaLocationArrow, FaVideo } from "react-icons/fa";
import useGame from "../../../../hooks/useGame";
import { publicAssetUrl } from "../../../../puzzleUi/publicAssetUrl";
import VrViewButton from "./VrViewButton";

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
    const playerTrackReplay = useGame((state) => state.playerTrackReplay);
    const setPlayerTrackReplay = useGame((state) => state.setPlayerTrackReplay);
    const cameraPathReplay = useGame((state) => state.cameraPathReplay);
    const setCameraPathReplay = useGame((state) => state.setCameraPathReplay);
    const cameraRealtimeFollow = useGame((state) => state.cameraRealtimeFollow);
    const setCameraRealtimeFollow = useGame((state) => state.setCameraRealtimeFollow);

    const activeView = firstPerson ? "firstPerson" : character ? "character" : "orbit";

    const setViewMode = useCallback(
        (mode) => {
            setCameraPathReplay(false);
            setCameraRealtimeFollow(false);

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

            setButtonMode("Play mode");
            setFirstPerson(false);
            setCharacter(false);
        },
        [setButtonMode, setCameraPathReplay, setCameraRealtimeFollow, setCharacter, setFirstPerson]
    );

    const toggleCameraPathReplay = useCallback(() => {
        const nextCameraPathReplay = !cameraPathReplay;

        setButtonMode("Play mode");
        setFirstPerson(false);
        setCharacter(false);
        setCameraPathReplay(nextCameraPathReplay);
        if (nextCameraPathReplay) setCameraRealtimeFollow(false);
    }, [cameraPathReplay, setButtonMode, setCameraPathReplay, setCameraRealtimeFollow, setCharacter, setFirstPerson]);

    const toggleCameraRealtimeFollow = useCallback(() => {
        const nextCameraRealtimeFollow = !cameraRealtimeFollow;

        setButtonMode("Play mode");
        if (nextCameraRealtimeFollow) {
            setFirstPerson(false);
            setCharacter(false);
            setCameraPathReplay(false);
        }
        setCameraRealtimeFollow(nextCameraRealtimeFollow);
    }, [cameraRealtimeFollow, setButtonMode, setCameraPathReplay, setCameraRealtimeFollow, setCharacter, setFirstPerson]);

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
                <VrViewButton />
            </div>

            <button
                type="button"
                className={`play-view-controls__button play-view-controls__button--camera-path${cameraPathReplay ? " is-active" : ""}`}
                aria-label={cameraPathReplay ? "Stop camera route" : "Play camera route"}
                aria-pressed={cameraPathReplay}
                data-tooltip={cameraPathReplay ? "Stop camera route" : "Play camera route"}
                onClick={toggleCameraPathReplay}
            >
                <FaLocationArrow className="play-view-controls__svg-icon play-view-controls__svg-icon--cameraPath" aria-hidden="true" />
            </button>

            <button
                type="button"
                className={`play-view-controls__button play-view-controls__button--camera-realtime${cameraRealtimeFollow ? " is-active" : ""}`}
                aria-label={cameraRealtimeFollow ? "Stop realtime camera follow" : "Follow walking camera"}
                aria-pressed={cameraRealtimeFollow}
                data-tooltip={cameraRealtimeFollow ? "Stop realtime camera follow" : "Follow walking camera"}
                onClick={toggleCameraRealtimeFollow}
            >
                <FaEye className="play-view-controls__svg-icon play-view-controls__svg-icon--cameraRealtime" aria-hidden="true" />
            </button>

            <button
                type="button"
                className={`play-view-controls__button play-view-controls__button--navigation${playerTrackReplay ? " is-active" : ""}`}
                aria-label={playerTrackReplay ? "Stop player track" : "Play player track"}
                aria-pressed={playerTrackReplay}
                data-tooltip={playerTrackReplay ? "Stop player track" : "Play player track"}
                onClick={() => setPlayerTrackReplay(!playerTrackReplay)}
            >
                <img className="play-view-controls__asset-icon play-view-controls__asset-icon--navigation" src={navigationIconUrl} alt="" aria-hidden="true" />
            </button>
        </div>
    );
}
