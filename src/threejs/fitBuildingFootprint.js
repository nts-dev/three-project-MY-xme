import { Matrix4, Vector3 } from "three";

// Fit a model to the traced lot corners in its saved reference pose. Baking the fit
// into model space lets later moves and rotations work like they do on other models.
export function fitBuildingFootprint(geometry, fit) {
    const reference = new Matrix4().fromArray(fit.reference);
    const inverse = reference.clone().invert();
    const { width, polygon, corners, openLeft } = fit;
    const project = (x, z) => [x * width[0] + z * width[1], z * width[0] - x * width[1]];
    const outline = polygon.map(([x, z]) => project(x, z));
    const minWidth = Math.min(...outline.map(([w]) => w));
    const spanWidth = Math.max(...outline.map(([w]) => w)) - minWidth;
    const spanDepth = Math.max(...outline.map(([, d]) => d)) - Math.min(...outline.map(([, d]) => d));
    const selectCorner = (widthSign, depthSign) => {
        const score = ([w, d]) => widthSign * w / spanWidth + depthSign * d / spanDepth;
        return outline.reduce((best, p) => score(p) > score(best) ? p : best);
    };
    const a = [...selectCorner(-1, -1)];
    const b = selectCorner(1, -1);
    const c = selectCorner(1, 1);
    const e = [...selectCorner(-1, 1)];
    if (openLeft) {
        a[0] = minWidth;
        a[1] = b[1];
        e[0] = minWidth;
        e[1] = c[1];
    }
    const bx = b[0] - a[0], by = b[1] - a[1];
    const ex = e[0] - a[0], ey = e[1] - a[1];
    const sx = c[0] - b[0] - ex, sy = c[1] - b[1] - ey;
    const determinant = bx * ey - by * ex;
    if (Math.abs(determinant) < 1e-8) return geometry;
    const [northWest, northEast, southEast, southWest] = corners;
    const fitted = geometry.clone();
    const position = fitted.attributes.position;
    const point = new Vector3();

    for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(reference);
        const [w, d] = project(point.x, point.z);
        const x = w - a[0], z = d - a[1];
        let u = (x * ey - z * ex) / determinant;
        let v = (bx * z - by * x) / determinant;
        // Invert the source quadrilateral. Its actual corners map to the four lot corners,
        // including when an old shop model has a skewed façade.
        for (let iteration = 0; iteration < 4; iteration++) {
            const dx = bx * u + ex * v + sx * u * v - x;
            const dz = by * u + ey * v + sy * u * v - z;
            const ux = bx + sx * v, uz = by + sy * v;
            const vx = ex + sx * u, vz = ey + sy * u;
            const jacobian = ux * vz - uz * vx;
            if (Math.abs(jacobian) < 1e-8) break;
            u -= (dx * vz - dz * vx) / jacobian;
            v -= (ux * dz - uz * dx) / jacobian;
        }
        u = Math.max(0, Math.min(1, u));
        v = Math.max(0, Math.min(1, v));
        const frontX = northWest[0] * (1 - u) + northEast[0] * u;
        const backX = southWest[0] * (1 - u) + southEast[0] * u;
        const frontZ = northWest[1] * (1 - u) + northEast[1] * u;
        const backZ = southWest[1] * (1 - u) + southEast[1] * u;
        point.set(frontX * (1 - v) + backX * v, point.y, frontZ * (1 - v) + backZ * v).applyMatrix4(inverse);
        position.setXYZ(i, point.x, point.y, point.z);
    }
    fitted.computeVertexNormals();
    fitted.computeBoundingBox();
    fitted.computeBoundingSphere();
    return fitted;
}
