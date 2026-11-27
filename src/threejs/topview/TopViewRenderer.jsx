import { useEffect } from "react";
import * as THREE from "three";
import { addAfterEffect, useThree } from "@react-three/fiber";
import useGame from "../../hooks/useGame";
import useTopView from "../../components/topview/topViewStore";

// Top view map (components/topview/TopViewMap.jsx): the scene from straight above, north up,
// centred on the avatar (character mode) or on the point the free camera orbits. The scene is
// rendered into a texture a few times a second (MAP_INTERVAL_MS, or when the centre or zoom moves
// on), and that texture is drawn into the canvas under the panel's map area after every frame (a
// cheap quad); the blue dot and view cone are moved every frame, so they glide between refreshes.

const MAP_INTERVAL_MS = 220;
const MAX_TEXTURE = 1024;
const HEIGHT_ABOVE = 180; // metres above the centre for the map camera: under the sky clouds (260 m and up)
const LABEL_REFRESH_MS = 3000;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// The map with rounded corners (the panel's bottom corners), so it sits inside the panel's border.
const fragmentShader = /* glsl */ `
uniform sampler2D map;
uniform vec2 sizePx;
uniform float radiusPx;
varying vec2 vUv;
void main() {
    vec2 p = vUv * sizePx;
    vec2 q = vec2(min(p.x, sizePx.x - p.x), p.y); // bottom corners only (the header is above)
    float alpha = 1.0;
    if (q.x < radiusPx && q.y < radiusPx) alpha = clamp(radiusPx - length(vec2(radiusPx) - q) + 0.5, 0.0, 1.0);
    gl_FragColor = vec4(texture2D(map, vUv).rgb, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

export default function TopViewRenderer() {
    const gl = useThree((s) => s.gl);
    const scene = useThree((s) => s.scene);
    const camera = useThree((s) => s.camera);
    const controls = useThree((s) => s.controls);

    useEffect(() => {
        const mapCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, HEIGHT_ABOVE + 400);
        mapCamera.up.set(0, 0, -1); // north (-z) up
        const target = new THREE.WebGLRenderTarget(2, 2, { samples: 4, depthBuffer: true });
        const blitScene = new THREE.Scene();
        const blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const material = new THREE.ShaderMaterial({
            uniforms: { map: { value: target.texture }, sizePx: { value: new THREE.Vector2(1, 1) }, radiusPx: { value: 12 } },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        quad.frustumCulled = false;
        blitScene.add(quad);

        const centre = new THREE.Vector3();
        const direction = new THREE.Vector3();
        const viewport = new THREE.Vector4();
        const scissor = new THREE.Vector4();
        let rendered = null; // { x, z, zoom, at }
        let labels = [];
        let labelsAt = -Infinity;

        const findCentre = () => {
            const { character, firstPerson, characterRef } = useGame.getState();
            if ((character || firstPerson) && characterRef) {
                try {
                    const p = characterRef.translation();
                    return centre.set(p.x, p.y, p.z);
                } catch {
                    // body removed this frame
                }
            }
            const orbit = controls || window.__editorThree?.controls;
            if (orbit?.target) return centre.copy(orbit.target);
            return centre.copy(camera.position);
        };

        const renderMap = (zoom, width, height, now) => {
            const w = Math.min(MAX_TEXTURE, Math.max(2, Math.round(width * gl.getPixelRatio())));
            const h = Math.min(MAX_TEXTURE, Math.max(2, Math.round(height * gl.getPixelRatio())));
            if (target.width !== w || target.height !== h) target.setSize(w, h);
            const aspect = width / height;
            mapCamera.left = -zoom * aspect;
            mapCamera.right = zoom * aspect;
            mapCamera.top = zoom;
            mapCamera.bottom = -zoom;
            mapCamera.position.set(centre.x, centre.y + HEIGHT_ABOVE, centre.z);
            mapCamera.lookAt(centre.x, centre.y, centre.z);
            mapCamera.updateProjectionMatrix();
            mapCamera.updateMatrixWorld();

            // Without the floating building labels and the haze (a map, not a view through air).
            if (now - labelsAt > LABEL_REFRESH_MS) {
                labels = [];
                scene.traverse((object) => {
                    if (object.userData?.isBuildingLabel) labels.push(object);
                });
                labelsAt = now;
            }
            const hidden = labels.filter((object) => object.visible);
            hidden.forEach((object) => { object.visible = false; });
            const fog = scene.fog;
            scene.fog = null;
            const previousTarget = gl.getRenderTarget();
            const autoClear = gl.autoClear;
            gl.autoClear = true;
            gl.setRenderTarget(target);
            gl.clear();
            gl.render(scene, mapCamera);
            gl.setRenderTarget(previousTarget);
            gl.autoClear = autoClear;
            scene.fog = fog;
            hidden.forEach((object) => { object.visible = true; });
            rendered = { x: centre.x, z: centre.z, zoom, at: now };
        };

        const unsubscribe = addAfterEffect(() => {
            const { open, bodyEl, markerEl, zoom } = useTopView.getState();
            if (!open || !bodyEl || gl.xr?.isPresenting) return;
            const canvasRect = gl.domElement.getBoundingClientRect();
            const rect = bodyEl.getBoundingClientRect();
            if (rect.width < 4 || rect.height < 4) return;
            const now = performance.now();
            findCentre();
            const moved = rendered ? Math.hypot(centre.x - rendered.x, centre.z - rendered.z) : Infinity;
            if (!rendered || rendered.zoom !== zoom || now - rendered.at > MAP_INTERVAL_MS || moved > zoom * 0.15) {
                renderMap(zoom, rect.width, rect.height, now);
            }

            // The map into the canvas under the panel's map area.
            const x = rect.left - canvasRect.left;
            const y = canvasRect.bottom - rect.bottom; // WebGL: from the bottom
            gl.getViewport(viewport);
            gl.getScissor(scissor);
            const scissorTest = gl.getScissorTest();
            const autoClear = gl.autoClear;
            gl.autoClear = false;
            gl.setViewport(x, y, rect.width, rect.height);
            gl.setScissor(x, y, rect.width, rect.height);
            gl.setScissorTest(true);
            material.uniforms.sizePx.value.set(rect.width, rect.height);
            gl.render(blitScene, blitCamera);
            gl.setScissorTest(scissorTest);
            gl.setScissor(scissor);
            gl.setViewport(viewport);
            gl.autoClear = autoClear;

            // Blue dot (where the avatar / view centre is now) and view cone (where the camera looks).
            if (markerEl && rendered) {
                const aspect = rect.width / rect.height;
                const px = ((centre.x - rendered.x) / (rendered.zoom * aspect)) * (rect.width / 2);
                const py = ((centre.z - rendered.z) / rendered.zoom) * (rect.height / 2);
                camera.getWorldDirection(direction);
                const heading = (Math.atan2(direction.x, -direction.z) * 180) / Math.PI;
                markerEl.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
                markerEl.style.setProperty("--top-view-heading", `${heading.toFixed(1)}deg`);
            }
        });

        return () => {
            unsubscribe();
            target.dispose();
            material.dispose();
            quad.geometry.dispose();
        };
    }, [gl, scene, camera, controls]);

    return null;
}
