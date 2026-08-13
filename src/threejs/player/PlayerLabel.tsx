import * as React from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export default function PlayerLabel({
    characterRef,
    playerSpeed,
    noOfLivesRemaining,
    angle,
    isLocal,
}: any) {
    const positionValueRef = React.useRef<HTMLElement | null>(null);
    const angleValueRef = React.useRef<HTMLElement | null>(null);
    const speedValueRef = React.useRef<HTMLElement | null>(null);
    const updateAccumulatorRef = React.useRef(0);

    React.useEffect(() => {
        if (!isLocal || typeof document === "undefined") return;

        const host =
            document.querySelector(".editor-app-root") ||
            document.querySelector(".canvas-element") ||
            document.body;
        let root = document.getElementById("player-telemetry-hud-root");
        if (!root) {
            root = document.createElement("div");
            root.id = "player-telemetry-hud-root";
            root.className = "player-telemetry-hud-root";
        }
        if (root.parentElement !== host) {
            host.appendChild(root);
        }

        root.innerHTML = "";
        const panel = document.createElement("div");
        panel.className = "player-telemetry-panel";
        panel.innerHTML = `
            <div class="player-telemetry-corner player-telemetry-corner--tl"></div>
            <div class="player-telemetry-corner player-telemetry-corner--br"></div>
            <h2 class="player-telemetry-title">TELEMETRICS</h2>
            <div class="player-telemetry-grid">
                <span>Position:</span>
                <strong data-telemetry-position></strong>
                <span>Angle:</span>
                <strong data-telemetry-angle></strong>
                <span>Speed:</span>
                <strong data-telemetry-speed></strong>
            </div>
        `;
        root.appendChild(panel);

        positionValueRef.current = panel.querySelector("[data-telemetry-position]");
        angleValueRef.current = panel.querySelector("[data-telemetry-angle]");
        speedValueRef.current = panel.querySelector("[data-telemetry-speed]");

        return () => {
            root.innerHTML = "";
            root.remove();
            positionValueRef.current = null;
            angleValueRef.current = null;
            speedValueRef.current = null;
        };
    }, [isLocal]);

    useFrame((_, delta) => {
        if (!isLocal || !characterRef?.current) return;
        updateAccumulatorRef.current += delta;
        if (updateAccumulatorRef.current < 1 / 12) return;
        updateAccumulatorRef.current = 0;

        const position = characterRef.current.translation();
        if (positionValueRef.current) {
            positionValueRef.current.textContent = `X: ${(position.x * 100).toFixed(1)}, Y: ${(position.y * 100).toFixed(1)}, Z: ${(position.z * 100).toFixed(1)}`;
        }
        if (angleValueRef.current) {
            angleValueRef.current.textContent = `${THREE.MathUtils.radToDeg(angle || 0).toFixed(1)}°`;
        }
        if (speedValueRef.current) {
            speedValueRef.current.textContent = `${playerSpeed}%, Lives: ${noOfLivesRemaining}`;
        }
    });

    return null;
}
