import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";

// Frames per second as a plain number (replaces drei's <Stats> graph, which redraws a canvas every
// frame). A DOM element outside React is updated twice a second, so it costs nothing per frame
// beyond a counter. Keeps the r3f-stats class, so existing placement rules still apply.
const UPDATE_MS = 500;

export default function FpsCounter({ className = "r3f-stats" }) {
    const state = useRef({ el: null, frames: 0, since: 0 });

    useEffect(() => {
        const el = document.createElement("div");
        el.className = `${className} fps-counter`;
        el.setAttribute("aria-label", "Frames per second");
        el.textContent = "-- FPS";
        document.body.appendChild(el);
        state.current.el = el;
        state.current.since = performance.now();
        return () => el.remove();
    }, [className]);

    useFrame(() => {
        const s = state.current;
        s.frames += 1;
        const now = performance.now();
        if (now - s.since < UPDATE_MS || !s.el) return;
        const fps = Math.round((s.frames * 1000) / (now - s.since));
        s.el.textContent = `${fps} FPS`;
        s.el.dataset.level = fps >= 50 ? "good" : fps >= 30 ? "ok" : "low";
        s.frames = 0;
        s.since = now;
    });

    return null;
}
