import * as THREE from "three";

export const PATHFINDING_ALGORITHMS = {
  dijkstra: "dijkstra",
  astar: "astar",
  bfs: "bfs",
  dfs: "dfs",
};

function getDirection({ dx, dz }) {
  return `${Math.sign(dx)},${Math.sign(dz)}`;
}

export default class VisualizerAStarPathfinder {
  constructor(graph, { algorithm = PATHFINDING_ALGORITHMS.astar, maxIterations = 1200 } = {}) {
    this.graph = graph;
    this.algorithm = Object.values(PATHFINDING_ALGORITHMS).includes(algorithm)
      ? algorithm
      : PATHFINDING_ALGORITHMS.astar;
    this.maxIterations = maxIterations;
  }

  findPath(startWorld, goalWorld) {
    const start = this.graph.worldToNode(startWorld);
    const goal = this.graph.worldToNode(goalWorld);
    const grid = this.createGrid();
    const startNode = grid.get(this.graph.getKey(start));
    const goalNode = grid.get(this.graph.getKey(goal));
    if (!startNode || !goalNode || startNode.status === "wall" || goalNode.status === "wall") {
      return { path: [], visited: [] };
    }

    if (this.algorithm === PATHFINDING_ALGORITHMS.bfs || this.algorithm === PATHFINDING_ALGORITHMS.dfs) {
      return this.findFrontierPath(startNode, goalNode, grid);
    }

    startNode.distance = 0;
    startNode.direction = "right";
    startNode.heuristicDistance = this.manhattan(startNode, goalNode);
    startNode.totalDistance = this.getTotalDistance(startNode);
    const unvisited = Array.from(grid.values());
    const visited = [];
    let iterations = 0;

    while (unvisited.length && iterations++ < this.maxIterations) {
      const current = this.closestNode(unvisited);
      if (!current || current.distance === Infinity) break;
      if (current.status === "wall") continue;
      current.status = "visited";
      visited.push(current);
      if (current.id === goalNode.id) return { path: this.backtrack(goalNode), visited };
      this.updateNeighbors(current, goalNode, grid);
    }

    return { path: [], visited };
  }

  findFrontierPath(startNode, goalNode, grid) {
    const frontier = [startNode];
    const visited = [];
    let iterations = 0;

    startNode.status = "queued";

    while (frontier.length && iterations++ < this.maxIterations) {
      const current = this.algorithm === PATHFINDING_ALGORITHMS.dfs
        ? frontier.pop()
        : frontier.shift();

      if (!current || current.status === "visited" || current.status === "wall") continue;
      current.status = "visited";
      visited.push(current);
      if (current.id === goalNode.id) return { path: this.backtrack(goalNode), visited };

      for (const next of this.graph.getNeighbors(current)) {
        const neighbor = grid.get(this.graph.getKey(next));
        if (!neighbor || neighbor.status === "wall" || neighbor.status === "visited" || neighbor.status === "queued") {
          continue;
        }
        neighbor.previousNode = current;
        neighbor.status = "queued";
        frontier.push(neighbor);
      }
    }

    return { path: [], visited };
  }

  createGrid() {
    const nodes = new Map();
    const halfW = Math.floor(this.graph.width / 2);
    const halfD = Math.floor(this.graph.depth / 2);
    for (let z = -halfD; z <= halfD; z += 1) {
      for (let x = -halfW; x <= halfW; x += 1) {
        const world = this.graph.nodeToWorld({ x, z });
        const id = this.graph.getKey({ x, z });
        nodes.set(id, {
          id, x, z, world, status: this.graph.isWalkable({ x, z }) ? "default" : "wall",
          weight: 1, distance: Infinity, totalDistance: Infinity, heuristicDistance: null,
          direction: null, previousNode: null,
        });
      }
    }
    return nodes;
  }

  closestNode(nodes) {
    let bestIndex = -1;
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const best = nodes[bestIndex];
      if (!best || node.totalDistance < best.totalDistance ||
        (node.totalDistance === best.totalDistance && node.heuristicDistance < best.heuristicDistance)) {
        bestIndex = index;
      }
    }
    return bestIndex >= 0 ? nodes.splice(bestIndex, 1)[0] : null;
  }

  updateNeighbors(current, goal, grid) {
    for (const next of this.graph.getNeighbors(current)) {
      const neighbor = grid.get(this.graph.getKey(next));
      if (!neighbor || neighbor.status === "wall" || neighbor.status === "visited") continue;
      const direction = getDirection(next);
      const turnCost = current.direction && current.direction !== direction ? 1 : 0;
      const distance = current.distance + neighbor.weight + next.cost + turnCost;
      if (distance >= neighbor.distance) continue;
      neighbor.distance = distance;
      neighbor.previousNode = current;
      neighbor.direction = direction;
      neighbor.heuristicDistance = this.manhattan(neighbor, goal);
      neighbor.totalDistance = this.getTotalDistance(neighbor);
    }
  }

  getTotalDistance(node) {
    if (this.algorithm === PATHFINDING_ALGORITHMS.dijkstra) {
      return node.distance;
    }
    return node.distance + (node.heuristicDistance ?? 0);
  }

  backtrack(goal) {
    const path = [];
    let current = goal;
    while (current) {
      path.unshift(current.world.clone());
      current = current.previousNode;
    }
    return path;
  }

  manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }
}
