import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import singleEdges from "../../components/autoCad/single-edges.js";
import { useAutoCadData, useHoveredAutoCadSegments, useSelectedAutoCadSegments } from "./autoCadData.js";

const DEFAULT_SCALE = 0.01;
const DEFAULT_ELEVATION = 0.01;
const DEFAULT_COLOR = "#f5f5f5";
const CAD_BACKGROUND = "#4a4a4a";
const MIN_CAMERA_DISTANCE = 3;
const CAMERA_PADDING = 1.6;
const TOP_VIEW_Z_OFFSET = 0.001;
const GRID_MINOR_COLOR = "#293241";
const GRID_MAJOR_COLOR = "#3f5368";
const AXIS_X_COLOR = "#d84f45";
const AXIS_Y_COLOR = "#3fae5c";
const AXIS_Z_COLOR = "#31d7ff";
const GRID_BASE_Y_OFFSET = -0.002;
const GRID_LABEL_TEXT = "#f7f7f7";
const GRID_LABEL_STROKE = "#3c3c3c";
const GRID_LABEL_PIXEL_HEIGHT = 30;
const GRID_AXIS_LABEL_PIXEL_HEIGHT = 27;
const GRID_LABEL_SCALE_FACTOR = 0.6;
const GRID_MAX_VISIBLE_LABEL_DIVISIONS = 13;
const GRID_FIXED_DIVISION_CAD = 40;
const GRID_MAJOR_DIVISION_COUNT = 5;

function cadYToWorldZ(value, scale) {
  return -(value * scale);
}

function cadZToWorldY(value, scale, elevation) {
  return elevation + value * scale;
}

function worldYToCadZ(value, scale, elevation) {
  return (value - elevation) / scale;
}

function worldZToCadY(value, scale) {
  return -(value / scale);
}

function getCadEdgePoint(edges, startIndex) {
  return {
    x: Number(edges[startIndex] ?? 0),
    y: Number(edges[startIndex + 1] ?? 0),
    z: Number(edges[startIndex + 2] ?? 0),
  };
}

function cadPointToWorld(point, scale, elevation) {
  return new THREE.Vector3(
    point.x * scale,
    cadZToWorldY(point.z ?? 0, scale, elevation),
    cadYToWorldZ(point.y ?? 0, scale),
  );
}


const CAD_LAYER_COLOR_ALIASES = {
  "0": "white",
  am_5: "cyan",
};

function normalizeCadColor(value, fallback) {
  if (!value || typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const alias = CAD_LAYER_COLOR_ALIASES[trimmed.toLowerCase()];
  return alias || trimmed;
}

function getCommandSegmentCount(style) {
  const explicitCount = Number(style?.segmentCount);
  if (Number.isFinite(explicitCount) && explicitCount > 0) {
    return Math.max(1, Math.round(explicitCount));
  }

  if (style?.command === "RECTANG") return 4;
  if (style?.command === "ARC") return 12;
  return 1;
}

function getNiceStep(range) {
  if (!Number.isFinite(range) || range <= 0) return 1;

  const roughStep = range / 8;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return magnitude * 2;
  if (normalized <= 5) return magnitude * 5;
  return magnitude * 10;
}

function snapDown(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  return Math.floor(value / step) * step;
}

function snapUp(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  return Math.ceil(value / step) * step;
}

function intersectDrawingPlane(camera, x, y, planeY) {
  const near = new THREE.Vector3(x, y, -1).unproject(camera);
  const far = new THREE.Vector3(x, y, 1).unproject(camera);
  const direction = far.sub(near).normalize();
  const ray = new THREE.Ray(near, direction);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const hit = new THREE.Vector3();

  return ray.intersectPlane(plane, hit) ? hit : null;
}

function getVisibleCadBounds(camera, scale, elevation) {
  if (!camera) return null;

  const corners = [
    intersectDrawingPlane(camera, -1, 1, elevation),
    intersectDrawingPlane(camera, 1, 1, elevation),
    intersectDrawingPlane(camera, -1, -1, elevation),
    intersectDrawingPlane(camera, 1, -1, elevation),
  ].filter(Boolean);

  if (corners.length < 4) return null;

  const xs = corners.map((point) => point.x / scale);
  const zs = corners.map((point) => worldZToCadY(point.z, scale));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    height: maxZ - minZ,
  };
}

function getGridViewportBounds(bounds, visibleBounds, scale) {
  const safeScale = Math.max(scale, Number.EPSILON);
  const objectMinXCad = (bounds?.minX ?? 0) / safeScale;
  const objectMaxXCad = (bounds?.maxX ?? (bounds?.radius ?? 1)) / safeScale;
  const objectMinZCad = worldZToCadY(bounds?.maxZ ?? 0, safeScale);
  const objectMaxZCad = worldZToCadY(bounds?.minZ ?? (bounds?.radius ?? 1), safeScale);

  const minX = Math.min(0, objectMinXCad, visibleBounds?.minX ?? 0);
  const maxX = Math.max(0, objectMaxXCad, visibleBounds?.maxX ?? objectMaxXCad);
  const minZ = Math.min(0, objectMinZCad, visibleBounds?.minZ ?? 0);
  const maxZ = Math.max(0, objectMaxZCad, visibleBounds?.maxZ ?? objectMaxZCad);

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxZ - minZ, 1),
  };
}

