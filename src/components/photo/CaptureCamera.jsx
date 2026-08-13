import React, { useEffect, useRef, useState } from 'react';
import Camera, { FACING_MODES, IMAGE_TYPES } from './lib/index.jsx';
// import Camera, { FACING_MODES } from 'react-html5-camera-photo';
import './reset.css';
import useGame from "../../hooks/useGame";
import { Toast } from "primereact/toast";

export default function CaptureCamera() {
    const setIsCamera = useGame((state) => state.setIsCamera);
    const setImages = useGame((state) => state.setImages);
    const [resolution, setResolution] = useState({ width:50, height: 800});
    const setImagesToSave = useGame((state) => state.setImagesToSave);
    const imagesToSave = useGame((state) => state.imagesToSave);
    const [isRecording, setIsRecording] = useState(false);
    const toast = useRef(null);
   // console.log(window.screen.height,window.screen.width)
    // useEffect(() => {
    //     // Detect if the device is in landscape or portrait mode
    //     const deviceWidth = window.screen.width;
    //     const deviceHeight = window.screen.height;
    //
    //     // Force portrait resolution by ensuring height is larger than width
    //     if (deviceWidth > deviceHeight) {
    //         setResolution({ width: deviceHeight, height: deviceWidth });
    //     } else {
    //         setResolution({ width: deviceWidth, height: deviceHeight });
    //     }
    // }, []);

    async function handleTakePhoto(dataUri) {
        try {
            if (isRecording && toast.current) {
                toast.current.show({
                    severity: 'warn',
                    summary: 'Recording!',
                    detail: `Recording a video...`,
                    life: 30000
                });
                return;
            }

            // Convert the dataUri to a Blob
            const blob = await (await fetch(dataUri)).blob();
            const previewUrl = URL.createObjectURL(blob);
            const imageName = Math.random().toString(36).replace(/[^a-z]+/g, '').substring(0, 5);

            const newImageObject = {
                itemImageSrc: previewUrl,
                thumbnailImageSrc: previewUrl,
                alt: `Captured Image`,
                title: `Captured Photo`,
                capturedImage: `${imageName}.png`,
                blob
            };

            setImages((prevImages) => [newImageObject, ...prevImages]);
            setImagesToSave([newImageObject, ...imagesToSave]);
            setIsCamera(false);
        } catch (error) {
            console.error('Error uploading photo:', error);
        }
    }

    function handleTakePhotoAnimationDone(dataUri) {
        console.log('takePhoto');
    }

    function handleCameraError(error) {
        console.log('handleCameraError', error);
    }

    const handleStartRecording = (stream) => {
        console.log('Recording started', stream);
        setIsRecording(true);
    };

    const handleStopRecording = () => {
        console.log('Recording stopped');
        setIsRecording(false);
    };

    return (
        <div>
            <Toast ref={toast} />
            <Camera
                onTakePhoto={handleTakePhoto}
                idealFacingMode={FACING_MODES.ENVIRONMENT}
                isFullscreen={true}
                sizeFactor={1}
                // isMaxResolution={true}
                // idealResolution={resolution} // Maintain portrait resolution
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
            />
        </div>
    );
}
