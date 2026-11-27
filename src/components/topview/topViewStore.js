import { create } from "zustand";

// Top view map (a small north-up map from straight above, like the map next to Google Street View):
// whether it is open, its zoom (half the shown width, metres) and size, and the DOM elements the
// renderer draws into (threejs/topview/TopViewRenderer.jsx) and moves the blue dot in.

export const TOP_VIEW_MIN_ZOOM = 15;
export const TOP_VIEW_MAX_ZOOM = 900;
const STORAGE_KEY = "topViewMap";

const saved = (() => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
        return {};
    }
})();

const remember = (state) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ open: state.open, zoom: state.zoom, large: state.large }));
    } catch {
        // private window / blocked storage: the map just does not remember its settings
    }
};

const clampZoom = (zoom) => Math.min(TOP_VIEW_MAX_ZOOM, Math.max(TOP_VIEW_MIN_ZOOM, zoom));

const useTopView = create((set, get) => ({
    open: Boolean(saved.open),
    zoom: clampZoom(Number(saved.zoom) || 70),
    large: Boolean(saved.large),
    bodyEl: null, // the map area (transparent: the canvas draws the map under it)
    markerEl: null, // the blue dot with its view cone
    setOpen: (open) => {
        set({ open });
        remember(get());
    },
    toggle: () => get().setOpen(!get().open),
    setZoom: (zoom) => {
        set({ zoom: clampZoom(zoom) });
        remember(get());
    },
    zoomBy: (factor) => get().setZoom(get().zoom * factor),
    toggleLarge: () => {
        set({ large: !get().large });
        remember(get());
    },
    setElements: (bodyEl, markerEl) => set({ bodyEl, markerEl }),
}));

export default useTopView;