function trimTrailingZeros(value) {
  let result = value.replace(/(\.\d*[1-9])0+$/, "$1").replace(/\.0+$/, ".0");
  if (result === "-0.0") return "0.0";
  if (!result.includes(".")) return `${result}.0`;
  return result;
}

function formatCadAxisLabel(value) {
  if (Math.abs(value) < 0.0001) return "0.0";
  const fixed = trimTrailingZeros(value.toFixed(4));
  return fixed;
}

function buildTextSprite(text, color, pixelHeight, viewportSize, rotation = 0) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", {
    alpha: true,
    desynchronized: false,
    willReadFrequently: false,
  });
  const fontSize = 72;
  const strokeWidth = 6;
  const padding = 18;
  const font = `500 ${fontSize}px Helvetica, Arial, sans-serif`;

  context.font = font;
  const metrics = context.measureText(text);
  const canvasWidth = Math.round(metrics.width + padding * 2);
  const canvasHeight = 128;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const nextContext = canvas.getContext("2d");
  nextContext.font = font;
  nextContext.textAlign = "center";
  nextContext.textBaseline = "middle";
  nextContext.clearRect(0, 0, canvas.width, canvas.height);
  nextContext.lineWidth = strokeWidth;
  nextContext.lineJoin = "round";
  nextContext.miterLimit = 2;
  nextContext.strokeStyle = GRID_LABEL_STROKE;
  nextContext.strokeText(text, canvas.width / 2, canvas.height / 2);
  nextContext.fillStyle = color;
  nextContext.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    rotation,
    sizeAttenuation: false,
  });

  const sprite = new THREE.Sprite(material);
  const viewportHeight = Math.max(viewportSize?.height ?? 1, 1);
  const scaleValue = (pixelHeight / viewportHeight) * GRID_LABEL_SCALE_FACTOR;
  sprite.scale.set((canvas.width / canvas.height) * scaleValue, scaleValue, 1);
  sprite.renderOrder = 6;

  return { sprite, material, texture };
}

function getLabelStride(axisSpanCad, divisionStepCad) {
  if (!Number.isFinite(axisSpanCad) || axisSpanCad <= 0 || !Number.isFinite(divisionStepCad) || divisionStepCad <= 0) {
    return 1;
  }

  const divisionCount = axisSpanCad / divisionStepCad;
  if (!Number.isFinite(divisionCount) || divisionCount <= 0) {
    return 1;
  }

  if (divisionCount <= GRID_MAX_VISIBLE_LABEL_DIVISIONS) {
    return 1;
  }

  return Math.max(1, Math.ceil(divisionCount / GRID_MAX_VISIBLE_LABEL_DIVISIONS));
}

