import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Your original helpers (unchanged)
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
    const bestPower = Math.abs(best[0]) + Math.abs(best[1]);
    const pairPower = Math.abs(pair[0]) + Math.abs(pair[1]);
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
        intent.moveY = -1; // forward
      }

      if (!gamepad.axes?.length) return intent;

      const [rawX, rawY] = getAxisPair(gamepad.axes);
      const x = applyDeadZone(rawX);
      const y = applyDeadZone(rawY);
      const isRightHand = source.handedness === 'right';

      if (isRightHand) {
        if (Math.abs(x) > Math.abs(intent.turnX)) intent.turnX = x;
        if (Math.abs(y) > Math.abs(intent.moveY)) intent.moveY = y;
        return intent;
      }

      // left hand (or unknown) → movement
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
  const y = turnOnly ? 0 : -moveY; // invert so stick-up = forward
  const distance = Math.min(Math.sqrt(x * x + y * y), 1);

  if (distance <= AXIS_DEAD_ZONE) {
    return { active: false, distance: 0, angle: 0, run: false };
  }

  return {
    active: true,
    distance,
    angle: Math.atan2(y, x), // radians, 0 = +X (right)
    run: distance > 0.72 && !turnOnly,
  };
}

// ---------------------------------------------------------------------------
// Correct locomotion component
export class XrLocomotion {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Camera} camera          – the XR camera (usually scene.camera)
   * @param {Object} [options]
   * @param {number} [options.walkSpeed=1.4]
   * @param {number} [options.runSpeed=3.0]
   * @param {number} [options.turnSpeed=2.2]  – rad/s for smooth turn
   * @param {boolean} [options.snapTurn=false]
   * @param {number} [options.snapAngle=Math.PI/6]
   */
  constructor(renderer, camera, options = {}) {
    this.renderer = renderer;
    this.camera = camera;

    this.walkSpeed = options.walkSpeed ?? 1.4;
    this.runSpeed = options.runSpeed ?? 3.0;
    this.turnSpeed = options.turnSpeed ?? 2.2;
    this.snapTurn = options.snapTurn ?? false;
    this.snapAngle = options.snapAngle ?? Math.PI / 6;

    // Dolly that we actually translate / rotate.
    // The XR camera must be a child of this object (or of XROrigin).
    this.dolly = new THREE.Group();
    this.dolly.name = 'xr-dolly';
    this.dolly.add(camera); // or add your existing XROrigin / player root

    // Scratch objects
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._move = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._quat = new THREE.Quaternion();
    this._lastSnap = 0;
  }

  /** Call every frame (inside your animation loop / useFrame) */
  update(delta, inputSources) {
    if (!this.renderer.xr.isPresenting) return;

    const intent = getXrStickIntent(inputSources);
    const stick = toJoystickState(intent);

    // ------------------------------------------------------------------
    // 1. Smooth / snap turning (right stick X)
    // ------------------------------------------------------------------
    if (Math.abs(intent.turnX) > AXIS_DEAD_ZONE) {
      if (this.snapTurn) {
        const now = performance.now();
        if (now - this._lastSnap > 250) {
          const dir = Math.sign(intent.turnX);
          this.dolly.rotation.y -= dir * this.snapAngle;
          this._lastSnap = now;
        }
      } else {
        this.dolly.rotation.y -= intent.turnX * this.turnSpeed * delta;
      }
    }

    // ------------------------------------------------------------------
    // 2. Movement relative to HEADING (camera yaw only)
    // ------------------------------------------------------------------
    if (!stick.active) return;

    // Get camera world direction, flatten to horizontal plane
    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    this._forward.normalize();

    // Right vector (also horizontal)
    this._right.crossVectors(this._forward, this.camera.up).normalize();

    // Convert polar stick → cartesian in camera space
    // angle 0 = +X (right), angle π/2 = +Y (forward after invert)
    const speed = (stick.run ? this.runSpeed : this.walkSpeed) * stick.distance;
    const sx = Math.cos(stick.angle); // right / left
    const sz = Math.sin(stick.angle); // forward / back

    this._move
      .set(0, 0, 0)
      .addScaledVector(this._right, sx * speed * delta)
      .addScaledVector(this._forward, sz * speed * delta);

    // Apply to the dolly (this is the real “dolly”, never touch camera.position)
    this.dolly.position.add(this._move);

    // Optional: keep player on the ground (simple version)
    // this.dolly.position.y = 0;   // or raycast against floor
  }
}