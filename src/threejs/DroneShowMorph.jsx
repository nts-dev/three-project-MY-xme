import React, { useEffect, useMemo, useRef, useState } from "react";
import useGame from "../hooks/useGame";
import gsap from "gsap";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { buildMorphPointTargets, filterMorphAssetsByPlacements, getMorphTargetPlacements, morphCategoryMatchesTarget, normalizeMorphName } from "./dslMorphUtils";
import { getSceneAssetDescriptor } from "./generatedAssetPaths";
import GpgpuBirdFlock from "./GpgpuBirdFlock";

const fbxLoader = new FBXLoader();
const gltfLoader = new GLTFLoader();
const morphModelCache = new Map();
const WORLD_SCALE = 0.01;
const LEVEL_GRID_TILE_SCALE = 0.01;
const LEVEL_GRID_UNIT_SCALE = 0.1;
const LEVEL_GRID_TILE_SIZE = 100;
const LEVEL_GRID_GAP = 0;
const LEVEL_GRID_STEP = (LEVEL_GRID_TILE_SIZE + LEVEL_GRID_GAP) * LEVEL_GRID_UNIT_SCALE * LEVEL_GRID_TILE_SCALE;
const BUILT_IN_PLANE_SPACING = LEVEL_GRID_STEP;
const BUILT_IN_SPHERE_RADIUS = LEVEL_GRID_STEP;
const BUILT_IN_HELIX_RADIUS = LEVEL_GRID_STEP * 0.35;
const BUILT_IN_HELIX_HEIGHT = LEVEL_GRID_STEP * 2;
const rainbowColorCache = new Map();
const TARGET_GRID_FILL_RATIO = 0.94;
const TARGET_GRID_HEIGHT_RATIO = 1.0;
const BIRD_COUNT_MIN = 72;
const BIRD_COUNT_MAX = 220;
const BIRD_WING_SPAN = 0.018;
const BIRD_FLAP_AMPLITUDE = 0.014;
const BIRD_HOVER_RADIUS = 0.7;
const BIRD_PREDATOR_FORCE = 5.2;
const BIRD_SWIPE_FORCE = 3.8;
const BIRD_POINTER_ACTIVE_MS = 220;
const BIRD_WORLD_POINTER_LERP = 0.24;
const BIRD_TINT = new THREE.Color(0xff2200);

const BIRD_VERTEX_SHADER = `
attribute vec3 color;
varying vec3 vColor;
varying float vDepth;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vColor = color;
  vDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const BIRD_FRAGMENT_SHADER = `
uniform vec3 uTint;
varying vec3 vColor;
varying float vDepth;

