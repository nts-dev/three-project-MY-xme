import { useEffect, useRef } from "react";
import { useGame1 } from "../../../../hooks/useGame1";
import useGame from "../../../../hooks/useGame";

const getAudioUrl = (file) => `${import.meta.env.VITE_VIDEO_URL}/audio/${file}`;

export default function SoundTrack() {
  const curAnimation = useGame1((state) => state.curAnimation);
  const soundName = useGame((state) => state.soundName);

  const cacheRef = useRef(new Map());
  const currentLoopSrcRef = useRef("");
  const prevAnimationRef = useRef("");
  const prevOneShotSrcRef = useRef("");

  const getOrCreateAudio = (src) => {
    const cache = cacheRef.current;
    if (cache.has(src)) return cache.get(src);

    const audio = new Audio(src);
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.load();
    cache.set(src, audio);
    return audio;
  };

  const stopLoopAudio = () => {
    const loopSrc = currentLoopSrcRef.current;
    if (!loopSrc) return;
    const loopAudio = cacheRef.current.get(loopSrc);
    if (loopAudio) {
      loopAudio.pause();
      loopAudio.currentTime = 0;
      loopAudio.loop = false;
    }
    currentLoopSrcRef.current = "";
  };

  const playOneShot = (src) => {
    const audio = getOrCreateAudio(src);
    audio.loop = false;
    audio.volume = 1.0;
    audio.playbackRate = 1.0;
    audio.currentTime = 0;
    audio.play().catch((err) => console.warn("One-shot audio blocked:", err));
  };

  useEffect(() => {
    let loopSrc = "";
    let loopRate = 1.0;

    if (curAnimation === "Walk") {
      loopSrc = getAudioUrl("concrete-footsteps.mp3");
      loopRate = 1.15;
    } else if (curAnimation === "Run") {
      loopSrc = getAudioUrl("concrete-footsteps-run.mp3");
      loopRate = 1.8;
    }

    if (!loopSrc) {
      stopLoopAudio();
    } else if (currentLoopSrcRef.current !== loopSrc) {
      stopLoopAudio();
      const loopAudio = getOrCreateAudio(loopSrc);
      loopAudio.loop = true;
      loopAudio.volume = 1.0;
      loopAudio.playbackRate = loopRate;
      currentLoopSrcRef.current = loopSrc;
      if (loopAudio.paused) {
        loopAudio.play().catch((err) => console.warn("Loop audio blocked:", err));
      }
    } else {
      const loopAudio = cacheRef.current.get(loopSrc);
      if (loopAudio) {
        loopAudio.playbackRate = loopRate;
        if (loopAudio.paused) {
          loopAudio.play().catch((err) => console.warn("Loop audio blocked:", err));
        }
      }
    }

    if (curAnimation !== prevAnimationRef.current) {
      prevAnimationRef.current = curAnimation;
      if (curAnimation === "Jump Takeoff") {
        playOneShot(getAudioUrl("jump.wav"));
      } else if (curAnimation === "Push") {
        playOneShot(getAudioUrl("push.wav"));
      }
    }

    if (soundName) {
      const oneShotSrc = getAudioUrl(soundName);
      if (prevOneShotSrcRef.current !== oneShotSrc) {
        prevOneShotSrcRef.current = oneShotSrc;
        playOneShot(oneShotSrc);
      }
    } else {
      prevOneShotSrcRef.current = "";
    }
  }, [curAnimation, soundName]);

  useEffect(() => {
    return () => {
      stopLoopAudio();
      cacheRef.current.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      cacheRef.current.clear();
    };
  }, []);

  return null;
}
