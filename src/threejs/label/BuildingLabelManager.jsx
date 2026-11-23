import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

// Desktop building labels (BuildingLabelSprite.js): keeps them readable and the scene fast.
//  - Size: each label scales with its distance so it stays about the same size on screen (within
//    limits), instead of shrinking to an unreadable chip far away or covering the view up close.
//  - Range: labels further than MAX_DISTANCE are hidden (not rendered at all).
//  - Declutter: nearest labels first; a label whose screen box would overlap one already shown is hidden.
// Runs every UPDATE_EVERY frames over a cached label list; in XR the XR optimizer takes over.

const UPDATE_EVERY = 6;
const CACHE_EVERY = 120; // frames between label list refreshes (labels are added as assets load)
const MAX_DISTANCE = 700;
const REFERENCE_DISTANCE = 70; // at this distance a label is drawn at its built-in size (scale 1)
const MIN_SCALE = 0.45;
const MAX_SCALE = 4.5;
const MAX_VISIBLE = 60;
const SCREEN_GAP = 4; // px between label boxes

const cameraPosition = new THREE.Vector3();
const labelPosition = new THREE.Vector3();
const projected = new THREE.Vector3();

export default function BuildingLabelManager() {
    const { scene, camera, gl, size } = useThree();
    const frameRef = useRef(0);
    const cacheRef = useRef({ frame: -1, labels: [] });

    useFrame(() => {
        if (gl.xr?.isPresenting) {
            return;
        }
        frameRef.current += 1;
        if (frameRef.current % UPDATE_EVERY !== 0) {
            return;
        }

        const cache = cacheRef.current;
        if (cache.frame < 0 || frameRef.current - cache.frame >= CACHE_EVERY) {
            const labels = [];
            scene.traverse((object) => {
                if (object.userData?.isBuildingLabel) {
                    labels.push(object);
                }
            });
            cache.labels = labels;
            cache.frame = frameRef.current;
        }
        if (!cache.labels.length) {
            return;
        }

        camera.getWorldPosition(cameraPosition);
        const candidates = [];
        for (const label of cache.labels) {
            labelPosition.copy(label.userData.anchorPosition || label.position);
            const distance = cameraPosition.distanceTo(labelPosition);
            if (distance > MAX_DISTANCE) {
                label.visible = false;
                continue;
            }
            projected.copy(labelPosition).project(camera);
            if (projected.z > 1 || projected.z < -1 || Math.abs(projected.x) > 1.2 || Math.abs(projected.y) > 1.2) {
                label.visible = false; // behind the camera or off screen
                continue;
            }
            candidates.push({ label, distance, sx: (projected.x + 1) * size.width / 2, sy: (1 - projected.y) * size.height / 2 });
        }

        // Screen size of a label at scale 1 at REFERENCE_DISTANCE, from its plane size and the camera fov.
        const fov = THREE.MathUtils.degToRad(camera.fov || 50);
        const pixelsPerMeterAtRef = size.height / (2 * Math.tan(fov / 2) * REFERENCE_DISTANCE);

        candidates.sort((a, b) => a.distance - b.distance);
        const shown = [];
        for (const candidate of candidates) {
            const { label, distance } = candidate;
            const scale = THREE.MathUtils.clamp(distance / REFERENCE_DISTANCE, MIN_SCALE, MAX_SCALE);
            label.scale.setScalar(scale);
            const params = label.geometry?.parameters || { width: 19.5, height: 4.8 };
            // On-screen box: world size x scale, projected at the label's distance.
            const pixelsPerMeter = pixelsPerMeterAtRef * REFERENCE_DISTANCE / Math.max(distance, 1);
            const w = params.width * scale * pixelsPerMeter, h = params.height * scale * pixelsPerMeter;
            // The label stands on its anchor (the pin), so its box is mostly above the anchor point.
            const box = { x0: candidate.sx - w / 2, x1: candidate.sx + w / 2, y0: candidate.sy - h * 0.86, y1: candidate.sy + h * 0.14 };
            const overlaps = shown.length >= MAX_VISIBLE || shown.some((other) =>
                box.x0 < other.x1 + SCREEN_GAP && box.x1 > other.x0 - SCREEN_GAP && box.y0 < other.y1 + SCREEN_GAP && box.y1 > other.y0 - SCREEN_GAP);
            label.visible = !overlaps;
            if (!overlaps) {
                shown.push(box);
            }
        }
    });

    return null;
}
