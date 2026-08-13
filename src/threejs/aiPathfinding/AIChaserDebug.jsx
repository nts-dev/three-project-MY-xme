import { useRapier } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import useInterface from "../../hooks/stores/useInterface.jsx";
import ChaserAgent from "./ChaserAgent";
import EnemyModel, { ENEMY_ANIMATIONS } from "./EnemyModel";
import GridGraph from "./GridGraph";
import RapierNavigationMap from "./RapierNavigationMap";
import VisualizerAStarPathfinder, { PATHFINDING_ALGORITHMS } from "./VisualizerAStarPathfinder";

const targetPosition = new THREE.Vector3();
const PATH_TILE_SIZE = 0.125;
const TARGET_ENDPOINT_CLEARANCE = 0.25;
const ARRIVAL_DISTANCE = 0.06;
const DEFAULT_IDLE_PATH_DELAY_MS = 5000;
const IDLE_MOVE_THRESHOLD = 0.05;
const ROTATION_LERP_SPEED = 12;
const DEFAULT_START = new THREE.Vector3(0, 0.0, 0);
const LEVEL_TILE_STEP = 0.1;
const RANDOM_SPAWN_ATTEMPTS = 24;
const ENEMY_COUNT = 3;
const GRAPH_SIZE = 320;
const MAX_PATH_ITERATIONS = 60000;
const ENEMY_ATTACK_DAMAGE = 10;
const ENEMY_ATTACK_INTERVAL_MS = 3000;
const PATH_LINE_Y = 0.015;
const AXIS_EPSILON = 0.001;
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const ENEMY_ALGORITHMS = [
  PATHFINDING_ALGORITHMS.dijkstra,
  PATHFINDING_ALGORITHMS.astar,
  PATHFINDING_ALGORITHMS.bfs,
  PATHFINDING_ALGORITHMS.dfs,
];
const ENEMY_PATH_COLORS = ["#fff36a", "#35d6ff", "#ff6ad5"];
const ENEMY_APPROACH_OFFSETS = [
  new THREE.Vector3(0.24, 0, 0),
  new THREE.Vector3(-0.24, 0, 0),
  new THREE.Vector3(0, 0, 0.24),
  new THREE.Vector3(0, 0, -0.24),
];

function applyEnemyDamage(avatarDefeatedRef) {
  const { hp, setHp, setHasDied } = useGame.getState();
  const nextHp = Math.max(0, (Number(hp) || 0) - ENEMY_ATTACK_DAMAGE);

  setHp(nextHp);
  if (nextHp <= 0) {
    avatarDefeatedRef.current = true;
    setHasDied(true);
  }
}

function readPosition(source, fallback) {
  const value = source?.current || source || fallback;
  const point = value?.translation?.() || value?.position || value;
  if (!point) return null;
  return targetPosition.set(point.x, point.y || 0.05, point.z);
}

function getPathToTarget(pathfinder, chaserPosition, target) {
  const graph = pathfinder.graph;
  const start = graph.findNearestWalkableWorld?.(chaserPosition) || chaserPosition;
  const goal = graph.findNearestWalkableWorld?.(target) || target;
  const result = pathfinder.findPath(start, goal);
  const basePath = orientPathFromTo(result.path || [], chaserPosition, target);
  const path = addOrthogonalTargetApproach(basePath, target, graph);
  if (!path.length) return { path: [], visited: result.visited || [] };
  return { path, visited: result.visited || [] };
}

function getFallbackPath(pathfinder, chaserPosition, target) {
  const graph = pathfinder.graph;
  const start = graph.findNearestWalkableWorld?.(chaserPosition) || chaserPosition;
  const goal = graph.findNearestWalkableWorld?.(target) || target;
  const result = pathfinder.findPath(start, goal);
  const basePath = orientPathFromTo(result.path || [], chaserPosition, target);
  return { path: addOrthogonalTargetApproach(basePath, target, graph), visited: result.visited || [] };
}

