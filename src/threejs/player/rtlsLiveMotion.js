import * as THREE from "three";

export const RTLS_ROUTE_OFFSET = new THREE.Vector3(-0.8, -1.3, -1.4);
const DELAY_MS = 650;
const MAX_BACKLOG_MS = 5000;
const STALE_MS = 3000;
const SPEED = 1.6;
const TURN_SPEED = Math.PI / 4;
const STOP_ANGLE = THREE.MathUtils.degToRad(35);
const RESUME_ANGLE = THREE.MathUtils.degToRad(2);
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

// Match recorded routes: posX/Y/Z are centimetres; position is a fallback in scene units.
export function rtlsScenePosition(player) {
    const values = ["X", "Y", "Z"].map((axis) => {
        const cm = player?.[`pos${axis}`];
        const value = cm == null ? player?.position?.[axis.toLowerCase()] : Number(cm) / 100;
        return value == null ? NaN : Number(value);
    });
    return values.every(Number.isFinite)
        ? new THREE.Vector3(...values).add(RTLS_ROUTE_OFFSET)
        : null;
}

export class RtlsLiveMotion {
    constructor() {
        this.position = new THREE.Vector3();
        this.heading = 0;
        this.speed = 0;
        this.distance = 0;
        this.turning = false;
        this.ready = false;
        this.queue = [];
        this.lastTimestamp = -Infinity;
        this.lastReceived = -Infinity;
        this.lastPosition = null;
        this.segment = null;
        this.player = null;
    }

    push(player, now) {
        const position = rtlsScenePosition(player);
        if (!position) return;
        const timestamp = Date.parse(player.dateTime || player.recordedAt || "");
        if (Number.isFinite(timestamp) && timestamp <= this.lastTimestamp) return;
        if (Number.isFinite(timestamp)) this.lastTimestamp = timestamp;
        const reconnect = now - this.lastReceived > STALE_MS;
        this.lastReceived = now;
        this.player = player;
        if (!this.ready || reconnect) {
            this.position.copy(position);
            this.previous = position.clone();
            this.queue = [];
            this.segment = null;
            this.turning = false;
            this.speed = 0;
            this.ready = true;
        }
        if (this.lastPosition && !reconnect && this.lastPosition.distanceTo(position) < 0.06) return;
        this.lastPosition = position.clone();
        this.queue.push({ position, at: now });
        // Resync after excessive delay instead of replaying an ever-growing old trail.
        if (this.queue.length > 300 || now - this.queue[0].at > MAX_BACKLOG_MS) {
            this.position.copy(position);
            this.previous.copy(position);
            this.queue = [];
            this.segment = null;
            this.turning = false;
        }
    }

    update(delta, now) {
        this.speed = 0;
        if (!this.ready) return;
        const dt = Math.min(Math.max(delta, 0), 0.05);
        if (!this.segment) {
            while (this.queue.length && this.queue[0].at <= now - DELAY_MS) {
                const next = this.queue.shift().position;
                if (this.position.distanceTo(next) < 0.001) continue;
                const start = this.position.clone();
                const after = this.queue[0]?.position || next;
                const curve = new THREE.CatmullRomCurve3([this.previous, start, next, after], false, "centripetal");
                // Only traverse the middle span; freeze it so new packets cannot shift the active path.
                const points = Array.from({ length: 25 }, (_, i) => curve.getPoint((1 + i / 24) / 3));
                this.segment = { points, index: 1, start };
                break;
            }
        }
        if (!this.segment) return;
        const segment = this.segment;
        const destination = segment.points[segment.index];
        const direction = destination.clone().sub(this.position);
        const heading = Math.atan2(direction.x, direction.z);
        const difference = angleDelta(this.heading, heading);
        if (!this.turning && Math.abs(difference) >= STOP_ANGLE) {
            this.turning = true;
            this.turnHeading = heading;
        }
        const targetHeading = this.turning ? this.turnHeading : heading;
        const turn = angleDelta(this.heading, targetHeading);
        this.heading += THREE.MathUtils.clamp(turn, -TURN_SPEED * dt, TURN_SPEED * dt);
        if (this.turning) {
            if (Math.abs(angleDelta(this.heading, targetHeading)) <= RESUME_ANGLE) this.turning = false;
            return;
        }
        let budget = SPEED * dt;
        let travelled = 0;
        while (budget > 0 && segment.index < segment.points.length) {
            direction.copy(segment.points[segment.index]).sub(this.position);
            const length = direction.length();
            const step = Math.min(length, budget);
            if (length > 0) this.position.addScaledVector(direction, step / length);
            budget -= step;
            travelled += step;
            if (length - step > 0.000001) break;
            segment.index += 1;
        }
        this.speed = dt > 0 ? travelled / dt : 0;
        this.distance += travelled;
        if (segment.index >= segment.points.length) {
            this.previous.copy(segment.start);
            this.segment = null;
        }
    }
}
