import * as THREE from "three";

const DIRECTIONS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
];

export default class GridGraph {
  constructor({
    width = 40,
    depth = 40,
    cellSize = 1,
    origin = new THREE.Vector3(),
    walkable,
    segmentBlocked,
  } = {}) {
    this.width = width;
    this.depth = depth;
    this.cellSize = cellSize;
    this.origin = origin.clone();
    this.walkable = walkable || (() => true);
    this.segmentBlocked = segmentBlocked || (() => false);
  }

  getKey(node) {
    return `${node.x},${node.z}`;
  }

  fromKey(key) {
    const [x, z] = key.split(",").map(Number);
    return { x, z };
  }

  worldToNode(position) {
    const x = Math.round((position.x - this.origin.x) / this.cellSize);
    const z = Math.round((position.z - this.origin.z) / this.cellSize);
    return this.clamp({ x, z });
  }

  nodeToWorld(node, y = 0.05) {
    return new THREE.Vector3(
      this.origin.x + node.x * this.cellSize,
      y,
      this.origin.z + node.z * this.cellSize
    );
  }

  getNeighbors(node) {
    return DIRECTIONS.map(([dx, dz, cost]) => ({ x: node.x + dx, z: node.z + dz, cost, dx, dz }))
      .filter((next) => this.canMove(node, next));
  }

  canMove(from, to) {
    const dx = to.dx ?? to.x - from.x;
    const dz = to.dz ?? to.z - from.z;
    if (!this.isWalkable(to)) return false;
    if (this.segmentBlocked(this.nodeToWorld(from), this.nodeToWorld(to))) return false;
    if (dx === 0 || dz === 0) return true;
    return this.isWalkable({ x: from.x + dx, z: from.z })
      && this.isWalkable({ x: from.x, z: from.z + dz })
      && !this.segmentBlocked(this.nodeToWorld(from), this.nodeToWorld({ x: from.x + dx, z: from.z }))
      && !this.segmentBlocked(this.nodeToWorld(from), this.nodeToWorld({ x: from.x, z: from.z + dz }));
  }

  isWalkable(node) {
    return this.inBounds(node) && this.walkable(node, this.nodeToWorld(node));
  }

  isWorldWalkable(position) {
    return this.isWalkable(this.worldToNode(position));
  }

  findNearestWalkableWorld(position, maxRadius = 8) {
    const center = this.worldToNode(position);
    if (this.isWalkable(center)) return position.clone();

    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        for (let z = -radius; z <= radius; z += 1) {
          if (Math.abs(x) !== radius && Math.abs(z) !== radius) continue;
          const node = { x: center.x + x, z: center.z + z };
          if (this.isWalkable(node)) return this.nodeToWorld(node, position.y || 0.05);
        }
      }
    }

    return null;
  }

  heuristic(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  inBounds(node) {
    const halfW = Math.floor(this.width / 2);
    const halfD = Math.floor(this.depth / 2);
    return node.x >= -halfW && node.x <= halfW && node.z >= -halfD && node.z <= halfD;
  }

  clamp(node) {
    const halfW = Math.floor(this.width / 2);
    const halfD = Math.floor(this.depth / 2);
    return {
      x: Math.max(-halfW, Math.min(halfW, node.x)),
      z: Math.max(-halfD, Math.min(halfD, node.z)),
    };
  }
}
