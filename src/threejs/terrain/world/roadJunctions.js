// Junction shapes for the ground roads (groundRoads.js): rounded kerb corners between the arms of
// roads that meet, and a filled disc in the middle so L corners have no notch. All in region
// metres [x, z]; returns polygons as { centre, ring } fans (ring points in order).

const NEAR = 3; // a road end within this of another road's edge joins it
const ARM_PROBE = 10; // metres along an arm to take its direction (curved roads)
const MAX_RADIUS = 12; // kerb corner radius (flared estate corners, as on the aerial photo)
const ARC_STEPS = 8;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => mul(a, 1 / (len(a) || 1));

/** Polyline helpers: total length, point at arc length, closest point (with arc length). */
function measure(points) {
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + len(sub(points[i], points[i - 1])));
    const total = cum.at(-1);
    const at = (s) => {
        const t = Math.max(0, Math.min(total, s));
        let i = 1;
        while (i < points.length - 1 && cum[i] < t) i++;
        const k = (t - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
        return add(points[i - 1], mul(sub(points[i], points[i - 1]), k));
    };
    const closest = (p) => {
        let best = { d: Infinity, s: 0, q: points[0] };
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const ab = sub(points[i], a);
            const l2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
            const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2));
            const q = add(a, mul(ab, k));
            const d = len(sub(p, q));
            if (d < best.d) best = { d, s: cum[i - 1] + k * (cum[i] - cum[i - 1]), q };
        }
        return best;
    };
    return { total, at, closest };
}

/** Arms leaving point s of a road: one at an end, two in the middle. */
function armsAt(road, m, s) {
    const out = [];
    const p = m.at(s);
    if (s < m.total - 1) out.push({ dir: unit(sub(m.at(s + ARM_PROBE), p)), half: road.width / 2, room: m.total - s });
    if (s > 1) out.push({ dir: unit(sub(m.at(s - ARM_PROBE), p)), half: road.width / 2, room: s });
    return out;
}

/** Junctions of asphalt roads: { point, arms: [{ dir, half, room }] }. */
export function findJunctions(roads) {
    const measured = roads.map((road) => ({ road, m: measure(road.points) }));
    const junctions = [];
    const addJunction = (point, arms) => {
        const found = junctions.find((j) => len(sub(j.point, point)) < 4);
        if (!found) return junctions.push({ point, arms: [...arms] });
        for (const arm of arms) {
            if (!found.arms.some((other) => len(sub(other.dir, arm.dir)) < 0.25)) found.arms.push(arm);
        }
        return found;
    };
    for (const a of measured) {
        for (const endS of [0, a.m.total]) {
            const end = a.m.at(endS);
            for (const b of measured) {
                if (b === a) continue;
                let hit = b.m.closest(end);
                if (hit.d > b.road.width / 2 + NEAR) continue;
                // Anchor where a's centreline (continued past its end) crosses b's centreline, so the
                // corners line up with both ribbons also when a meets b at an angle.
                const inward = unit(sub(end, a.m.at(endS === 0 ? ARM_PROBE : a.m.total - ARM_PROBE)));
                const crossing = rayHit(end, inward, b.road.points, b.road.width + NEAR);
                if (crossing) hit = { ...b.m.closest(crossing), q: crossing };
                const armsA = armsAt(a.road, a.m, endS);
                const armsB = armsAt(b.road, b.m, hit.s);
                // Roads running on along each other (shared stretches) are not a junction.
                if (armsA.some((x) => armsB.some((y) => x.dir[0] * y.dir[0] + x.dir[1] * y.dir[1] > 0.94))) continue;
                addJunction(hit.q, [...armsA, ...armsB]);
            }
        }
    }
    // Roads crossing each other away from their ends.
    for (let i = 0; i < measured.length; i++) {
        for (let j = i + 1; j < measured.length; j++) {
            const A = measured[i].road.points;
            const B = measured[j].road.points;
            for (let p = 1; p < A.length; p++) {
                for (let q = 1; q < B.length; q++) {
                    const x = intersect(A[p - 1], A[p], B[q - 1], B[q]);
                    if (!x) continue;
                    const sa = measured[i].m.closest(x).s;
                    const sb = measured[j].m.closest(x).s;
                    if (Math.min(sa, measured[i].m.total - sa, sb, measured[j].m.total - sb) < 3) continue; // an end: handled above
                    addJunction(x, [...armsAt(measured[i].road, measured[i].m, sa), ...armsAt(measured[j].road, measured[j].m, sb)]);
                }
            }
        }
    }
    return junctions;
}

