import { create } from "zustand";

// The current weather reading for the open map (set by WeatherChip, which fetches it), shared with
// the 3D scene (RainEffect). `preview` forces a condition for testing: ?weather=rain|heavy|drizzle|storm
// in the page URL.
const PREVIEW = (() => {
    if (typeof window === "undefined") return null;
    const value = new URLSearchParams(window.location.search).get("weather");
    return value ? value.toLowerCase() : null;
})();

export const useWeatherStore = create((set) => ({
    weather: null,
    preview: PREVIEW,
    setWeather: (weather) => set({ weather }),
}));

/**
 * 0 (clear sky, sharp sun shadows) .. 1 (fully overcast: no direct sun) from cloud cover; any rain
 * makes it at least mostly overcast. URL preview: clear / cloudy / drizzle / rain / heavy / storm.
 */
export function overcastLevel(weather, preview) {
    if (preview) {
        const rain = rainIntensity(null, preview);
        if (rain > 0) return 0.7 + 0.3 * rain;
        return { clear: 0, sunny: 0, none: 0, dry: 0, cloudy: 1, overcast: 1 }[preview] ?? 1;
    }
    if (!weather) return 0;
    const clouds = Number.isFinite(weather.cloudCover) ? weather.cloudCover / 100 : { clear: 0, "partly-cloudy": 0.5, cloudy: 1, fog: 1 }[weather.kind] ?? 0;
    // Shadows only fade once the sky is mostly covered (scattered clouds still let the sun through).
    const fromClouds = Math.min(1, Math.max(0, (clouds - 0.4) / 0.55));
    // Rain means a mostly covered sky: light rain still lets some light through, a downpour none.
    const rain = rainIntensity(weather, preview);
    return Math.max(fromClouds, rain > 0 ? 0.7 + 0.3 * rain : 0);
}

// Three rain levels, each with its own look in the scene (RainEffect):
//   light  - a few fine, faint drops, damp road, hardly any puddles;
//   medium - steady rain, wet road, puddles forming;
//   heavy  - downpour: dense long streaks, soaked road, big puddles, dark sky.
export const RAIN_LEVELS = { none: 0, light: 0.15, medium: 0.5, heavy: 1 };
const LEVEL_ORDER = ["none", "light", "medium", "heavy"];
const PREVIEW_LEVELS = { drizzle: "light", light: "light", rain: "medium", medium: "medium", moderate: "medium", heavy: "heavy", storm: "heavy", thunderstorm: "heavy" };
// WMO codes by intensity (Open-Meteo, and the airport observation mapped to them by the backend).
// Heavy (dense) drizzle is little water but a steady curtain of fine drops: it looks like medium rain.
const CODE_LEVELS = { 51: "light", 53: "light", 55: "medium", 56: "light", 57: "medium", 61: "light", 66: "light", 80: "light", 63: "medium", 81: "medium", 95: "medium", 65: "heavy", 67: "heavy", 82: "heavy", 96: "heavy", 99: "heavy" };

/**
 * "none" | "light" | "medium" | "heavy" from a weather reading or the URL preview
 * (?weather=light|medium|heavy, also drizzle / rain / storm).
 */
export function rainLevel(weather, preview) {
    if (preview) return PREVIEW_LEVELS[preview] || "none"; // clear, cloudy, ...: dry
    if (!weather || !["drizzle", "rain", "showers", "thunderstorm"].includes(weather.kind)) return "none";
    let level = CODE_LEVELS[weather.weatherCode] || (weather.kind === "thunderstorm" ? "medium" : "light");
    if (/^heavy/i.test(weather.condition || "") && weather.kind !== "drizzle") level = "heavy";
    // Measured rate (mm in the last 15 min -> mm/h), meteorological classes: light < 2.5 mm/h,
    // moderate < 7.6 mm/h, heavy above. The higher of the code and the rate wins.
    if (Number.isFinite(weather.precipitation)) {
        const rate = weather.precipitation * 4;
        const byRate = rate >= 7.6 ? "heavy" : rate >= 2.5 ? "medium" : "light";
        if (LEVEL_ORDER.indexOf(byRate) > LEVEL_ORDER.indexOf(level)) level = byRate;
    }
    return level;
}

