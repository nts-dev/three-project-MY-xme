import React, { useEffect, useRef, useState } from "react";
import "./ProjectGoogleWebGLMap.css";

const GOOGLE_MAPS_SCRIPT_ID = "nts3d-google-maps";
export const GOOGLE_MAPS_API_KEY = "AIzaSyCk524s6rBpXRbSfNxnEAO5O3QwbrzQe-E";
export const GOOGLE_MAP_ID = "eede854a1831373a49d48d2d";

export const PROJECT_153_L0_MODEL_ORIGIN = {
    address: "No.99 Jalan Platinum 5/5, Pusat Perdagangan Nilai Impian, 71800 Nilai, Negeri Sembilan, Malaysia",
    center: { lat: 2.8308620259663924, lng: 101.79590237387696},
    fallbackCenter: { lat: 2.8308620259663924, lng: 101.79590237387696 },
    modelYawDegrees: 16+180,
    modelOffsetMeters: { x: 0, y: 0, z: 10 },
    camera: {
        zoom: 22.5,
        heading: 35,
        tilt: 67,
    },
};

export function getProject153L0ResolvedOrigin() {
    return window.__NTS_PROJECT_153_L0_MODEL_ORIGIN || {
        ...PROJECT_153_L0_MODEL_ORIGIN,
        center: PROJECT_153_L0_MODEL_ORIGIN.fallbackCenter,
        geocodeStatus: "FALLBACK",
    };
}

let googleMapsLoaderPromise = null;

export function loadGoogleMaps() {
    if (!GOOGLE_MAPS_API_KEY) {
        return Promise.reject(new Error("Missing Google Maps API key"));
    }

    if (window.google?.maps?.WebGLOverlayView) {
        return Promise.resolve(window.google.maps);
    }

    if (googleMapsLoaderPromise) {
        return googleMapsLoaderPromise;
    }

    googleMapsLoaderPromise = new Promise((resolve, reject) => {
        window.__ntsProjectGoogleMapsLoaded = () => {
            if (window.google?.maps?.WebGLOverlayView) {
                resolve(window.google.maps);
            } else {
                reject(new Error("Google Maps WebGLOverlayView is unavailable"));
            }
        };

        const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(window.google.maps), { once: true });
            existingScript.addEventListener("error", reject, { once: true });
            return;
        }

        const params = new URLSearchParams({
            key: GOOGLE_MAPS_API_KEY,
            v: "beta",
            libraries: "",
            callback: "__ntsProjectGoogleMapsLoaded",
        });

        const script = document.createElement("script");
        script.id = GOOGLE_MAPS_SCRIPT_ID;
        script.async = true;
        script.defer = true;
        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        script.onerror = () => reject(new Error("Failed to load Google Maps"));
        document.head.appendChild(script);
    });

    return googleMapsLoaderPromise;
}

function publishResolvedOrigin(origin) {
    window.__NTS_PROJECT_153_L0_MODEL_ORIGIN = origin;
    window.dispatchEvent(new CustomEvent("project-153-l0-model-origin", { detail: origin }));
}

export default function ProjectGoogleWebGLMap() {
    const hostRef = useRef(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!hostRef.current) return;

        let map = null;
        let cancelled = false;

        const cleanup = () => {
            cancelled = true;
        };

        loadGoogleMaps()
            .then((maps) => {
                if (cancelled || !hostRef.current) return;

                map = new maps.Map(hostRef.current, {
                    center: PROJECT_153_L0_MODEL_ORIGIN.fallbackCenter,
                    zoom: PROJECT_153_L0_MODEL_ORIGIN.camera.zoom,
                    heading: PROJECT_153_L0_MODEL_ORIGIN.camera.heading,
                    tilt: PROJECT_153_L0_MODEL_ORIGIN.camera.tilt,
                    mapId: GOOGLE_MAP_ID,
                    renderingType: maps.RenderingType?.VECTOR,
                    isFractionalZoomEnabled: true,
                    disableDefaultUI: false,
                    fullscreenControl: true,
                    gestureHandling: "greedy",
                    keyboardShortcuts: true,
                });

                const geocoder = new maps.Geocoder();
                geocoder.geocode({ address: PROJECT_153_L0_MODEL_ORIGIN.address }, (results, status) => {
                    if (cancelled) return;

                    const location = status === "OK" && results?.[0]?.geometry?.location;
                    const anchor = location
                        ? { lat: location.lat(), lng: location.lng() }
                        : PROJECT_153_L0_MODEL_ORIGIN.fallbackCenter;

                    map.moveCamera({
                        center: anchor,
                        zoom: PROJECT_153_L0_MODEL_ORIGIN.camera.zoom,
                        heading: PROJECT_153_L0_MODEL_ORIGIN.camera.heading,
                        tilt: PROJECT_153_L0_MODEL_ORIGIN.camera.tilt,
                    });
                    publishResolvedOrigin({
                        ...PROJECT_153_L0_MODEL_ORIGIN,
                        center: anchor,
                        geocodeStatus: status,
                    });
                    setError("");
                });
            })
            .catch((loadError) => {
                console.error("Failed to initialize Google Maps WebGL scene:", loadError);
                setError(loadError.message || "Failed to initialize Google Maps WebGL scene");
            });

        return cleanup;
    }, []);

    return (
        <div className="project-google-webgl-map">
            <div className="project-google-webgl-map__stage" ref={hostRef} />
            {error && (
                <div className="project-google-webgl-map__error">
                    <strong>Google Maps WebGL unavailable</strong>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
