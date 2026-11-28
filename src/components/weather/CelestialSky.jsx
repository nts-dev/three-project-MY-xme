import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getActiveTerrain } from "../../threejs/terrain/terrainData";
import { moonIllumination, moonPosition, sceneDirection, sunPosition } from "./ephemeris";
import { daylightFromAltitude, useSkyStore, useWeatherStore } from "./weatherStore";
import { displayDate } from "./siteClock";

// Real sun and moon for the open map: their positions are worked out from the map's real-world
// location (terrain anchor) and the current time (ephemeris.js), every few seconds, and published in
// useSkyStore. RainEffect lights the scene from them (sun or moon light, twilight, night), the sky
// shader and clouds follow the sun. Here: the moon (with its real phase) and the stars at night.
// ?time=HH:MM (site local time) previews another time of day.

const UPDATE_SECONDS = 5;
const MOON_DISTANCE = 20000; // metres from the camera (the camera's far plane is much further)
const MOON_ANGULAR_SIZE = 1.6 * (Math.PI / 180); // drawn ~3x the real 0.5 degrees, so it reads on screen

const moonVertex = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    varying vec3 vNormal;
    void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
    }
`;

const moonFragment = /* glsl */ `
    #include <logdepthbuf_pars_fragment>
    uniform vec3 uSunDirection;
    uniform float uOpacity;
    varying vec3 vNormal;
    void main() {
        #include <logdepthbuf_fragment>
        // Lit by the sun (the phase follows), a faint earthshine on the dark side, soft mottling.
        float light = smoothstep(-0.05, 0.25, dot(normalize(vNormal), normalize(uSunDirection)));
        float mare = 0.88 + 0.12 * sin(vNormal.x * 9.0) * sin(vNormal.y * 7.0 + 1.3);
        vec3 color = vec3(0.96, 0.94, 0.88) * mare * light + vec3(0.06, 0.07, 0.09);
        gl_FragColor = vec4(color, uOpacity);
    }
`;

export default function CelestialSky() {
    const camera = useThree((state) => state.camera);
    const daylight = useSkyStore((state) => state.daylight);
    const timer = useRef(-Infinity);
    const moonRef = useRef(null);
    const sunVector = useMemo(() => new THREE.Vector3(), []);
    const moonVector = useMemo(() => new THREE.Vector3(), []);

    const moonMaterial = useMemo(() => new THREE.ShaderMaterial({
        vertexShader: moonVertex,
        fragmentShader: moonFragment,
        uniforms: { uSunDirection: { value: new THREE.Vector3(0, 1, 0) }, uOpacity: { value: 1 } },
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
    }), []);
    const moonGeometry = useMemo(() => new THREE.SphereGeometry(1, 32, 16), []);
    useEffect(() => () => {
        moonMaterial.dispose();
        moonGeometry.dispose();
    }, [moonMaterial, moonGeometry]);

    useFrame(({ clock }) => {
        const time = clock.getElapsedTime();
        if (time - timer.current >= UPDATE_SECONDS) {
            timer.current = time;
            const terrain = getActiveTerrain();
            const anchor = terrain?.world?.frame?.anchor;
            if (Number.isFinite(anchor?.lat) && Number.isFinite(anchor?.lon)) {
                const { timePreview, setSky } = useSkyStore.getState();
                const date = displayDate(timePreview, useWeatherStore.getState().weather, anchor.lon);
                const sun = sunPosition(date, anchor.lat, anchor.lon);
                const moon = moonPosition(date, anchor.lat, anchor.lon);
                const phase = moonIllumination(date);
                sceneDirection(sun, sunVector);
                sceneDirection(moon, moonVector);
                setSky({
                    ready: true,
                    sun: { direction: sunVector.toArray(), altitude: sun.altitude },
                    moon: { direction: moonVector.toArray(), altitude: moon.altitude, fraction: phase.fraction },
                    daylight: Number(daylightFromAltitude(sun.altitude).toFixed(3)),
                });
            }
        }

        // Moon: a sphere far out along its direction, following the camera, lit from the sun's side.
        const mesh = moonRef.current;
        if (!mesh) return;
        const { moon, sun, daylight: day } = useSkyStore.getState();
        mesh.visible = moon.altitude > -0.03;
        if (!mesh.visible) return;
        moonVector.fromArray(moon.direction);
        mesh.position.copy(camera.position).addScaledVector(moonVector, MOON_DISTANCE);
        mesh.scale.setScalar(MOON_DISTANCE * Math.tan(MOON_ANGULAR_SIZE / 2));
        moonMaterial.uniforms.uSunDirection.value.fromArray(sun.direction);
        // Pale in daylight (as the real daytime moon), bright at night.
        moonMaterial.uniforms.uOpacity.value = 0.25 + 0.75 * (1 - day);
    });

    return (
        <>
            <mesh ref={moonRef} geometry={moonGeometry} material={moonMaterial} frustumCulled={false} renderOrder={-1} visible={false} />
            {daylight < 0.35 && <Stars radius={8000} depth={2000} count={4000} factor={60} saturation={0} fade speed={0.3} />}
        </>
    );
}
