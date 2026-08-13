import React, { useEffect, useRef, useState} from 'react';
import './style.css';
import useGame from "../../../hooks/useGame";

const AudioSpectrum = () => {
    const audioRef = useRef(null);

    const setTerminalMessage = useGame((state) => state.setTerminalMessage);
    const [selectedTrackIndex, setSelectedTrackIndex] = useState(0); // Index (0-based)
    const [fileName, setFileName] = useState('NO FILE SELECTED');

    const audioFiles = [
        'love-clemens.mp3',
        'abandoned-places.mp3',
        'silo-adi.mp3',
        'liquid-acid.mp3',
        'Forged-NVU.mp3',
        'Spiderbot-Remake.mp3',
        'BOYZ-NOIZE.mp3',
        'goetia-adi.mp3',
        'em.mp3',
        'feral-aavirall-main-version.mp3'
    ];



    // Resize canvas on mount
    // useEffect(() => {
    //     const canvas = canvasRef.current;
    //     const resizeCanvas = () => {
    //         canvas.width = canvas.offsetWidth;
    //         canvas.height = canvas.offsetHeight;
    //     };
    //     resizeCanvas();
    //     window.addEventListener('resize', resizeCanvas);
    //     return () => window.removeEventListener('resize', resizeCanvas);
    // }, []);

    // Setup audio context and analyser
    // const setupAudio = (sourceNode) => {
    //     const ctx = new (window.AudioContext || window.webkitAudioContext)();
    //     const analyser = ctx.createAnalyser();
    //     analyser.fftSize = 512;
    //
    //     const source = ctx.createMediaElementSource(sourceNode);
    //     source.connect(analyser);
    //     analyser.connect(ctx.destination);
    //
    //     setAudioContext(ctx);
    //     setAudioAnalyser(analyser);
    // };

    // Draw spectrum
    // useEffect(() => {
    //     if (!audioAnalyser || !canvasRef.current) return;
    //
    //     const canvas = canvasRef.current;
    //     const ctx = canvas.getContext('2d');
    //     const width = canvas.width;
    //     const height = canvas.height;
    //     const dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
    //
    //     let animationFrameId;
    //
    //     const draw = () => {
    //         audioAnalyser.getByteFrequencyData(dataArray);
    //         ctx.clearRect(0, 0, width, height);
    //
    //         const barWidth = width / dataArray.length;
    //         let x = 0;
    //         for (let i = 0; i < dataArray.length; i++) {
    //             const barHeight = (dataArray[i] / 255) * height * (audioSensitivity / 5);
    //             const hue = (i / dataArray.length) * 20;
    //             ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    //             ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
    //             x += barWidth;
    //         }
    //
    //         // Grid lines
    //         ctx.strokeStyle = "rgba(255, 78, 66, 0.2)";
    //         ctx.lineWidth = 1;
    //         for (let i = 0; i < 5; i++) {
    //             const y = height * (i / 4);
    //             ctx.beginPath();
    //             ctx.moveTo(0, y);
    //             ctx.lineTo(width, y);
    //             ctx.stroke();
    //         }
    //         for (let i = 0; i < 9; i++) {
    //             const x = width * (i / 8);
    //             ctx.beginPath();
    //             ctx.moveTo(x, 0);
    //             ctx.lineTo(x, height);
    //             ctx.stroke();
    //         }
    //
    //         // Frequency labels
    //         ctx.fillStyle = "rgba(255, 78, 66, 0.7)";
    //         ctx.font = '10px monospace';
    //         ctx.textAlign = "center";
    //         const freqLabels = ["0", "1K", "2K", "4K", "8K", "16K"];
    //         for (let i = 0; i < freqLabels.length; i++) {
    //             const labelX = (width / (freqLabels.length - 1)) * i;
    //             ctx.fillText(freqLabels[i], labelX, height - 5);
    //         }
    //
    //         animationFrameId = requestAnimationFrame(draw);
    //     };
    //
    //     draw();
    //     return () => cancelAnimationFrame(animationFrameId);
    // }, [audioAnalyser, audioSensitivity]);

    // Handle track click
    const playAudio = (audio) => {
        const playPromise = audio.play();
        if (playPromise?.catch) {
            playPromise.catch(() => {
                setTerminalMessage({
                    id: `${Date.now()}-audio-blocked`,
                    isCommand: false,
                    message: "Audio playback is waiting for user interaction"
                });
            });
        }
    };

    const handleTrackClick = (index) => {
        const audio = audioRef.current;
        setSelectedTrackIndex(index);
        setFileName(audioFiles[index]);
        audio.src = `${import.meta.env.VITE_FILE_URL}/${audioFiles[index]}`;
        audio.load();
        audio.loop = true;
        playAudio(audio);
        setTerminalMessage({
            id: `${Date.now()}-track-${index}`,
            isCommand: true,
            command: "audio",
            message: "Track " + (index + 1) + " selected"
        });
        // if (!audioContext) setupAudio(audio);
    };

    const handleFileUpload = () => {
        document.getElementById("audio-file-input").click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        const audio = audioRef.current;

        if (file) {
            const url = URL.createObjectURL(file);
            audio.src = url;
            audio.load();
            playAudio(audio);
            setFileName(file.name);
            setSelectedTrackIndex(null);

            // if (!audioContext) setupAudio(audio);
        }
    };

    // Auto-play first track on mount
    useEffect(() => {
        const audio = audioRef.current;
        if (audioFiles.length > 0) {
            const url = `${import.meta.env.VITE_FILE_URL}/${audioFiles[0]}`;
            audio.src = url;
            audio.load();
            audio.loop = true;
            playAudio(audio);
            setFileName(audioFiles[0]);
            setSelectedTrackIndex(0);
           // console.log(audioFiles[0])
            // if (!audioContext) setupAudio(audio);
        }
    }, []);

// Drag functionality
//     useEffect(() => {
//         const dragHandle = document.getElementById("spectrum-handle");
//         const dragTarget = document.querySelector(".spectrum-analyzer");
//
//         let isDragging = false;
//         let startX = 0;
//         let startY = 0;
//         let offsetX = 0;
//         let offsetY = 0;
//
//         const onMouseDown = (e) => {
//             isDragging = true;
//             startX = e.clientX;
//             startY = e.clientY;
//             const rect = dragTarget.getBoundingClientRect();
//             offsetX = rect.left;
//             offsetY = rect.top;
//             setTerminalMessage({isCommand: false, message: "Audio spectrum analyzer moved"});
//             document.addEventListener("mousemove", onMouseMove);
//             document.addEventListener("mouseup", onMouseUp);
//         };
//
//         const onMouseMove = (e) => {
//             if (!isDragging) return;
//             const dx = e.clientX - startX;
//             const dy = e.clientY - startY;
//             dragTarget.style.position = "absolute";
//             dragTarget.style.left = `${offsetX + dx}px`;
//             dragTarget.style.top = `${offsetY + dy}px`;
//             dragTarget.style.zIndex = 9999;
//         };
//
//         const onMouseUp = () => {
//             isDragging = false;
//             document.removeEventListener("mousemove", onMouseMove);
//             document.removeEventListener("mouseup", onMouseUp);
//         };
//
//         dragHandle.addEventListener("mousedown", onMouseDown);
//
//         return () => {
//             dragHandle.removeEventListener("mousedown", onMouseDown);
//         };
//     }, []);


    return (
        <div >
            {/*<div className="spectrum-header">*/}
            {/*    <span>AUDIO TRACKS</span>*/}
            {/*    <span className="drag-handle" id="spectrum-handle">⋮⋮</span>*/}
            {/*</div>*/}

            {/*<div className="spectrum-content">*/}
            {/*    <canvas ref={canvasRef} className="spectrum-canvas"></canvas>*/}
            {/*</div>*/}

            <div className="audio-controls">
                <div className="demo-tracks">
                    {/*<span className="demo-tracks-label">TRACKS:</span>*/}
                    {audioFiles.map((_, i) => (
                        <button
                            key={i}
                            className={`demo-track-btn ${selectedTrackIndex === i ? 'selected' : ''}`}
                            onClick={() => handleTrackClick(i)}
                            title={`Play track ${i + 1}`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div>

                {/*<input*/}
                {/*    type="file"*/}
                {/*    id="audio-file-input"*/}
                {/*    className="audio-file-input"*/}
                {/*    accept="audio/*"*/}
                {/*    onChange={handleFileChange}*/}
                {/*    style={{ display: 'none' }}*/}
                {/*/>*/}
                {/*<button className="audio-file-btn" onClick={handleFileUpload}>UPLOAD AUDIO FILE</button>*/}
                {/*<div className="audio-file-label">{fileName}</div>*/}

                <audio
                    className="audio-player"
                    ref={audioRef}
                    crossOrigin="anonymous"
                ></audio>

                {/*<div className="controls-row">*/}
                {/*    <div className="audio-sensitivity" style={{ flex: 1 }}>*/}
                {/*        <div className="audio-sensitivity-label">*/}
                {/*            <span>SENSITIVITY</span>*/}
                {/*            <span className="audio-sensitivity-value" id="sensitivity-value">{audioSensitivity.toFixed(1)}</span>*/}
                {/*        </div>*/}
                {/*        <input*/}
                {/*            type="range"*/}
                {/*            min="1"*/}
                {/*            max="10"*/}
                {/*            value={audioSensitivity}*/}
                {/*            step="0.1"*/}
                {/*            className="slider"*/}
                {/*            onChange={handleSensitivityChange}*/}
                {/*        />*/}
                {/*    </div>*/}
                {/*</div>*/}
            </div>
        </div>
    );
};

export default AudioSpectrum;
