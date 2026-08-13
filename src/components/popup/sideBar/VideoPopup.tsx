import { Dialog } from 'primereact/dialog';
import * as React from 'react';
import useGame from "../../../hooks/useGame";
import Hls from 'hls.js';

export default function VideoPopup() {
    const showVideo = useGame((state: any) => state.showVideo);
    const setShowVideo = useGame((state: any) => state.setShowVideo);
    const videoLink = useGame((state: any) => state.videoLink);
    const videoRawLink = useGame((state: any) => state.videoRawLink);

    const [videoRef, setVideoRef] = React.useState<HTMLVideoElement | null>(null);
    const [hlsInstance, setHlsInstance] = React.useState<Hls | null>(null);

    React.useEffect(() => {
        if (videoRef) {
            let hls: Hls | null = null;

            if (Hls.isSupported()) {
                hls = new Hls();
                hls.loadSource(`http://video.nts.nl:9090/storage/${videoLink}/hsl/master.m3u8`);
                hls.attachMedia(videoRef);

                hls.on(Hls.Events.MANIFEST_PARSED, async function () {
                    try {
                        await videoRef.play();
                    } catch (error) {
                        // console.error('Error while trying to play HLS video:', error);
                        // console.log(error)
                        // if (error.name === 'AbortError') {
                        //     switchToMp4();
                        // }
                    }
                });

                hls.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        console.error('HLS Error:', data);
                        // If the error is fatal, switch to MP4
                        switchToMp4();
                    }
                });

                setHlsInstance(hls);
            } else if (videoRef.canPlayType('application/vnd.apple.mpegurl')) {
                videoRef.src = `https://video.nts.nl:9090/storage/${videoLink}/hsl/master.m3u8`;

                videoRef.addEventListener('canplay', function () {
                    videoRef.play();
                });

                videoRef.onerror = () => {
                    // Fallback to MP4 if HLS fails
                    switchToMp4();
                };
            } else {
                // If HLS is not supported, fallback to MP4
                switchToMp4();
            }

            return () => {
                if (hls) {
                    hls.destroy();
                }
                setHlsInstance(null);
            };
        }
    }, [videoLink, videoRef]);

    const switchToMp4 = () => {
        if (videoRef) {
            videoRef.src = `https://video.nts.nl:9090/storage/${videoRawLink}`;
            videoRef.play();
        }
    };

    const onVideoRef = React.useCallback((node: HTMLVideoElement | null) => {
        if (node !== null) {
            setVideoRef(node);
        }
    }, []);

    const handleClose = () => {
        try {
            if (videoRef) {
                videoRef.pause();
                videoRef.currentTime = 0;
            }
            if (hlsInstance) {
                hlsInstance.destroy();
                setHlsInstance(null);
            }
            setShowVideo(false);
        } catch (error) {
            console.error('Error closing video:', error);
        }
    };

    return (
        <div className="card flex justify-content-center">
            <Dialog
                visible={showVideo}
                style={{ width: '80rem', zIndex: "999999" }}
                maximizable
                draggable={false}
                onHide={handleClose}
            >
                <div className="video-container">
                    <video
                        ref={onVideoRef}
                        width="100%"
                        controls
                        preload="auto"
                    >
                        Your browser does not support the video tag.
                    </video>
                </div>
            </Dialog>
        </div>
    );
}