function buildAxisLabels(viewBounds, scale, baseY, divisionStepCad, viewportSize, elevation, has3d = false, maxCadZ = 0, zAxisCadSpan = 0) {
  if (!viewBounds || !Number.isFinite(viewBounds.width) || !Number.isFinite(viewBounds.height) || divisionStepCad <= 0) {
    return { objects: [], materials: [], textures: [] };
  }

  const viewportHeight = Math.max(viewportSize?.height ?? 1, 1);
  const labelScale = (GRID_LABEL_PIXEL_HEIGHT / viewportHeight) * GRID_LABEL_SCALE_FACTOR;
  const extraLineGap = (12 / viewportHeight) * GRID_LABEL_SCALE_FACTOR;
  const xAxisOffset = -(labelScale * 1.2 + extraLineGap);
  const zAxisOffset = -(labelScale * 1.2 + extraLineGap);
  const minX = snapDown(viewBounds.minX, divisionStepCad);
  const labelHeight = baseY + 0.01;
  const objects = [];
  const materials = [];
  const textures = [];
  const maxX = snapUp(viewBounds.maxX, divisionStepCad);
  const minZ = snapDown(viewBounds.minZ, divisionStepCad);
  const maxZ = snapUp(viewBounds.maxZ, divisionStepCad);
  const maxVerticalCadZ = snapUp(Math.max(maxCadZ, 0), divisionStepCad);
  const maxVisibleCadZ = snapUp(Math.max(zAxisCadSpan, maxCadZ, 0), divisionStepCad);
  const horizontalStride = getLabelStride(viewBounds.width, divisionStepCad);
  const verticalStride = getLabelStride(viewBounds.height, divisionStepCad);
  const depthStride = getLabelStride(Math.max(maxVisibleCadZ, divisionStepCad), divisionStepCad);
  let horizontalIndex = 0;
  let verticalIndex = 0;
  let depthIndex = 0;

  for (let value = minX; value <= maxX + divisionStepCad * 0.25; value += divisionStepCad) {
    const isOrigin = Math.abs(value) < divisionStepCad * 0.25;
    const shouldShow = horizontalIndex % horizontalStride === 0 || isOrigin;
    if (shouldShow && !isOrigin) {
      const label = buildTextSprite(formatCadAxisLabel(value), GRID_LABEL_TEXT, GRID_LABEL_PIXEL_HEIGHT, viewportSize, 0);
      label.sprite.position.set(value * scale, labelHeight, xAxisOffset);
      objects.push(label.sprite);
      materials.push(label.material);
      textures.push(label.texture);
    }
    horizontalIndex += 1;
  }

  for (let value = minZ; value <= maxZ + divisionStepCad * 0.25; value += divisionStepCad) {
    const isOrigin = Math.abs(value) < divisionStepCad * 0.25;
    const shouldShow = verticalIndex % verticalStride === 0 || isOrigin;
    if (shouldShow && !isOrigin) {
      const label = buildTextSprite(formatCadAxisLabel(value), GRID_LABEL_TEXT, GRID_LABEL_PIXEL_HEIGHT, viewportSize, Math.PI / 2);
      label.sprite.position.set(zAxisOffset, labelHeight, cadYToWorldZ(value, scale));
      objects.push(label.sprite);
      materials.push(label.material);
      textures.push(label.texture);
    }
    verticalIndex += 1;
  }

  const originLabel = buildTextSprite("0,0", GRID_LABEL_TEXT, GRID_LABEL_PIXEL_HEIGHT, viewportSize, 0);
  originLabel.sprite.position.set(zAxisOffset * 0.65, labelHeight, xAxisOffset * 0.2);
  objects.push(originLabel.sprite);
  materials.push(originLabel.material);
  textures.push(originLabel.texture);

  const xLabel = buildTextSprite("X", AXIS_X_COLOR, GRID_AXIS_LABEL_PIXEL_HEIGHT, viewportSize, 0);
  xLabel.sprite.position.set(maxX * scale, labelHeight, xAxisOffset * 1.85);
  objects.push(xLabel.sprite);
  materials.push(xLabel.material);
  textures.push(xLabel.texture);

  const yLabel = buildTextSprite("Y", AXIS_Y_COLOR, GRID_AXIS_LABEL_PIXEL_HEIGHT, viewportSize, Math.PI / 2);
  yLabel.sprite.position.set(zAxisOffset * 1.85, labelHeight, cadYToWorldZ(maxZ, scale));
  objects.push(yLabel.sprite);
  materials.push(yLabel.material);
  textures.push(yLabel.texture);

  if (has3d && maxVisibleCadZ > 0) {
    const depthLabelX = Math.abs(zAxisOffset) * 1.8;
    const depthLabelZ = xAxisOffset * 0.85;

    for (let value = divisionStepCad; value <= maxVisibleCadZ + divisionStepCad * 0.25; value += divisionStepCad) {
      const shouldShow = depthIndex % depthStride === 0;
      if (shouldShow) {
        const label = buildTextSprite(formatCadAxisLabel(value), GRID_LABEL_TEXT, GRID_LABEL_PIXEL_HEIGHT, viewportSize, 0);
        label.sprite.position.set(depthLabelX, cadZToWorldY(value, scale, elevation), depthLabelZ);
        objects.push(label.sprite);
        materials.push(label.material);
        textures.push(label.texture);
      }
      depthIndex += 1;
    }

    const zLabel = buildTextSprite("Z", AXIS_Z_COLOR, GRID_AXIS_LABEL_PIXEL_HEIGHT, viewportSize, 0);
    zLabel.sprite.position.set(depthLabelX * 1.15, cadZToWorldY(maxVisibleCadZ, scale, elevation), depthLabelZ * 1.1);
    objects.push(zLabel.sprite);
    materials.push(zLabel.material);
    textures.push(zLabel.texture);
  }

  return { objects, materials, textures };
}

