import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getTerrainHeightAt } from "../../threejs/terrain/terrainData";
import { wetSurfaceUniforms } from "../../threejs/terrain/world/wetSurface";
import { RAIN_LEVELS, overcastLevel, rainIntensity, useSkyStore, useWeatherStore } from "./weatherStore";

// The scene follows the live weather (weatherStore, Open-Meteo):
//  - Overcast (cloud cover, rain): the sun dims and its shadows fade out, the shadow side is filled
//    by soft sky light, the light darkens a little and a light haze appears. A clear sky keeps the sun.
//  - Rain: streaks around the camera, drawn as thin camera-facing quads (at least ~2 px wide, so
//    drizzle shows against buildings, not only against the sky), all animated in the vertex shader:
//    each drop falls, drifts with the wind and wraps inside a box that follows the camera. Drizzle is
//    fine, short and slow; heavy rain long, dense and fast. Streaks fade out in high aerial views.
// Everything eases over a few seconds and is restored when leaving the map.

const MAX_DROPS = 14000;
const BOX = new THREE.Vector3(50, 34, 50); // metres around the camera
const FADE_FROM_HEIGHT = 250; // metres above ground: streaks full below, gone from FADE_TO_HEIGHT
const FADE_TO_HEIGHT = 600;

const SUN_DIM = 0.82; // direct sun reduction when fully overcast
const FILL_BOOST = 0.3; // more ambient / sky light when overcast (light comes from the whole sky)
const DARKEN_OVERCAST = 0.12; // exposure reduction, overcast
const DARKEN_RAIN = 0.18; // extra exposure reduction, heavy rain
const HAZE_COLOR = new THREE.Color("#8d99a6");
const HAZE_OVERCAST = 0.0006; // FogExp2 density, overcast
const HAZE_RAIN = 0.0016; // extra density, heavy rain
// Ground wetness (wetSurface.js): soaks within ~10 s of rain, dries over a few minutes after it stops.
const WET_UP = 0.25; // 1/s
const WET_DOWN = 0.006; // 1/s
const SKY_CLEAR_TOP = new THREE.Color("#5f93d4");
const SKY_CLEAR_HORIZON = new THREE.Color("#c3d9ee");
const SKY_GREY_TOP = new THREE.Color("#7c8794");
const SKY_GREY_HORIZON = new THREE.Color("#a9b2bb");
// Time of day (useSkyStore, CelestialSky): night light is moonlight, twilight is warm and weak.
const MOONLIGHT = 0.14; // full moon, high, relative to the sun light's own intensity
const NIGHT_FILL = 0.16; // ambient / sky light at night, relative to day
const NIGHT_EXPOSURE = 0.62; // exposure at night, relative to day
// Late afternoon / early morning: the light level follows the sun's height (see lowSunDim).
const LOW_SUN_DARKEN = 0.14; // exposure reduction with the sun at the horizon, clear sky
const LOW_SUN_DARKEN_OVERCAST = 0.2; // extra under full cloud (a grey evening is gloomy)
const LOW_SUN_FILL = 0.3; // ambient / sky light reduction with the sun at the horizon
const SUN_COLOR = new THREE.Color("#ffffff");
const LOW_SUN_COLOR = new THREE.Color("#ffc58a");
const MOON_COLOR = new THREE.Color("#9fb3ff");
const NIGHT_HAZE = new THREE.Color("#1a2130");
const SKY_NIGHT_TOP = new THREE.Color("#0b1220");
const SKY_NIGHT_HORIZON = new THREE.Color("#1f2a3b");

