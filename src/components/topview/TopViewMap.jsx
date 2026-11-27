import { useCallback, useEffect, useRef } from "react";
import { FaMap } from "react-icons/fa";
import useTopView from "./topViewStore";
import "./TopViewMap.css";

// The top view map panel: a header (title, zoom, size, close) and the map area. The map itself is
// drawn by TopViewRenderer into the WebGL canvas right under the (transparent) map area; the blue
// dot (the avatar, or the point the free camera looks at) with its view cone is positioned by it too.

export default function TopViewMap() {
    const open = useTopView((s) => s.open);
    const zoom = useTopView((s) => s.zoom);
    const large = useTopView((s) => s.large);
    const setOpen = useTopView((s) => s.setOpen);
    const zoomBy = useTopView((s) => s.zoomBy);
    const toggleLarge = useTopView((s) => s.toggleLarge);
    const setElements = useTopView((s) => s.setElements);
    const bodyRef = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        setElements(bodyRef.current, markerRef.current);
        return () => setElements(null, null);
    }, [open, setElements]);

    // Mouse wheel over the map zooms it (and does not reach the 3D view under it).
    useEffect(() => {
        const body = bodyRef.current;
        if (!open || !body) return undefined;
        const onWheel = (event) => {
            event.preventDefault();
            event.stopPropagation();
            zoomBy(Math.exp(event.deltaY * 0.0015));
        };
        body.addEventListener("wheel", onWheel, { passive: false });
        return () => body.removeEventListener("wheel", onWheel);
    }, [open, zoomBy]);

    // Above the walk tracker when it is shown (both use the bottom-left corner; desktop only, phones
    // have the map at the top).
    const panelRef = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const place = () => {
            const panel = panelRef.current;
            if (!panel) return;
            const tracker = document.querySelector(".camera-realtime-walk-tracker");
            const rect = tracker?.getBoundingClientRect();
            const shown = rect && rect.width > 0 && rect.left < window.innerWidth / 2 && window.innerWidth > 760;
            panel.style.bottom = shown ? `${Math.round(window.innerHeight - rect.top + 8)}px` : "";
        };
        place();
        const timer = setInterval(place, 500);
        return () => clearInterval(timer);
    }, [open]);

    const stop = useCallback((event) => event.stopPropagation(), []);

    // Closed: a round button to bring it back (shown on phones while walking, where the toolbar
    // has no map button; TopViewMap.css).
    if (!open) {
        return (
            <button type="button" className="top-view-map__reopen" aria-label="Show map" title="Show map" onClick={() => setOpen(true)}>
                <FaMap aria-hidden="true" />
            </button>
        );
    }
    // Scale bar: a round length about a quarter of the map width.
    const scale = niceLength(zoom / 2);
    return (
        <div ref={panelRef} className={`top-view-map${large ? " is-large" : ""}`} role="region" aria-label="Top view map" onPointerDown={stop}>
            <div className="top-view-map__head">
                <span>Map</span>
                <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1 / 1.5)}>+</button>
                <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1.5)}>−</button>
                <button type="button" aria-label={large ? "Smaller map" : "Larger map"} title={large ? "Smaller map" : "Larger map"} onClick={toggleLarge}>
                    {large ? "⤡" : "⤢"}
                </button>
                <button type="button" aria-label="Close map" title="Close map" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="top-view-map__body" ref={bodyRef}>
                <div className="top-view-map__north" aria-hidden="true">N</div>
                <div className="top-view-map__marker" ref={markerRef} aria-hidden="true">
                    <div className="top-view-map__cone" />
                    <div className="top-view-map__dot" />
                </div>
                <div className="top-view-map__scale" aria-hidden="true">
                    <div style={{ width: `${(scale / (zoom * 2)) * 100}%` }} />
                    <span>{scale >= 1000 ? `${scale / 1000} km` : `${scale} m`}</span>
                </div>
            </div>
        </div>
    );
}

function niceLength(metres) {
    const power = 10 ** Math.floor(Math.log10(metres));
    for (const step of [5, 2, 1]) if (step * power <= metres) return step * power;
    return power;
}
