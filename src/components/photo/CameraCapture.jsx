import React, { useRef, useState } from "react";

const CameraCapture = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [photo, setPhoto] = useState(null);

    // Start the camera
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoRef.current.srcObject = stream;
        } catch (error) {
            console.error("Error accessing the camera", error);
        }
    };

    // Capture the photo
    const capturePhoto = () => {
        const context = canvasRef.current.getContext("2d");
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        const imageData = canvasRef.current.toDataURL("image/png");
        setPhoto(imageData);
    };

    // Stop the camera
    const stopCamera = () => {
        const stream = videoRef.current.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
    };

    return (
        <div>
            <h1>Camera Capture</h1>
            <div>
                <video ref={videoRef} autoPlay style={{ width: "100%" }}></video>
            </div>
            <button onClick={startCamera}>Start Camera</button>
            <button onClick={capturePhoto}>Capture Photo</button>
            <button onClick={stopCamera}>Stop Camera</button>
            <div>
                <canvas ref={canvasRef} style={{ display: "none" }} width="640" height="480"></canvas>
                {photo && (
                    <div>
                        <h2>Captured Photo:</h2>
                        <img src={photo} alt="Captured" style={{ width: "100%" }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CameraCapture;
