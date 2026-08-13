import React, { useEffect, useRef, useState } from "react";
import "./pauseMenu.css";
import useGame from "../../../hooks/useGame";

export default function PauseMenu({
                                      open = true,
                                      onClose,
                                      onResume,
                                      onOptions,
                                      onSave,
                                      onExitToMain,
                                      onQuit,
                                  }) {
    const items = [
        { label: "RESUME", action: onResume ?? onClose },
        { label: "OPTIONS", action: onOptions },
        { label: "SAVE GAME", action: onSave },
        { label: "EXIT TO MAIN MENU", action: onExitToMain },
        { label: "QUIT GAME", action: onQuit },
    ];

    const [active, setActive] = useState(0);
    const menuRef = useRef(null);
    const setPauseGame = useGame((state) => state.setPauseGame)
    const setToMainMenu = useGame((state) => state.setToMainMenu)

    useEffect(() => {
        if (open) menuRef.current?.focus();
    }, [open]);

    const handleKey = (e) => {
        if (e.key === "Escape") return onClose?.();
        if (e.key === "ArrowDown") setActive((i) => (i + 1) % items.length);
        if (e.key === "ArrowUp") setActive((i) => (i - 1 + items.length) % items.length);
        if (e.key === "Home") setActive(0);
        if (e.key === "End") setActive(items.length - 1);
        if (e.key === "Enter" || e.key === " ") items[active].action?.();
    };




    const handleClick = (label) => {
        if(label==="RESUME"){
            setPauseGame(false);
        }
        else if(label==="EXIT TO MAIN MENU"){
            setPauseGame(false);
            setToMainMenu(true)
        }

    }

    if (!open) return null;


    return (
        <div className="pause-overlay" role="dialog" aria-modal="true">
            <button className="pause-close" onClick={onClose} aria-label="Close">✕</button>

            <div
                className="pause-menu"
                tabIndex={0}
                ref={menuRef}
                onKeyDown={handleKey}
                aria-label="Pause Menu"
            >
                <ul className="pause-list">
                    {items.map((it, i) => (
                        <li key={it.label} className="pause-item-list">
                            <button
                                className={`pause-item ${i === active ? "is-active" : ""}`}
                                onMouseEnter={() => setActive(i)}
                                onClick={() =>handleClick(it.label)}
                            >
                                {it.label}
                            </button>
                        </li>
                    ))}
                </ul>

                {/*<div className="pause-footer">*/}
                {/*    <button className="btn-secondary" onClick={onClose}>BACK</button>*/}
                {/*</div>*/}
            </div>
        </div>
    );
}
