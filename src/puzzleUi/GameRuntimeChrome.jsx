import React, { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { FaExpand } from "react-icons/fa";
import useGame from "../hooks/useGame";
import { publicAssetCssUrl } from "./publicAssetUrl";
import { injectPlayHudFont } from "./playHudFont";
import "./index.css";

const buttonBgUrl = publicAssetCssUrl("button-bg.svg");

const RuntimeButton = ({ label, className = "", children, onClick, pressed }) => (
    <button
        type="button"
        className={`game-runtime-button ${className}`.trim()}
        aria-label={label}
        aria-pressed={pressed}
        onClick={(event) => {
            event.currentTarget.blur();
            onClick?.();
        }}
        onKeyDown={(event) => {
            if (event.code === "Space") {
                event.preventDefault();
            }
        }}
        onKeyUp={(event) => {
            if (event.code === "Space") {
                event.preventDefault();
            }
        }}
    >
        {children}
    </button>
);

export default function GameRuntimeChrome({ cameraRef }) {
    const setPauseGame = useGame((state) => state.setPauseGame);
    const setCharacter = useGame((state) => state.setCharacter);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        injectPlayHudFont();
    }, []);

    const zoomCamera = useCallback((directionMultiplier) => {
        const camera = cameraRef?.current;
        if (!camera) {
            return;
        }

        const direction = new THREE.Vector3(0, 0, directionMultiplier);
        direction.applyQuaternion(camera.quaternion);
        camera.position.add(direction.multiplyScalar(0.55));
        camera.updateProjectionMatrix?.();
    }, [cameraRef]);

    const exitPlayMode = useCallback(async () => {
        setPauseGame(false);
        setCharacter(false);
        setFirstPerson(false);
        setButtonMode("Edit Mode");

        if (document.fullscreenElement) {
            try {
                await document.exitFullscreen();
            } catch (error) {
                console.warn("Fullscreen exit failed:", error);
            }
        }
    }, [setButtonMode, setCharacter, setFirstPerson, setPauseGame]);

    return (
        <div
            className="game-runtime-chrome"
            aria-label="Game runtime controls"
            style={{ "--game-button-bg-url": buttonBgUrl }}
        >
            {isMinimized ? (
                <RuntimeButton
                    label="Restore controls"
                    className="game-runtime-button--restore"
                    onClick={() => setIsMinimized(false)}
                >
                    PLAY
                </RuntimeButton>
            ) : (
                <>
                    <div className="game-runtime-topbar">
                        <RuntimeButton
                            label="Play"
                            className="game-runtime-button--play"
                            pressed
                            onClick={() => setPauseGame(false)}
                        >
                            PLAY
                        </RuntimeButton>
                        <RuntimeButton
                            label="Exit play mode"
                            className="game-runtime-button--minimize"
                            onClick={() => {
                                void exitPlayMode();
                            }}
                        >
                            <FaExpand aria-hidden="true" />
                        </RuntimeButton>
                    </div>

                    <div className="game-runtime-sidebar">
                        <RuntimeButton
                            label="Play"
                            className="game-runtime-button--round"
                            pressed
                            onClick={() => setPauseGame(false)}
                        >
                            ▶
                        </RuntimeButton>
                        <RuntimeButton
                            label="Zoom in"
                            className="game-runtime-button--round"
                            onClick={() => zoomCamera(-1)}
                        >
                            +
                        </RuntimeButton>
                        <RuntimeButton
                            label="Zoom out"
                            className="game-runtime-button--round"
                            onClick={() => zoomCamera(1)}
                        >
                            -
                        </RuntimeButton>
                    </div>
                </>
            )}
        </div>
    );
}
