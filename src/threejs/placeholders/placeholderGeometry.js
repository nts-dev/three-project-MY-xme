import * as THREE from "three";

const geometrySizeCache = new WeakMap();

export const getGeometrySize = (geometry) => {
  if (!geometry) return [1, 1, 1];

  const cached = geometrySizeCache.get(geometry);
  if (cached) return cached;

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return [1, 1, 1];

  const size = new THREE.Vector3();
  box.getSize(size);

  const result = [size.x + 0.01, size.y + 0.01, size.z + 0.01];
  geometrySizeCache.set(geometry, result);
  return result;
};
