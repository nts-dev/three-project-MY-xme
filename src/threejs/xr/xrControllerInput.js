const AXIS_DEAD_ZONE = 0.18;
const MOVE_BUTTON_INDICES = new Set([0, 1, 4, 5]);

function applyDeadZone(value) {
    return Math.abs(value) < AXIS_DEAD_ZONE ? 0 : value;
}

function getAxisPair(axes = []) {
    const pairs = [
        [axes[0] || 0, axes[1] || 0],
        [axes[2] || 0, axes[3] || 0],
    ];

    return pairs.reduce((best, pair) => {
        const [, bestY] = best;
        const [, pairY] = pair;
        const bestPower = Math.abs(best[0]) + Math.abs(bestY);
        const pairPower = Math.abs(pair[0]) + Math.abs(pairY);
        return pairPower > bestPower ? pair : best;
    }, pairs[0]);
}

function hasMoveButton(gamepad) {
    return gamepad?.buttons?.some((button, index) => {
        return MOVE_BUTTON_INDICES.has(index) && button?.pressed;
    });
}

export function getXrStickIntent(inputSources = []) {
    return Array.from(inputSources).reduce(
        (intent, source) => {
            const gamepad = source?.gamepad;
            if (!gamepad) return intent;

            if (hasMoveButton(gamepad)) {
                intent.moveY = -1;
            }

            if (!gamepad.axes?.length) return intent;

            const [rawX, rawY] = getAxisPair(gamepad.axes);
            const x = applyDeadZone(rawX);
            const y = applyDeadZone(rawY);
            const isRightHand = source.handedness === "right";

            if (isRightHand) {
                if (Math.abs(x) > Math.abs(intent.turnX)) intent.turnX = x;
                if (Math.abs(y) > Math.abs(intent.moveY)) intent.moveY = y;
                return intent;
            }

            if (Math.abs(x) + Math.abs(y) > Math.abs(intent.moveX) + Math.abs(intent.moveY)) {
                intent.moveX = x;
                intent.moveY = y;
            }

            return intent;
        },
        { moveX: 0, moveY: 0, turnX: 0 }
    );
}

export function toJoystickState({ moveX, moveY, turnX }) {
    const turnOnly = Math.abs(turnX) > Math.max(Math.abs(moveX), Math.abs(moveY), AXIS_DEAD_ZONE);
    const x = turnOnly ? turnX : moveX;
    const y = turnOnly ? 0 : -moveY;
    const distance = Math.min(Math.sqrt(x * x + y * y), 1);

    if (distance <= AXIS_DEAD_ZONE) {
        return { active: false, distance: 0, angle: 0, run: false };
    }

    return {
        active: true,
        distance,
        angle: Math.atan2(y, x),
        run: distance > 0.72 && !turnOnly,
    };
}