function createGridLineSegments(vertices, color, opacity, renderOrder) {
  if (vertices.length === 0) {
    return { object: null, material: null };
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = renderOrder;
  return { object: lines, material };
}

function buildCadGrid(bounds, visibleBounds, scale, elevation, viewportSize) {
  if (!bounds) {
    return { objects: [], materials: [], textures: [] };
  }

  const viewBounds = getGridViewportBounds(bounds, visibleBounds, scale);
  const majorStepCad = GRID_FIXED_DIVISION_CAD * GRID_MAJOR_DIVISION_COUNT;
  const minorStepCad = GRID_FIXED_DIVISION_CAD;
  const positiveMarginCad = majorStepCad;
  const negativeMarginCad = minorStepCad * 2;
  const minX = snapDown(Math.min(viewBounds.minX, 0) - negativeMarginCad, minorStepCad);
  const maxX = snapUp(viewBounds.maxX + positiveMarginCad, minorStepCad);
  const minZ = snapDown(Math.min(viewBounds.minZ, 0) - negativeMarginCad, minorStepCad);
  const maxZ = snapUp(viewBounds.maxZ + positiveMarginCad, minorStepCad);
  const baseY = elevation + GRID_BASE_Y_OFFSET;
  const maxCadZ = Math.max(bounds?.maxCadZ ?? 0, 0);
  const zAxisCadSpan = snapUp(Math.max(maxCadZ, maxX, maxZ, 0), minorStepCad);
  const objects = [];
  const materials = [];
  const textures = [];
  const minorVertices = [];
  const majorVertices = [];

  for (let x = minX; x <= maxX + minorStepCad * 0.25; x += minorStepCad) {
    if (Math.abs(x) < minorStepCad * 0.25) continue;
    const isMajor = Math.abs(Math.round(x / majorStepCad) * majorStepCad - x) < minorStepCad * 0.25;
    const target = isMajor ? majorVertices : minorVertices;
    target.push(
      x * scale,
      baseY,
      cadYToWorldZ(minZ, scale),
      x * scale,
      baseY,
      cadYToWorldZ(maxZ, scale),
    );
  }

  for (let z = minZ; z <= maxZ + minorStepCad * 0.25; z += minorStepCad) {
    if (Math.abs(z) < minorStepCad * 0.25) continue;
    const isMajor = Math.abs(Math.round(z / majorStepCad) * majorStepCad - z) < minorStepCad * 0.25;
    const target = isMajor ? majorVertices : minorVertices;
    const worldZ = cadYToWorldZ(z, scale);
    target.push(minX * scale, baseY, worldZ, maxX * scale, baseY, worldZ);
  }

  const minorGrid = createGridLineSegments(minorVertices, GRID_MINOR_COLOR, 0.42, 1);
  if (minorGrid.object && minorGrid.material) {
    objects.push(minorGrid.object);
    materials.push(minorGrid.material);
  }

  const majorGrid = createGridLineSegments(majorVertices, GRID_MAJOR_COLOR, 0.72, 2);
  if (majorGrid.object && majorGrid.material) {
    objects.push(majorGrid.object);
    materials.push(majorGrid.material);
  }

  const axisPoints = [
    new THREE.Vector3(minX * scale, baseY + 0.0015, 0),
    new THREE.Vector3(maxX * scale, baseY + 0.0015, 0),
    new THREE.Vector3(0, baseY + 0.0015, cadYToWorldZ(minZ, scale)),
    new THREE.Vector3(0, baseY + 0.0015, cadYToWorldZ(maxZ, scale)),
  ];
  const axisColorsList = [
    ...new THREE.Color(AXIS_X_COLOR).toArray(),
    ...new THREE.Color(AXIS_X_COLOR).toArray(),
    ...new THREE.Color(AXIS_Y_COLOR).toArray(),
    ...new THREE.Color(AXIS_Y_COLOR).toArray(),
  ];

  if (bounds?.has3d && zAxisCadSpan > 0) {
    axisPoints.push(
      new THREE.Vector3(0, cadZToWorldY(0, scale, elevation), 0),
      new THREE.Vector3(0, cadZToWorldY(zAxisCadSpan, scale, elevation), 0),
    );
    axisColorsList.push(
      ...new THREE.Color(AXIS_Z_COLOR).toArray(),
      ...new THREE.Color(AXIS_Z_COLOR).toArray(),
    );
  }

  const axisGeometry = new THREE.BufferGeometry().setFromPoints(axisPoints);
  const axisColors = new Float32Array(axisColorsList);
  axisGeometry.setAttribute("color", new THREE.BufferAttribute(axisColors, 3));
  const axisMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const axisLines = new THREE.LineSegments(axisGeometry, axisMaterial);
  axisLines.renderOrder = 3;
  objects.push(axisLines);
  materials.push(axisMaterial);

  const labels = buildAxisLabels(
    viewBounds,
    scale,
    baseY,
    minorStepCad,
    viewportSize,
    elevation,
    Boolean(bounds?.has3d),
    maxCadZ,
    zAxisCadSpan,
  );
  objects.push(...labels.objects);
  materials.push(...labels.materials);
  textures.push(...labels.textures);

  return { objects, materials, textures };
}

function disposeObjectResources(object) {
  if (!object || typeof object.traverse !== "function") return;

  object.traverse((child) => {
    if (child.geometry && typeof child.geometry.dispose === "function") {
      child.geometry.dispose();
    }
  });
}
function distanceToScreenSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= Number.EPSILON) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const closestX = start.x + t * dx;
  const closestY = start.y + t * dy;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function formatCadLength(value) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(3);
}

