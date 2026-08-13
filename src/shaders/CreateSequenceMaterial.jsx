import * as THREE from 'three';
import vertexShader from './sequence.vert';
import fragmentShader from './sequence.frag';

/* -------------------- Global singleton driver -------------------- */
const SequenceDriver = (() => {
    const list = new Set();
    let rafId = 0;
    let running = false;
    let lastTickAt = 0;

    function tick() {
        const now = performance.now();
        const dt = lastTickAt > 0 ? Math.min((now - lastTickAt) / 1000, 0.1) : 0;
        lastTickAt = now;
        // If page hidden, don't advance animations
        if (document.hidden) {
            rafId = requestAnimationFrame(tick);
            return;
        }
        for (const m of list) {
            // step at material's logical speed
            m.uniforms.uTime.value += dt * m.userData._speedMul;
        }
        rafId = requestAnimationFrame(tick);
    }

    function start() {
        if (!running) {
            running = true;
            lastTickAt = performance.now();
            rafId = requestAnimationFrame(tick);
        }
    }

    function stop() {
        if (running) cancelAnimationFrame(rafId);
        running = false;
        lastTickAt = 0;
    }

    function add(mat) {
        list.add(mat);
        if (list.size === 1) start();
    }

    function remove(mat) {
        list.delete(mat);
        if (list.size === 0) stop();
    }

    return { add, remove };
})();

const PLACEHOLDER_TEXTURE = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
PLACEHOLDER_TEXTURE.needsUpdate = true;
PLACEHOLDER_TEXTURE.colorSpace = THREE.SRGBColorSpace;
PLACEHOLDER_TEXTURE.wrapS = PLACEHOLDER_TEXTURE.wrapT = THREE.RepeatWrapping;

const imagePromiseCache = new Map();
const atlasPromiseCache = new Map();
const atlasRefCounts = new Map();

/* -------------------- Helper loaders -------------------- */
async function loadImage(url) {
    if (imagePromiseCache.has(url)) {
        return imagePromiseCache.get(url);
    }

    // Prefer ImageBitmap for faster upload when available
    let promise;
    if ('createImageBitmap' in window) {
        promise = fetch(url, { mode: 'cors' })
            .then((res) => res.blob())
            .then((blob) => createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'default' }));
    } else {
        // Fallback to HTMLImageElement
        promise = new Promise((res, rej) => {
            const el = new Image();
            el.crossOrigin = 'anonymous';
            el.decoding = 'async';
            el.onload = () => res(el);
            el.onerror = rej;
            el.src = url;
        });
    }

    imagePromiseCache.set(url, promise);
    promise.catch(() => {
        imagePromiseCache.delete(url);
    });
    return promise;
}

function nextPOT(v) {
    return Math.pow(2, Math.ceil(Math.log2(Math.max(1, v))));
}

function getAtlasCacheKey(imageUrls, maxAtlasSize) {
    return JSON.stringify({ imageUrls, maxAtlasSize });
}

