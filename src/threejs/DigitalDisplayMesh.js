import * as THREE from "three";

const DOT_FONT = {
    " ": [0, 0, 0, 0, 0, 0, 0],
    "A": [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    "B": [0b11110, 0b10001, 0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
    "C": [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
    "D": [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100],
    "E": [0b11111, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000, 0b11111],
    "F": [0b11111, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000, 0b10000],
    "G": [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
    "H": [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    "I": [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
    "J": [0b00111, 0b00010, 0b00010, 0b00010, 0b10010, 0b10010, 0b01100],
    "K": [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
    "L": [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
    "M": [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
    "N": [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
    "O": [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    "P": [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
    "Q": [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10010, 0b01101],
    "R": [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
    "S": [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
    "T": [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
    "U": [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    "V": [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
    "W": [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
    "X": [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
    "Y": [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
    "Z": [0b11111, 0b00010, 0b00100, 0b01000, 0b10000, 0b10000, 0b11111],
    "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
    "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
    "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
    "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
    "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
    "5": [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110],
    "6": [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
    "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
    "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
    "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b11100],
};

const GLYPH_DATA = {};
for (const ch in DOT_FONT) {
    const rows = DOT_FONT[ch];
    const pixels = [];
    for (let r = 0; r < 7; r++) {
        const row = rows[r];
        for (let c = 0; c < 5; c++) {
            if (row & (1 << (4 - c))) {
                pixels.push((c << 8) | r);
            }
        }
    }
    GLYPH_DATA[ch] = pixels;
}

const GLYPH_CANVAS_CACHE = new Map();
const DISPLAY_CANVAS_CACHE = new Map();
const DISPLAY_UPDATE_FPS = 24;
const DISPLAY_UPDATE_INTERVAL = 1000 / DISPLAY_UPDATE_FPS;
const DISPLAY_VISIBILITY_GRACE_MS = 250;

const DisplayDriver = (() => {
    const displays = new Set();
    let rafId = 0;
    let running = false;
    let lastUpdateAt = 0;

    function tick(now) {
        rafId = requestAnimationFrame(tick);

        if (document.hidden || now - lastUpdateAt < DISPLAY_UPDATE_INTERVAL) {
            return;
        }

        const dt = lastUpdateAt > 0 ? Math.min((now - lastUpdateAt) / 1000, 0.1) : 0;
        lastUpdateAt = now;

        for (const display of displays) {
            if (now - display.lastRenderedAt > DISPLAY_VISIBILITY_GRACE_MS) {
                continue;
            }

            display.scroll += display.speed * dt;
            if (display.scroll >= display.scrollRange) {
                display.scroll %= display.scrollRange;
            }

            display.texture.offset.x = display.scroll / display.stripWidth;
        }
    }

    function add(display) {
        displays.add(display);
        if (running) return;
        running = true;
        lastUpdateAt = performance.now();
        rafId = requestAnimationFrame(tick);
    }

    function remove(display) {
        displays.delete(display);
        if (displays.size > 0) return;
        if (running) cancelAnimationFrame(rafId);
        running = false;
        lastUpdateAt = 0;
    }

    return { add, remove };
})();

function getGlyphCanvases(dotSize, spacing, step, color) {
    const cacheKey = `${dotSize}_${spacing}_${color}`;
    if (GLYPH_CANVAS_CACHE.has(cacheKey)) {
        return GLYPH_CANVAS_CACHE.get(cacheKey);
    }

    const map = {};
    for (const ch in GLYPH_DATA) {
        const pixels = GLYPH_DATA[ch];
        const canvas = document.createElement("canvas");
        canvas.width = 5 * step;
        canvas.height = 7 * step;

        const ctx = canvas.getContext("2d");
        ctx.fillStyle = color;
        for (let i = 0; i < pixels.length; i++) {
            const p = pixels[i];
            ctx.fillRect(((p >> 8) & 31) * step, (p & 7) * step, dotSize, dotSize);
        }
        map[ch] = canvas;
    }

    GLYPH_CANVAS_CACHE.set(cacheKey, map);
    return map;
}

function getDisplayCanvas({ text, width, height, dotSize, fontScale, color }) {
    const normalizedText = String(text || " ").toUpperCase();
    const cacheKey = `${normalizedText}_${width}_${height}_${dotSize}_${fontScale}_${color}`;
    if (DISPLAY_CANVAS_CACHE.has(cacheKey)) {
        return DISPLAY_CANVAS_CACHE.get(cacheKey);
    }

    const spacing = dotSize * fontScale;
    const step = dotSize + spacing;
    const charW = 5 * step;
    const totalW = Math.max(1, normalizedText.length * charW);
    const stripWidth = Math.max(1, Math.ceil(totalW));
    const canvas = document.createElement("canvas");
    canvas.width = stripWidth;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: true });
    const glyphCanvases = getGlyphCanvases(dotSize, spacing, step, color);

    let x = 0;
    for (let i = 0; i < normalizedText.length; i++) {
        ctx.drawImage(glyphCanvases[normalizedText[i]] || glyphCanvases[" "], x, 0);
        x += charW;
    }

    const displayCanvas = {
        canvas,
        totalW,
        stripWidth,
        repeatX: width / stripWidth,
    };
    DISPLAY_CANVAS_CACHE.set(cacheKey, displayCanvas);
    return displayCanvas;
}

export default function DigitalDisplayMesh({
    text = "PUZZLE GAME 2 ",
    width = 512,
    height = 128,
    dotSize = 4.68,
    fontScale = 0.2,
    color = "#fc941d",
    scrollSpeed = 3,
    meshWidth = 40,
    meshHeight = 10,
    meshDepth = 10,
    position = new THREE.Vector3(0, 1.48, 0),
} = {}) {
    const displayCanvas = getDisplayCanvas({ text, width, height, dotSize, fontScale, color });
    const texture = new THREE.CanvasTexture(displayCanvas.canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(displayCanvas.repeatX, 1);

    const geometry = new THREE.PlaneGeometry(meshWidth, meshHeight);
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        emissive: new THREE.Color(color),
        emissiveIntensity: 3,
        depthWrite: false,
        toneMapped: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.y += meshHeight / 2 + 0.55;
    mesh.position.z += meshDepth / 2;

    const driverState = {
        texture,
        scroll: 0,
        speed: scrollSpeed * 20,
        scrollRange: displayCanvas.totalW,
        stripWidth: displayCanvas.stripWidth,
        lastRenderedAt: performance.now(),
    };

    mesh.onBeforeRender = () => {
        driverState.lastRenderedAt = performance.now();
    };

    if (driverState.speed > 0 && driverState.scrollRange > 0) {
        DisplayDriver.add(driverState);
    }

    mesh.disposeDisplay = () => {
        DisplayDriver.remove(driverState);
        texture.dispose();
        geometry.dispose();
        material.dispose();
    };

    return mesh;
}
