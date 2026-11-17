import * as React from 'react';
import { useEffect, useRef } from 'react';
import * as THREE from "three";
import { createPortal } from "react-dom";

// "Back to start" button for large map scenes (153_L2 XME map): after flying around it is hard to find
// the starting view again.
//  - With a `startView` ({ position: [x, y, z], target: [x, y, z] }, scene metres) the camera is put
//    there when the project opens and the button returns to it.
//  - Without one, the start view is the camera pose just before the user first moves the camera.

type Pose = { position: THREE.Vector3; target: THREE.Vector3 };

const RETURN_DURATION_MS = 700;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export default function HomeViewButton({ camera, orbitControls, projectId, startView }: any) {
    const homeRef = useRef<Pose | null>(null);
    const animationRef = useRef(0);

    useEffect(() => {
        homeRef.current = startView
            ? { position: new THREE.Vector3(...startView.position), target: new THREE.Vector3(...startView.target) }
            : null;
        let controls: any = null;
        let userMoved = false;
        const timers: number[] = [];

        const applyStartView = () => {
            const cam = camera.current;
            const home = homeRef.current;
            if (!startView || userMoved || !cam || !controls || !home) return;
            cam.position.copy(home.position);
            controls.target.copy(home.target);
            cam.lookAt(home.target);
            controls.update();
        };
        const onUserMove = () => {
            userMoved = true;
            if (!homeRef.current && camera.current && controls) {
                homeRef.current = { position: camera.current.position.clone(), target: controls.target.clone() };
            }
        };

        // The controls may mount after this HUD: wait for them.
        const attach = window.setInterval(() => {
            controls = orbitControls.current;
            if (!controls?.addEventListener || !camera.current) return;
            window.clearInterval(attach);
            controls.addEventListener("start", onUserMove);
            applyStartView();
            // Scene loading can still move the camera right after mount: re-apply until the user moves it.
            timers.push(window.setTimeout(applyStartView, 500), window.setTimeout(applyStartView, 1500));
        }, 100);
        // Wheel zoom bypasses the controls' "start" event (CameraController handles it).
        window.addEventListener("wheel", onUserMove, { capture: true, passive: true });
        return () => {
            window.clearInterval(attach);
            timers.forEach((timer) => window.clearTimeout(timer));
            controls?.removeEventListener?.("start", onUserMove);
            window.removeEventListener("wheel", onUserMove, { capture: true } as any);
            cancelAnimationFrame(animationRef.current);
        };
    }, [camera, orbitControls, projectId, startView]);

    const goHome = () => {
        const cam = camera.current;
        const controls = orbitControls.current;
        const home = homeRef.current;
        if (!cam || !controls || !home) return;
        cancelAnimationFrame(animationRef.current);
        const fromPosition = cam.position.clone();
        const fromTarget = controls.target.clone();
        const started = performance.now();
        const step = (now: number) => {
            const t = easeInOut(Math.min(1, (now - started) / RETURN_DURATION_MS));
            cam.position.lerpVectors(fromPosition, home.position, t);
            controls.target.lerpVectors(fromTarget, home.target, t);
            controls.update();
            if (t < 1) animationRef.current = requestAnimationFrame(step);
        };
        animationRef.current = requestAnimationFrame(step);
    };

    // Rendered on the body: fixed in the top-right view-controls row, whatever the editor layout.
    return createPortal(
        <button
            type="button"
            className="webglstudio-home-view-button"
            title="Back to start view"
            aria-label="Back to start view"
            onClick={goHome}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <i className="pi pi-home" aria-hidden="true"></i>
        </button>
    , document.body);
}
