import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useGame from '../../hooks/useGame';
import ToggleDims from '../../threejs/scene/ToggleDims';
import { FormMixer } from './Projects';

export default function PackageRuntimeBridge() {
    const { scene, camera } = useThree();
    const pause = useGame((state) => state.pause);
    const playBackward = useGame((state) => state.playBackward);
    const setPause = useGame((state) => state.setPause);
    const showBdims = useGame((state) => state.showBdims);
    const showFdims = useGame((state) => state.showFdims);
    const showOdims = useGame((state) => state.showOdims);
    const labelRenderer = useGame((state) => state.labelRenderer);

    useEffect(() => {
        ToggleDims(showBdims, showFdims, showOdims, scene);

        const dims = document.getElementById('dims');
        if (!showBdims && !showFdims && !showOdims) {
            dims?.parentNode?.removeChild(dims);
            return;
        }

        if (labelRenderer?.domElement && !labelRenderer.domElement.parentNode) {
            document.body.appendChild(labelRenderer.domElement);
        }
    }, [labelRenderer, scene, showBdims, showFdims, showOdims]);

    useEffect(() => {
        if (!FormMixer?.action) return;

        const action = FormMixer.action;
        const onFinished = () => setPause(true);
        action.paused = pause;

        if (!pause) {
            const duration = action.getClip?.()?.duration || 0;
            action.loop = THREE.LoopOnce;
            action.clampWhenFinished = true;
            action.timeScale = playBackward ? -1 / 2.6 : 1 / 2.6;

            if (playBackward && duration && action.time <= 0) {
                action.time = duration;
            }

            if (!playBackward) {
                action.reset().fadeIn(0.2);
            }

            action.play();
            action._mixer?.addEventListener?.('finished', onFinished);
        }

        return () => {
            action?._mixer?.removeEventListener?.('finished', onFinished);
        };
    }, [pause, playBackward, setPause]);

    useFrame((_, delta) => {
        FormMixer?.mixer?.update(delta);

        if (showBdims || showFdims || showOdims) {
            labelRenderer?.render?.(scene, camera);
        }
    });

    return null;
}
