import React, { useRef, useEffect } from "react";
import "./StatsPopup.css";

import useGame from "../../../../hooks/useGame";
import useInterface from "../../../../hooks/stores/useInterface.jsx";
import confetti from "canvas-confetti";
import * as THREE from "three";
import {
    enPc,
    horizontalSpeed,
    realTimeChaPosition
} from "../../../../threejs/player/puzzle/character/Constants.jsx";

// ✅ Only update DOM if value actually changed
function setText(ref, text) {
    if (!ref.current) return;
    if (ref.current.textContent !== text) {
        ref.current.textContent = text;
    }
}

const TIMEOUT_MS = 12_000_000;
const UI_INTERVAL = 100;

export default function StatsPopup() {
    // UI refs
    const timeRef = useRef();
    const posRef = useRef();
    const distRef = useRef();
    const speedRef = useRef();
    const levelRef = useRef();
    const enPcRef = useRef();

    // Zustand state for slow-changing UI values
    const noOfLivesRemaining = useGame((s) => s.noOfLivesRemaining);
    const noOfCoins = useGame((s) => s.noOfCoins);
    const hp = useGame((s) => s.hp);
    const tokenCode = useGame((s) => s.tokenCode);

    const timeout = useInterface((s) => s.timeout);
    const isRecovering = useGame((s) => s.isRecovering);
    const setSoundUrl = useGame((s) => s.setSoundUrl);
    const pauseGame = useGame((s) => s.pauseGame);
    const toMainMenu = useGame((s) => s.toMainMenu);
    const speedFactor = useGame((s) => s.speedFactor);

    // Pause/Timer
    const timeoutRef = useRef(null);
    const pausedAtRef = useRef(null);
    const pausedAccumRef = useRef(0);
    const frozenElapsedRef = useRef(0);
    const lastSoundPhaseRef = useRef(null);

    // Movement tracking
    const lastPosRef = useRef(new THREE.Vector3());
    const lastTimeRef = useRef(performance.now());
    const totalDistanceRef = useRef(0);

    // ✅ Create reusable Vector3 to avoid allocations
    const posV = useRef(new THREE.Vector3()).current;

    // ✅ Throttle UI updates to 10 fps (100ms)
    // ✅ Coin confetti (only runs when noOfCoins changes)
    useEffect(() => {
        if (noOfCoins > 0) {
            const el = document.getElementById("timer");
            if (!el) return;
            const rect = el.getBoundingClientRect();

            confetti({
                particleCount: 50,
                spread: 90,
                origin: {
                    x: (rect.left + rect.width / 2) / window.innerWidth,
                    y: (rect.top + rect.height / 2) / window.innerHeight
                },
                colors: ["#FFD700", "#FFEC8B", "#DAA520"]
            });
        }
    }, [noOfCoins]);

    // ✅ Main update loop — NO React re-render
    useEffect(() => {
        const updateStats = () => {
            const now = performance.now();

            const state = useInterface.getState();

            let elapsedMs = 0;
            const isPaused =
                state.phase === "paused" || pauseGame === true || toMainMenu === true;

            // ✅ TIMER LOGIC (unchanged — just faster)
            if (state.phase === "ended") {
                if (lastSoundPhaseRef.current !== "ended") {
                    setSoundUrl("game_over.mp3");
                    lastSoundPhaseRef.current = "ended";
                }
                elapsedMs = Math.max(
                    0,
                    state.endTime - state.startTime - pausedAccumRef.current
                );
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            } else if (state.phase === "timeout") {
                if (lastSoundPhaseRef.current !== "timeout") {
                    setSoundUrl("game_fail.mp3");
                    lastSoundPhaseRef.current = "timeout";
                }
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            } else if (state.phase === "playing") {
                lastSoundPhaseRef.current = null;
            }

            if (state.phase === "playing") {
                if (isPaused) {
                    if (pausedAtRef.current == null) {
                        pausedAtRef.current = Date.now();
                        frozenElapsedRef.current =
                            Math.max(
                                0,
                                Date.now() - state.startTime - pausedAccumRef.current
                            ) / 1000;
                        clearTimeout(timeoutRef.current);
                        timeoutRef.current = null;
                    }
                    elapsedMs = frozenElapsedRef.current * 1000;
                } else {
                    if (pausedAtRef.current != null) {
                        pausedAccumRef.current += Date.now() - pausedAtRef.current;
                        pausedAtRef.current = null;
                    }
                    elapsedMs = Math.max(
                        0,
                        Date.now() - state.startTime - pausedAccumRef.current
                    );

                    if (!timeoutRef.current) {
                        const remaining = Math.max(0, TIMEOUT_MS - elapsedMs);
                        timeoutRef.current = setTimeout(() => {
                            if (useInterface.getState().phase === "playing") {
                                timeout(isRecovering);
                            }
                        }, remaining);
                    }
                }
            }

            // ✅ Format timer text
            const secs = elapsedMs / 1000;
            const minutes = Math.floor(secs / 60);
            const seconds = Math.floor(secs % 60);
            const ms = (secs % 1).toFixed(1).slice(2);

            setText(timeRef, `${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}:${ms}`);

            // ✅ POSITION + LEVEL
            posV.set(realTimeChaPosition.x, realTimeChaPosition.y, realTimeChaPosition.z);

            setText(posRef, `${(posV.x * 100).toFixed(0)}, ${(posV.z * 100).toFixed(0)}, ${(posV.y * 100).toFixed(0)}`);

            const level = Math.floor(posV.y / 0.1);
            setText(levelRef, `${Math.max(0, level)}`);

            // ✅ DISTANCE + SPEED
            const dt = (now - lastTimeRef.current) / 1000;
            if (dt > 0) {
                const step = posV.distanceTo(lastPosRef.current);
                totalDistanceRef.current += step;

                const total = totalDistanceRef.current;
                setText(
                    distRef,
                    total > 1000 ? `${(total / 1000).toFixed(2)} km` : `${total.toFixed(2)} m`
                );

                setText(speedRef, `${(
                    (((horizontalSpeed.current * speedFactor) / 0.83) * 19.44)
                ).toFixed(2)} km/h`);

                lastPosRef.current.copy(posV);
                lastTimeRef.current = now;
            }

            // ✅ ENERGY %
            setText(enPcRef, `${enPc?.current}%`);
        };

        updateStats();
        const intervalId = window.setInterval(updateStats, UI_INTERVAL);

        return () => {
            window.clearInterval(intervalId);
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        };
    }, [pauseGame, toMainMenu, setSoundUrl, timeout, isRecovering, speedFactor]);

    return (
        <div id="popup-stats" className="stats-popup">
            <div className="stats-popup__inner">
                <div className="stats-popup__item stats-popup__item--wide">
                    <span className="stats-popup__label">POS</span>
                    <span ref={posRef} className="stats-popup__value" />
                </div>
                <div className="stats-popup__divider" />
                <div className="stats-popup__item stats-popup__item--level">
                    <span className="stats-popup__label">L</span>
                    <span ref={levelRef} className="stats-popup__value" />
                </div>
                <div className="stats-popup__item">
                    <span className="stats-popup__label">DIST</span>
                    <span ref={distRef} className="stats-popup__value" />
                </div>
                <div className="stats-popup__divider" />
                <div className="stats-popup__item stats-popup__item--speed">
                    <span className="stats-popup__label">SPEED</span>
                    <span ref={speedRef} className="stats-popup__value stats-popup__value--danger" />
                </div>
                <div className="stats-popup__item stats-popup__item--time">
                    <span className="stats-popup__label">TIME</span>
                    <span ref={timeRef} className="stats-popup__value" />
                </div>
                <div className="stats-popup__divider" />
                <div className="stats-popup__item stats-popup__item--compact">
                    <span className="stats-popup__label">W</span>
                    <span className="stats-popup__value">{noOfCoins * 100} BU</span>
                </div>
                <div className="stats-popup__item stats-popup__item--compact">
                    <span className="stats-popup__label">LIVES</span>
                    <span className="stats-popup__value">{noOfLivesRemaining}</span>
                </div>
                <div className="stats-popup__divider" />
                <div className="stats-popup__item stats-popup__item--compact">
                    <span className="stats-popup__label">H</span>
                    <span className="stats-popup__value">{hp}%</span>
                </div>
                <div className="stats-popup__item stats-popup__item--compact">
                    <span className="stats-popup__label">ENERGY</span>
                    <span ref={enPcRef} className="stats-popup__value" />
                </div>
               
            </div>
        </div>

    );
}