// The renderer uses a logarithmic depth buffer: the logdepthbuf chunks make the drops' depth match the
// scene's, so drops in front of buildings and the ground show (without them they only showed on the sky).
const vertexShader = /* glsl */ `
    #include <common>
    #include <logdepthbuf_pars_vertex>
    attribute vec2 corner;  // x: -1 / 1 across the streak; y: 0 = top, 1 = bottom
    attribute vec3 seed;    // per drop: position in the box (0..1)
    uniform float uTime;
    uniform vec3 uCenter;
    uniform vec3 uBox;
    uniform float uSpeed;
    uniform float uLength;
    uniform float uWidth;      // metres
    uniform float uPixelAngle; // metres per pixel at 1 m distance
    uniform vec2 uWind;
    varying float vTip;
    varying float vSide;
    varying float vFade;

    void main() {
        vec3 travel = vec3(uWind.x, -uSpeed, uWind.y) * uTime;
        vec3 local = mod(seed * uBox + travel - uCenter, uBox) - 0.5 * uBox;
        vec3 bottom = uCenter + local;
        vec3 direction = normalize(vec3(uWind.x, -uSpeed, uWind.y));
        vec3 point = bottom - direction * uLength * (1.0 - corner.y);
        vec3 toCamera = cameraPosition - point;
        float distance = length(toCamera);
        vec3 across = normalize(cross(direction, toCamera / max(distance, 0.001)));
        // At least ~2 px wide at any distance, so far drops do not flicker away.
        float width = max(uWidth, distance * uPixelAngle * 2.0);
        point += across * corner.x * width * 0.5;
        vTip = corner.y;
        vSide = corner.x;
        vec3 edge = abs(local) / (0.5 * uBox);
        vFade = (1.0 - smoothstep(0.6, 1.0, max(max(edge.x, edge.z), edge.y))) * (1.0 - smoothstep(8.0, 26.0, distance) * 0.55);
        gl_Position = projectionMatrix * viewMatrix * vec4(point, 1.0);
        #include <logdepthbuf_vertex>
    }
`;

const fragmentShader = /* glsl */ `
    #include <logdepthbuf_pars_fragment>
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vTip;
    varying float vSide;
    varying float vFade;
    void main() {
        #include <logdepthbuf_fragment>
        float along = smoothstep(0.0, 0.7, vTip);      // faint tail, brighter head
        float across = 1.0 - vSide * vSide;            // soft edges
        gl_FragColor = vec4(uColor, uOpacity * vFade * along * across);
    }
`;

const lerp = THREE.MathUtils.lerp;

