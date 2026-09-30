import test from "node:test";
import assert from "node:assert/strict";
import { RtlsLiveMotion, rtlsScenePosition } from "./rtlsLiveMotion.js";

const packet = (x, z, time) => ({
    clientId: "GR100f", posX: x * 100, posY: 650.9, posZ: z * 100,
    position: { x, y: 0, z }, rtls: { x, y: z },
    dateTime: new Date(1700000000000 + time).toISOString(),
});

test("uses recorded-route units and offsets, rejecting invalid coordinates", () => {
    const position = rtlsScenePosition(packet(1, 2, 0));
    assert.ok(Math.abs(position.x - 0.2) < 1e-9);
    assert.ok(Math.abs(position.y - 5.209) < 1e-9);
    assert.ok(Math.abs(position.z - 0.6) < 1e-9);
    assert.equal(rtlsScenePosition({ posX: "bad" }), null);
});

test("buffers updates, rejects duplicates and out-of-order packets", () => {
    const motion = new RtlsLiveMotion();
    motion.push(packet(0, 0, 0), 0);
    motion.push(packet(0, 1, 100), 100);
    motion.push(packet(0, 1, 100), 200);
    motion.push(packet(9, 9, 50), 250);
    assert.equal(motion.queue.length, 2);
    const initial = motion.position.clone();
    motion.update(1 / 60, 500);
    assert.ok(motion.position.equals(initial));
    motion.update(1 / 60, 800);
    assert.ok(motion.position.z > initial.z);
    assert.ok(motion.speed <= 1.600001);
});

test("sharp turns freeze translation and limit rotation before resuming", () => {
    const motion = new RtlsLiveMotion();
    motion.push(packet(0, 0, 0), 0);
    motion.push(packet(1, 0, 100), 100);
    const initial = motion.position.clone();
    let previousHeading = motion.heading;
    for (let i = 0; i < 40; i++) {
        motion.update(1 / 60, 800 + i * 1000 / 60);
        assert.ok(motion.position.equals(initial));
        assert.ok(Math.abs(motion.heading - previousHeading) <= Math.PI / 4 / 60 + 1e-9);
        previousHeading = motion.heading;
    }
    for (let i = 0; i < 160; i++) motion.update(1 / 60, 1500 + i * 1000 / 60);
    assert.ok(motion.position.x > initial.x);
});

test("drains the buffered path then idles without extrapolating", () => {
    const motion = new RtlsLiveMotion();
    motion.push(packet(0, 0, 0), 0);
    motion.push(packet(0, 1, 100), 100);
    for (let i = 0; i < 300; i++) motion.update(1 / 60, 800 + i * 1000 / 60);
    assert.ok(motion.position.distanceTo(rtlsScenePosition(packet(0, 1, 100))) < 1e-6);
    assert.equal(motion.speed, 0);
});

test("reconnection and excessive backlog resync instead of replaying stale history", () => {
    const motion = new RtlsLiveMotion();
    motion.push(packet(0, 0, 0), 0);
    motion.push(packet(4, 4, 4000), 4000);
    assert.ok(motion.position.equals(rtlsScenePosition(packet(4, 4, 4000))));
    for (let i = 1; i <= 60; i++) motion.push(packet(4 + i / 10, 4, 4000 + i * 100), 4000 + i * 100);
    assert.ok(motion.queue.length < 60);
    assert.ok(motion.position.x > 8);
});
