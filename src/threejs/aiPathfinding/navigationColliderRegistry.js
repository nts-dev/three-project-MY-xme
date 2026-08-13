const colliders = new Map();

export function registerNavigationCollider(key, geometry, name) {
  if (!key || !geometry) return () => {};
  colliders.set(key, { geometry, name });
  return () => {
    if (colliders.get(key)?.geometry === geometry) colliders.delete(key);
  };
}

export function getNavigationColliders() {
  return Array.from(colliders.values());
}

export function clearNavigationColliders() {
  colliders.clear();
}