void main() {
  float shade = 0.2 + (1000.0 - vDepth) / 1000.0 * vColor.r;
  vec3 color = mix(vec3(shade), uTint, 0.22);
  gl_FragColor = vec4(color, 0.96);
}
`;

function getGridWorldSpan(gridSize) {
  const cellsX = Math.max(1, Number(gridSize?.x) || 1);
  const cellsY = Math.max(1, Number(gridSize?.y) || 1);
  const cellsZ = Math.max(1, Number(gridSize?.z) || 1);
  const tileVisualSpan = LEVEL_GRID_TILE_SCALE;

  return {
    x: Math.max(tileVisualSpan, (cellsX - 1) * LEVEL_GRID_STEP + tileVisualSpan),
    y: Math.max(tileVisualSpan, (cellsY - 1) * LEVEL_GRID_STEP + tileVisualSpan),
    z: Math.max(tileVisualSpan, (cellsZ - 1) * LEVEL_GRID_STEP + tileVisualSpan),
  };
}

function computeBounds(positions) {
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
  };

  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index];
    const y = positions[index + 1];
    const z = positions[index + 2];
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.minZ = Math.min(bounds.minZ, z);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.maxZ = Math.max(bounds.maxZ, z);
  }

  return bounds;
}

function scaleTargetPositionsToGrid(positions, gridSize) {
  if (!positions?.length) {
    return positions;
  }

  const bounds = computeBounds(positions);
  const sizeX = Math.max(1e-6, bounds.maxX - bounds.minX);
  const sizeY = Math.max(1e-6, bounds.maxY - bounds.minY);
  const sizeZ = Math.max(1e-6, bounds.maxZ - bounds.minZ);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const gridSpan = getGridWorldSpan(gridSize);
  const targetSpanX = gridSpan.x * TARGET_GRID_FILL_RATIO;
  const targetSpanY = gridSpan.y * TARGET_GRID_HEIGHT_RATIO;
  const targetSpanZ = gridSpan.z * TARGET_GRID_FILL_RATIO;
  const horizontalScale = Math.min(targetSpanX / sizeX, targetSpanZ / sizeZ);
  const verticalScale = targetSpanY / sizeY;
  const targetCenterX = gridSpan.x / 2;
  const targetCenterZ = gridSpan.z / 2;
  const next = positions.slice();

  for (let index = 0; index < next.length; index += 3) {
    next[index] = (next[index] - centerX) * horizontalScale + targetCenterX;
    next[index + 1] = (next[index + 1] - bounds.minY) * verticalScale;
    next[index + 2] = (next[index + 2] - centerZ) * horizontalScale + targetCenterZ;
  }

  return next;
}

function scaleTargetsToGrid(targets, gridSize) {
  return targets.map((target) => ({
    ...target,
    positions: scaleTargetPositionsToGrid(target.positions, gridSize),
  }));
}


function buildPlanePositions(count, spacing = BUILT_IN_PLANE_SPACING) {
  const gridSize = Math.ceil(Math.sqrt(count));
  const offset = ((gridSize - 1) * spacing) / 2;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (i % gridSize) * spacing - offset;
    positions[i * 3 + 1] = Math.floor(i / gridSize) * spacing - offset;
    positions[i * 3 + 2] = 0;
  }

  return positions;
}

function buildSpherePositions(count, radius = BUILT_IN_SPHERE_RADIUS) {
  const positions = new Float32Array(count * 3);
  const phi = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;

    positions[i * 3] = Math.cos(theta) * r * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(theta) * r * radius;
  }

  return positions;
}

function buildHelixPositions(count, radius = BUILT_IN_HELIX_RADIUS, height = BUILT_IN_HELIX_HEIGHT, turns = 3) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const progress = i / Math.max(1, count - 1);
    const angle = progress * Math.PI * 2 * turns;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = progress * height - height / 2;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }

  return positions;
}

function getRainbowColors(count) {
  if (rainbowColorCache.has(count)) {
    return rainbowColorCache.get(count);
  }

  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    color.setHSL(i / Math.max(1, count), 0.7, 0.5);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  rainbowColorCache.set(count, colors);
  return colors;
}

function lerpPositionBuffers(target, from, to, progress) {
  const inverse = 1 - progress;
  for (let index = 0; index < target.length; index += 1) {
    target[index] = from[index] * inverse + to[index] * progress;
  }
}

function copyBuffer(target, source) {
  target.set(source);
}

function toWorldPlacement(placement) {
  return {
    x: Number(placement?.x || 0) * WORLD_SCALE,
    y: Number(placement?.z || 0) * WORLD_SCALE,
    z: Number(placement?.y || 0) * WORLD_SCALE,
  };
}

function offsetPositions(basePositions, placements) {
  const centers = Array.isArray(placements) && placements.length ? placements : [{ x: 0, y: 0, z: 0 }];
  const positions = new Float32Array(basePositions.length);
  const groupSize = Math.floor(basePositions.length / 3 / centers.length) || 1;

  for (let index = 0; index < basePositions.length / 3; index += 1) {
    const center = toWorldPlacement(centers[Math.min(centers.length - 1, Math.floor(index / groupSize))]);
    positions[index * 3] = basePositions[index * 3] + center.x;
    positions[index * 3 + 1] = basePositions[index * 3 + 1] + center.y;
    positions[index * 3 + 2] = basePositions[index * 3 + 2] + center.z;
  }

  return positions;
}

function getFallbackPlacements(morph) {
  const placements = morph?.targetPlacements || {};
  for (const value of Object.values(placements)) {
    if (Array.isArray(value) && value.length) {
      return value;
    }
  }
  return [];
}

function computeCentroid(positions) {
  const centroid = { x: 0, y: 0, z: 0 };
  const count = Math.max(1, Math.floor((positions?.length || 0) / 3));

  for (let index = 0; index < positions.length; index += 3) {
    centroid.x += positions[index];
    centroid.y += positions[index + 1];
    centroid.z += positions[index + 2];
  }

  centroid.x /= count;
  centroid.y /= count;
  centroid.z /= count;
  return centroid;
}

function translatePositions(positions, offset) {
  const translated = positions.slice();
  for (let index = 0; index < translated.length; index += 3) {
    translated[index] += offset.x;
    translated[index + 1] += offset.y;
    translated[index + 2] += offset.z;
  }
  return translated;
}

function createBuiltInTarget(name, count, morph, colors) {
  const normalized = normalizeMorphName(name);
  const placements = getMorphTargetPlacements(morph, name);
  const fallbackPlacements = placements.length ? placements : getFallbackPlacements(morph);

  if (normalized === "plane") {
    return {
      name: "plane",
      positions: offsetPositions(buildPlanePositions(count, BUILT_IN_PLANE_SPACING), fallbackPlacements),
      colors,
      builtIn: normalized
    };
  }

  if (normalized === "sphere") {
    return {
      name: "sphere",
      positions: offsetPositions(buildSpherePositions(count, BUILT_IN_SPHERE_RADIUS), fallbackPlacements),
      colors,
      builtIn: normalized
    };
  }

  if (normalized === "helix") {
    return {
      name: "helix",
      positions: offsetPositions(buildHelixPositions(count, BUILT_IN_HELIX_RADIUS, BUILT_IN_HELIX_HEIGHT, 3), fallbackPlacements),
      colors,
      builtIn: normalized
    };
  }

  return null;
}

function buildBirdGeometry(count) {
  const trianglesPerBird = 3;
  const verticesPerBird = trianglesPerBird * 3;
  const positions = new Float32Array(count * verticesPerBird * 3);
  const colors = new Float32Array(count * verticesPerBird * 3);

  for (let birdIndex = 0; birdIndex < count; birdIndex += 1) {
    const vertexOffset = birdIndex * verticesPerBird * 3;
    const template = [
      0, 0, -0.022,
      0, 0.004, -0.022,
      0, 0, 0.032,

      0, 0, -0.016,
      -BIRD_WING_SPAN, 0, 0,
      0, 0, 0.016,

      0, 0, 0.016,
      BIRD_WING_SPAN, 0, 0,
      0, 0, -0.016,
    ];

    positions.set(template, vertexOffset);

    const shade = 0.4 + (birdIndex / Math.max(1, count)) * 0.4;
    for (let i = 0; i < verticesPerBird; i += 1) {
      const colorOffset = vertexOffset + i * 3;
      colors[colorOffset] = shade;
      colors[colorOffset + 1] = shade;
      colors[colorOffset + 2] = shade;
    }
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  return {
    geometry,
    basePositions: positions.slice(),
  };
}

function rotateBirdVertex(vertex, velocity) {
  const speed = velocity.length();
  if (speed < 1e-5) {
    return vertex.clone();
  }

  const direction = velocity.clone().normalize();
  const yaw = Math.atan2(direction.x, direction.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
  return vertex.clone().applyEuler(new THREE.Euler(-pitch, yaw, 0, "YXZ"));
}

function BirdFlockCloud({ morph, visible }) {
  const geometryRef = useRef();
  const materialRef = useRef();
  const birdsRef = useRef([]);
  const pointerRef = useRef({
    ndc: new THREE.Vector2(10000, 10000),
    velocity: new THREE.Vector2(),
    lastTime: 0,
  });
  const pointerWorldRef = useRef(new THREE.Vector3(10000, 10000, 10000));
  const gridSize = useGame((state) => state.gridSize);

  const flockConfig = useMemo(() => {
    const gridSpan = getGridWorldSpan(gridSize);
    return {
      center: new THREE.Vector3(gridSpan.x / 2, gridSpan.y / 2, gridSpan.z / 2),
      bounds: {
        x: Math.max(0.08, gridSpan.x * 0.5 * TARGET_GRID_FILL_RATIO),
        y: Math.max(0.06, gridSpan.y * 0.44 * TARGET_GRID_HEIGHT_RATIO),
        z: Math.max(0.08, gridSpan.z * 0.5 * TARGET_GRID_FILL_RATIO),
      },
    };
  }, [gridSize]);

  const birdCount = useMemo(() => {
    const requested = Math.floor(Number(morph?.pointCount || 120));
    return THREE.MathUtils.clamp(requested, BIRD_COUNT_MIN, BIRD_COUNT_MAX);
  }, [morph?.pointCount]);

  const birdGeometry = useMemo(() => buildBirdGeometry(birdCount), [birdCount]);

  useEffect(() => {
    birdsRef.current = new Array(birdCount).fill(null).map(() => ({
      position: new THREE.Vector3(
        flockConfig.center.x + (Math.random() - 0.5) * flockConfig.bounds.x * 1.8,
        flockConfig.center.y + (Math.random() - 0.5) * flockConfig.bounds.y * 1.8,
        flockConfig.center.z + (Math.random() - 0.5) * flockConfig.bounds.z * 1.8,
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.18,
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.18,
      ),
      phase: Math.random() * Math.PI * 2,
    }));
  }, [birdCount, flockConfig]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const nextX = event.clientX / window.innerWidth * 2 - 1;
      const nextY = -(event.clientY / window.innerHeight) * 2 + 1;
      const now = performance.now();
      const elapsed = Math.max(16, now - (pointerRef.current.lastTime || now));
      const dx = nextX - pointerRef.current.position.x;
      const dy = nextY - pointerRef.current.position.y;

      pointerRef.current.velocity.set(
        THREE.MathUtils.clamp(dx / elapsed * 16, -1.8, 1.8),
        THREE.MathUtils.clamp(dy / elapsed * 16, -1.8, 1.8),
      );
      pointerRef.current.ndc.set(nextX, nextY);
      pointerRef.current.lastTime = now;
    };

    const resetPointer = () => {
      pointerRef.current.ndc.set(10000, 10000);
      pointerRef.current.velocity.set(0, 0);
      pointerRef.current.lastTime = 0;
      pointerWorldRef.current.set(10000, 10000, 10000);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("mouseleave", resetPointer);
    window.addEventListener("blur", resetPointer);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mouseleave", resetPointer);
      window.removeEventListener("blur", resetPointer);
    };
  }, []);

  useEffect(() => () => birdGeometry.geometry.dispose(), [birdGeometry]);

  useFrame((state, delta) => {
    if (!visible || !geometryRef.current || !birdsRef.current.length) {
      return;
    }

    const dt = Math.min(delta, 0.05);
    const geometry = geometryRef.current;
    const positionAttribute = geometry.getAttribute("position");
    const positionArray = positionAttribute.array;
    const pointerState = pointerRef.current;
    const pointer = pointerState.ndc;
    const pointerWorld = pointerWorldRef.current;
    const pointerVelocityWorld = new THREE.Vector3(
      pointerState.velocity.x * flockConfig.bounds.x,
      pointerState.velocity.y * flockConfig.bounds.y,
      0,
    );
    const pointerActive = performance.now() - pointerState.lastTime < BIRD_POINTER_ACTIVE_MS;
    const now = state.clock.getElapsedTime();

    if (pointerActive && Math.abs(pointer.x) <= 1.2 && Math.abs(pointer.y) <= 1.2) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -flockConfig.center.z);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, state.camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, hit)) {
        pointerWorld.lerp(hit, BIRD_WORLD_POINTER_LERP);
      }
    }

    for (let i = 0; i < birdsRef.current.length; i += 1) {
      const bird = birdsRef.current[i];
      const separation = new THREE.Vector3();
      const alignment = new THREE.Vector3();
      const cohesion = new THREE.Vector3();
      let neighborCount = 0;

      for (let j = 0; j < birdsRef.current.length; j += 1) {
        if (i === j) continue;
        const other = birdsRef.current[j];
        const offset = new THREE.Vector3().subVectors(other.position, bird.position);
        const distance = offset.length();
        if (distance < 1e-5 || distance > 0.22) continue;

        neighborCount += 1;
        alignment.add(other.velocity);
        cohesion.add(other.position);

        if (distance < 0.08) {
          separation.sub(offset.normalize().multiplyScalar((0.08 - distance) / 0.08));
        }
      }

      if (neighborCount > 0) {
        alignment.divideScalar(neighborCount).sub(bird.velocity).multiplyScalar(0.32);
        cohesion.divideScalar(neighborCount).sub(bird.position).multiplyScalar(0.08);
      }

      const centerPull = new THREE.Vector3()
        .subVectors(flockConfig.center, bird.position)
        .multiplyScalar(0.045);

      const predator = new THREE.Vector3();
      if (pointerActive && pointerWorld.x < 9999) {
        const away = new THREE.Vector3().subVectors(bird.position, pointerWorld);
        const predatorDistance = away.length();
        if (predatorDistance < BIRD_HOVER_RADIUS) {
          const hoverStrength = (BIRD_HOVER_RADIUS - predatorDistance) / BIRD_HOVER_RADIUS;
          predator.copy(away.normalize().multiplyScalar(hoverStrength * BIRD_PREDATOR_FORCE));
          predator.addScaledVector(pointerVelocityWorld, hoverStrength * BIRD_SWIPE_FORCE);
        }
      }

      bird.velocity
        .addScaledVector(separation, 0.38 * dt * 60)
        .addScaledVector(alignment, 0.16 * dt * 60)
        .addScaledVector(cohesion, 0.1 * dt * 60)
        .addScaledVector(centerPull, dt * 60)
        .addScaledVector(predator, dt * 60);

      bird.velocity.x += Math.sin(now * 0.6 + i * 0.17) * 0.0007;
      bird.velocity.y += Math.cos(now * 0.8 + i * 0.11) * 0.00045;
      bird.velocity.z += Math.sin(now * 0.5 + i * 0.09) * 0.0007;

      const speed = bird.velocity.length();
      if (speed > 0.12) {
        bird.velocity.setLength(0.12);
      } else if (speed < 0.03) {
        bird.velocity.setLength(0.03);
      }

      bird.position.addScaledVector(bird.velocity, dt);

      const minX = flockConfig.center.x - flockConfig.bounds.x;
      const maxX = flockConfig.center.x + flockConfig.bounds.x;
      const minY = flockConfig.center.y - flockConfig.bounds.y;
      const maxY = flockConfig.center.y + flockConfig.bounds.y;
      const minZ = flockConfig.center.z - flockConfig.bounds.z;
      const maxZ = flockConfig.center.z + flockConfig.bounds.z;

      if (bird.position.x < minX || bird.position.x > maxX) bird.velocity.x *= -1;
      if (bird.position.y < minY || bird.position.y > maxY) bird.velocity.y *= -1;
      if (bird.position.z < minZ || bird.position.z > maxZ) bird.velocity.z *= -1;

      bird.position.x = THREE.MathUtils.clamp(bird.position.x, minX, maxX);
      bird.position.y = THREE.MathUtils.clamp(bird.position.y, minY, maxY);
      bird.position.z = THREE.MathUtils.clamp(bird.position.z, minZ, maxZ);
      bird.phase += dt * (9 + bird.velocity.length() * 55);

      const verticesPerBird = 9;
      const start = i * verticesPerBird * 3;
      for (let vertexIndex = 0; vertexIndex < verticesPerBird; vertexIndex += 1) {
        const baseIndex = start + vertexIndex * 3;
        const vertex = new THREE.Vector3(
          birdGeometry.basePositions[baseIndex],
          birdGeometry.basePositions[baseIndex + 1],
          birdGeometry.basePositions[baseIndex + 2],
        );

        if (vertexIndex === 4 || vertexIndex === 7) {
          vertex.y = Math.sin(bird.phase) * BIRD_FLAP_AMPLITUDE;
        }

        const rotated = rotateBirdVertex(vertex, bird.velocity);
        positionArray[baseIndex] = rotated.x + bird.position.x;
        positionArray[baseIndex + 1] = rotated.y + bird.position.y;
        positionArray[baseIndex + 2] = rotated.z + bird.position.z;
      }
    }

    positionAttribute.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return (
    <mesh frustumCulled={false} visible={visible}>
      <primitive object={birdGeometry.geometry} ref={geometryRef} attach="geometry" />
      <shaderMaterial
        ref={materialRef}
        vertexShader={BIRD_VERTEX_SHADER}
        fragmentShader={BIRD_FRAGMENT_SHADER}
        uniforms={{ uTint: { value: BIRD_TINT } }}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function cloneLoadedModel(loaded) {
  const source = loaded?.scene || loaded;
  const clone = source.clone(true);
  clone.animations = loaded?.animations || source?.animations || [];
  return clone;
}

async function loadMorphCategoryModel(category) {
  const descriptor = getSceneAssetDescriptor(
    category?.fbx || category?.fileName || category?.name,
    category?.properties
  );

  if (!morphModelCache.has(descriptor.cacheKey)) {
    const loaderPromise = ["glb", "gltf"].includes(descriptor.extension)
      ? gltfLoader.loadAsync(descriptor.url)
      : fbxLoader.loadAsync(descriptor.url);
    morphModelCache.set(descriptor.cacheKey, loaderPromise);
  }

  const loaded = await morphModelCache.get(descriptor.cacheKey);
  return cloneLoadedModel(loaded);
}

function alignBuiltInHelixTarget(targets) {
  const helixIndex = targets.findIndex((target) => target?.builtIn === "helix");
  if (helixIndex < 0) {
    return targets;
  }

  const referenceTarget = targets.find((target, index) => index !== helixIndex && target?.positions?.length);
  if (!referenceTarget?.positions?.length) {
    return targets;
  }

  const helixTarget = targets[helixIndex];
  const helixCentroid = computeCentroid(helixTarget.positions);
  const referenceCentroid = computeCentroid(referenceTarget.positions);
  const offset = {
    x: referenceCentroid.x - helixCentroid.x,
    y: referenceCentroid.y - helixCentroid.y,
    z: referenceCentroid.z - helixCentroid.z,
  };

  const aligned = [...targets];
  aligned[helixIndex] = {
    ...helixTarget,
    positions: translatePositions(helixTarget.positions, offset)
  };
  return aligned;
}

async function createMorphTargets(morph, categories, gridSize) {
  const count = Math.max(4, Number(morph?.pointCount || 100) * 4);
  const requestedTargets = Array.isArray(morph?.targets) && morph.targets.length
    ? morph.targets
    : ["plane", "sphere", "helix"];
  const sharedColors = getRainbowColors(count);

  const resolvedTargets = await Promise.all(requestedTargets.map(async (target) => {
    const builtIn = createBuiltInTarget(target, count, morph, sharedColors);
    if (builtIn) {
      return builtIn;
    }

    const placements = getMorphTargetPlacements(morph, target);
    const category = categories.find((item) => {
      if (morphCategoryMatchesTarget(item, target)) {
        return true;
      }

      if (!placements.length) {
        return false;
      }

      const assets = Array.isArray(item?.assets) ? item.assets : Object.values(item?.assets || {});
      const matchedAssets = filterMorphAssetsByPlacements(assets, placements, { fallbackToAll: false });
      return matchedAssets.length > 0 && matchedAssets.length !== assets.length ? true : matchedAssets.length > 0;
    });
    if (!category) {
      return null;
    }

    const modelRoot = await loadMorphCategoryModel(category).catch(() => null);
    const targetData = buildMorphPointTargets(category, count, modelRoot, placements);
    return targetData
      ? { name: category.name || target, positions: targetData.positions, colors: sharedColors, builtIn: null }
      : null;
  }));

  return scaleTargetsToGrid(alignBuiltInHelixTarget(resolvedTargets.filter((target) => target?.positions && target?.colors)), gridSize);
}

function DroneShowMorphPreset({ morph, categories, visible = true }) {
  const geometryRef = useRef();
  const [targets, setTargets] = useState([]);
  const count = Math.max(4, Number(morph?.pointCount || 100) * 4);
  const duration = Math.max(0.1, Number(morph?.duration || 2));
  const repeat = Number.isFinite(Number(morph?.repeat)) ? Number(morph.repeat) : -1;
  const ease = morph?.ease || "power2.inOut";
  const gridSize = useGame((state) => state.gridSize);
  const categorySignature = useMemo(
    () => JSON.stringify((Array.isArray(categories) ? categories : []).map((category) => ({
      name: category?.name,
      fileName: category?.fileName,
      fbx: category?.fbx,
      properties: category?.properties,
    }))),
    [categories]
  );

  useEffect(() => {
    let cancelled = false;

    createMorphTargets(morph, Array.isArray(categories) ? categories : [], gridSize).then((nextTargets) => {
      if (!cancelled) {
        setTargets(nextTargets);
      }
    }).catch(() => {
      if (!cancelled) {
        setTargets([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [categorySignature, categories, count, gridSize, morph]);

  useEffect(() => {
    if (!geometryRef.current || !targets.length) {
      return undefined;
    }

    const geometry = geometryRef.current;
    const pointCount = Math.max(1, Math.floor((targets[0]?.positions?.length || 0) / 3));
    const positionBuffer = new Float32Array(pointCount * 3);
    copyBuffer(positionBuffer, targets[0].positions);

    const positionAttribute = new THREE.BufferAttribute(positionBuffer, 3);
    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", positionAttribute);

    const colorAttribute = new THREE.BufferAttribute(targets[0].colors, 3);
    geometry.setAttribute("color", colorAttribute);

    if (targets.length < 2) {
      positionAttribute.needsUpdate = true;
      return undefined;
    }

    const state = { progress: 0 };
    const timeline = gsap.timeline({ repeat, repeatDelay: 0 });

    targets.forEach((from, index) => {
      const to = targets[(index + 1) % targets.length];
      timeline.to(state, {
        progress: 1,
        duration,
        delay: 0,
        ease,
        onStart: () => {
          state.progress = 0;
        },
        onUpdate: () => {
          lerpPositionBuffers(positionBuffer, from.positions, to.positions, state.progress);
          positionAttribute.needsUpdate = true;
        },
        onComplete: () => {
          copyBuffer(positionBuffer, to.positions);
          positionAttribute.needsUpdate = true;
          state.progress = 0;
        }
      });
    });

    return () => {
      timeline.kill();
      geometry.deleteAttribute("position");
      geometry.deleteAttribute("color");
    };
  }, [duration, ease, repeat, targets]);

  if (targets.length < 2) {
    return null;
  }

  return (
    <points frustumCulled={false} position={[0, 0, 0]} scale={[1, 1, 1]} visible={visible}>
      <bufferGeometry ref={geometryRef} />
      <pointsMaterial
        size={Number(morph?.pointSize || 0.003)}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation={false}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

export default function DroneShowMorph({ morphs = [], categories = [] }) {
  const hasDied = useGame((state) => state.hasDied);
  const presets = Array.isArray(morphs) ? morphs.filter((morph) => morph?.preset === "droneShow") : [];

  if (!presets.length) {
    return null;
  }

  return (
    <>
      {presets.map((morph) => (
        <React.Fragment key={morph.id || "drone-show-morph"}>
          <DroneShowMorphPreset
            morph={morph}
            categories={Array.isArray(categories) ? categories : []}
            visible={!hasDied}
          />
        </React.Fragment>
      ))}
      <GpgpuBirdFlock visible={hasDied} />
    </>
  );
}


