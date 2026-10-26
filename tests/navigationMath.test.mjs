import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wheelDollyStep } from '../src/threejs/scene/camera/navigationMath.js';

test('precision wheel input scales continuously and does not jump at long distances', () => {
    for (const distance of [1, 50, 1000]) {
        const small = wheelDollyStep(0.1, 0, 800, distance, 2);
        const larger = wheelDollyStep(1, 0, 800, distance, 2);
        assert.ok(Math.abs(larger / small - 10) < 1e-10);
        assert.equal(wheelDollyStep(0, 0, 800, distance, 2), 0);
        assert.equal(wheelDollyStep(-1, 0, 800, distance, 2), larger);
    }
});

test('wheel modes normalize to pixels and large gestures remain bounded', () => {
    assert.equal(wheelDollyStep(5, 1, 800, 20, 2), wheelDollyStep(80, 0, 800, 20, 2));
    assert.equal(wheelDollyStep(1, 2, 800, 20, 2), wheelDollyStep(800, 0, 800, 20, 2));
    assert.equal(wheelDollyStep(1e6, 0, 800, 1e6, 2), 10);
});