/** Where the ray from p along dir (both ways, within maxDist) crosses polyline `points`, nearest p. */
function rayHit(p, dir, points, maxDist) {
    let best = null;
    for (let i = 1; i < points.length; i++) {
        const c = points[i - 1];
        const s = sub(points[i], c);
        const den = dir[0] * s[1] - dir[1] * s[0];
        if (Math.abs(den) < 1e-9) continue;
        const t = ((c[0] - p[0]) * s[1] - (c[1] - p[1]) * s[0]) / den;
        const u = ((c[0] - p[0]) * dir[1] - (c[1] - p[1]) * dir[0]) / den;
        if (u < 0 || u > 1 || Math.abs(t) > maxDist) continue;
        if (!best || Math.abs(t) < best.t) best = { t: Math.abs(t), q: add(p, mul(dir, t)) };
    }
    return best ? best.q : null;
}

function intersect(a, b, c, d) {
    const r = sub(b, a);
    const s = sub(d, c);
    const den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
    const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    return t > 0 && t < 1 && u > 0 && u < 1 ? add(a, mul(r, t)) : null;
}

/** Fan polygons filling a junction: a centre disc and a rounded corner between neighbouring arms. */
export function junctionFans({ point, arms }) {
    const fans = [];
    const sorted = [...arms].sort((x, y) => Math.atan2(x.dir[1], x.dir[0]) - Math.atan2(y.dir[1], y.dir[0]));
    const discRadius = Math.min(...arms.map((arm) => arm.half));
    fans.push({ centre: point, ring: Array.from({ length: 25 }, (_, i) => add(point, mul([Math.cos((i / 24) * 2 * Math.PI), Math.sin((i / 24) * 2 * Math.PI)], discRadius))) });
    for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        const b = sorted[(i + 1) % sorted.length];
        let theta = Math.atan2(b.dir[1], b.dir[0]) - Math.atan2(a.dir[1], a.dir[0]);
        if (theta <= 0) theta += 2 * Math.PI;
        if (theta < 0.35 || theta > 2.9) continue; // nearly parallel, or (almost) a straight run
        // Edges facing each other: arm a's edge on its counter-clockwise side, arm b's on its clockwise side.
        const ea = add(point, mul([-a.dir[1], a.dir[0]], a.half));
        const eb = add(point, mul([b.dir[1], -b.dir[0]], b.half));
        const den = a.dir[0] * b.dir[1] - a.dir[1] * b.dir[0];
        if (Math.abs(den) < 1e-6) continue;
        const t = ((eb[0] - ea[0]) * b.dir[1] - (eb[1] - ea[1]) * b.dir[0]) / den;
        const corner = add(ea, mul(a.dir, t));
        const half = theta / 2;
        const room = Math.min(a.room, b.room) * 0.6;
        const radius = Math.min(MAX_RADIUS, room * Math.tan(half));
        if (radius < 1) continue;
        const tangent = radius / Math.tan(half);
        const ta = add(corner, mul(a.dir, tangent));
        const tb = add(corner, mul(b.dir, tangent));
        const centre = add(corner, mul(unit(add(a.dir, b.dir)), radius / Math.sin(half)));
        const start = Math.atan2(ta[1] - centre[1], ta[0] - centre[0]);
        let end = Math.atan2(tb[1] - centre[1], tb[0] - centre[0]);
        // The arc bulges towards the corner: take the short way round.
        let sweep = end - start;
        while (sweep > Math.PI) sweep -= 2 * Math.PI;
        while (sweep < -Math.PI) sweep += 2 * Math.PI;
        end = start + sweep;
        const ring = [ta];
        for (let k = 1; k < ARC_STEPS; k++) {
            const angle = start + ((end - start) * k) / ARC_STEPS;
            ring.push(add(centre, [Math.cos(angle) * radius, Math.sin(angle) * radius]));
        }
        ring.push(tb);
        fans.push({ centre: corner, ring });
    }
    return fans;
}
