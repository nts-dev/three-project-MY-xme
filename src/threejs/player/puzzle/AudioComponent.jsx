import { useEffect, useRef, useState } from 'react';

const AudioComponent = (audioPath = '/audio/step.wav', initialVolume = 1) => {
    const footstepAudioRef = useRef(null);
    const isPlayingSound = useRef(false);
    const [volume, setVolume] = useState(initialVolume);

    useEffect(() => {
        const audio = new Audio(audioPath);
        audio.loop = false;
        audio.volume = volume;
        console.log('Initial audio volume set to:', audio.volume);
        footstepAudioRef.current = audio;



        audio.addEventListener('ended', () => {
            isPlayingSound.current = false;
        });
        audio.addEventListener('pause', () => {
            isPlayingSound.current = false;
        });

        audio.load();

        const handleUserInteraction = () => {
            // console.log('User interaction detected, audio should now play');
        };
        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('keydown', handleUserInteraction);

        return () => {
            if (footstepAudioRef.current) {
                footstepAudioRef.current.pause();
                footstepAudioRef.current = null;
            }
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
        };
    }, [audioPath]);

    // Update volume when it changes
    useEffect(() => {
        if (footstepAudioRef.current) {
            footstepAudioRef.current.volume = volume;
            console.log('Volume updated to:', footstepAudioRef.current.volume);
        }
    }, [volume]);

    // Dynamic volume adjustment with keypress
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.key === '+') {
                setVolume((prev) => Math.min(1, prev + 0.1));
            } else if (e.key === '-') {
                setVolume((prev) => Math.max(0, prev - 0.1));
            }
        };

        window.addEventListener('keydown', handleKeyPress);

        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, []);

    const playFootstep = () => {
        if (!footstepAudioRef.current) return;

        if (isPlayingSound.current) {
            return;
            // footstepAudioRef.current.pause();
        }
        footstepAudioRef.current.currentTime = 0;
        // console.log('Playing footstep sound with volume:', footstepAudioRef.current.volume);
        footstepAudioRef.current.play().then(() => {
            isPlayingSound.current = true;
            // console.log('Footstep sound started playing');
        }).catch((e) => {
            console.error('Error playing footstep sound:', e);
            // console.log('AudioComponent src:', footstepAudioRef.current.src);
            // console.log('AudioComponent readyState:', footstepAudioRef.current.readyState);
        });
    };

    const stopFootstep = () => {
        if (footstepAudioRef.current && isPlayingSound.current) {
             footstepAudioRef.current.pause();
            footstepAudioRef.current.currentTime = 0;
            isPlayingSound.current = false;
        }
    };

    return { playFootstep, stopFootstep, volume, setVolume };
};

export default AudioComponent;