import { geoToUnit } from "./webMercator";

// Road surfaces painted over the satellite photo of each terrain tile: asphalt, edge lines and lane
// markings, from the regions' roads.json (scripts/terrain/steps/roadSurfaces.mjs). Roads come out
// straight and sharp at any zoom instead of following the photo.

const METERS_PER_DEGREE_LAT = 110574;
const ASPHALT = "#454644";
const MARKING = "rgba(238, 236, 228, 0.92)";

/** Region roads as geo polylines: [{ points: [{ lat, lon }], width, lanes, oneway }]. */
export function roadSurfaceLines(regions) {
    const lines = [];
    for (const region of regions) {
        for (const road of region.roads || []) {
            if (!road.points?.length || road.points.length < 2) continue;
            lines.push({
                ...road,
                points: road.points.map(([x, z]) => ({
                    lat: region.lat - z / METERS_PER_DEGREE_LAT,
                    lon: region.lon + x / region.metersPerDegreeLon,
                })),
            });
        }
    }
    return lines;
}

/** Converts geo road lines to map units (u, v) with bounds, for fast per-tile tests. */
export function prepareRoadSurfaces(lines, metersPerUnit) {
    return lines.map((road) => {
        const points = road.points.map(({ lat, lon }) => geoToUnit(lat, lon));
        const half = road.width / 2 / metersPerUnit;
        return {
            ...road,
            points,
            minU: Math.min(...points.map((p) => p.u)) - half,
            maxU: Math.max(...points.map((p) => p.u)) + half,
            minV: Math.min(...points.map((p) => p.v)) - half,
            maxV: Math.max(...points.map((p) => p.v)) + half,
        };
    });
}

/** A polyline shifted sideways by `offset` pixels (positive = left of the direction of travel). */
function offsetLine(points, offset) {
    return points.map((p, i) => {
        const a = points[Math.max(0, i - 1)];
        const b = points[Math.min(points.length - 1, i + 1)];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const length = Math.hypot(dx, dy) || 1;
        return [p[0] - (dy / length) * offset, p[1] + (dx / length) * offset];
    });
}

/** Trims `amount` pixels off both ends of a polyline (keeps markings out of junctions). */
function trimLine(points, amount) {
    const total = points.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0), 0);
    if (total <= amount * 2.5) return null;
    const cut = (line, distance) => {
        let left = distance;
        for (let i = 0; i < line.length - 1; i++) {
            const segment = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
            if (segment >= left) {
                const t = left / (segment || 1);
                return [[line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t], ...line.slice(i + 1)];
            }
            left -= segment;
        }
        return line.slice(-1);
    };
    return cut(cut(points, amount).reverse(), amount).reverse();
}

const strokeLine = (context, points) => {
    context.beginPath();
    points.forEach(([x, y], i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
    context.stroke();
};

/**
 * Paints the roads crossing a terrain tile into its canvas (size x size pixels, tile z/x/y).
 * Asphalt first for all roads (so junctions merge), then markings.
 */
export function paintRoadSurfaces(context, tile, size, roads, metersPerUnit) {
    if (!roads?.length) return;
    const n = 2 ** tile.z;
    const u0 = tile.x / n;
    const v0 = tile.y / n;
    const u1 = (tile.x + 1) / n;
    const v1 = (tile.y + 1) / n;
    const crossing = roads.filter((r) => r.maxU >= u0 && r.minU <= u1 && r.maxV >= v0 && r.minV <= v1);
    if (!crossing.length) return;

    const pixelsPerUnit = size * n;
    const pixelsPerMeter = pixelsPerUnit / metersPerUnit;
    const toPixels = (road) => road.points.map((p) => [(p.u - u0) * pixelsPerUnit, (p.v - v0) * pixelsPerUnit]);
    const visible = crossing.filter((road) => road.width * pixelsPerMeter >= 1.5); // too thin at this zoom: leave the photo
    if (!visible.length) return;

    context.save();
    context.lineJoin = "round";
    context.lineCap = "round";
    context.strokeStyle = ASPHALT;
    for (const road of visible) {
        context.lineWidth = road.width * pixelsPerMeter;
        strokeLine(context, toPixels(road));
    }

    // Markings only where they are at least ~1 px wide.
    if (pixelsPerMeter * 0.15 >= 0.45) {
        context.strokeStyle = MARKING;
        context.lineCap = "butt";
        const markWidth = Math.max(1, 0.15 * pixelsPerMeter);
        for (const road of visible) {
            const line = trimLine(toPixels(road), 7 * pixelsPerMeter);
            if (!line) continue;
            const half = (road.width / 2 - 0.5) * pixelsPerMeter;
            context.lineWidth = markWidth;
            context.setLineDash([]);
            strokeLine(context, offsetLine(line, half));
            strokeLine(context, offsetLine(line, -half));
            const lanes = Math.max(1, road.lanes);
            context.setLineDash([3 * pixelsPerMeter, 6 * pixelsPerMeter]);
            for (let lane = 1; lane < lanes; lane++) {
                const offset = -half + ((2 * half) * lane) / lanes;
                strokeLine(context, offsetLine(line, offset));
            }
        }
    }
    context.restore();
}