function formatCadCoord(value) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(3);
}

function formatCadAngle(value) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(3);
}

function buildSegmentData(edges, scale, elevation) {
  const segments = [];

  for (let segmentIndex = 0; segmentIndex * 6 + 5 < edges.length; segmentIndex += 1) {
    const startIndex = segmentIndex * 6;
    const startCad = getCadEdgePoint(edges, startIndex);
    const endCad = getCadEdgePoint(edges, startIndex + 3);
    const start = cadPointToWorld(startCad, scale, elevation);
    const end = cadPointToWorld(endCad, scale, elevation);
    const centerCad = {
      x: (startCad.x + endCad.x) / 2,
      y: (startCad.y + endCad.y) / 2,
      z: (startCad.z + endCad.z) / 2,
    };
    const midpoint = cadPointToWorld(centerCad, scale, elevation);
    midpoint.y += 0.02;
    const deltaX = endCad.x - startCad.x;
    const deltaY = endCad.y - startCad.y;
    const deltaZ = endCad.z - startCad.z;

    segments.push({
      index: segmentIndex,
      start,
      end,
      midpoint,
      startCad,
      endCad,
      centerCad,
      lengthCad: Math.hypot(deltaX, deltaY, deltaZ),
      angleDeg: THREE.MathUtils.radToDeg(Math.atan2(deltaY, deltaX)),
      has3d: Math.abs(startCad.z) > 0.0001 || Math.abs(endCad.z) > 0.0001,
    });
  }

  return segments;
}

function getTooltipScreenOffset(segment, camera, viewportSize) {
  if (!segment || !camera || !viewportSize?.width || !viewportSize?.height) {
    return { transform: "translate(-50%, 18px)" };
  }

  const point = segment.midpoint.clone().project(camera);
  const screenX = ((point.x + 1) * 0.5) * viewportSize.width;
  const screenY = ((1 - point.y) * 0.5) * viewportSize.height;
  const popupWidth = 220;
  const popupHeight = 170;
  const margin = 16;

  let translateX = "-50%";
  let offsetX = 0;
  let offsetY = 18;

  if (screenY + popupHeight + margin > viewportSize.height) {
    offsetY = -(popupHeight * 0.5 + 20);
  }

  if (screenX + popupWidth * 0.5 + margin > viewportSize.width) {
    translateX = "-100%";
    offsetX = -18;
  } else if (screenX - popupWidth * 0.5 - margin < 0) {
    translateX = "0%";
    offsetX = 18;
  }

  return {
    transform: `translate(${translateX}, ${offsetY}px) translateX(${offsetX}px)`,
  };
}
function findHoveredSegment(segments, camera, pointer, size, threshold = 10) {
  if (!camera || !Array.isArray(segments) || segments.length === 0) return null;

  let closest = null;
  let bestDistance = threshold;

  for (const segment of segments) {
    const start = segment.start.clone().project(camera);
    const end = segment.end.clone().project(camera);

    if ((start.z < -1 && end.z < -1) || (start.z > 1 && end.z > 1)) {
      continue;
    }

    const startScreen = {
      x: ((start.x + 1) * 0.5) * size.width,
      y: ((1 - start.y) * 0.5) * size.height,
    };
    const endScreen = {
      x: ((end.x + 1) * 0.5) * size.width,
      y: ((1 - end.y) * 0.5) * size.height,
    };

    const distance = distanceToScreenSegment(pointer, startScreen, endScreen);
    if (distance <= bestDistance) {
      bestDistance = distance;
      closest = segment;
    }
  }

  return closest;
}
function buildHighlightedSegments(edges, segmentIndices, scale, elevation, size, color, lineWidth, renderOrder) {
  if (!Array.isArray(segmentIndices) || segmentIndices.length === 0) return null;

  const uniqueIndices = Array.from(new Set(segmentIndices.map((value) => Number(value)).filter(Number.isFinite)));
  const positions = [];
  for (const segmentIndex of uniqueIndices) {
    const segmentStartIndex = segmentIndex * 6;
    if (segmentStartIndex + 5 >= edges.length) continue;

    const start = cadPointToWorld(getCadEdgePoint(edges, segmentStartIndex), scale, elevation);
    const end = cadPointToWorld(getCadEdgePoint(edges, segmentStartIndex + 3), scale, elevation);

    positions.push(
      start.x,
      start.y,
      start.z,
      end.x,
      end.y,
      end.z,
    );
  }

  if (positions.length === 0) return null;

  const material = new LineMaterial({
    color,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    linewidth: lineWidth,
    worldUnits: false,
  });

  material.resolution.set(size.width, size.height);

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const lineSegments = new LineSegments2(geometry, material);
  lineSegments.frustumCulled = false;
  lineSegments.renderOrder = renderOrder;
  lineSegments.computeLineDistances();

  return { geometry, lineSegments };
}

