import * as THREE from 'three';

const DOT_ANIMATION_FPS = 24;
const textureCache = new Map();

function createCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function makeCacheKey({
                          width,
                          height,
                          dotRadius,
                          dotCount,
                          wobbleAmount,
                          repeatX,
                          repeatY,
                      }) {
    return `${width}:${height}:${dotRadius}:${dotCount}:${wobbleAmount}:${repeatX}:${repeatY}`;
}

function createGlowTexture({
                               width,
                               height,
                               dotRadius,
                               dotCount,
                               wobbleAmount,
                               repeatX,
                               repeatY,
                           }) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d', { alpha: true });

    const spriteSize = Math.max(1, Math.ceil(dotRadius * 6));
    const halfSprite = spriteSize * 0.5;
    const sprite = createCanvas(spriteSize, spriteSize);
    const sctx = sprite.getContext('2d', { alpha: true });
    const center = halfSprite;

    const gradient = sctx.createRadialGradient(
        center, center, 0,
        center, center, dotRadius * 3
    );
    gradient.addColorStop(0.0, 'white');
    gradient.addColorStop(0.4, 'white');
    gradient.addColorStop(1.0, 'rgba(0,0,0,0)');

    sctx.fillStyle = gradient;
    sctx.beginPath();
    sctx.arc(center, center, dotRadius * 3, 0, Math.PI * 2);
    sctx.fill();

    const dots = new Array(dotCount);
    for (let i = 0; i < dotCount; i++) {
        dots[i] = {
            x: Math.random() * width,
            y: Math.random() * height,
            phaseX: Math.random() * Math.PI * 2,
            phaseY: Math.random() * Math.PI * 2,
            speedX: 0.45 + Math.random() * 0.75,
            speedY: 0.35 + Math.random() * 0.65,
        };
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 1;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.needsUpdate = true;

    let frameId = 0;
    let lastFrameAt = 0;
    const frameInterval = 1000 / DOT_ANIMATION_FPS;

    const drawFrame = (time = 0) => {
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'lighter';

        const seconds = time * 0.001;
        const wobble = Number(wobbleAmount) || 0;

        for (let i = 0; i < dotCount; i++) {
            const dot = dots[i];
            const offsetX = wobble ? Math.sin(seconds * dot.speedX + dot.phaseX) * wobble : 0;
            const offsetY = wobble ? Math.cos(seconds * dot.speedY + dot.phaseY) * wobble : 0;

            ctx.drawImage(
                sprite,
                dot.x + offsetX - halfSprite,
                dot.y + offsetY - halfSprite
            );
        }

        texture.needsUpdate = true;
    };

    const tick = (time) => {
        if (time - lastFrameAt >= frameInterval) {
            lastFrameAt = time;
            drawFrame(time);
        }
        frameId = requestAnimationFrame(tick);
    };

    drawFrame(0);
    if ((Number(wobbleAmount) || 0) > 0) {
        frameId = requestAnimationFrame(tick);
    }

    return {
        texture,
        dispose() {
            if (frameId) cancelAnimationFrame(frameId);
            texture.dispose();
        },
    };
}

function acquireGlowTexture(params) {
    const key = makeCacheKey(params);
    const cached = textureCache.get(key);
    if (cached) {
        cached.refs += 1;
        return { key, texture: cached.texture };
    }

    const entry = createGlowTexture(params);
    textureCache.set(key, { ...entry, refs: 1 });
    return { key, texture: entry.texture };
}

function releaseGlowTexture(key) {
    const cached = textureCache.get(key);
    if (!cached) return;

    cached.refs -= 1;
    if (cached.refs > 0) return;

    cached.dispose();
    textureCache.delete(key);
}

export default function CreateGlowDotMaterial({
                                                  width = 1024,
                                                  height = 1024,
                                                  dotRadius = 10,
                                                  dotCount = 30,
                                                  wobbleAmount = 100,   // kept but unused (static)
                                                  repeatX = 4,
                                                  repeatY = 1,
                                              } = {}) {

    const textureParams = {
        width,
        height,
        dotRadius,
        dotCount,
        wobbleAmount,
        repeatX,
        repeatY,
    };
    const { key: textureKey, texture } = acquireGlowTexture(textureParams);

    // ------------------------------------------
    // MATERIAL
    // ------------------------------------------
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
    });

    let disposed = false;
    const baseDispose = material.dispose.bind(material);
    material.dispose = () => {
        if (disposed) return;
        disposed = true;
        releaseGlowTexture(textureKey);
        baseDispose();
    };
    material.disposeGlow = material.dispose;
    material.userData.disposeGlow = material.dispose;

    return material;
}
