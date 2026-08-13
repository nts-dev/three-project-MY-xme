import React from "react";
import { Cloud, Clouds, Sky } from "@react-three/drei";
import * as THREE from "three";

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

export default function ProjectSkyClouds({ projectBaseId }) {
    const isProject153 = projectBaseId === "153";
    const shouldRender = isProject153 || ["144", "145", "147"].includes(projectBaseId);

    if (!shouldRender) return null;

    return (
        <>
            <Sky
                distance={isProject153 ? PROJECT_153_SKY_DISTANCE : undefined}
                sunPosition={[10000, 300000, 1000000]}
                turbidity={4}
                rayleigh={1.2}
                mieCoefficient={0.01}
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
                            opacity={cloud.opacity}
                            speed={0.08}
                            bounds={cloud.bounds}
                            segments={34}
                            scale={cloud.scale}
                            volume={cloud.volume}
                            smallestVolume={0.8}
                            growth={4.5}
                            fade={260}
                            concentrate="random"
                            color="#f8fbff"
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
