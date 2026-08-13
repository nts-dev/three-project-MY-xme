import * as THREE from "three";
import { getNavigationColliders } from "./navigationColliderRegistry";

const EXCLUDED_NAME = /character|player|ai-chaser|grid|floor|ground|line|sphere_dot/i;

export default class SceneObstacleMap {
  constructor({ radius = 0.25, height = 1.8, minObstacleHeight = 0.08 } = {}) {
    this.radius = radius;
    this.height = height;
    this.minObstacleHeight = minObstacleHeight;
    this.boxes = [];
    this.tempBox = new THREE.Box3();
  }

  rebuild(scene) {
    const navColliders = getNavigationColliders();
    if (navColliders.length) {
      this.rebuildFromNavigationColliders(navColliders);
      return;
    }

    this.boxes = [];
    scene.traverse((object) => {
      if (!this.shouldUse(object)) return;
      const box = this.tempBox.setFromObject(object);
      if (box.isEmpty()) return;
      const size = box.getSize(new THREE.Vector3());
      if (size.y < this.minObstacleHeight) return;
      this.boxes.push(box.clone());
    });
  }

  rebuildFromNavigationColliders(navColliders) {
    this.boxes = [];
    for (const collider of navColliders) {
      const geometry = collider.geometry;
      if (!geometry?.attributes?.position) continue;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (!geometry.boundingBox) continue;
      const box = geometry.boundingBox.clone();
      const size = box.getSize(new THREE.Vector3());
      if (size.y < this.minObstacleHeight) continue;
      this.boxes.push(box);
    }
  }

  blocks(position) {
    const minY = position.y - 0.05;
    const maxY = position.y + this.height;

    for (const box of this.boxes) {
      if (box.max.y < minY || box.min.y > maxY) continue;
      if (position.x < box.min.x - this.radius || position.x > box.max.x + this.radius) continue;
      if (position.z < box.min.z - this.radius || position.z > box.max.z + this.radius) continue;
      return true;
    }

    return false;
  }

  blocksSegment(start, end, step = 0.2) {
    const distance = start.distanceTo(end);
    const steps = Math.max(1, Math.ceil(distance / step));

    for (let index = 0; index <= steps; index += 1) {
      const point = start.clone().lerp(end, index / steps);
      if (this.blocks(point)) return true;
    }

    return false;
  }

  shouldUse(object) {
    if (!object?.isMesh || !object.visible) return false;
    if (EXCLUDED_NAME.test(object.name || "")) return false;
    if (EXCLUDED_NAME.test(object.parent?.name || "")) return false;
    if (object.userData?.camExcludeCollision) return false;
    if (object.material?.colorWrite === false) return false;
    return true;
  }
}
