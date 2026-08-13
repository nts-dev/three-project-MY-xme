import React, { useMemo, useState, useCallback } from "react";
import "./options.css";



export default function Options({ onClose }) {
    const [active, setActive] = useState("KEYBOARD"); // default selected like screenshot

    const tabs = useMemo(
        () => ([
            { key: "DISPLAY",   label: "DISPLAY" },
            { key: "AUDIO",     label: "AUDIO & LANGUAGES" },
            { key: "GRAPHICS",  label: "GRAPHICS" },
            { key: "KEYBOARD",  label: "KEYBOARD & MOUSE" },
            { key: "GAMEPAD",   label: "GAMEPAD" },
        ]),
        []
);

    const onKeyNav = useCallback((e) => {
        const idx = tabs.findIndex(t => t.key === active);
        if (e.key === "ArrowRight") {
            setActive(tabs[(idx + 1) % tabs.length].key);
        } else if (e.key === "ArrowLeft") {
            setActive(tabs[(idx - 1 + tabs.length) % tabs.length].key);
        }
    }, [active, tabs]);

    return (
        <div className="options-container">
            <div className="options-scroll-wrapper">
                {/* Close */}
                {/*<button className="close-button" onClick={onClose} aria-label="Close">✕</button>*/}

                {/* Title row */}
                <div className="options-title-row">
                    <h2 className="options-title">OPTIONS</h2>
                    <div className="options-title-line" />
                </div>

                {/* Menu */}
                <div
                    className="options-menu"
                    role="tablist"
                    aria-label="Options menu"
                    tabIndex={0}
                    onKeyDown={onKeyNav}
                >
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            role="tab"
                            aria-selected={active === t.key}
                            className={`options-tab ${active === t.key ? "is-active" : ""}`}
                            onClick={() => setActive(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Content area (simple placeholders; plug in your real content per tab) */}
                <div className="options-panel">
                    {active === "DISPLAY"   && <div className="panel-body">Display settings…</div>}
                    {active === "AUDIO"     && <div className="panel-body">Audio & language settings…</div>}
                    {active === "GRAPHICS"  && <div className="panel-body">Graphics settings…</div>}
                    {active === "GAMEPAD"   && <div className="panel-body">Gamepad settings…</div>}
                    {active === "KEYBOARD" && (
                        <div className="panel-body">
                            <div className="kbm-wrap">
                                <div className="kbm-keyboard" aria-label="Keyboard layout" />
                                <div className="kbm-mouse" aria-label="Mouse layout" />
                            </div>
                        </div>
                    )}

                </div>
                <button className="options-back-button" onClick={onClose}>Back</button>
            </div>
        </div>
    );
}
