import React, { useEffect, useRef, useState } from "react";
import { FaClock, FaLocationArrow, FaRegCircle, FaWalking } from "react-icons/fa";
import useGame from "../../../../hooks/useGame";
import "./PlayAssetInfoHud.css";

function formatMetric(value, fractionDigits = 1) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return "0";
    return numberValue.toFixed(fractionDigits);
}

function formatDistance(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return "0";
    if (Math.abs(numberValue) >= 1000) return (numberValue / 1000).toFixed(2);
    return numberValue.toFixed(numberValue >= 10 ? 0 : 1);
}

function formatElapsed(seconds) {
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;
    return [hours, minutes, secs]
        .map((part) => String(part).padStart(2, "0"))
        .join(":");
}

export default function CameraRealtimeTelemetryHud() {
    const cameraRealtimeFollow = useGame((state) => state.cameraRealtimeFollow);
    const telemetry = useGame((state) => state.cameraRealtimeTelemetry);
    const resetCameraRealtimeTelemetry = useGame((state) => state.resetCameraRealtimeTelemetry);
    const elapsedStartRef = useRef(Date.now());
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        if (!cameraRealtimeFollow) return undefined;

        const startTime = Date.now();
        elapsedStartRef.current = startTime;
        setElapsedSeconds(0);

        const intervalId = window.setInterval(() => {
            setElapsedSeconds((Date.now() - elapsedStartRef.current) / 1000);
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [cameraRealtimeFollow]);

    if (!cameraRealtimeFollow) return null;

    const heading = Number.isFinite(Number(telemetry?.heading)) ? Number(telemetry.heading) : 0;
    const distanceValue = Number(telemetry?.distance) || 0;
    const distanceUnit = Math.abs(distanceValue) >= 1000 ? "km" : "m";
    const handleReset = () => {
        elapsedStartRef.current = Date.now();
        setElapsedSeconds(0);
        resetCameraRealtimeTelemetry?.();
    };

    return (
        <>
            <section className="camera-realtime-walk-tracker" aria-label="Walk tracker">
                <div className="camera-realtime-walk-tracker__header">
                    <span className="camera-realtime-walk-tracker__title">
                        <FaWalking aria-hidden="true" />
                        Walk Tracker
                    </span>
                    <div className="camera-realtime-walk-tracker__actions">
                        <span className={`camera-realtime-walk-tracker__rec${telemetry?.hasGpsUpdate ? " is-live" : ""}`}>
                            <span aria-hidden="true" />
                            REC
                        </span>
                        <button type="button" className="camera-realtime-walk-tracker__reset" onClick={handleReset}>
                            <FaRegCircle aria-hidden="true" />
                            Reset
                        </button>
                    </div>
                </div>
                <div className="camera-realtime-walk-tracker__grid">
                    <div>
                        <span>Current</span>
                        <strong>{formatMetric(telemetry?.currentSpeed)}</strong>
                        <small>m/s</small>
                    </div>
                    <div>
                        <span>Average</span>
                        <strong>{formatMetric(telemetry?.averageSpeed)}</strong>
                        <small>m/s</small>
                    </div>
                    <div>
                        <span>Distance</span>
                        <strong>{formatDistance(distanceValue)}</strong>
                        <small>{distanceUnit}</small>
                    </div>
                </div>
                <div className="camera-realtime-walk-tracker__time">
                    <FaClock aria-hidden="true" />
                    {formatElapsed(elapsedSeconds)}
                </div>
            </section>

            <section className="camera-realtime-compass" aria-label="Compass">
                <div className="camera-realtime-compass__dial">
                    <span className="camera-realtime-compass__north">N</span>
                    <FaLocationArrow
                        className="camera-realtime-compass__needle"
                        style={{ transform: `rotate(${heading}deg)` }}
                        aria-hidden="true"
                    />
                </div>
                <span className="camera-realtime-compass__degrees">{Math.round(heading)}&deg;</span>
            </section>
        </>
    );
}