function orientPathFromTo(path, start, target) {
  if (path.length < 2) return path;

  const first = path[0];
  const last = path[path.length - 1];
  const normalScore = horizontalDistance(first, start) + horizontalDistance(last, target);
  const reversedScore = horizontalDistance(last, start) + horizontalDistance(first, target);
  return reversedScore < normalScore ? [...path].reverse() : path;
}

function anchorPathAtChaser(path, chaserPosition, target, graph) {
  const oriented = orientPathFromTo(path, chaserPosition, target);
  if (!oriented.length) return oriented;

  const first = oriented[0];
  if (horizontalDistance(first, chaserPosition) <= 0.001) return oriented;
  return [
    chaserPosition.clone(),
    ...getOrthogonalConnector(chaserPosition, first, graph),
    ...oriented.slice(1),
  ];
}

function addOrthogonalTargetApproach(path, target, graph) {
  if (!path.length) return path;

  const lastPoint = path[path.length - 1];
  if (horizontalDistance(lastPoint, target) <= 0.03) return path;

  const connector = getOrthogonalConnector(lastPoint, target, graph, TARGET_ENDPOINT_CLEARANCE);
  return connector.length ? [...path, ...connector] : path;
}

function insetEndpoint(from, to, inset) {
  const distance = from.distanceTo(to);
  if (distance <= inset) return from.clone();
  return from.clone().lerp(to, (distance - inset) / distance);
}

function horizontalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function isAxisAligned(from, to) {
  return Math.abs(from.x - to.x) <= AXIS_EPSILON || Math.abs(from.z - to.z) <= AXIS_EPSILON;
}

function canUseConnector(points, graph, endpointClearance = 0) {
  if (!graph) return true;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const isFinalSegment = index === points.length - 2;
    const checkPoint = isFinalSegment && endpointClearance > 0
      ? insetEndpoint(from, to, endpointClearance)
      : to;

    if (from.distanceTo(checkPoint) > AXIS_EPSILON && graph.segmentBlocked(from, checkPoint)) {
      return false;
    }
  }

  return true;
}

function getOrthogonalConnector(from, to, graph, endpointClearance = 0) {
  if (horizontalDistance(from, to) <= AXIS_EPSILON) return [];
  if (isAxisAligned(from, to)) {
    return canUseConnector([from, to], graph, endpointClearance) ? [to.clone()] : [];
  }

  const y = to.y || from.y;
  const xFirstCorner = new THREE.Vector3(to.x, y, from.z);
  const zFirstCorner = new THREE.Vector3(from.x, y, to.z);
  const xFirst = [from, xFirstCorner, to];
  const zFirst = [from, zFirstCorner, to];

  if (canUseConnector(xFirst, graph, endpointClearance)) return [xFirstCorner, to.clone()];
  if (canUseConnector(zFirst, graph, endpointClearance)) return [zFirstCorner, to.clone()];
  return [xFirstCorner, to.clone()];
}

