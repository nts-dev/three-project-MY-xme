import { useEffect, useState } from "react";
import * as THREE from "three";
import useGame from "../hooks/useGame";

const AudioComponent = ({ camera }: any) => {

    const soundUrl: string = useGame((state: any) => state.soundUrl);
    const noOfCoins = useGame((state: any) => state.noOfCoins);
    const isPuzzleGame = useGame((state: any) => state.isPuzzleGame);
    const [listener] = useState(() => new THREE.AudioListener());
    const [backgroundSound, setBackgroundSound] = useState<THREE.Audio | null>(null);
    const [effectSound, setEffectSound] = useState<THREE.Audio | null>(null);

    // useEffect(() => {
    //
    //     camera.add(listener);
    //     return () => camera.remove(listener); // Cleanup on unmount
    // }, [camera]);

    useEffect(() => {


        if (!soundUrl || soundUrl==''){

            effectSound?.stop()
            return;
        }

        const sound = new THREE.Audio(listener);
        const audioLoader = new THREE.AudioLoader();

        audioLoader.load(`${import.meta.env.VITE_FILE_URL}/${soundUrl}`, (buffer) => {
            sound.setBuffer(buffer);
            sound.setVolume(0.5);
            if(isPuzzleGame){
                sound.setLoop(true);
                // If it's already playing, do nothing
                if (backgroundSound && backgroundSound.isPlaying){
                    backgroundSound.stop()
                }

                // Start playing background sound
                sound.play();
                setBackgroundSound(sound);


            } else if (soundUrl === "initialSound.mp3" ) {
                sound.setLoop(true);

                // If it's already playing, do nothing
                if (backgroundSound && backgroundSound.isPlaying) return;

                // Start playing background sound
                sound.play();
                setBackgroundSound(sound);
            }
            else {
                if(soundUrl==='walking-in-the-water.mp3'){
                    sound.setPlaybackRate(3);
                }
                // Play sound effect (one-time sound)
                sound.setLoop(false);
                sound.play();


                // Stop the previous effect sound (if any)
                setEffectSound((prevEffect) => {
                    prevEffect?.stop();
                    return sound;
                });
            }
        });
        return () => {

            effectSound?.stop();
        };
    }, [soundUrl, noOfCoins,isPuzzleGame]);

    useEffect(() => {

        if (!backgroundSound) return;

            if (!backgroundSound.isPlaying) {
                backgroundSound.play();
            }
            else{
                backgroundSound.stop()
                backgroundSound.play();
            }
        return () => {
             backgroundSound?.stop(); // Stop background sound on unmount
        };
    }, [ backgroundSound]);



    return null;
};

export default AudioComponent;
