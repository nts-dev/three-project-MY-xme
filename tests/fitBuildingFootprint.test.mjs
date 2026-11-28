import assert from "node:assert/strict";
import { test } from "node:test";
import { BufferGeometry, Float32BufferAttribute, Matrix4 } from "three";
import { fitBuildingFootprint } from "../src/threejs/fitBuildingFootprint.js";

test("a tapered building shares both ends of its wall with the next lot", () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([
        1, 0, 0,  4, 0, 0,  0, 0, 6,
        4, 0, 0,  5, 0, 6,  0, 0, 6,
        1, 8, 0,  4, 8, 0,  0, 8, 6,
        4, 8, 0,  5, 8, 6,  0, 8, 6,
    ], 3));
    const result = fitBuildingFootprint(geometry, {
        reference: new Matrix4().toArray(),
        width: [1, 0],
        polygon: [[1, 0], [4, 0], [5, 6], [0, 6]],
        corners: [[0, 0], [6, 0], [6, 6], [0, 6]],
    });
    const positions = result.attributes.position;
    assert.equal(positions.getX(1), 6);
    assert.equal(positions.getX(4), 6);
    assert.equal(positions.getX(7), 6);
    assert.equal(positions.getX(10), 6);
    assert.equal(positions.getY(10), 8);
    assert.equal(geometry.attributes.position.getX(1), 4);
});

test("both corners of an angled façade land on the same frontage", () => {
    const outline = [[0, 1], [4, 0], [5, 6], [1, 7]];
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([
        0, 5, 1, 4, 5, 0, 5, 5, 6,
        5, 5, 6, 1, 5, 7, 0, 5, 1,
    ], 3));
    const result = fitBuildingFootprint(geometry, {
        reference: new Matrix4().toArray(),
        width: [1, 0],
        polygon: outline,
        corners: [[0, 0], [4, 0], [4, 6], [0, 6]],
    });
    const positions = result.attributes.position;
    assert.equal(positions.getZ(0), 0);
    assert.equal(positions.getZ(1), 0);
    assert.equal(positions.getX(0), 0);
    assert.equal(positions.getX(1), 4);
});
