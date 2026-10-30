import { SRGBColorSpace, WebGLRenderer } from 'three';
import { WebGPURenderer } from 'three/webgpu';

// Projects whose scenes only use node-compatible materials and can run on WebGPU.
// GLSL ShaderMaterial / drei shaderMaterial / onBeforeCompile do not render on WebGPURenderer.
export const WEBGPU_PROJECTS = new Set([]);

const RENDERER_OVERRIDE_KEY = 'renderer';
const RENDERER_KINDS = ['webgpu', 'webgl'];

// ?renderer=webgpu|webgl wins, then localStorage 'renderer', then the project allowlist.
export function getRequestedRenderer(projectBaseId) {
    try {
        const fromUrl = new URLSearchParams(window.location.search).get(RENDERER_OVERRIDE_KEY);
        if (RENDERER_KINDS.includes(fromUrl)) return fromUrl;
    } catch { /* ignore */ }

    try {
        const fromStorage = localStorage.getItem(RENDERER_OVERRIDE_KEY);
        if (RENDERER_KINDS.includes(fromStorage)) return fromStorage;
    } catch { /* ignore */ }

    return WEBGPU_PROJECTS.has(String(projectBaseId)) ? 'webgpu' : 'webgl';
}

let adapterPromise = null;
let webgpuFailed = false;

// Called when WebGPURenderer.init() fails so later project loads go straight to WebGL.
export function disableWebGPU() {
    webgpuFailed = true;
}

// Resolves to a GPUAdapter, or null when WebGPU is unavailable. Cached for the session.
export function getWebGPUAdapter() {
    if (!adapterPromise) {
        adapterPromise = (async () => {
            if (typeof navigator === 'undefined' || !navigator.gpu) return null;
            try {
                return await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
            } catch {
                return null;
            }
        })();
    }
    return adapterPromise;
}

// Resolves the renderer to actually use: WebGPU only when requested and an adapter exists.
export async function resolveRendererKind(projectBaseId) {
    if (webgpuFailed || getRequestedRenderer(projectBaseId) !== 'webgpu') return 'webgl';
    return (await getWebGPUAdapter()) ? 'webgpu' : 'webgl';
}

export function createRenderer(kind, canvas, { antialias, powerPreference, logarithmicDepthBuffer }) {
    // alpha matches R3F's default renderer: the canvas stays transparent so the CSS background
    // (white in the editor) shows through instead of an opaque black clear.
    const options = { canvas, alpha: true, antialias, powerPreference, logarithmicDepthBuffer };
    const renderer = kind === 'webgpu' ? new WebGPURenderer(options) : new WebGLRenderer(options);
    renderer.outputColorSpace = SRGBColorSpace;
    return renderer;
}

export async function getWebGPUAdapterDescription() {
    const info = (await getWebGPUAdapter())?.info;
    if (!info) return null;
    return [info.vendor, info.architecture, info.description].filter(Boolean).join(' ') || null;
}
