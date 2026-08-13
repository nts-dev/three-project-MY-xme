const JOY_AXIS_MARGIN = 0.15;

export function calcFallDamagePct(units) {
  return Math.min(100, 10 + 5 * (units - 0.4));
}

export function hasLadderText(value) {
  if (!value) return false;
  return String(value).toLowerCase().includes("ladder");
}

export function getRayHitMeta(hit) {
  const col = hit?.collider;
  if (!col) return { object: null, name: "" };

  const parentRb = typeof col.parent === "function" ? col.parent() : null;
  const object =
    parentRb?.userData?.object ||
    parentRb?.userData?.rigidBodyObject ||
    parentRb?.userData ||
    col?.userData?.object ||
    col?.userData ||
    parentRb ||
    col ||
    null;

  const hitName =
    parentRb?.userData?.name ||
    parentRb?.name ||
    col?.userData?.name ||
    col?.name ||
    object?.name ||
    "";

  return { object, name: String(hitName) };
}

export function getJoystickDirection(angleRad, previousDirection = null) {
  const x = Math.cos(angleRad);
  const y = Math.sin(angleRad);
  const absX = Math.abs(x);
  const absY = Math.abs(y);

  if (absY > absX + JOY_AXIS_MARGIN) return y > 0 ? "forward" : "backward";
  if (absX > absY + JOY_AXIS_MARGIN) return x > 0 ? "right" : "left";
  return previousDirection;
}

export function getColliderHandleValue(col) {
  if (!col) return null;
  if (typeof col.handle === "function") {
    const value = col.handle();
    return value === undefined || value === null ? null : String(value);
  }

  const value = col.handle;
  return value === undefined || value === null ? null : String(value);
}
