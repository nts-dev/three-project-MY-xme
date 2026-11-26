import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Cloud, Clouds, Sky } from "@react-three/drei";
import { updateWeatherBlend, useSkyStore } from "../../components/weather/weatherStore";
import * as THREE from "three";
import { SkyMesh } from "three/examples/jsm/objects/SkyMesh.js";

const PROJECT_153_CLOUDS = [
    { seed: 153, position: [-520, 260, -420], bounds: [72, 8, 34], scale: 6.5, volume: 5.8, opacity: 0.78 },
    { seed: 154, position: [-230, 315, -610], bounds: [88, 7, 36], scale: 6, volume: 5.2, opacity: 0.72 },
    { seed: 155, position: [80, 285, -500], bounds: [78, 8, 34], scale: 6.2, volume: 5.5, opacity: 0.76 },
    { seed: 156, position: [430, 270, -350], bounds: [74, 7, 32], scale: 5.8, volume: 5.2, opacity: 0.74 },
    { seed: 157, position: [-600, 340, -70], bounds: [84, 7, 30], scale: 5.8, volume: 4.8, opacity: 0.7 },
    { seed: 158, position: [-200, 365, 120], bounds: [92, 8, 36], scale: 6, volume: 5, opacity: 0.72 },
    { seed: 159, position: [170, 335, 40], bounds: [80, 7, 31], scale: 5.8, volume: 4.8, opacity: 0.7 },
    { seed: 160, position: [560, 320, 190], bounds: [74, 7, 29], scale: 5.5, volume: 4.6, opacity: 0.78 },
    { seed: 161, position: [-430, 395, 500], bounds: [86, 7, 34], scale: 5.6, volume: 4.7, opacity: 0.76 },
    { seed: 162, position: [10, 420, 570], bounds: [96, 8, 38], scale: 6, volume: 4.8, opacity: 0.78 },
    { seed: 163, position: [430, 385, 455], bounds: [78, 7, 31], scale: 5.5, volume: 4.5, opacity: 0.75 },
    { seed: 164, position: [700, 360, -90], bounds: [72, 7, 29], scale: 5.3, volume: 4.4, opacity: 0.74 },
];

const PROJECT_153_SKY_DISTANCE = 4500000;
const DEFAULT_SKY_DISTANCE = 1000;
const SUN_POSITION = [10000, 300000, 1000000];

// drei <Sky> is a GLSL ShaderMaterial and <Clouds> relies on onBeforeCompile; neither runs on
// WebGPURenderer, so use three's node-based SkyMesh (which has its own procedural clouds) there.
function WebGPUSky({ distance }) {
    const sky = useMemo(() => {
        const mesh = new SkyMesh();
        mesh.turbidity.value = 4;
        mesh.rayleigh.value = 1.2;
        mesh.mieCoefficient.value = 0.01;
        mesh.mieDirectionalG.value = 0.98;
        mesh.sunPosition.value.set(...SUN_POSITION);
        return mesh;
    }, []);

    useEffect(() => () => {
        sky.geometry.dispose();
        sky.material.dispose();
    }, [sky]);

    return <primitive object={sky} scale={distance} />;
}

export default function ProjectSkyClouds({ projectBaseId }) {
    const isWebGPU = useThree((state) => Boolean(state.gl.isWebGPURenderer));
    // Live weather (weatherStore): an overcast sky turns grey and hazy; rain darkens the clouds further.
    // The eased weather (updateWeatherBlend: a new reading blends in over ~a minute), in 2% steps so
    // the sky and clouds re-render only now and then while it changes.
    const [{ overcast, wet }, setShown] = useState({ overcast: 0, wet: 0 });
    const shownRef = useRef({ overcast: -1, wet: -1 });
    useFrame(() => {
        const blend = updateWeatherBlend();
        const next = { overcast: Math.round(blend.overcast * 50) / 50, wet: Math.round(blend.rain * 50) / 50 };
        if (next.overcast !== shownRef.current.overcast || next.wet !== shownRef.current.wet) {
            shownRef.current = next;
            setShown(next);
        }
    });
    const mix = (clear, grey) => clear + (grey - clear) * overcast;
    // Time of day (CelestialSky): the sky shader follows the real sun; clouds darken at night.
    const daylight = useSkyStore((state) => state.daylight);
    // Clouds also lose light as the sun sinks through the afternoon (0 high sun .. 1 at the horizon).
    const lowSun = useSkyStore((state) => (state.ready ? Number((1 - THREE.MathUtils.smoothstep(state.sun.altitude, -0.02, 0.6)).toFixed(2)) : 0));
    const cloudColor = useMemo(
        () => new THREE.Color("#f8fbff").lerp(new THREE.Color("#a9b1b9"), overcast).lerp(new THREE.Color("#6f7882"), wet)
            .lerp(new THREE.Color("#5d6570"), 0.45 * lowSun * daylight)
            .lerp(new THREE.Color("#252c38"), 1 - daylight).getStyle(),
        [overcast, wet, daylight, lowSun]
    );
    const skyRef = useRef(null);
    useFrame(() => {
        const uniform = skyRef.current?.material?.uniforms?.sunPosition;
        const sky = useSkyStore.getState();
        if (uniform && sky.ready) uniform.value.fromArray(sky.sun.direction);
    });
    const isProject153 = projectBaseId === "153";
    const shouldRender = isProject153 || ["144", "145", "147"].includes(projectBaseId);

    if (!shouldRender) return null;

    if (isWebGPU) {
        return <WebGPUSky distance={isProject153 ? PROJECT_153_SKY_DISTANCE : DEFAULT_SKY_DISTANCE} />;
    }

    return (
        <>
            <Sky
                ref={skyRef}
                distance={isProject153 ? PROJECT_153_SKY_DISTANCE : undefined}
                sunPosition={SUN_POSITION}
                turbidity={mix(4, 18)}
                rayleigh={mix(1.2, 0.25)}
                mieCoefficient={mix(0.01, 0.045)}
                mieDirectionalG={0.98}
                inclination={0.9}
            />
            {isProject153 ? (
                <Clouds material={THREE.MeshBasicMaterial} limit={420} range={420}>
                    {PROJECT_153_CLOUDS.map((cloud) => (
                        <Cloud
                            key={cloud.seed}
                            seed={cloud.seed}
                            position={cloud.position}
                            opacity={Math.min(0.95, cloud.opacity + 0.2 * overcast)}
                            speed={0.08}
                            bounds={cloud.bounds}
                            segments={16}
                            scale={cloud.scale}
                            volume={cloud.volume}
                            smallestVolume={0.8}
                            growth={4.5}
                            fade={260}
                            concentrate="random"
                            color={cloudColor}
                        />
                    ))}
                </Clouds>
            ) : (
                <Clouds material={THREE.MeshBasicMaterial} limit={40} range={40}>
                    <Cloud
                        position={[0, 32, -22]}
                        opacity={0.55}
                        speed={0.25}
                        bounds={[80, 18, 55]}
                        segments={24}
                        scale={2.2}
                    />
                </Clouds>
            )}
        </>
    );
}
