import * as THREE from "three";

const tmp = new THREE.Vector3();
const stepDirection = new THREE.Vector3();

export default class ChaserAgent {
  constructor({ position = new THREE.Vector3(), speed = 3, waypointRadius } = {}) {
    this.position = position.clone();
    this.speed = speed;
    this.waypointRadius = waypointRadius;
    this.path = [];
    this.index = 0;
  }

  setPath(path) {
    this.path = path || [];
    this.index = this.path.length > 1 ? 1 : 0;
  }

  clearPath() {
    this.path = [];
    this.index = 0;
  }

  syncPosition(position) {
    this.position.set(position.x, position.y || this.position.y, position.z);
  }

  getVelocity() {
    const target = this.path[this.index];
    if (!target) return tmp.set(0, 0, 0);

    tmp.copy(target).sub(this.position);
    tmp.y = 0;
    const distance = tmp.length();
    if (distance <= this.waypointRadius) {
      this.index += 1;
      return this.getVelocity();
    }

    return tmp.normalize().multiplyScalar(this.speed);
  }

  update(delta) {
    let remainingStep = this.speed * delta;

    while (remainingStep > 0) {
      const target = this.path[this.index];
      if (!target) return this.position;

      stepDirection.copy(target).sub(this.position);
      stepDirection.y = 0;
      const distance = stepDirection.length();

      if (distance <= this.waypointRadius || distance <= remainingStep) {
        this.position.set(target.x, target.y || this.position.y, target.z);
        this.index += 1;
        remainingStep -= distance;
        continue;
      }

      this.position.addScaledVector(stepDirection.normalize(), remainingStep);
      return this.position;
    }

    return this.position;
  }

  getRemainingPath() {
    return [this.position.clone(), ...this.path.slice(this.index)];
  }

  writeRemainingPath(target) {
    target.length = 0;
    target.push(this.position);
    for (let index = this.index; index < this.path.length; index += 1) {
      target.push(this.path[index]);
    }
    return target;
  }
}
