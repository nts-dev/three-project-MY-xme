import React, { useEffect, useRef, useState } from 'react';
import useGame from "../../../hooks/useGame";

const AnomalyMetricsPanel = () => {
    const canvasRef = useRef(null);
    const audioAnalyser = useGame((state) => state.audioAnalyser);
    const animationRef = useRef(null);

    const [peakFrequency, setPeakFrequency] = useState('—');
    const [amplitude, setAmplitude] = useState('—');
    const [phaseShift, setPhaseShift] = useState('—');

    useEffect(() => {
        if (!audioAnalyser || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const width = 400;
        const height = 100;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        audioAnalyser.fftSize = 2048;
        const bufferLength = audioAnalyser.frequencyBinCount;

        const freqData = new Uint8Array(bufferLength);
        const timeData = new Float32Array(audioAnalyser.fftSize);

        const sampleRate = audioAnalyser.context.sampleRate;

        const draw = () => {
            const width = canvas.width / dpr;
            const height = canvas.height / dpr;

            // Waveform
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.fillRect(0, 0, width, height);

            audioAnalyser.getByteTimeDomainData(freqData);
            ctx.beginPath();
            ctx.strokeStyle = "rgba(255, 78, 66, 0.8)";
            ctx.lineWidth = 2;

            const sliceWidth = width / freqData.length;
            let x = 0;

            for (let i = 0; i < freqData.length; i++) {
                const v = freqData[i] / 128.0;
                const y = (v * height) / 2;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                x += sliceWidth;
            }

            ctx.stroke();

            // --- Frequency Data ---
            audioAnalyser.getByteFrequencyData(freqData);

            // Find peak frequency index
            let maxAmp = 0;
            let peakIndex = 0;
            for (let i = 0; i < bufferLength; i++) {
                if (freqData[i] > maxAmp) {
                    maxAmp = freqData[i];
                    peakIndex = i;
                }
            }

            const hzPerBin = sampleRate / audioAnalyser.fftSize;
            const freq = peakIndex * hzPerBin;
            setPeakFrequency(`${freq.toFixed(1)} Hz`);

            // --- Amplitude ---
            // RMS amplitude from time domain signal
            audioAnalyser.getFloatTimeDomainData(timeData);
            let sumSquares = 0;
            for (let i = 0; i < timeData.length; i++) {
                sumSquares += timeData[i] * timeData[i];
            }
            const rms = Math.sqrt(sumSquares / timeData.length);
            setAmplitude(rms.toFixed(3));

            // --- Phase Shift (approximate) ---
            // Use sine wave assumption: phase ≈ arcsin(v) / 2π
            const firstValue = timeData[0];
            const phase = Math.asin(Math.max(-1, Math.min(1, firstValue))) / (2 * Math.PI);
            const piFraction = (phase * 2).toFixed(2); // Multiply by 2 to approximate in π units
            const rawMultiple = phase * 2; // between -1 and 1
            const absMultiple = Math.abs(rawMultiple);

// Define common fractions
            const fractions = [
                { value: 0, label: "0/π" },
                { value: 1 / 6, label: "π/6" },
                { value: 1 / 4, label: "π/4" },
                { value: 1 / 3, label: "π/3" },
                { value: 1 / 2, label: "π/2" },
                { value: 2 / 3, label: "2π/3" },
                { value: 3 / 4, label: "3π/4" },
                { value: 5 / 6, label: "5π/6" },
                { value: 1, label: "π" },
            ];

// Find closest match
            let closest = fractions[0];
            let minDiff = Infinity;

            for (const frac of fractions) {
                const diff = Math.abs(frac.value - absMultiple);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = frac;
                }
            }

// Add sign if negative
            const label = rawMultiple < 0 ? `-${closest.label}` : closest.label;
            setPhaseShift(label);

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [audioAnalyser]);

    return (
        <div
            className="data-panel"
            style={{ position: 'absolute', top: '20px', right: '20px' }}
        >
            <div className="data-panel-title">ANOMALY METRICS</div>
            <div className="waveform">
                <canvas
                    ref={canvasRef}
                    className="waveform-canvas"
                    style={{ width: '400px', height: '100px' }}
                ></canvas>
            </div>
            <div className="data-readouts">
                <div className="data-row">
                    <span className="data-label">PEAK FREQUENCY:</span>
                    <span className="data-value" id="peak-value">{peakFrequency}</span>
                </div>
                <div className="data-row">
                    <span className="data-label">AMPLITUDE:</span>
                    <span className="data-value" id="amplitude-value">{amplitude}</span>
                </div>
                <div className="data-row">
                    <span className="data-label">PHASE SHIFT:</span>
                    <span className="data-value" id="phase-value">{phaseShift}</span>
                </div>
            </div>
        </div>
    );
};

export default AnomalyMetricsPanel;
