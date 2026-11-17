import { IMAGERY_PROVIDERS } from "../terrainImagery";
import { GOOGLE_MAPS_API_KEY } from "../../../components/project-map/ProjectGoogleWebGLMap";

// Satellite imagery providers for the world terrain: { url (with {z}/{x}/{y}), maxZoom, attribution }.
//  - "esri": Esri World Imagery (no key).
//  - "google": Google Map Tiles API 2D satellite tiles. Needs the Map Tiles API enabled (with billing)
//    on the key's Google Cloud project; tiles are loaded live (Google's terms do not allow storing
//    them) and the Google attribution must stay visible. Falls back to Esri when no session can be
//    created.

const esriProvider = (config = {}) => ({
    name: "esri",
    url: IMAGERY_PROVIDERS.esri.url,
    maxZoom: config.maxZoom ?? IMAGERY_PROVIDERS.esri.maxZoom,
    attribution: IMAGERY_PROVIDERS.esri.attribution,
});

async function googleProvider(config, signal) {
    const key = config.key || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY;
    const response = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapType: "satellite", language: config.language || "en-US", region: config.region || "MY" }),
        signal,
    });
    if (!response.ok) throw new Error(`Google Map Tiles createSession: HTTP ${response.status}`);
    const { session } = await response.json();
    return {
        name: "google",
        url: `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}`,
        maxZoom: config.maxZoom ?? 20,
        attribution: "Imagery © Google",
    };
}

/** Resolves a scene's `terrain.imagery` config to a provider; null when imagery is off. */
export async function resolveImageryProvider(config, { signal } = {}) {
    if (!config) return null;
    if (config.provider === "google") {
        try {
            return await googleProvider(config, signal);
        } catch (error) {
            if (error.name === "AbortError") throw error;
            console.warn("[terrain] Google satellite tiles unavailable (enable the Map Tiles API for the key); using Esri imagery", error);
        }
    }
    return esriProvider(config);
}
