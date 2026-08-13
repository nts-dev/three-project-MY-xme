import PriorityQueue from "./PriorityQueue";

export default class AStarPathfinder {
  constructor(graph, { maxIterations = 800 } = {}) {
    this.graph = graph;
    this.maxIterations = maxIterations;
  }

  findPath(startWorld, goalWorld) {
    const start = this.graph.worldToNode(startWorld);
    const goal = this.graph.worldToNode(goalWorld);
    const startKey = this.graph.getKey(start);
    const goalKey = this.graph.getKey(goal);
    const open = new PriorityQueue();
    const cameFrom = new Map();
    const gScore = new Map([[startKey, 0]]);
    const closed = new Set();
    let iterations = 0;

    open.push(start, 0);
    while (open.size && iterations++ < this.maxIterations) {
      const current = open.pop();
      const currentKey = this.graph.getKey(current);
      if (currentKey === goalKey) return this.reconstruct(cameFrom, currentKey);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);

      for (const neighbor of this.graph.getNeighbors(current)) {
        const key = this.graph.getKey(neighbor);
        if (closed.has(key)) continue;
        const nextCost = gScore.get(currentKey) + neighbor.cost;
        if (nextCost >= (gScore.get(key) ?? Infinity)) continue;
        cameFrom.set(key, currentKey);
        gScore.set(key, nextCost);
        open.push(neighbor, nextCost + this.graph.heuristic(neighbor, goal));
      }
    }

    return [];
  }

  reconstruct(cameFrom, key) {
    const path = [this.graph.nodeToWorld(this.graph.fromKey(key))];
    while (cameFrom.has(key)) {
      key = cameFrom.get(key);
      path.push(this.graph.nodeToWorld(this.graph.fromKey(key)));
    }
    return path.reverse();
  }
}