/** 0 (dry) .. 1 (downpour): the rain level as a number (light 0.15, medium 0.5, heavy 1). */
export function rainIntensity(weather, preview) {
    return RAIN_LEVELS[rainLevel(weather, preview)];
}

// Sun / moon for the open map (set by CelestialSky every few seconds): scene-frame unit directions
// (x east, y up, z south), altitudes in radians, moon phase 0..1, and `daylight` 0 (night) .. 1 (day)
// with twilight in between. `timePreview` (?time=HH:MM, site local time) fixes the clock for testing.
// `windPreview` (?wind=km/h) overrides the wind speed for testing.
const urlParam = (name) => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get(name));

export const useSkyStore = create((set) => ({
    ready: false, // false until a real position was computed (maps without terrain keep their own light)
    sun: { direction: [0.3, 0.9, 0.3], altitude: 1.2 },
    moon: { direction: [-0.3, -0.5, 0.3], altitude: -0.5, fraction: 0.5 },
    daylight: 1,
    timePreview: urlParam("time"),
    windPreview: urlParam("wind") !== null && Number.isFinite(Number(urlParam("wind"))) ? Number(urlParam("wind")) : null,
    setSky: (sky) => set(sky),
}));

/**
 * Outdoor light level at the site, 0 (dark) .. 1 (bright day), as a light sensor would see it: the
 * time of day (daylight), the sun's height (a low sun gives much less light) and the weather
 * (clouds and rain block it). Street lights switch on from it.
 */
export function ambientLightLevel(sky, weather, preview) {
    if (!sky?.ready) return 1;
    const t = Math.min(1, Math.max(0, (sky.sun.altitude + 0.02) / 0.62)); // horizon .. ~35 degrees
    const sunHigh = t * t * (3 - 2 * t);
    const clouds = overcastLevel(weather, preview);
    const rain = rainIntensity(weather, preview);
    return sky.daylight * (0.35 + 0.65 * sunHigh) * (1 - 0.5 * clouds) * (1 - 0.3 * rain);
}

/** 0 (night, sun 6° or more below the horizon) .. 1 (day, sun 10° or more up). */
export function daylightFromAltitude(altitude) {
    const t = Math.min(1, Math.max(0, (altitude + 0.105) / (0.175 + 0.105)));
    return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------------------------
// The weather the scene SHOWS, eased towards the latest reading: a live update (every 5 minutes)
// that changes the condition blends in over ~a minute (rain thickening or thinning, the sky greying
// or clearing, the wind picking up) instead of switching at once. The first reading after loading
// is applied at once (the scene opens with the right weather); ?weather= / ?wind= previews ease
// quickly. Shared by RainEffect, the sky / clouds, wind sway, lightning and the weather sound.
// updateWeatherBlend() may be called from several places per frame: it advances by real time.

const LIVE_BLEND_SECONDS = 25; // time constant: ~63% after 25 s, ~95% after 75 s
const PREVIEW_BLEND_SECONDS = 1.5;

export const weatherBlend = { rain: 0, overcast: 0, wind: 0, gusts: 0, ready: false, at: 0 };

export function updateWeatherBlend() {
    const b = weatherBlend;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const dt = b.at ? Math.min((now - b.at) / 1000, 1) : 0;
    b.at = now;
    const { weather, preview } = useWeatherStore.getState();
    const windPreview = useSkyStore.getState().windPreview;
    const wind = windPreview ?? (Number.isFinite(weather?.windSpeed) ? weather.windSpeed : 0);
    const target = {
        rain: rainIntensity(weather, preview),
        overcast: overcastLevel(weather, preview),
        wind,
        gusts: windPreview !== null ? windPreview * 1.5 : (Number.isFinite(weather?.windGusts) ? weather.windGusts : wind),
    };
    if (!b.ready) {
        if (weather || preview || windPreview !== null) {
            Object.assign(b, target);
            b.ready = true;
        }
        return b;
    }
    if (dt <= 0) return b;
    const k = 1 - Math.exp(-dt / (preview || windPreview !== null ? PREVIEW_BLEND_SECONDS : LIVE_BLEND_SECONDS));
    for (const key of ["rain", "overcast", "wind", "gusts"]) b[key] += (target[key] - b[key]) * k;
    return b;
}
