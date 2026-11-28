import { paintRoadSurfaces } from "./roadSurfaces";

const CURVE_EASE = 24; // px: the road direction is eased this far around each centreline vertex
const MAX_LINE_STEPS = 320; // px: furthest a line is followed under a bridge deck (photo fill)
// Under bridge decks, with the ground roads known (OSM centrelines are often a metre or two off
// the photo): within ROAD_ON_MARGIN m of a road's edge a hidden pixel takes road texture; real
// pixels within ROAD_NEAR_MARGIN m of one are not used for the ground; the ground fill looks up to
// ROAD_SKIP_METRES past a road beside the deck.
const ROAD_ON_MARGIN = 3;
const ROAD_NEAR_MARGIN = 4.5;
const ROAD_SKIP_METRES = 25;
const GROUND_MIRROR_SLACK = 1.5; // metres a ground reflection may slide past a road edge
const ROAD_MIN_CROSSING = 0.3; // |sin| of the angle a road must cross a deck at to be filled under it

export function composeTileImagery({ tile, size, apron, images, imageryMasks, roadSurfaces, metersPerUnit }, createCanvas) {
    const padPx = 256 * apron;
    const full = size + 2 * padPx;
    let canvas;
    let context;
    try {
        canvas = createCanvas(full, full);
        context = canvas.getContext("2d", { willReadFrequently: apron > 0 });
        if (images.some((image) => !image?.bitmap)) {
            // Background where a photo is missing.
            context.fillStyle = "#6b7b52";
            context.fillRect(0, 0, full, full);
        }
        for (const image of images) {
            if (image?.bitmap) context.drawImage(image.bitmap, padPx + image.i * 256, padPx + image.j * 256);
        }
    } finally {
        images.forEach((image) => image?.bitmap?.close());
    }
    eraseMaskedImagery(context, tile, size, padPx, imageryMasks, metersPerUnit);
    if (padPx) {
        // Back to the tile itself.
        const tileCanvas = createCanvas(size, size);
        const tileContext = tileCanvas.getContext("2d");
        tileContext.drawImage(canvas, padPx, padPx, size, size, 0, 0, size, size);
        canvas.width = canvas.height = 0;
        canvas = tileCanvas;
        context = tileContext;
    }
    paintRoadSurfaces(context, tile, size, roadSurfaces, metersPerUnit);
    return canvas;
}

/**
 * Fills the masked areas (raised bridge decks) of a tile's photo, so a bridge is not also
 * painted on the ground below it. Each hidden pixel takes the real ground beside the deck,
 * mirrored across the deck's edges (the two sides blended across the width): grass and road
 * texture stay sharp and markings crossing under the deck carry on. Where no mirrored pixel
 * exists (tile edge, another deck) the smooth push-pull average fills in.
 */