async function buildAtlas(imageUrls, maxAtlasSize) {
    const frames = await Promise.all(imageUrls.map(loadImage));
    const w0 = frames[0].width, h0 = frames[0].height;

    let tileW = nextPOT(w0);
    let tileH = nextPOT(h0);

    let cols = Math.min(frames.length, Math.max(1, Math.floor(maxAtlasSize / tileW)));
    let rows = Math.ceil(frames.length / cols);
    while (cols * tileW > maxAtlasSize || rows * tileH > maxAtlasSize) {
        tileW = Math.max(32, tileW >> 1);
        tileH = Math.max(32, tileH >> 1);
        cols = Math.min(frames.length, Math.max(1, Math.floor(maxAtlasSize / tileW)));
        rows = Math.ceil(frames.length / cols);
        if (tileW === 32 && tileH === 32) break;
    }

    const atlasW = cols * tileW;
    const atlasH = rows * tileH;

    const cv = document.createElement('canvas');
    cv.width = atlasW;
    cv.height = atlasH;
    const ctx = cv.getContext('2d', { willReadFrequently: false });

    // Draw frames into grid (cover fit)
    for (let i = 0; i < frames.length; i++) {
        const bmp = frames[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const dx = col * tileW;
        const dy = row * tileH;

        const s = Math.max(tileW / bmp.width, tileH / bmp.height);
        const dw = Math.round(bmp.width * s);
        const dh = Math.round(bmp.height * s);
        const ox = dx + Math.floor((tileW - dw) / 2);
        const oy = dy + Math.floor((tileH - dh) / 2);

        ctx.drawImage(bmp, ox, oy, dw, dh);
    }

    const atlasTex = new THREE.CanvasTexture(cv);
    atlasTex.colorSpace = THREE.SRGBColorSpace;
    atlasTex.wrapS = atlasTex.wrapT = THREE.RepeatWrapping;
    // Disable mipmaps to avoid seams and reduce GPU work
    atlasTex.generateMipmaps = false;
    atlasTex.minFilter = THREE.LinearFilter;
    atlasTex.magFilter = THREE.LinearFilter;

    return {
        texture: atlasTex,
        cols,
        rows,
        frameCount: frames.length,
    };
}

function getAtlas(imageUrls, maxAtlasSize) {
    const key = getAtlasCacheKey(imageUrls, maxAtlasSize);
    if (!atlasPromiseCache.has(key)) {
        const promise = buildAtlas(imageUrls, maxAtlasSize);
        atlasPromiseCache.set(key, promise);
        atlasRefCounts.set(key, 0);
        promise.catch(() => {
            atlasPromiseCache.delete(key);
            atlasRefCounts.delete(key);
        });
    }
    return { key, promise: atlasPromiseCache.get(key) };
}

/* -------------------- Factory -------------------- */
export default function CreateSequenceMaterial(
    imageUrls = [],
    {
        // playback
        fps = 6,           // logical FPS of the sequence
        speedScale = 0.025, // multiplier applied to time (keeps your default)
        // UV controls
        repeat = [2, 2],
        offset = [0.5, 0.25],
        scaleY = 1,
        // atlas constraints
        maxAtlasSize = 4096,
        toneMapped = true,
    } = {}
) {
    if (!imageUrls?.length) {
        console.warn('CreateSequenceMaterial: no image URLs provided.');
        return new THREE.MeshBasicMaterial({ color: 0x000000 });
    }

    const uniforms = {
        uAtlas:       { value: PLACEHOLDER_TEXTURE },
        uGrid:        { value: new THREE.Vector2(1, 1) }, // cols, rows
        uFrameCount:  { value: 1 },
        uTime:        { value: 0 },
        uFps:         { value: fps },
        uSpeed:       { value: speedScale },
        uRepeat:      { value: new THREE.Vector2(repeat[0], repeat[1]) },
        uOffset:      { value: new THREE.Vector2(offset[0], offset[1]) },
        uScaleY:      { value: scaleY },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        toneMapped,
    });

    // Playback speed multiplier used by the global driver
    material.userData._speedMul = 1.0;
    material.userData._sequenceDisposed = false;
    material.userData._sequenceAtlasKey = null;

    // Allow external control from your game loop if desired:
    // material.userData.advance = (dt) => { uniforms.uTime.value += dt * material.userData._speedMul; };

    // Build atlas once (async)
    (async () => {
        try {
            const { key, promise } = getAtlas(imageUrls, maxAtlasSize);
            material.userData._sequenceAtlasKey = key;
            atlasRefCounts.set(key, (atlasRefCounts.get(key) || 0) + 1);

            const atlas = await promise;
            if (material.userData._sequenceDisposed) return;

            uniforms.uAtlas.value = atlas.texture;
            uniforms.uGrid.value.set(atlas.cols, atlas.rows);
            uniforms.uFrameCount.value = atlas.frameCount;

            // register this material with global driver
            SequenceDriver.add(material);
        } catch (e) {
            console.error('CreateSequenceMaterial atlas build failed:', e);
        }
    })();

    // Public API
    material.userData.disposeSequence = () => {
        if (material.userData._sequenceDisposed) return;
        material.userData._sequenceDisposed = true;
        SequenceDriver.remove(material);
        const atlasKey = material.userData._sequenceAtlasKey;
        if (atlasKey) {
            const nextCount = Math.max(0, (atlasRefCounts.get(atlasKey) || 0) - 1);
            atlasRefCounts.set(atlasKey, nextCount);
            if (nextCount === 0) {
                atlasPromiseCache.get(atlasKey)?.then((atlas) => atlas.texture?.dispose?.());
                atlasPromiseCache.delete(atlasKey);
                atlasRefCounts.delete(atlasKey);
            }
        }
        material.dispose();
    };

    // Optional: change speed at runtime
    material.userData.setPlaybackSpeed = (mul /* e.g., 0.5, 1, 2 */) => {
        material.userData._speedMul = Math.max(0, mul || 1);
    };

    return material;
}
