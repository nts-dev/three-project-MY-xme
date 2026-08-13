const DEFAULT_MAX_CANDIDATES = 16;

function distanceSqPointToRaySegment(point, origin, direction, length) {
  const vx = point.x - origin.x;
  const vy = point.y - origin.y;
  const vz = point.z - origin.z;
  const projected = Math.max(
    0,
    Math.min(length, vx * direction.x + vy * direction.y + vz * direction.z)
  );
  const cx = origin.x + direction.x * projected;
  const cy = origin.y + direction.y * projected;
  const cz = origin.z + direction.z * projected;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const dz = point.z - cz;
  return dx * dx + dy * dy + dz * dz;
}

export function filterInteractionCandidates({
  records = [],
  origin,
  direction,
  length = 0.05,
  padding = 0.1,
  maxCandidates = DEFAULT_MAX_CANDIDATES,
}) {
  if (!origin || !direction || !Array.isArray(records) || records.length === 0) {
    return [];
  }

  const dirLen = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const normalizedDirection = {
    x: direction.x / dirLen,
    y: direction.y / dirLen,
    z: direction.z / dirLen,
  };

  const candidates = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;

    const radius = Math.max(0.01, Number(record.radius) || 0.01) + padding;
    const distanceSq = distanceSqPointToRaySegment(record, origin, normalizedDirection, length);
    if (distanceSq <= radius * radius) {
      candidates.push({ id: record.id, distanceSq });
    }
  }

  candidates.sort((a, b) => a.distanceSq - b.distanceSq);
  return candidates.slice(0, maxCandidates).map((candidate) => candidate.id);
}
