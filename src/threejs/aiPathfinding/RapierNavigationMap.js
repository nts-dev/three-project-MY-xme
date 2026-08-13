export default class RapierNavigationMap {
  constructor({
    rapier,
    world,
    probeHeight = 2,
    probeDepth = 5,
    lineHeight = 0.35,
    clearanceRadius = 0.18,
    clearanceHeight = 0.45,
  } = {}) {
    this.rapier = rapier;
    this.world = world;
    this.probeHeight = probeHeight;
    this.probeDepth = probeDepth;
    this.lineHeight = lineHeight;
    this.clearanceRadius = clearanceRadius;
    this.clearanceHeight = clearanceHeight;
    this.clearanceShape = new rapier.Cuboid(clearanceRadius, clearanceHeight, clearanceRadius);
    this.referenceY = 0;
    this.walkableCache = new Map();
    this.floorCache = new Map();
    this.verticalRayOrigin = { x: 0, y: 0, z: 0 };
    this.verticalRay = new rapier.Ray(this.verticalRayOrigin, { x: 0, y: -1, z: 0 });
    this.segmentRayOrigin = { x: 0, y: 0, z: 0 };
    this.segmentRayDirection = { x: 0, y: 0, z: 0 };
    this.segmentRay = new rapier.Ray(this.segmentRayOrigin, this.segmentRayDirection);
    this.clearanceShapePosition = { x: 0, y: 0, z: 0 };
    this.clearanceShapeRotation = { x: 0, y: 0, z: 0, w: 1 };
  }

  setReferenceY(y = 0) {
    this.referenceY = y;
  }

  clearCache() {
    this.walkableCache.clear();
    this.floorCache.clear();
  }

  isWalkable(node, position) {
    const key = `${node.x},${node.z},${Math.round(this.referenceY * 10)}`;
    if (this.walkableCache.has(key)) return this.walkableCache.get(key);

    const ray = this.verticalRay;
    ray.origin.x = position.x;
    ray.origin.y = this.referenceY + this.probeHeight;
    ray.origin.z = position.z;
    const hit = this.world.castRay(ray, this.probeHeight + this.probeDepth, true);
    const groundToi = hit?.timeOfImpact ?? hit?.toi ?? this.probeHeight;
    const walkable = Boolean(hit) && !this.hasClearanceObstacle(position, groundToi);
    this.walkableCache.set(key, walkable);
    return walkable;
  }

  hasFloor(node, position) {
    const key = `${node.x},${node.z},floor,${Math.round(this.referenceY * 10)}`;
    if (this.floorCache.has(key)) return this.floorCache.get(key);

    const ray = this.verticalRay;
    ray.origin.x = position.x;
    ray.origin.y = this.referenceY + this.probeHeight;
    ray.origin.z = position.z;
    const walkable = Boolean(this.world.castRay(ray, this.probeHeight + this.probeDepth, true));
    this.floorCache.set(key, walkable);
    return walkable;
  }

  hasClearanceObstacle(position, groundToi = this.probeHeight) {
    const groundY = this.referenceY + this.probeHeight - groundToi;
    const shapePos = this.clearanceShapePosition;
    shapePos.x = position.x;
    shapePos.y = groundY + this.clearanceHeight + 0.05;
    shapePos.z = position.z;
    const hit = this.world.intersectionWithShape(shapePos, this.clearanceShapeRotation, this.clearanceShape);
    return Boolean(hit);
  }

  blocksSegment(start, end) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= 0.001) return false;

    const ray = this.segmentRay;
    ray.origin.x = start.x;
    ray.origin.y = this.referenceY + this.lineHeight;
    ray.origin.z = start.z;
    ray.dir.x = dx / distance;
    ray.dir.y = 0;
    ray.dir.z = dz / distance;
    return Boolean(this.world.castRay(ray, distance, true));
  }
}
