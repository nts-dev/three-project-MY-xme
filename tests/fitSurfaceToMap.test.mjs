import assert from "node:assert/strict";
import test from "node:test";
import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from "three";
import { fitSurfaceToMap } from "../src/threejs/fitSurfaceToMap.js";

test("a road surface follows traced coordinates and ground elevations without changing its UVs", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
    geometry.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    const reference = new Matrix4().makeTranslation(10, 5, 20);
    const targets = [
        [10, 20, 12, 0.05, 20],
        [11, 20, 15, 0.07, 21],
        [10, 21, 12, 0.09, 22],
    ];
    const fitted = fitSurfaceToMap(geometry, { reference: reference.toArray(), vertices: targets });

    targets.forEach(([, , x, y, z], index) => {
        const vertex = new Vector3().fromBufferAttribute(fitted.attributes.position, index).applyMatrix4(reference);
        assert(vertex.distanceTo(new Vector3(x, y, z)) < 1e-6);
    });
    assert.deepEqual([...fitted.attributes.uv.array], [...geometry.attributes.uv.array]);
    assert.deepEqual([...geometry.attributes.position.array], [0, 0, 0, 1, 0, 0, 0, 0, 1]);
});

test("parking triangles at the entrance are cleared and the remaining group is kept", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([
        0, 0, 0, 1, 0, 0, 0, 0, 1,
        3, 0, 0, 4, 0, 0, 3, 0, 1,
    ], 3));
    geometry.setIndex([0, 1, 2, 3, 4, 5]);
    geometry.addGroup(0, 6, 0);

    const fitted = fitSurfaceToMap(geometry, {
        reference: new Matrix4().toArray(),
        vertices: [],
        clearance: [0, 0, 1, 1],
    });

    assert.deepEqual([...fitted.index.array], [3, 4, 5]);
    assert.deepEqual(fitted.groups, [{ start: 0, count: 3, materialIndex: 0 }]);
});