function expandPathToTiles(path, step = 0.5) {
  const tiles = [];
  const seen = new Set();

  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const distance = start.distanceTo(end);
    const steps = Math.max(1, Math.ceil(distance / step));

    for (let tileIndex = 0; tileIndex <= steps; tileIndex += 1) {
      const point = start.clone().lerp(end, tileIndex / steps);
      const key = `${Math.round(point.x / step)},${Math.round(point.z / step)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tiles.push(point);
    }
  }

  const finalPoint = path[path.length - 1];
  const lastTile = tiles[tiles.length - 1];
  if (finalPoint && (!lastTile || lastTile.distanceTo(finalPoint) > 0.001)) {
    tiles.push(finalPoint.clone());
  }

  return tiles;
}

function getRandomGridSpawn(gridSize, graph, fallback = DEFAULT_START) {
  const gridX = Math.max(1, Math.floor(Number(gridSize?.x) || 1));
  const gridZ = Math.max(1, Math.floor(Number(gridSize?.z) || 1));
  const y = fallback.y || 0.05;
  let randomFallback = null;

  for (let attempt = 0; attempt < RANDOM_SPAWN_ATTEMPTS; attempt += 1) {
    const x = Math.floor(Math.random() * gridX);
    const z = Math.floor(Math.random() * gridZ);
    const point = new THREE.Vector3(x * LEVEL_TILE_STEP, y, z * LEVEL_TILE_STEP);
    randomFallback = point;

    if (!graph?.isWorldWalkable || graph.isWorldWalkable(point)) {
      return point;
    }

    const nearest = graph.findNearestWalkableWorld?.(point);
    if (nearest) {
      return nearest;
    }
  }

  return randomFallback || fallback.clone();
}

function getRandomEnemyAlgorithms(count) {
  const shuffled = [...ENEMY_ALGORITHMS].sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, index) =>
    shuffled[index % shuffled.length]
  );
}

function getRandomApproachOffsets(count) {
  const shuffled = ENEMY_APPROACH_OFFSETS
    .map((offset) => offset.clone())
    .sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, index) =>
    shuffled[index % shuffled.length].clone()
  );
}

function getApproachTarget(target, offset, graph) {
  const approachTarget = target.clone().add(offset);
  approachTarget.y = target.y;

  if (!graph?.isWorldWalkable || graph.isWorldWalkable(approachTarget)) {
    return approachTarget;
  }

  return graph.findNearestWalkableWorld?.(approachTarget) || target.clone();
}

function createChaserRuntime(position, speed, algorithm, approachOffset) {
  return {
    chaser: new ChaserAgent({ position, speed, waypointRadius: -0.01 }),
    algorithm,
    approachOffset,
    lastTarget: new THREE.Vector3(Infinity, 0, Infinity),
    lastPathTime: 0,
    idleTarget: new THREE.Vector3(Infinity, 0, Infinity),
    idleStartTime: null,
    activeChaseTarget: null,
    pendingPath: null,
    remainingPath: [],
    previousPosition: position.clone(),
    rotationYRef: { current: 0 },
    lastAttackTime: -Infinity,
    avatarDefeatedRef: { current: false },
  };
}

export default function AIChaserDebug({
  avatarRef,
  graph,
  start = DEFAULT_START,
  speed = 0.25,
  repathMs = 300,
  followDelayMs = 600,
  idlePathDelayMs = DEFAULT_IDLE_PATH_DELAY_MS,
  enabled = true,
}) {
  const { rapier, world } = useRapier();
  const ecctrlCharacterRef = useGame((state) => state.characterRef);
  const kinematicCharacterRef = useGame((state) => state.gameCharacterRef);
  const searchCenter = useGame((state) => state.searchCenter);
  const gridSize = useGame((state) => state.gridSize);
  const restart = useGame((state) => state.restart);
  const resetGame = useGame((state) => state.resetGame);
  const phase = useInterface((state) => state.phase);
  const navigationMap = useMemo(() => new RapierNavigationMap({ rapier, world }), [rapier, world]);
  
  const defaultGraph = useMemo(() => new GridGraph({
    width: GRAPH_SIZE,
    depth: GRAPH_SIZE,
    cellSize: 1,
    walkable: (node, worldPosition) => navigationMap.isWalkable(node, worldPosition),
    segmentBlocked: (startPoint, endPoint) => navigationMap.blocksSegment(startPoint, endPoint),
  }), [navigationMap]);
  const floorOnlyGraph = useMemo(() => new GridGraph({
    width: GRAPH_SIZE,
    depth: GRAPH_SIZE,
    cellSize: 1,
    walkable: (node, worldPosition) => navigationMap.hasFloor(node, worldPosition),
    segmentBlocked: (startPoint, endPoint) => navigationMap.blocksSegment(startPoint, endPoint),
  }), [navigationMap]);
  const pathfinder = useMemo(
    () => new VisualizerAStarPathfinder(graph || defaultGraph, { maxIterations: MAX_PATH_ITERATIONS }),
    [graph, defaultGraph]
  );
  const fallbackPathfinder = useMemo(
    () => new VisualizerAStarPathfinder(graph || floorOnlyGraph, { maxIterations: MAX_PATH_ITERATIONS }),
    [graph, floorOnlyGraph]
  );
  const enemyPathfinders = useMemo(
    () => Object.fromEntries(ENEMY_ALGORITHMS.map((algorithm) => [
      algorithm,
      new VisualizerAStarPathfinder(graph || defaultGraph, { algorithm, maxIterations: MAX_PATH_ITERATIONS }),
    ])),
    [graph, defaultGraph]
  );
  const enemyFallbackPathfinders = useMemo(
    () => Object.fromEntries(ENEMY_ALGORITHMS.map((algorithm) => [
      algorithm,
      new VisualizerAStarPathfinder(graph || floorOnlyGraph, { algorithm, maxIterations: MAX_PATH_ITERATIONS }),
    ])),
    [graph, floorOnlyGraph]
  );
  const lastCacheTime = useRef(-Infinity);
  const chaserStatesRef = useRef(null);
  const enemyAlgorithmsRef = useRef(null);
  const enemyApproachOffsetsRef = useRef(null);
  const enemyInstancesRef = useRef(null);
  const instanceMatrix = useMemo(() => new THREE.Matrix4(), []);
  const instanceQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const instanceScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const [illustrations, setIllustrations] = useState(() =>
    Array.from({ length: ENEMY_COUNT }, () => ({ path: [], visited: [] }))
  );
  const [enemyAnimations, setEnemyAnimations] = useState(() =>
    Array.from({ length: ENEMY_COUNT }, () => ENEMY_ANIMATIONS.walking)
  );
  const enemyAnimationRefs = useRef(Array.from({ length: ENEMY_COUNT }, () => ENEMY_ANIMATIONS.walking));

  if (!enemyAlgorithmsRef.current) {
    enemyAlgorithmsRef.current = getRandomEnemyAlgorithms(ENEMY_COUNT);
  }
  if (!enemyApproachOffsetsRef.current) {
    enemyApproachOffsetsRef.current = getRandomApproachOffsets(ENEMY_COUNT);
  }

  if (!chaserStatesRef.current) {
    chaserStatesRef.current = Array.from({ length: ENEMY_COUNT }, (_, index) =>
      createChaserRuntime(
        getRandomGridSpawn(gridSize, pathfinder.graph, start),
        speed,
        enemyAlgorithmsRef.current[index],
        enemyApproachOffsetsRef.current[index]
      )
    );
  }
  const chaserStates = chaserStatesRef.current;
  chaserStates.forEach((state) => {
    state.chaser.speed = speed;
  });

  const setEnemyAnimationIfChanged = (index, animationName) => {
    if (enemyAnimationRefs.current[index] === animationName) return;
    enemyAnimationRefs.current[index] = animationName;
    setEnemyAnimations((current) => {
      if (current[index] === animationName) return current;
      const next = [...current];
      next[index] = animationName;
      return next;
    });
  };

  const clearIllustration = (index) => {
    setIllustrations((current) => {
      const existing = current[index];
      if (!existing?.path.length && !existing?.visited.length) return current;
      const next = [...current];
      next[index] = { path: [], visited: [] };
      return next;
    });
  };

  const setIllustrationAt = (index, illustration) => {
    setIllustrations((current) => {
      const next = [...current];
      next[index] = illustration;
      return next;
    });
  };

  useEffect(() => {
    if (!enabled || !chaserStatesRef.current) return;

    const nextAlgorithms = getRandomEnemyAlgorithms(ENEMY_COUNT);
    const nextApproachOffsets = getRandomApproachOffsets(ENEMY_COUNT);
    enemyAlgorithmsRef.current = nextAlgorithms;
    enemyApproachOffsetsRef.current = nextApproachOffsets;
    chaserStatesRef.current.forEach((state, index) => {
      const spawn = getRandomGridSpawn(gridSize, pathfinder.graph, start);
      state.chaser.syncPosition(spawn);
      state.algorithm = nextAlgorithms[index];
      state.approachOffset = nextApproachOffsets[index];
      state.chaser.clearPath();
      state.previousPosition.copy(spawn);
      state.lastTarget.set(Infinity, 0, Infinity);
      state.idleTarget.set(Infinity, 0, Infinity);
      state.idleStartTime = null;
      state.activeChaseTarget = null;
      state.pendingPath = null;
      state.lastPathTime = 0;
      state.lastAttackTime = -Infinity;
      state.avatarDefeatedRef.current = false;
      state.rotationYRef.current = 0;
      setEnemyAnimationIfChanged(index, ENEMY_ANIMATIONS.walking);
    });
    setIllustrations(Array.from({ length: ENEMY_COUNT }, () => ({ path: [], visited: [] })));
  }, [enabled, gridSize?.x, gridSize?.z, pathfinder.graph, resetGame, restart, start.x, start.y, start.z]);

  useFrame(({ clock }, delta) => {
    if (!enabled) return;
    if (phase !== "playing") return;

    const fallbackTarget = kinematicCharacterRef || ecctrlCharacterRef || searchCenter;
    const target = readPosition(avatarRef, fallbackTarget);
    if (!target) return;

    const now = clock.elapsedTime * 1000;
    const firstChaser = chaserStates[0]?.chaser;
    navigationMap.setReferenceY(target.y || firstChaser?.position.y || 0);
    if (now - lastCacheTime.current > 1000) {
      navigationMap.clearCache();
      lastCacheTime.current = now;
    }

    chaserStates.forEach((state, index) => {
      const chaser = state.chaser;
      const hasIdleTarget = Number.isFinite(state.idleTarget.x);
      const movedSinceIdleTarget = hasIdleTarget && horizontalDistance(target, state.idleTarget) > IDLE_MOVE_THRESHOLD;
      const movedSinceLastFrame = horizontalDistance(target, state.lastTarget) > IDLE_MOVE_THRESHOLD;
      if (!hasIdleTarget || movedSinceIdleTarget || movedSinceLastFrame) {
        const reachedActiveTarget = state.activeChaseTarget &&
          horizontalDistance(chaser.position, state.activeChaseTarget) <= ARRIVAL_DISTANCE;
        const walkedAwayFromReachedTarget = reachedActiveTarget &&
          horizontalDistance(target, state.activeChaseTarget) > IDLE_MOVE_THRESHOLD;
        const shouldResetChase = !reachedActiveTarget || walkedAwayFromReachedTarget;

        state.idleTarget.copy(target);
        state.idleStartTime = now;
        if (shouldResetChase) {
          state.activeChaseTarget = null;
          state.pendingPath = null;
          state.lastAttackTime = -Infinity;
          state.avatarDefeatedRef.current = false;
          chaser.clearPath();
          clearIllustration(index);
          setEnemyAnimationIfChanged(index, ENEMY_ANIMATIONS.walking);
        }
        state.lastTarget.copy(target);
        return;
      }

      if (state.idleStartTime === null) {
        state.idleTarget.copy(target);
        state.idleStartTime = now;
      }

      const idleForMs = now - state.idleStartTime;
      const shouldPathToIdleTarget =
        idleForMs >= idlePathDelayMs &&
        !state.activeChaseTarget &&
        now - state.lastPathTime > repathMs;

      if (shouldPathToIdleTarget) {
        const exactTarget = state.idleTarget.clone();
        const approachTarget = getApproachTarget(exactTarget, state.approachOffset, pathfinder.graph);
        const enemyPathfinder = enemyPathfinders[state.algorithm] || pathfinder;
        const enemyFallbackPathfinder = enemyFallbackPathfinders[state.algorithm] || fallbackPathfinder;
        let result = getPathToTarget(enemyPathfinder, chaser.position, approachTarget);
        if (!result.path.length) result = getFallbackPath(enemyFallbackPathfinder, chaser.position, approachTarget);
        if (!result.path.length && horizontalDistance(approachTarget, exactTarget) > 0.001) {
          result = getPathToTarget(enemyPathfinder, chaser.position, exactTarget);
          if (!result.path.length) result = getFallbackPath(enemyFallbackPathfinder, chaser.position, exactTarget);
        }
        if (result.path.length) {
          const pathToAvatar = addOrthogonalTargetApproach(result.path, exactTarget, pathfinder.graph);
          const pathTiles = anchorPathAtChaser(
            expandPathToTiles(pathToAvatar, PATH_TILE_SIZE),
            chaser.position,
            exactTarget,
            pathfinder.graph
          );
          state.pendingPath = {
            path: pathTiles,
            releaseAt: now + followDelayMs,
          };
          setIllustrationAt(index, { path: pathTiles, visited: result.visited.map((node) => node.world) });
          state.activeChaseTarget = exactTarget;
          state.lastAttackTime = -Infinity;
          state.avatarDefeatedRef.current = false;
        }
        state.lastPathTime = now;
      }

      state.lastTarget.copy(target);

      if (state.pendingPath && now >= state.pendingPath.releaseAt) {
        chaser.setPath(state.pendingPath.path);
        state.pendingPath = null;
      }

      state.previousPosition.copy(chaser.position);
      chaser.update(delta);
      const moveDx = chaser.position.x - state.previousPosition.x;
      const moveDz = chaser.position.z - state.previousPosition.z;
      if (Math.hypot(moveDx, moveDz) > 0.001) {
        const nextRotationY = Math.atan2(moveDx, moveDz);
        state.rotationYRef.current = THREE.MathUtils.lerp(
          state.rotationYRef.current,
          nextRotationY,
          Math.min(1, delta * ROTATION_LERP_SPEED)
        );
      }
      const reachedTarget = state.activeChaseTarget &&
        horizontalDistance(chaser.position, state.activeChaseTarget) <= ARRIVAL_DISTANCE;
      const inContactWithAvatar = horizontalDistance(chaser.position, target) <= ARRIVAL_DISTANCE;

      if (reachedTarget && inContactWithAvatar) {
        if (!state.avatarDefeatedRef.current && now - state.lastAttackTime >= ENEMY_ATTACK_INTERVAL_MS) {
          applyEnemyDamage(state.avatarDefeatedRef);
          state.lastAttackTime = now;
        }

        setEnemyAnimationIfChanged(index, state.avatarDefeatedRef.current ? ENEMY_ANIMATIONS.walking : ENEMY_ANIMATIONS.jump);
      } else if (enemyAnimationRefs.current[index] === ENEMY_ANIMATIONS.jump) {
        state.lastAttackTime = -Infinity;
        setEnemyAnimationIfChanged(index, ENEMY_ANIMATIONS.walking);
      }

      if (!reachedTarget) {
        chaser.writeRemainingPath(state.remainingPath);
      }

      if (enemyInstancesRef.current) {
        instanceQuaternion.setFromAxisAngle(UP_AXIS, state.rotationYRef.current);
        instanceMatrix.compose(chaser.position, instanceQuaternion, instanceScale);
        enemyInstancesRef.current.setMatrixAt(index, instanceMatrix);
      }
    });

    if (enemyInstancesRef.current) {
      enemyInstancesRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <Suspense
        fallback={(
          <>
            {chaserStates.map((state, index) => (
              <mesh key={`ai-chaser-fallback-${index}`} name={`ai-chaser-${index}`} position={state.chaser.position}>
                <sphereGeometry args={[0.025, 12, 12]} />
                <meshBasicMaterial color="red" />
              </mesh>
            ))}
          </>
        )}
      >
        {chaserStates.map((state, index) => (
          <EnemyModel
            key={`ai-chaser-${index}`}
            name={`ai-chaser-${index}`}
            animationName={enemyAnimations[index]}
            loop={true}
            userData={{ camExcludeCollision: true }}
            worldPosition={state.chaser.position}
            rotationYRef={state.rotationYRef}
          />
        ))}
      </Suspense>
      <instancedMesh
        ref={enemyInstancesRef}
        name="ai-chaser-instances"
        args={[null, null, ENEMY_COUNT]}
        visible={false}
        userData={{ camExcludeCollision: true }}
      >
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshBasicMaterial color="red" />
      </instancedMesh>
      {illustrations.map((illustration, index) => illustration.path.length > 1 && (
        <Line
          key={`ai-chaser-path-${index}`}
          points={illustration.path.map((point) => [point.x, PATH_LINE_Y, point.z])}
          color={ENEMY_PATH_COLORS[index % ENEMY_PATH_COLORS.length]}
          lineWidth={10}
          transparent
          opacity={0.28}
          depthWrite={false}
          toneMapped={false}
        />
      ))}
    </>
  );
}
