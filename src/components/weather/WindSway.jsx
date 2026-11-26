import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useWeatherStore, updateWeatherBlend } from "./weatherStore";

// Trees move with the live wind (weatherStore, Open-Meteo): in the vertex shader each vertex is
// pushed downwind by an amount growing with the square of its height above the tree's base (the
// trunk stays put, the crown bends), as a steady lean plus a slow sway and gusts, out of phase from
// tree to tree. No CPU work per tree; the tree materials are patched once (one small recompile when
// the trees first appear). Calm air leaves them still. ?wind=<km/h> previews another wind speed.

const TREE = /PineTree|Tree0?\d/i;
const SCAN_SECONDS = 4;
const MAX_BEND = 0.016; // metres per metre² of height at full strength (an 8 m pine bends ~1 m)
const IDLE_STRENGTH = 0.12; // calm air: a barely-there sway, so the trees never look frozen

const windUniforms = {
    uWindTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(1, 0) }, // where the wind blows to (scene x, z)
    uWindStrength: { value: 0 }, // 0 calm .. 1 storm
    uWindGust: { value: 0 }, // 0 .. 1
};

const WIND_PROJECT = /* glsl */ `
    vec4 mvPosition = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        vec4 treeBase = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    #else
        vec4 treeBase = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    #endif
    vec4 treeWorld = modelMatrix * mvPosition;
    if (uWindStrength > 0.001) {
        float h = max(treeWorld.y - treeBase.y, 0.0);
        float phase = dot(treeBase.xz, vec2(0.071, 0.113));
        float sway = 0.55 * sin(uWindTime * 1.3 + phase) + 0.25 * sin(uWindTime * 2.9 + phase * 1.7);
        float gust = uWindGust * max(0.0, sin(uWindTime * 0.45 + phase * 0.3));
        float bend = ${MAX_BEND.toFixed(4)} * uWindStrength * h * h * (0.35 + 0.65 * sway + 0.8 * gust);
        // Side-to-side rocking across the wind, and a fast flutter of the needles / leaves.
        vec2 across = vec2(-uWindDir.y, uWindDir.x);
        float rock = ${MAX_BEND.toFixed(4)} * 0.35 * uWindStrength * h * h * sin(uWindTime * 0.9 + phase * 2.1);
        float flutter = 0.05 * uWindStrength * h * sin(uWindTime * 7.0 + dot(treeWorld.xyz, vec3(1.7, 2.3, 1.3)));
        treeWorld.xz += uWindDir * bend + across * rock + vec2(flutter, -flutter) * 0.5;
        treeWorld.y -= 0.15 * bend * bend / max(h, 1.0); // keeps the crown from stretching
    }
    mvPosition = viewMatrix * treeWorld;
    gl_Position = projectionMatrix * mvPosition;
`;

function patchMaterial(material) {
    if (!material || material.userData.windSway) return;
    material.userData.windSway = true;
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        previous?.(shader, renderer);
        Object.assign(shader.uniforms, windUniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
                uniform float uWindTime;
                uniform vec2 uWindDir;
                uniform float uWindStrength;
                uniform float uWindGust;`)
            .replace("#include <project_vertex>", WIND_PROJECT);
    };
    const previousKey = material.customProgramCacheKey?.bind(material);
    material.customProgramCacheKey = () => `${previousKey ? previousKey() : ""}|wind`;
    material.needsUpdate = true;
}

export default function WindSway() {
    const scene = useThree((state) => state.scene);
    const scanned = useRef(-Infinity);
    const strength = useRef(0);
    const direction = useRef(new THREE.Vector2(1, 0));

    useEffect(() => () => {
        windUniforms.uWindStrength.value = 0;
    }, []);

    useFrame(({ clock }, delta) => {
        const time = clock.getElapsedTime();
        if (time - scanned.current > SCAN_SECONDS) {
            scanned.current = time;
            scene.traverse((object) => {
                if (!object.isMesh || !TREE.test(object.name || "")) return;
                (Array.isArray(object.material) ? object.material : [object.material]).forEach(patchMaterial);
            });
        }

        const weather = useWeatherStore.getState().weather;
        // Eased wind (updateWeatherBlend: a new reading blends in), km/h.
        const blend = updateWeatherBlend();
        const speed = blend.wind;
        const gusts = blend.gusts;
        // Effective wind: the mean plus part of the gusts (trees answer to gusts). Even light air
        // moves a crown a little, so there is a gentle idle sway; ~50 km/h bends a tree fully.
        const effective = Math.max(speed, speed + (gusts - speed) * 0.5);
        const target = Math.max(IDLE_STRENGTH, Math.pow(THREE.MathUtils.clamp(effective / 50, 0, 1), 0.7));
        strength.current += (target - strength.current) * (1 - Math.exp(-0.5 * Math.min(delta, 0.1)));
        const from = THREE.MathUtils.degToRad(Number.isFinite(weather?.windDirection) ? weather.windDirection : 225);
        direction.current.set(-Math.sin(from), Math.cos(from)); // blows towards the opposite side (x east, z south)

        windUniforms.uWindTime.value = time % 10000;
        windUniforms.uWindStrength.value = strength.current;
        windUniforms.uWindDir.value.copy(direction.current);
        windUniforms.uWindGust.value = THREE.MathUtils.clamp((gusts - speed) / 40, 0, 1);
    });

    return null;
}