function eraseMaskedImagery(context, tile, tileSize, padPx, imageryMasks, metersPerUnit) {
    if (!imageryMasks.length) return;
    // The canvas holds the tile plus padPx of the neighbouring photo on each side (lines are
    // followed across the tile's edge); `full` is its width.
    const full = tileSize + 2 * padPx;
    const n = 2 ** tile.z;
    const pad = padPx / (tileSize * n);
    const u0 = tile.x / n - pad;
    const v0 = tile.y / n - pad;
    const u1 = (tile.x + 1) / n + pad;
    const v1 = (tile.y + 1) / n + pad;
    const masks = imageryMasks.filter((m) => m.maxU >= u0 && m.minU <= u1 && m.maxV >= v0 && m.minV <= v1);
    if (!masks.length) return;

    const pixelsPerUnit = tileSize * n;
    const masked = new Uint8Array(full * full);
    // Per hidden pixel: nearest deck centre-line point (footX/Y), unit normal across the deck
    // (normX/Y), signed distance along it (side) and the deck half width there (halfPx).
    const best = new Float32Array(full * full).fill(Infinity);
    const footX = new Float32Array(full * full);
    const footY = new Float32Array(full * full);
    const normX = new Float32Array(full * full);
    const normY = new Float32Array(full * full);
    const side = new Float32Array(full * full);
    const halfPx = new Float32Array(full * full);
    let maxHalf = 0;
    let minX = full;
    let minY = full;
    let maxX = -1;
    let maxY = -1;
    for (const mask of masks) {
        const half = mask.halfWidth * pixelsPerUnit;
        if (half < 0.5) continue; // narrower than a pixel at this zoom: nothing to erase
        maxHalf = Math.max(maxHalf, half);
        for (let i = 0; i < mask.points.length - 1; i++) {
            const ax = (mask.points[i].u - u0) * pixelsPerUnit;
            const ay = (mask.points[i].v - v0) * pixelsPerUnit;
            const bx = (mask.points[i + 1].u - u0) * pixelsPerUnit;
            const by = (mask.points[i + 1].v - v0) * pixelsPerUnit;
            const dx = bx - ax;
            const dy = by - ay;
            const lengthSq = dx * dx + dy * dy || 1;
            const xs = Math.max(0, Math.floor(Math.min(ax, bx) - half));
            const xe = Math.min(full - 1, Math.ceil(Math.max(ax, bx) + half));
            const ys = Math.max(0, Math.floor(Math.min(ay, by) - half));
            const ye = Math.min(full - 1, Math.ceil(Math.max(ay, by) + half));
            const first = i === 0;
            const last = i === mask.points.length - 2;
            for (let y = ys; y <= ye; y++) {
                for (let x = xs; x <= xe; x++) {
                    const along = ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / lengthSq;
                    // Square ends (the deck stops there): a round cap beyond the end only made
                    // streaky fill past the deck.
                    if ((first && along < 0) || (last && along > 1)) continue;
                    const t = Math.max(0, Math.min(1, along));
                    const distance = Math.hypot(x + 0.5 - (ax + t * dx), y + 0.5 - (ay + t * dy));
                    if (distance > half) continue;
                    const q = y * full + x;
                    masked[q] = 1;
                    if (distance < best[q]) {
                        const length = Math.sqrt(lengthSq);
                        best[q] = distance;
                        footX[q] = ax + t * dx;
                        footY[q] = ay + t * dy;
                        normX[q] = -dy / length;
                        normY[q] = dx / length;
                        side[q] = ((x + 0.5 - footX[q]) * normX[q] + (y + 0.5 - footY[q]) * normY[q]);
                        halfPx[q] = half;
                    }
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
    }
    if (maxX < 0) return;

    // Room around the decks for the mirrored pixels (up to two deck widths out).
    // With known roads, more: the ground fill may have to reach past a road beside the deck.
    const margin = Math.ceil(2 * maxHalf + (masks.some((m) => m.roads) ? (ROAD_SKIP_METRES * pixelsPerUnit) / metersPerUnit : 0)) + 3;
    const x0 = Math.max(0, minX - margin);
    const y0 = Math.max(0, minY - margin);
    const w = Math.min(full, maxX + margin + 1) - x0;
    const h = Math.min(full, maxY + margin + 1) - y0;
    const image = context.getImageData(x0, y0, w, h);
    const data = image.data;

    // Ground roads near the decks (when the bridges list them): per pixel, the distance (px)
    // beyond the nearest road's edge. Under a deck, road texture belongs only on these; elsewhere
    // (a deck beside a road, or the photo's own deck) the fill uses the ground, not the road.
    const pxPerMetre = pixelsPerUnit / metersPerUnit;
    const roadLists = [...new Set(masks.map((m) => m.roads).filter(Boolean))];
    const knowRoads = roadLists.length > 0;
    const roadDist = knowRoads ? new Float32Array(w * h).fill(Infinity) : null;
    // Nearest road per pixel: its index (roadRuns) and the unit direction of its centreline there.
    const roadId = knowRoads ? new Int32Array(w * h).fill(-1) : null;
    const roadTx = knowRoads ? new Float32Array(w * h) : null;
    const roadTy = knowRoads ? new Float32Array(w * h) : null;
    // Along the road: arc length of the nearest centreline point (roadS) and the signed offset from
    // the centreline (roadOff, + to the left of travel), for filling along curved roads.
    const roadS = knowRoads ? new Float32Array(w * h) : null;
    const roadOff = knowRoads ? new Float32Array(w * h) : null;
    const roadGeom = []; // per road: { xs, ys, cum } centreline in pixels (this canvas region)
    let roadRuns = 0;
    const roadSkew = [];
    const ON_ROAD = ROAD_ON_MARGIN * pxPerMetre; // a hidden pixel this close takes road texture
    const NEAR_ROAD = ROAD_NEAR_MARGIN * pxPerMetre; // a real pixel this close is not used as ground
    if (knowRoads) {
        for (const roads of roadLists) {
            for (const road of roads) {
                const id = roadRuns++;
                roadSkew.push(road.skew ?? 0);
                const half = road.half * pixelsPerUnit;
                const reach = half + NEAR_ROAD + 1;
                const gx = road.points.map((pt) => (pt.u - u0) * pixelsPerUnit - x0);
                const gy = road.points.map((pt) => (pt.v - v0) * pixelsPerUnit - y0);
                const cum = [0];
                for (let i = 1; i < gx.length; i++) cum.push(cum[i - 1] + Math.hypot(gx[i] - gx[i - 1], gy[i] - gy[i - 1]));
                roadGeom.push({ xs: gx, ys: gy, cum });
                for (let i = 0; i < road.points.length - 1; i++) {
                    const ax = (road.points[i].u - u0) * pixelsPerUnit - x0;
                    const ay = (road.points[i].v - v0) * pixelsPerUnit - y0;
                    const bx = (road.points[i + 1].u - u0) * pixelsPerUnit - x0;
                    const by = (road.points[i + 1].v - v0) * pixelsPerUnit - y0;
                    const dx = bx - ax;
                    const dy = by - ay;
                    const lengthSq = dx * dx + dy * dy || 1;
                    const length = Math.sqrt(lengthSq);
                    const xs = Math.max(0, Math.floor(Math.min(ax, bx) - reach));
                    const xe = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + reach));
                    const ys = Math.max(0, Math.floor(Math.min(ay, by) - reach));
                    const ye = Math.min(h - 1, Math.ceil(Math.max(ay, by) + reach));
                    for (let y = ys; y <= ye; y++) {
                        for (let x = xs; x <= xe; x++) {
                            const t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / lengthSq));
                            const d = Math.hypot(x + 0.5 - (ax + t * dx), y + 0.5 - (ay + t * dy)) - half;
                            const p = y * w + x;
                            // Under a deck only roads crossing it count: one running along it (an
                            // approach or a road beside / beneath the deck's line) would be followed
                            // along the deck and drag texture across the roads it does cross.
                            const q = (y + y0) * full + (x + x0);
                            if (masked[q] && Math.abs((dx * normX[q] + dy * normY[q]) / length) < ROAD_MIN_CROSSING) continue;
                            if (d < roadDist[p]) {
                                roadDist[p] = d;
                                roadId[p] = id;
                                roadTx[p] = dx / length;
                                roadTy[p] = dy / length;
                                roadS[p] = cum[i] + t * length;
                                roadOff[p] = ((x + 0.5 - (ax + t * dx)) * -dy + (y + 0.5 - (ay + t * dy)) * dx) / length;
                            }
                        }
                    }
                }
            }
        }
    }

    // Push-pull fill: average the known pixels into ever coarser levels, then fill the hole
    // from those smooth averages (no streaks, unlike copying neighbours inwards).
    const pushPull = (takesPixel) => {
    const levels = [];
    let lw = w;
    let lh = h;
    let colour = new Float32Array(w * h * 3);
    let weight = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = y * w + x;
            if (masked[(y + y0) * full + (x + x0)] || !takesPixel(p)) continue;
            colour[p * 3] = data[p * 4];
            colour[p * 3 + 1] = data[p * 4 + 1];
            colour[p * 3 + 2] = data[p * 4 + 2];
            weight[p] = 1;
        }
    }
    levels.push({ w: lw, h: lh, colour, weight });
    while (lw > 1 || lh > 1) {
        const nw = Math.max(1, Math.ceil(lw / 2));
        const nh = Math.max(1, Math.ceil(lh / 2));
        const nextColour = new Float32Array(nw * nh * 3);
        const nextWeight = new Float32Array(nw * nh);
        for (let y = 0; y < lh; y++) {
            for (let x = 0; x < lw; x++) {
                const p = y * lw + x;
                const q = (y >> 1) * nw + (x >> 1);
                const k = weight[p];
                nextColour[q * 3] += colour[p * 3] * k;
                nextColour[q * 3 + 1] += colour[p * 3 + 1] * k;
                nextColour[q * 3 + 2] += colour[p * 3 + 2] * k;
                nextWeight[q] += k;
            }
        }
        for (let q = 0; q < nw * nh; q++) {
            if (nextWeight[q] > 0) {
                nextColour[q * 3] /= nextWeight[q];
                nextColour[q * 3 + 1] /= nextWeight[q];
                nextColour[q * 3 + 2] /= nextWeight[q];
                nextWeight[q] = Math.min(1, nextWeight[q]);
            }
        }
        lw = nw;
        lh = nh;
        colour = nextColour;
        weight = nextWeight;
        levels.push({ w: lw, h: lh, colour, weight });
    }
    for (let l = levels.length - 2; l >= 0; l--) {
        const fine = levels[l];
        const coarse = levels[l + 1];
        for (let y = 0; y < fine.h; y++) {
            for (let x = 0; x < fine.w; x++) {
                const p = y * fine.w + x;
                const k = fine.weight[p];
                if (k >= 1) continue;
                // Bilinear sample of the coarser level at this pixel centre.
                const cx = Math.min(coarse.w - 1, Math.max(0, (x + 0.5) / 2 - 0.5));
                const cy = Math.min(coarse.h - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
                const ax = Math.floor(cx);
                const ay = Math.floor(cy);
                const bx = Math.min(coarse.w - 1, ax + 1);
                const by = Math.min(coarse.h - 1, ay + 1);
                const tx = cx - ax;
                const ty = cy - ay;
                for (let c = 0; c < 3; c++) {
                    const v = (coarse.colour[(ay * coarse.w + ax) * 3 + c] * (1 - tx) + coarse.colour[(ay * coarse.w + bx) * 3 + c] * tx) * (1 - ty)
                        + (coarse.colour[(by * coarse.w + ax) * 3 + c] * (1 - tx) + coarse.colour[(by * coarse.w + bx) * 3 + c] * tx) * ty;
                    fine.colour[p * 3 + c] = fine.colour[p * 3 + c] * k + v * (1 - k);
                }
                fine.weight[p] = 1;
            }
        }
    }
    return levels[0].colour;
    };
    const result = pushPull(() => true);
    const isGround = (p) => roadDist[p] > NEAR_ROAD;
    const groundResult = knowRoads ? pushPull(isGround) : result;
    // Mirror fill, from the untouched photo (copied: the loop writes into `data`).
    const source = new Uint8ClampedArray(data);
    const sample = (sx, sy, out) => {
        const ix = Math.floor(sx);
        const iy = Math.floor(sy);
        if (ix < x0 || iy < y0 || ix >= x0 + w || iy >= y0 + h || masked[iy * full + ix]) return false;
        const p = (iy - y0) * w + (ix - x0);
        out[0] = source[p * 4];
        out[1] = source[p * 4 + 1];
        out[2] = source[p * 4 + 2];
        return true;
    };
    // Ground beside the deck for a hidden pixel off the roads: the mirrored pixel at offset
    // `o` along the normal, or (when that is a road or hidden) further out, past the road.
    const groundSample = (fx, fy, nx, ny, o, dir, maxExtra, out) => {
        for (let extra = 0; extra <= maxExtra; extra += 1) {
            const ix = Math.floor(fx + nx * (o + dir * extra));
            const iy = Math.floor(fy + ny * (o + dir * extra));
            if (ix < x0 || iy < y0 || ix >= x0 + w || iy >= y0 + h) return false;
            if (masked[iy * full + ix]) continue;
            const p = (iy - y0) * w + (ix - x0);
            if (!isGround(p)) continue;
            out[0] = source[p * 4];
            out[1] = source[p * 4 + 1];
            out[2] = source[p * 4 + 2];
            return true;
        }
        return false;
    };
    const colourA = [0, 0, 0];
    const colourB = [0, 0, 0];

    // Direction of the lines in the photo around each hidden pixel (structure tensor of the real
    // pixels, averaged over a window about 1.5 deck widths across): lane markings crossing under
    // the deck continue along it. Integral images keep the averaging cheap.
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) lum[i] = 0.299 * source[i * 4] + 0.587 * source[i * 4 + 1] + 0.114 * source[i * 4 + 2];
    const W1 = w + 1;
    const sxx = new Float64Array(W1 * (h + 1));
    const sxy = new Float64Array(W1 * (h + 1));
    const syy = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) {
        let rxx = 0;
        let rxy = 0;
        let ryy = 0;
        for (let x = 0; x < w; x++) {
            if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
                const q = (y + y0) * full + (x + x0);
                if (!masked[q] && !masked[q - 1] && !masked[q + 1] && !masked[q - full] && !masked[q + full]) {
                    const gx = lum[y * w + x + 1] - lum[y * w + x - 1];
                    const gy = lum[(y + 1) * w + x] - lum[(y - 1) * w + x];
                    rxx += gx * gx;
                    rxy += gx * gy;
                    ryy += gy * gy;
                }
            }
            const o = (y + 1) * W1 + (x + 1);
            sxx[o] = sxx[o - W1] + rxx;
            sxy[o] = sxy[o - W1] + rxy;
            syy[o] = syy[o - W1] + ryy;
        }
    }
    // Lane lines run along their road: under a deck they are continued along the road's own
    // direction (the map centreline) turned by the road's `skew` (bridges.json, measured once from
    // the full-resolution photo). Fixed per road: estimated per tile, the angle differed between
    // tiles and zoom levels, and the lanes under the deck turned while zooming.
    const roadCos = new Float32Array(roadRuns).fill(1);
    const roadSin = new Float32Array(roadRuns);
    for (let id = 0; id < roadRuns; id++) {
        roadCos[id] = Math.cos(roadSkew[id]);
        roadSin[id] = Math.sin(roadSkew[id]);
    }
    const boxSum = (arr, xa, ya, xb, yb) => arr[yb * W1 + xb] - arr[ya * W1 + xb] - arr[yb * W1 + xa] + arr[ya * W1 + xa];
    const radius = Math.ceil(maxHalf * 3) + 8; // wide: a steady direction (a jittering one makes lines wobble)
    // Along a line from (sx, sy) in direction (dx, dy): k = steps to the first real pixel, and
    // the colour reflected along the line itself (the pixel 2k away, just as far beyond the
    // hole's edge): lines stay straight and dashes / texture are copied, not smeared into
    // streaks. The edge pixel itself when the reflected one is not available.
    const pixelAt = (fx, fy, out) => {
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        if (ix < x0 || iy < y0 || ix >= x0 + w || iy >= y0 + h || masked[iy * full + ix]) return false;
        const p = ((iy - y0) * w + (ix - x0)) * 4;
        out[0] = source[p];
        out[1] = source[p + 1];
        out[2] = source[p + 2];
        return true;
    };
    const march = (sx, sy, dx, dy, maxSteps, out) => {
        for (let k = 1; k <= maxSteps; k++) {
            const ix = Math.floor(sx + dx * k);
            const iy = Math.floor(sy + dy * k);
            if (ix < x0 || iy < y0 || ix >= x0 + w || iy >= y0 + h) return -1;
            if (masked[iy * full + ix]) continue;
            if (!pixelAt(sx + dx * 2 * k, sy + dy * 2 * k, out)) pixelAt(sx + dx * k, sy + dy * k, out);
            return k;
        }
        return -1;
    };
    const lineA = [0, 0, 0];
    const lineB = [0, 0, 0];

    // A point at arc length s along road id's centreline, `off` pixels to its left (straight on
    // beyond the ends). The tangent is eased over CURVE_EASE px around each vertex, so the offset
    // path has no kinks at the polyline's corners.
    const curvePoint = (id, s, off, out) => {
        const { xs, ys, cum } = roadGeom[id];
        const n = xs.length - 1;
        let i = 0;
        let lo = 0;
        let hi = n - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (cum[mid] <= s) {
                i = mid;
                lo = mid + 1;
            } else hi = mid - 1;
        }
        const len = cum[i + 1] - cum[i] || 1;
        let tx = (xs[i + 1] - xs[i]) / len;
        let ty = (ys[i + 1] - ys[i]) / len;
        const t = (s - cum[i]) / len;
        const px = xs[i] + tx * (s - cum[i]);
        const py = ys[i] + ty * (s - cum[i]);
        // Ease the direction towards the neighbouring segment near the vertices.
        const ease = (j, along) => {
            if (j < 0 || j >= n) return;
            const l2 = cum[j + 1] - cum[j] || 1;
            const ux = (xs[j + 1] - xs[j]) / l2;
            const uy = (ys[j + 1] - ys[j]) / l2;
            const wgt = 0.5 * Math.max(0, 1 - along / CURVE_EASE);
            tx = tx * (1 - wgt) + ux * wgt;
            ty = ty * (1 - wgt) + uy * wgt;
            const tl = Math.hypot(tx, ty) || 1;
            tx /= tl;
            ty /= tl;
        };
        if (t > 0 && t < 1) {
            ease(i - 1, s - cum[i]);
            ease(i + 1, cum[i + 1] - s);
        }
        out[0] = px - ty * off;
        out[1] = py + tx * off;
    };
    const curveAt = [0, 0];
    // Along road id from arc length s0 in direction dir (+1 / -1), at offset off0 (drifting by the
    // road's skew): steps to the first real pixel, its colour reflected along the road (2k).
    const marchCurve = (id, s0, off0, dir, out) => {
        const drift = roadSin[id];
        for (let k = 1; k <= MAX_LINE_STEPS; k++) {
            curvePoint(id, s0 + dir * k, off0 + dir * k * drift, curveAt);
            const ix = Math.floor(curveAt[0]) + x0;
            const iy = Math.floor(curveAt[1]) + y0;
            if (ix < x0 || iy < y0 || ix >= x0 + w || iy >= y0 + h) return -1;
            if (masked[iy * full + ix]) continue;
            const nearX = curveAt[0] + x0;
            const nearY = curveAt[1] + y0;
            curvePoint(id, s0 + dir * 2 * k, off0 + dir * 2 * k * drift, curveAt);
            if (!pixelAt(curveAt[0] + x0, curveAt[1] + y0, out)) pixelAt(nearX, nearY, out);
            return k;
        }
        return -1;
    };

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const q = (y + y0) * full + (x + x0);
            if (!masked[q]) continue;
            const p = y * w + x;
            const s = side[q];
            const half = halfPx[q];
            if (knowRoads && roadDist[p] > ON_ROAD) {
                // Off the roads: ground only, mirrored across each edge (a pure reflection: every
                // hidden pixel its own photo pixel, so grass keeps its texture); the two sides blend
                // across the width. A side whose mirror lands on a road (a road beside the deck) is
                // left out and the other side fills the whole width; only where both are roads does
                // the reflection reach a little past them, then the smooth ground average.
                // (Walking far past a road made streaks: neighbouring pixels all hit one far pixel.)
                const near = Math.ceil(GROUND_MIRROR_SLACK * pxPerMetre);
                let okA = groundSample(footX[q], footY[q], normX[q], normY[q], 2 * half - s, 1, near, colourA);
                let okB = groundSample(footX[q], footY[q], normX[q], normY[q], -2 * half - s, -1, near, colourB);
                if (!okA && !okB) {
                    // Roads on both sides (a strip between two roads, or a road running along under the
                    // deck end): it continues along the deck, so take it from beyond the deck end.
                    const tx = normY[q];
                    const ty = -normX[q];
                    const px = x + x0 + 0.5;
                    const py = y + y0 + 0.5;
                    const dA = march(px, py, tx, ty, MAX_LINE_STEPS, colourA);
                    const dB = march(px, py, -tx, -ty, MAX_LINE_STEPS, colourB);
                    if (dA > 0 || dB > 0) {
                        const wa = dA > 0 ? (dB > 0 ? dB / (dA + dB) : 1) : 0;
                        for (let c = 0; c < 3; c++) data[p * 4 + c] = colourA[c] * wa + colourB[c] * (1 - wa);
                        continue;
                    }
                    const maxExtra = Math.ceil(ROAD_SKIP_METRES * pxPerMetre);
                    okA = groundSample(footX[q], footY[q], normX[q], normY[q], 2 * half - s, 1, maxExtra, colourA);
                    okB = groundSample(footX[q], footY[q], normX[q], normY[q], -2 * half - s, -1, maxExtra, colourB);
                }
                const k = Math.min(1, Math.max(0, (s + half) / (2 * half)));
                const wA = okA ? (okB ? k * k * (3 - 2 * k) : 1) : 0;
                const wB = okB ? (okA ? 1 - k * k * (3 - 2 * k) : 1) : 0;
                const total = wA + wB;
                const trust = total > 0 ? 1 : 0;
                for (let c = 0; c < 3; c++) {
                    const mirrored = total > 0 ? (colourA[c] * wA + colourB[c] * wB) / total : groundResult[p * 3 + c];
                    data[p * 4 + c] = mirrored * trust + groundResult[p * 3 + c] * (1 - trust);
                }
                continue;
            }
            if (knowRoads && roadId[p] >= 0) {
                // On a road under the deck: along the road both ways to the photo beyond the deck,
                // reflected along it; the nearer side, blended only around the middle (dashes stay sharp).
                // Along the road's own (curved) centreline at this pixel's offset from it: lanes
                // stay parallel to the road through bends (straight lines left a jog on curves).
                const id = roadId[p];
                const dA = marchCurve(id, roadS[p], roadOff[p], 1, lineA);
                const dB = marchCurve(id, roadS[p], roadOff[p], -1, lineB);
                if (dA > 0 || dB > 0) {
                    let wA = dA > 0 ? 1 : 0;
                    if (dA > 0 && dB > 0) {
                        const r = Math.min(1, Math.max(0, (dA / (dA + dB) - 0.35) / 0.3)); // 0 near A .. 1 near B
                        wA = 1 - r * r * (3 - 2 * r);
                    }
                    for (let c = 0; c < 3; c++) data[p * 4 + c] = lineA[c] * wA + lineB[c] * (1 - wA);
                    continue;
                }
            }
            // Local line direction and how clear it is (coherence 0 .. 1).
            const xa = Math.max(0, x - radius);
            const ya = Math.max(0, y - radius);
            const xb = Math.min(w, x + radius + 1);
            const yb = Math.min(h, y + radius + 1);
            const jxx = boxSum(sxx, xa, ya, xb, yb);
            const jxy = boxSum(sxy, xa, ya, xb, yb);
            const jyy = boxSum(syy, xa, ya, xb, yb);
            const trace = jxx + jyy;
            let directional = 0;
            if (trace > 1e-6) {
                const diff = Math.sqrt(((jxx - jyy) / 2) ** 2 + jxy * jxy);
                const coherence = ((2 * diff) / trace) ** 2;
                const angle = 0.5 * Math.atan2(2 * jxy, jxx - jyy); // gradient direction
                const vx = -Math.sin(angle); // along the lines
                const vy = Math.cos(angle);
                const across = Math.abs(vx * normX[q] + vy * normY[q]); // 1 = straight across the deck
                // Any clear direction, also lines running at a shallow angle under a deck (a ramp over a
                // road it nearly follows): mirroring those flips their angle (a skew). The search along
                // the line is capped (MAX_LINE_STEPS pixels).
                if (coherence > 0.1 && across > 0.03) {
                    const maxSteps = Math.min(MAX_LINE_STEPS, Math.ceil((2.5 * half) / across) + 2);
                    const dA = march(x + x0 + 0.5, y + y0 + 0.5, vx, vy, maxSteps, lineA);
                    const dB = march(x + x0 + 0.5, y + y0 + 0.5, -vx, -vy, maxSteps, lineB);
                    if (dA > 0 && dB > 0) {
                        // The line's colour on both sides, weighted by distance.
                        for (let c = 0; c < 3; c++) lineA[c] = (lineA[c] * dB + lineB[c] * dA) / (dA + dB);
                        directional = Math.min(1, (coherence - 0.1) / 0.3);
                    }
                }
            }
            // Mirrored across the + edge (s -> 2h - s) and across the - edge (s -> -2h - s).
            const okA = sample(footX[q] + normX[q] * (2 * half - s), footY[q] + normY[q] * (2 * half - s), colourA);
            const okB = sample(footX[q] + normX[q] * (-2 * half - s), footY[q] + normY[q] * (-2 * half - s), colourB);
            const k = Math.min(1, Math.max(0, (s + half) / (2 * half))); // 1 at the + edge, 0 at the - edge
            // A smooth weight (the seam in the middle blends over the width), each side only when found.
            const wA = okA ? k * k * (3 - 2 * k) : 0;
            const wB = okB ? 1 - k * k * (3 - 2 * k) : 0;
            const total = wA + wB;
            for (let c = 0; c < 3; c++) {
                const mirrored = total > 0 ? (colourA[c] * wA + colourB[c] * wB) / total : result[p * 3 + c];
                // Where only one side was found far from it, lean on the smooth fill a little.
                const trust = total > 0 ? Math.min(1, total * 1.5) : 0;
                const fill = mirrored * trust + result[p * 3 + c] * (1 - trust);
                // Clear lines crossing the deck: continue them; else the mirrored ground.
                data[p * 4 + c] = lineA[c] * directional + fill * (1 - directional);
            }
        }
    }
    context.putImageData(image, x0, y0);
}
