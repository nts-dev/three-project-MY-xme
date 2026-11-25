import { create } from "zustand";

// Sound on/off for the map (weather ambience and footsteps), remembered per browser.
const KEY = "map-sound-on";
const initial = (() => {
    try {
        return localStorage.getItem(KEY) !== "0";
    } catch {
        return true;
    }
})();

// Footstep events from the avatar's animation (CharacterModel: a foot touching down), played by
// WeatherSound. { running: boolean }
const footstepListeners = new Set();
export const onFootstep = (fn) => {
    footstepListeners.add(fn);
    return () => footstepListeners.delete(fn);
};
export const emitFootstep = (step) => footstepListeners.forEach((fn) => fn(step));

export const useSoundStore = create((set) => ({
    on: initial,
    toggle: () => set((state) => {
        const on = !state.on;
        try {
            localStorage.setItem(KEY, on ? "1" : "0");
        } catch {
            // private window: not remembered
        }
        return { on };
    }),
}));
