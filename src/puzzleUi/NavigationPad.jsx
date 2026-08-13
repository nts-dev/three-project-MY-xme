import { useCallback, useEffect, useRef, useState } from "react";
import { useJoystickControls } from "../hooks/useJoystickControls";
import { publicAssetUrl } from "./publicAssetUrl";
import "./index.css";

const arrowIconUrl = publicAssetUrl("arrow.svg");
const selectedArrowIconUrl = publicAssetUrl("selected arrow.svg");

const DIRECTIONS = [
    { key: "up", label: "Move forward", angle: Math.PI / 2 },
    { key: "right", label: "Move right", angle: 0 },
    { key: "down", label: "Move backward", angle: (Math.PI * 3) / 2 },
    { key: "left", label: "Move left", angle: Math.PI },
];

export default function NavigationPad() {
    const setJoystick = useJoystickControls((state) => state.setJoystick);
    const resetJoystick = useJoystickControls((state) => state.resetJoystick);
    const [activeDirection, setActiveDirection] = useState(null);
    const activeDirectionRef = useRef(null);

    const stopMovement = useCallback(() => {
        activeDirectionRef.current = null;
        setActiveDirection(null);
        resetJoystick();
    }, [resetJoystick]);

    const startMovement = useCallback(
        (direction) => {
            activeDirectionRef.current = direction.key;
            setActiveDirection(direction.key);
            setJoystick(1, direction.angle, false);
        },
        [setJoystick]
    );

    useEffect(() => {
        window.addEventListener("pointerup", stopMovement);
        window.addEventListener("blur", stopMovement);

        return () => {
            window.removeEventListener("pointerup", stopMovement);
            window.removeEventListener("blur", stopMovement);
            resetJoystick();
        };
    }, [resetJoystick, stopMovement]);

    return (
        <nav className="game-navigation-pad" aria-label="Movement controls">
            {DIRECTIONS.map((direction) => {
                const isActive = activeDirection === direction.key;

                return (
                    <button
                        key={direction.key}
                        type="button"
                        className={`game-navigation-pad__button game-navigation-pad__button--${direction.key}${isActive ? " is-active" : ""}`}
                        aria-label={direction.label}
                        aria-pressed={isActive}
                        onPointerDown={(event) => {
                            event.preventDefault();
                            event.currentTarget.setPointerCapture?.(event.pointerId);
                            startMovement(direction);
                        }}
                        onPointerCancel={stopMovement}
                        onContextMenu={(event) => event.preventDefault()}
                    >
                        <img
                            className="game-navigation-pad__segment game-navigation-pad__segment--idle"
                            src={arrowIconUrl}
                            alt=""
                            draggable="false"
                        />
                        <img
                            className="game-navigation-pad__segment game-navigation-pad__segment--active"
                            src={selectedArrowIconUrl}
                            alt=""
                            draggable="false"
                        />
                    </button>
                );
            })}
        </nav>
    );
}