export default function RainEffect() {
    const weather = useWeatherStore((state) => state.weather);
    const preview = useWeatherStore((state) => state.preview);
    const rainTarget = rainIntensity(weather, preview);
    const overcastTarget = overcastLevel(weather, preview);
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const size = useThree((state) => state.size);
    const rain = useRef(0); // eased levels
    const overcast = useRef(0);
    const wetness = useRef(0);
    const base = useRef(null); // scene exposure / fog before the weather changed them
    const lights = useRef({ list: [], scannedAt: -Infinity });
    const meshRef = useRef(null);

    const { geometry, material } = useMemo(() => {
        const g = new THREE.InstancedBufferGeometry();
        g.setAttribute("corner", new THREE.BufferAttribute(new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]), 2));
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3)); // positions come from the shader
        g.setIndex([0, 2, 1, 1, 2, 3]);
        const seeds = new Float32Array(MAX_DROPS * 3);
        for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
        g.setAttribute("seed", new THREE.InstancedBufferAttribute(seeds, 3));
        g.instanceCount = 0;
        const m = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uCenter: { value: new THREE.Vector3() },
                uBox: { value: BOX.clone() },
                uSpeed: { value: 8 },
                uLength: { value: 0.8 },
                uWidth: { value: 0.012 },
                uPixelAngle: { value: 0.001 },
                uWind: { value: new THREE.Vector2() },
                uColor: { value: new THREE.Color("#dde6ef") },
                uOpacity: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false,
        });
        return { geometry: g, material: m };
    }, []);

    // Haze: a FogExp2 installed once at zero density (adding or removing scene fog later recompiles every
    // material, a multi-second freeze); the weather only changes its density. An existing fog is reused.
    useEffect(() => {
        let ownFog = null;
        if (!scene.fog) {
            ownFog = new THREE.FogExp2(HAZE_COLOR.clone(), 0);
            scene.fog = ownFog;
        }
        base.current = { exposure: gl.toneMappingExposure, fog: scene.fog, density: scene.fog?.density ?? 0, ownFog: Boolean(ownFog) };
        const lightState = lights.current;
        return () => {
            const b = base.current;
            if (b) {
                gl.toneMappingExposure = b.exposure;
                if (b.fog?.isFogExp2) b.fog.density = b.density;
            }
            for (const { light, intensity, shadowIntensity, color } of lightState.list) {
                light.intensity = intensity;
                if (color) light.color.copy(color);
                if (light.shadow && shadowIntensity !== undefined) light.shadow.intensity = shadowIntensity;
            }
            lightState.list = [];
            wetSurfaceUniforms.uWetness.value = 0;
            wetSurfaceUniforms.uRain.value = 0;
            if (ownFog && scene.fog === ownFog) scene.fog = null;
            base.current = null;
        };
    }, [gl, scene]);

    useEffect(() => () => {
        geometry.dispose();
        material.dispose();
    }, [geometry, material]);

    useFrame(({ clock }, delta) => {
        const dt = Math.min(delta, 0.1);
        rain.current += (rainTarget - rain.current) * (1 - Math.exp(-0.8 * dt));
        overcast.current += (overcastTarget - overcast.current) * (1 - Math.exp(-0.8 * dt));
        const wet = rain.current;
        const grey = overcast.current;

        // Lights: found every few seconds (they can be recreated); their own intensities kept as the base.
        const time = clock.getElapsedTime();
        if (time - lights.current.scannedAt > 3) {
            lights.current.scannedAt = time;
            const known = new Map(lights.current.list.map((entry) => [entry.light, entry]));
            const next = [];
            scene.traverse((object) => {
                if (!object.isDirectionalLight && !object.isAmbientLight && !object.isHemisphereLight) return;
                next.push(known.get(object) || {
                    light: object,
                    intensity: object.intensity,
                    shadowIntensity: object.shadow?.intensity,
                    color: object.color?.clone(),
                    sun: object.isDirectionalLight,
                });
            });
            lights.current.list = next;
        }
        // Time of day: the sun by day (weaker and warmer when low), the moon by night (by its phase
        // and height), both through the clouds; shadows come from whichever lights the scene.
        const sky = useSkyStore.getState();
        const day = sky.ready ? sky.daylight : 1;
        const sunUp = sky.ready ? THREE.MathUtils.smoothstep(sky.sun.altitude, 0, 0.5) : 1; // 0 at the horizon .. 1 at ~30 degrees
        const sunShare = day * (0.35 + 0.65 * sunUp);
        const moonShare = sky.ready ? (1 - day) * MOONLIGHT * sky.moon.fraction * THREE.MathUtils.smoothstep(sky.moon.altitude, 0, 0.3) : 0;
        const byMoon = moonShare > sunShare;
        // Daylight itself fades through the afternoon as the sun sinks (sky light ~ sun height),
        // more under cloud: 0 with the sun ~35 degrees or higher, 1 at the horizon. Weighted by `day`
        // so twilight and night keep their own tuning.
        const lowSunDim = sky.ready ? day * (1 - THREE.MathUtils.smoothstep(sky.sun.altitude, -0.02, 0.6)) : 0;
        for (const entry of lights.current.list) {
            if (entry.sun) {
                entry.light.intensity = entry.intensity * (sunShare + moonShare) * (1 - SUN_DIM * grey);
                if (entry.light.shadow && entry.shadowIntensity !== undefined) entry.light.shadow.intensity = entry.shadowIntensity * (1 - grey) * (byMoon ? 0.5 : 1);
                if (entry.color && sky.ready) entry.light.color.copy(byMoon ? MOON_COLOR : SUN_COLOR).lerp(LOW_SUN_COLOR, byMoon ? 0 : day * (1 - sunUp));
                // Direction used by SunShadows to place the light and its shadow camera.
                const direction = byMoon ? sky.moon.direction : sky.sun.direction;
                // Low sun / moon: kept at least ~4 degrees up, so shadows stay finite at sunrise and sunset.
                if (sky.ready && direction[1] > -0.05) {
                    const dir = (entry.light.userData.sunDirection ||= new THREE.Vector3()).fromArray(direction);
                    dir.y = Math.max(dir.y, 0.07);
                    dir.normalize();
                }
            } else {
                entry.light.intensity = entry.intensity * THREE.MathUtils.lerp(NIGHT_FILL, 1, day) * (1 + FILL_BOOST * grey) * (1 - LOW_SUN_FILL * lowSunDim);
            }
        }
        // 0 = light rain (few fine, slow, faint drops) .. 1 = downpour (dense, long, fast). Levels:
        // light 0.15 -> 0, medium 0.5 -> ~0.4, heavy 1 -> 1.
        const heavy = THREE.MathUtils.clamp((wet - RAIN_LEVELS.light) / (1 - RAIN_LEVELS.light), 0, 1);

        // Wet ground: light rain only dampens the road (barely a puddle), medium rain forms puddles,
        // a downpour soaks everything. Eases up fast, dries slowly.
        const wetTarget = wet > 0.01 ? lerp(0.22, 1, heavy) : 0;
        const wetRate = wetTarget > wetness.current ? WET_UP : WET_DOWN;
        wetness.current += (wetTarget - wetness.current) * (1 - Math.exp(-wetRate * dt));
        wetSurfaceUniforms.uWetness.value = wetness.current;
        wetSurfaceUniforms.uRain.value = wet;
        wetSurfaceUniforms.uWetTime.value = time % 1000;
        wetSurfaceUniforms.uDaylight.value = day;
        wetSurfaceUniforms.uSkyTop.value.copy(SKY_CLEAR_TOP).lerp(SKY_GREY_TOP, grey).lerp(SKY_NIGHT_TOP, 1 - day);
        wetSurfaceUniforms.uSkyHorizon.value.copy(SKY_CLEAR_HORIZON).lerp(SKY_GREY_HORIZON, grey).lerp(SKY_NIGHT_HORIZON, 1 - day);

        const b = base.current;
        if (b) {
            gl.toneMappingExposure = b.exposure * THREE.MathUtils.lerp(NIGHT_EXPOSURE, 1, day) * (1 - DARKEN_OVERCAST * grey - DARKEN_RAIN * wet)
                * (1 - lowSunDim * (LOW_SUN_DARKEN + LOW_SUN_DARKEN_OVERCAST * grey));
            if (b.fog?.isFogExp2) {
                b.fog.density = b.density + HAZE_OVERCAST * grey + HAZE_RAIN * wet;
                if (b.ownFog) b.fog.color.copy(HAZE_COLOR).lerp(NIGHT_HAZE, 1 - day);
            }
        }

        // Rain streaks.
        const mesh = meshRef.current;
        if (!mesh) return;
        const ground = getTerrainHeightAt(camera.position.x, camera.position.z) ?? 0;
        const altitudeFade = 1 - THREE.MathUtils.smoothstep(camera.position.y - ground, FADE_FROM_HEIGHT, FADE_TO_HEIGHT);
        const amount = wet * altitudeFade;
        mesh.visible = amount > 0.01;
        if (!mesh.visible) return;
        // Drops: light ~7% (a sparse few hundred around the viewer), medium ~45%, heavy all.
        geometry.instanceCount = Math.round(MAX_DROPS * lerp(0.07, 1, heavy) * altitudeFade);
        const u = material.uniforms;
        u.uColor.value.set("#dde6ef").multiplyScalar(THREE.MathUtils.lerp(0.35, 1, day));
        u.uTime.value = time % 3600;
        u.uCenter.value.copy(camera.position);
        u.uSpeed.value = lerp(4.5, 12, heavy);
        u.uLength.value = lerp(0.5, 1.5, heavy);
        u.uWidth.value = lerp(0.008, 0.016, heavy);
        u.uOpacity.value = lerp(0.45, 0.75, heavy) * Math.min(1, amount / 0.1);
        const fov = THREE.MathUtils.degToRad(camera.fov || 50);
        u.uPixelAngle.value = (2 * Math.tan(fov / 2)) / Math.max(size.height, 1);
        // Wind (km/h, from `windDirection`) -> drift towards the opposite side; scene x east, z south.
        const speed = Number.isFinite(weather?.windSpeed) ? weather.windSpeed / 3.6 : 0;
        const from = THREE.MathUtils.degToRad(Number.isFinite(weather?.windDirection) ? weather.windDirection : 0);
        u.uWind.value.set(-Math.sin(from) * speed * 0.8, Math.cos(from) * speed * 0.8);
    });

    return (
        <mesh
            ref={meshRef}
            geometry={geometry}
            material={material}
            frustumCulled={false}
            renderOrder={20}
            visible={false}
        />
    );
}