export default function SingleEdgesDrawing({
  data = singleEdges,
  scale = DEFAULT_SCALE,
  elevation = DEFAULT_ELEVATION,
  scene,
  invalidate,
  orbitControls,
}) {
  const { camera, gl, size } = useThree();
  const liveData = useAutoCadData(data);
  const hoveredSegmentIndices = useHoveredAutoCadSegments();
  const selectedSegmentIndices = useSelectedAutoCadSegments();
  const [hoveredSceneSegment, setHoveredSceneSegment] = useState(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!scene) return undefined;
    const previousBackground = scene.background;
    scene.background = new THREE.Color(CAD_BACKGROUND);
    invalidate?.();

    return () => {
      scene.background = previousBackground;
      invalidate?.();
    };
  }, [invalidate, scene]);

  const lineGroups = useMemo(() => {
    const edges = liveData?.parts?.[0]?.shape?.edges || [];
    const commandStyles = liveData?.commandStyles || [];
    const fallbackColor = normalizeCadColor(
      liveData?.parts?.[0]?.color,
      DEFAULT_COLOR,
    );
    const colorBuckets = new Map();

    const pushSegment = (bucketColor, segmentStartIndex) => {
      const nextColor = normalizeCadColor(bucketColor, fallbackColor);
      const bucket = colorBuckets.get(nextColor) || [];
      const start = cadPointToWorld(getCadEdgePoint(edges, segmentStartIndex), scale, elevation);
      const end = cadPointToWorld(getCadEdgePoint(edges, segmentStartIndex + 3), scale, elevation);

      bucket.push(
        start.x,
        start.y,
        start.z,
        end.x,
        end.y,
        end.z,
      );

      colorBuckets.set(nextColor, bucket);
    };

    if (commandStyles.length > 0) {
      let segmentCursor = 0;

      for (const style of commandStyles) {
        const segmentCount = getCommandSegmentCount(style);

        for (let index = 0; index < segmentCount; index += 1) {
          const segmentStartIndex = segmentCursor * 6;
          if (segmentStartIndex + 5 >= edges.length) {
            break;
          }

          pushSegment(style?.color, segmentStartIndex);
          segmentCursor += 1;
        }
      }
    } else {
      for (let index = 0; index < edges.length; index += 6) {
        pushSegment(fallbackColor, index);
      }
    }

    return Array.from(colorBuckets.entries()).map(([groupColor, positions]) => {
      const material = new LineMaterial({
        color: groupColor,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        linewidth: 1.5,
        worldUnits: false,
      });

      material.resolution.set(size.width, size.height);

      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(positions);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const lineSegments = new LineSegments2(geometry, material);
      lineSegments.frustumCulled = false;
      lineSegments.renderOrder = 10;
      lineSegments.computeLineDistances();

      return {
        color: groupColor,
        geometry,
        lineSegments,
      };
    });
  }, [elevation, liveData, scale, size.height, size.width]);

  const segmentData = useMemo(() => {
    const edges = liveData?.parts?.[0]?.shape?.edges || [];
    return buildSegmentData(edges, scale, elevation);
  }, [elevation, liveData, scale]);

  const mergedHoveredSegmentIndices = useMemo(() => {
    const indices = Array.isArray(hoveredSegmentIndices) ? [...hoveredSegmentIndices] : [];
    if (hoveredSceneSegment?.index != null) {
      indices.push(hoveredSceneSegment.index);
    }
    return Array.from(new Set(indices.map((value) => Number(value)).filter(Number.isFinite)));
  }, [hoveredSceneSegment, hoveredSegmentIndices]);
  const selectedSegments = useMemo(() => {
    const edges = liveData?.parts?.[0]?.shape?.edges || [];
    return buildHighlightedSegments(
      edges,
      selectedSegmentIndices,
      scale,
      elevation,
      size,
      "#2f80ed",
      3,
      18,
    );
  }, [elevation, liveData, scale, selectedSegmentIndices, size]);

  const highlightedSegments = useMemo(() => {
    const edges = liveData?.parts?.[0]?.shape?.edges || [];
    return buildHighlightedSegments(
      edges,
      mergedHoveredSegmentIndices,
      scale,
      elevation,
      size,
      "#ff7a00",
      4,
      20,
    );
  }, [elevation, liveData, mergedHoveredSegmentIndices, scale, size]);

  const drawingBounds = useMemo(() => {
    const bb = liveData?.bb;
    const edges = liveData?.parts?.[0]?.shape?.edges || [];
    const hasBb = bb && [bb.xmin, bb.xmax, bb.ymin, bb.ymax].every(Number.isFinite);

    if (!hasBb && edges.length === 0) {
      return null;
    }

    if (hasBb) {
      const minX = (bb.xmin ?? 0) * scale;
      const maxX = (bb.xmax ?? 0) * scale;
      const minZ = cadYToWorldZ(bb.ymax ?? 0, scale);
      const maxZ = cadYToWorldZ(bb.ymin ?? 0, scale);
      const minY = cadZToWorldY(bb.zmin ?? 0, scale, elevation);
      const maxY = cadZToWorldY(bb.zmax ?? 0, scale, elevation);
      const center = new THREE.Vector3(
        (minX + maxX) / 2,
        (minY + maxY) / 2,
        (minZ + maxZ) / 2,
      );
      const width = Math.max(maxX - minX, 0);
      const depth = Math.max(maxZ - minZ, 0);
      const height = Math.max(maxY - minY, 0);

      return {
        center,
        radius: Math.max(width, depth, height, 1),
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
        minCadZ: bb.zmin ?? 0,
        maxCadZ: bb.zmax ?? 0,
        has3d: height > scale * 0.5,
      };
    }

    if (edges.length === 0) {
      return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < edges.length; index += 3) {
      const point = cadPointToWorld(getCadEdgePoint(edges, index), scale, elevation);
      const x = point.x;
      const y = point.y;
      const z = point.z;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }

    return {
      center: new THREE.Vector3(
        (minX + maxX) / 2,
        (minY + maxY) / 2,
        (minZ + maxZ) / 2,
      ),
      radius: Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1),
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      minCadZ: worldYToCadZ(minY, scale, elevation),
      maxCadZ: worldYToCadZ(maxY, scale, elevation),
      has3d: maxY - minY > scale * 0.5,
    };
  }, [elevation, liveData, scale]);

  const visibleCadBounds = useMemo(
    () => (drawingBounds ? getVisibleCadBounds(camera, scale, elevation) : null),
    [camera, drawingBounds, scale, elevation],
  );

  useEffect(() => {
    if (!gl?.domElement || !camera) return undefined;

    const domElement = gl.domElement;

    const updateHoveredSegment = (clientX, clientY) => {
      const rect = domElement.getBoundingClientRect();
      const pointer = {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
      pointerRef.current = pointer;
      const hovered = findHoveredSegment(segmentData, camera, pointer, size);
      setHoveredSceneSegment((previous) => {
        if (previous?.index === hovered?.index) {
          return previous;
        }
        return hovered;
      });
    };

    const handlePointerMove = (event) => {
      updateHoveredSegment(event.clientX, event.clientY);
    };

    const handlePointerLeave = () => {
      setHoveredSceneSegment(null);
    };

    domElement.addEventListener("pointermove", handlePointerMove);
    domElement.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      domElement.removeEventListener("pointermove", handlePointerMove);
      domElement.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [camera, gl, segmentData, size]);
  useEffect(() => {
    const controls = orbitControls?.current;
    const domElement = gl?.domElement;
    if (!controls || !domElement || !camera) return undefined;

    const handleControlsChange = () => {
      const pointer = pointerRef.current;
      const hovered = findHoveredSegment(segmentData, camera, pointer, size);
      setHoveredSceneSegment((previous) => {
        if (previous?.index === hovered?.index) {
          return previous;
        }
        return hovered;
      });
    };

    controls.addEventListener("change", handleControlsChange);
    return () => {
      controls.removeEventListener("change", handleControlsChange);
    };
  }, [camera, gl, orbitControls, segmentData, size]);
  const hoveredTooltipStyle = useMemo(
    () => getTooltipScreenOffset(hoveredSceneSegment, camera, size),
    [camera, hoveredSceneSegment, size],
  );
  const cadGrid = useMemo(
    () => (drawingBounds ? buildCadGrid(drawingBounds, visibleCadBounds, scale, elevation, size) : { objects: [], materials: [], textures: [] }),
    [drawingBounds, visibleCadBounds, scale, elevation, size],
  );

  useEffect(() => {
    if (!camera || !drawingBounds) return;

    const { center, radius } = drawingBounds;
    const distance = Math.max(radius * CAMERA_PADDING, MIN_CAMERA_DISTANCE);

    if (drawingBounds.has3d) {
      camera.position.set(
        center.x + distance * 0.8,
        center.y + distance * 0.95,
        center.z + distance * 0.8,
      );
    } else {
      camera.position.set(
        center.x,
        center.y + distance,
        center.z + TOP_VIEW_Z_OFFSET,
      );
    }
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    const controls = orbitControls?.current;
    if (controls) {
      controls.target.copy(center);
      controls.update();
    }

    invalidate?.();
  }, [camera, drawingBounds, invalidate, orbitControls]);

  useEffect(() => {
    return () => {
      lineGroups.forEach((group) => {
        group.lineSegments.removeFromParent();
        group.lineSegments.material.dispose();
        group.geometry.dispose();
      });
    };
  }, [lineGroups]);

  useEffect(() => {
    return () => {
      cadGrid.objects.forEach((object) => {
        object.removeFromParent();
        disposeObjectResources(object);
      });
      cadGrid.materials.forEach((material) => material.dispose());
      cadGrid.textures.forEach((texture) => texture.dispose());
    };
  }, [cadGrid]);

  useEffect(() => {
    return () => {
      if (selectedSegments) {
        selectedSegments.lineSegments.removeFromParent();
        selectedSegments.lineSegments.material.dispose();
        selectedSegments.geometry.dispose();
      }
    };
  }, [selectedSegments]);

  useEffect(() => {
    return () => {
      if (highlightedSegments) {
        highlightedSegments.lineSegments.removeFromParent();
        highlightedSegments.lineSegments.material.dispose();
        highlightedSegments.geometry.dispose();
      }
    };
  }, [highlightedSegments]);

  return (
    <group>
      {cadGrid.objects.map((object, index) => (
        <primitive key={object.uuid || "grid-" + index} object={object} />
      ))}
      {lineGroups.map((group) => (
        <primitive
          key={group.color}
          object={group.lineSegments}
        />
      ))}
      {selectedSegments ? <primitive object={selectedSegments.lineSegments} /> : null}
      {highlightedSegments ? <primitive object={highlightedSegments.lineSegments} /> : null}
      {hoveredSceneSegment ? (
        <Html position={hoveredSceneSegment.midpoint} style={{ pointerEvents: "none", ...hoveredTooltipStyle }}>
          <div
            style={{
              minWidth: "220px",
              borderRadius: "10px",
              background: "rgba(248, 248, 246, 0.96)",
              border: "1px solid rgba(55, 55, 55, 0.18)",
              color: "#333",
              fontSize: "11px",
              lineHeight: 1.2,
              boxShadow: "0 10px 26px rgba(0,0,0,0.22)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "6px 10px",
                fontSize: "15px",
                fontWeight: 700,
                textAlign: "center",
                borderBottom: "1px solid rgba(0,0,0,0.1)",
                background: "rgba(0,0,0,0.03)",
              }}
            >
              Distance
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "68px 1fr", rowGap: "1px", background: "rgba(0,0,0,0.08)" }}>
              <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.98)", fontWeight: 600 }}>distance</div>
              <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.98)", textAlign: "right" }}>
                {formatCadLength(hoveredSceneSegment.lengthCad)} <span style={{ color: "#666" }}>(center)</span>
              </div>
              <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.98)", fontWeight: 600 }}>point 1</div>
              <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.98)", textAlign: "right" }}>
                (
                <span style={{ color: "#f0534d" }}>{formatCadCoord(hoveredSceneSegment.startCad.x)}</span>
                <span style={{ color: "#777" }}> </span>
                <span style={{ color: "#28b35f" }}>{formatCadCoord(hoveredSceneSegment.startCad.y)}</span>
                {hoveredSceneSegment.has3d ? (
                  <>
                    <span style={{ color: "#777" }}> </span>
                    <span style={{ color: "#4a86ff" }}>{formatCadCoord(hoveredSceneSegment.startCad.z)}</span>
                  </>
                ) : null}
                )
              </div>
              <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.98)", fontWeight: 600 }}>point 2</div>
              <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.98)", textAlign: "right" }}>
                (
                <span style={{ color: "#f0534d" }}>{formatCadCoord(hoveredSceneSegment.endCad.x)}</span>
                <span style={{ color: "#777" }}> </span>
                <span style={{ color: "#28b35f" }}>{formatCadCoord(hoveredSceneSegment.endCad.y)}</span>
                {hoveredSceneSegment.has3d ? (
                  <>
                    <span style={{ color: "#777" }}> </span>
                    <span style={{ color: "#4a86ff" }}>{formatCadCoord(hoveredSceneSegment.endCad.z)}</span>
                  </>
                ) : null}
                )
              </div>
              <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.98)", fontWeight: 600 }}>center</div>
              <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.98)", textAlign: "right" }}>
                (
                <span style={{ color: "#f0534d" }}>{formatCadCoord(hoveredSceneSegment.centerCad.x)}</span>
                <span style={{ color: "#777" }}> </span>
                <span style={{ color: "#28b35f" }}>{formatCadCoord(hoveredSceneSegment.centerCad.y)}</span>
                {hoveredSceneSegment.has3d ? (
                  <>
                    <span style={{ color: "#777" }}> </span>
                    <span style={{ color: "#4a86ff" }}>{formatCadCoord(hoveredSceneSegment.centerCad.z)}</span>
                  </>
                ) : null}
                )
              </div>
              <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.98)", fontWeight: 600 }}>angle</div>
              <div style={{ padding: "4px 10px", background: "rgba(255,255,255,0.98)", textAlign: "right" }}>
                {formatCadAngle(hoveredSceneSegment.angleDeg)}
              </div>
            </div>
          </div>
        </Html>
      ) : null}
    </group>
  );
}





















































