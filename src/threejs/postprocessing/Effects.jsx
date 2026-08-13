import { EffectComposer, SSR, Bloom, HueSaturation, Grid } from '@react-three/postprocessing';
import { useControls } from 'leva';
import {useRef, useState} from "react";

export function Effects() {
    const [props, setProps]  = useState({
        enabled: true,
        temporalResolve: true,
        STRETCH_MISSED_RAYS: true,
        USE_MRT: true,
        USE_NORMALMAP: true,
        USE_ROUGHNESSMAP: true,
        ENABLE_JITTERING: false,
        ENABLE_BLUR: true,
        DITHERING: false,
        temporalResolveMix: 0.95,
        temporalResolveCorrectionMix:  0.4,
        maxSamples:  0,
        resolutionScale:1,
        blurMix: 0.5,
        blurKernelSize:  8,
        BLUR_EXPONENT:  8,
        rayStep: 0.5,
        intensity: 0.8,
        maxRoughness:  1,
        jitter:0.05,
        jitterSpread:  0.02,
        jitterRough:  0.1,
        roughnessFadeOut:0.5,
        rayFadeOut:  0,
        MAX_STEPS:  30,
        NUM_BINARY_SEARCH_STEPS:  8,
        maxDepthDifference:  7,
        maxDepth:1,
        thickness: 0,
        ior:  0,
    });

    return (

            <EffectComposer>
                {/*<SSR {...props} />*/}
                {/*<Grid scale={0.05} />*/}
                {/*<Bloom luminanceThreshold={0.4} mipmapBlur={true} luminanceSmoothing={0.5} intensity={0.1} />*/}
                <Bloom intensity={1.5} luminanceThreshold={0.2} />
                {/*<HueSaturation hue={-0.2} saturation={0.3} />*/}
            </EffectComposer>

    );
}