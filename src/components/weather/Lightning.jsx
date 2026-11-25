import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { emitStrike, isStorm, lightning } from "./lightning";
import { useWeatherStore } from "./weatherStore";

// Lightning in thunderstorms (live weather, or ?weather=storm): every 8-25 s a strike somewhere
// 300-1200 m from the camera. The scene flashes (RainEffect multiplies the exposure, no extra
// lights) with a short flicker, and a jagged bolt shows for a moment: one small ribbon mesh,
// rebuilt per strike and hidden in between, so it costs nothing while no strike is showing.
// Thunder follows from WeatherSound (delayed by the distance).

const MIN_GAP = 8;
const MAX_GAP = 25;
const BOLT_WIDTH = 2.2; // metres

// Flicker: [start s, length s, brightness] pulses after the strike.
const flickerPattern = () => {
    const pulses = [[0, 0.07, 1]];
    let t = 0.07;
    for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) {
        t += 0.04 + Math.random() * 0.08;
        pulses.push([t, 0.04 + Math.random() * 0.06, 0.4 + Math.random() * 0.6]);
        t += 0.06;
    }
    return pulses;
};

/** Ribbon along a jagged path from (top) down to (bottom), facing the camera horizontally. */
function boltGeometry(top, bottom, camera) {
    const points = [top.clone()];
    const segments = 14;
    for (let i = 1; i < segments; i++) {
        const p = top.clone().lerp(bottom, i / segments);
        const kink = (1 - i / segments) * 40 + 8;
        p.x += (Math.random() - 0.5) * kink;
        p.z += (Math.random() - 0.5) * kink;
        points.push(p);
    }
    points.push(bottom.clone());
    // A short side branch.
    const from = 3 + Math.floor(Math.random() * 5);
    const branch = [points[from].clone()];
    for (let i = 1; i <= 4; i++) {
        const last = branch[i - 1];
        branch.push(new THREE.Vector3(last.x + (Math.random() - 0.3) * 35, last.y - 25 - Math.random() * 20, last.z + (Math.random() - 0.5) * 35));
    }
    const view = new THREE.Vector3().subVectors(bottom, camera.position).setY(0).normalize();
    const side = new THREE.Vector3(-view.z, 0, view.x);
    const positions = [];
    const index = [];
    for (const [path, width] of [[points, BOLT_WIDTH], [branch, BOLT_WIDTH * 0.6]]) {
        const base = positions.length / 3;
        path.forEach((p, i) => {
            const w = width * (1 - (i / path.length) * 0.5);
            positions.push(p.x - side.x * w, p.y, p.z - side.z * w, p.x + side.x * w, p.y, p.z + side.z * w);
            if (i > 0) {
                const a = base + (i - 1) * 2;
                index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
        });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(index);
    return geometry;
}

export default function Lightning() {
    const { camera } = useThree();
    const meshRef = useRef(null);
    const material = useMemo(() => new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.85, 0.9, 1).multiplyScalar(3),
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    }), []);
    const state = useRef({ next: 0, strikeAt: -1, pulses: [] });

    useEffect(() => () => {
        material.dispose();
        meshRef.current?.geometry?.dispose();
        lightning.flash = 0;
    }, [material]);

    useFrame(({ clock }) => {
        const now = clock.elapsedTime;
        const s = state.current;
        const mesh = meshRef.current;
        const { weather, preview } = useWeatherStore.getState();
        if (!isStorm(weather, preview)) {
            s.next = 0;
            lightning.flash = 0;
            if (mesh) mesh.visible = false;
            return;
        }
        if (!s.next) s.next = now + 3 + Math.random() * 5;
        if (now >= s.next) {
            s.next = now + MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
            s.strikeAt = now;
            s.pulses = flickerPattern();
            const distance = 300 + Math.random() * 900;
            // Mostly in front of the viewer (so the bolt is seen); the rest anywhere (flash only).
            const look = camera.getWorldDirection(new THREE.Vector3());
            const angle = Math.random() < 0.7
                ? Math.atan2(look.z, look.x) + (Math.random() - 0.5) * 1.8
                : Math.random() * Math.PI * 2;
            const ground = new THREE.Vector3(camera.position.x + Math.cos(angle) * distance, 0, camera.position.z + Math.sin(angle) * distance);
            const top = ground.clone().setY(350 + Math.random() * 150);
            if (mesh) {
                mesh.geometry?.dispose();
                mesh.geometry = boltGeometry(top, ground, camera);
            }
            emitStrike({ distance });
        }
        // Flash brightness from the flicker pulses.
        const t = now - s.strikeAt;
        let flash = 0;
        for (const [start, length, level] of s.pulses) {
            if (t >= start && t < start + length) flash = Math.max(flash, level * (1 - (t - start) / length) ** 0.5);
        }
        lightning.flash = flash;
        if (mesh) {
            mesh.visible = flash > 0.05;
            material.opacity = Math.min(1, flash * 1.2);
        }
    });

    return <mesh ref={meshRef} material={material} visible={false} frustumCulled={false} renderOrder={10} />;
}
