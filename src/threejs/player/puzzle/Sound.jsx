import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useGame from '../../../hooks/useGame';

const Sound = () => {
    const soundRef = useRef(null);
    const listenerRef = useRef(null);
    const loaderRef = useRef(null);
    const audioBufferCache = useRef(Object.create(null));
    const { camera } = useThree();
    const soundParams = useGame((state) => state.soundParams);

    const {
        url = '',
        playbackRate = 1.4,
    } = soundParams || {};

    // Init listener once
    useEffect(() => {

        if (!listenerRef.current) {
            const listener = new THREE.AudioListener();
            listenerRef.current = listener;
            camera.add(listener);
        }
        return () => {
            if (listenerRef.current) {
                camera.remove(listenerRef.current);
                listenerRef.current = null;
            }
        };
    }, [camera]);

    // Main sound logic
    useEffect(() => {
        const listener = listenerRef.current;

        if (!listener) return;

        // ✅ If url === 0 → mute instead of unmount
        if (!url) {
            if (soundRef.current) {
                soundRef.current.setVolume(0);
                return;
            }
        }


        // ✅ If same URL, just update params
        if (soundRef.current && soundRef.current._url === url) {
            soundRef.current.setLoop(true);
            soundRef.current.setVolume(1);
            soundRef.current.setPlaybackRate(playbackRate);
            if (!soundRef.current.isPlaying) soundRef.current.play();
            return;
        }

        // Replace previous sound
        if (soundRef.current) {
            if (soundRef.current.isPlaying) soundRef.current.stop();
            soundRef.current.disconnect();
            soundRef.current = null;
        }

        // Create sound
        const sound = new THREE.Audio(listener);
        sound._url = url;
        soundRef.current = sound;

        const cachedBuffer = audioBufferCache.current[url];
        const applyBuffer = (buffer) => {
            if (!soundRef.current) return;
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.setVolume(1);
            sound.setPlaybackRate(playbackRate);
            sound.play();
        };

        if (cachedBuffer) {
            applyBuffer(cachedBuffer);
        } else {
            if (!loaderRef.current) loaderRef.current = new THREE.AudioLoader();
            loaderRef.current.load(
                url,
                (buffer) => {
                    audioBufferCache.current[url] = buffer;
                    applyBuffer(buffer);
                },
                undefined,
                (err) => console.warn('[Sound] Audio load failed:', err)
            );
        }

        // cleanup — but DO NOT run for url===0
        return () => {
            if (soundRef.current && !url) {
                if (soundRef.current.isPlaying) soundRef.current.stop();
                soundRef.current.disconnect();
                soundRef.current = null;
            }
        };
    }, [url, playbackRate]);

    // Playback rate updates
    useEffect(() => {
        const sound = soundRef.current;
        if (sound) sound.setPlaybackRate(playbackRate);
    }, [playbackRate]);

    return null;
};

export default React.memo(Sound);
