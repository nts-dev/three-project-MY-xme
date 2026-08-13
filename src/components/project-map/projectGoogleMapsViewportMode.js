export const GOOGLE_MAPS_WEBGL_PROJECT_IDS = new Set(["153_L0", "153_L1"]);

const STORAGE_KEY_PREFIX = "nts-google-maps-webgl-viewport-mode:";
const CHANGE_EVENT = "nts-google-maps-webgl-viewport-mode-change";

function normalizeProjectId(projectId) {
    return String(projectId || "");
}

function storageKey(projectId) {
    return `${STORAGE_KEY_PREFIX}${normalizeProjectId(projectId)}`;
}

export function isGoogleMapsWebGLProject(projectId) {
    return GOOGLE_MAPS_WEBGL_PROJECT_IDS.has(normalizeProjectId(projectId));
}

export function getGoogleMapsViewportMode(projectId) {
    if (!isGoogleMapsWebGLProject(projectId)) {
        return "three";
    }

    try {
        return window.localStorage?.getItem(storageKey(projectId)) === "google"
            ? "google"
            : "three";
    } catch {
        return "three";
    }
}

export function setGoogleMapsViewportMode(projectId, mode) {
    if (!isGoogleMapsWebGLProject(projectId)) return;

    const nextMode = mode === "three" ? "three" : "google";

    try {
        window.localStorage?.setItem(storageKey(projectId), nextMode);
    } catch {
        // Ignore storage failures; the event still updates the current tab.
    }

    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
        detail: {
            projectId: normalizeProjectId(projectId),
            mode: nextMode,
        },
    }));
}

export function toggleGoogleMapsViewportMode(projectId) {
    const currentMode = getGoogleMapsViewportMode(projectId);
    const nextMode = currentMode === "google" ? "three" : "google";
    setGoogleMapsViewportMode(projectId, nextMode);
    return nextMode;
}

export function subscribeGoogleMapsViewportMode(projectId, callback) {
    const normalizedProjectId = normalizeProjectId(projectId);
    const handler = (event) => {
        if (!event.detail || event.detail.projectId === normalizedProjectId) {
            callback();
        }
    };

    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);

    return () => {
        window.removeEventListener(CHANGE_EVENT, handler);
        window.removeEventListener("storage", handler);
    };
}
