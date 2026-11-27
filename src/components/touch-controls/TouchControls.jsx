import { useCallback, useRef, useState } from "react";
import { useJoystickControls } from "../../hooks/useJoystickControls";
import "./TouchControls.css";

// On-screen controls for walking on touch screens: a joystick (bottom left) and a Walk/Run
// buttons (bottom right). Plain HTML, no WebGL: the earlier 3D joystick used two extra WebGL
// canvases, which browsers drop when a page has too many, and then the controls vanished.
// Feeds the same store as before (useJoystickControls), so the character controller is unchanged.

const MAX_PUSH = 0.65; // share of the base radius that counts as full push (as the old joystick)

export default function TouchControls() {
    const setJoystick = useJoystickControls((state) => state.setJoystick);
    const resetJoystick = useJoystickControls((state) => state.resetJoystick);
    const toggleRun = useJoystickControls((state) => state.toggleRun);
    const running = useJoystickControls((state) => state.curRunToggle);

    const baseRef = useRef(null);
    const pointerRef = useRef(null);
    const [knob, setKnob] = useState({ x: 0, y: 0, active: false });

    const move = useCallback((event) => {
        const base = baseRef.current;
        if (!base) return;
        const rect = base.getBoundingClientRect();
        const radius = rect.width / 2;
        const dx = event.clientX - (rect.left + radius);
        const dy = event.clientY - (rect.top + radius);
        const length = Math.hypot(dx, dy);
        const travel = radius * 0.58; // how far the knob can move from the centre
        const k = length > travel ? travel / length : 1;
        setKnob({ x: dx * k, y: dy * k, active: true });
        // Same units as the 3D joystick: pixels, capped at MAX_PUSH x radius; angle counter-clockwise
        // from the right, screen up = +y.
        const maxDistance = radius * MAX_PUSH;
        const distance = Math.min(length, maxDistance);
        const angle = (Math.atan2(-dy, dx) + 2 * Math.PI) % (2 * Math.PI);
        setJoystick(distance, angle, false, maxDistance > 0 ? distance / maxDistance : 1);
    }, [setJoystick]);

    const onStickDown = (event) => {
        if (pointerRef.current !== null) return;
        pointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        move(event);
    };
    const onStickMove = (event) => {
        if (event.pointerId !== pointerRef.current) return;
        event.preventDefault();
        move(event);
    };
    const onStickUp = (event) => {
        if (event.pointerId !== pointerRef.current) return;
        pointerRef.current = null;
        setKnob({ x: 0, y: 0, active: false });
        resetJoystick();
    };

    const stop = (event) => event.preventDefault();

    return (
        <div className="touch-controls" onContextMenu={stop}>
            <div
                ref={baseRef}
                className={`touch-controls__stick${knob.active ? " is-active" : ""}`}
                role="application"
                aria-label="Movement joystick"
                onPointerDown={onStickDown}
                onPointerMove={onStickMove}
                onPointerUp={onStickUp}
                onPointerCancel={onStickUp}
            >
                <span className="touch-controls__ring" aria-hidden="true" />
                <span className="touch-controls__arrow touch-controls__arrow--up" aria-hidden="true" />
                <span className="touch-controls__arrow touch-controls__arrow--right" aria-hidden="true" />
                <span className="touch-controls__arrow touch-controls__arrow--down" aria-hidden="true" />
                <span className="touch-controls__arrow touch-controls__arrow--left" aria-hidden="true" />
                <span className="touch-controls__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} aria-hidden="true" />
            </div>

            <div className="touch-controls__actions">
                <button
                    type="button"
                    className={`touch-controls__button touch-controls__button--run${running ? " is-on" : ""}`}
                    aria-pressed={running}
                    aria-label={running ? "Running: tap to walk" : "Walking: tap to run"}
                    onPointerDown={(event) => {
                        event.preventDefault();
                        toggleRun();
                    }}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        {running ? (
                            <path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6A2 2 0 0 0 12 6c-.3 0-.5 0-.8.1L6 8.3V13h2V9.6l1.8-.7Z" />
                        ) : (
                            <path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM9.9 8.9 7.1 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5 5 0 0 1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5 0-.8.1L6 8.3V13h2V9.6l1.9-.7Z" opacity="0.9" />
                        )}
                    </svg>
                    <span>{running ? "Run" : "Walk"}</span>
                </button>
            </div>
        </div>
    );
}
