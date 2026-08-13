import * as THREE from "three";

const textureColorCache = new WeakMap();

export function normalizeMorphName(value) {
  return String(value || "")
    .replace(/\.(fbx|glb|gltf)$/i, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toLowerCase();
}

export function getMorphCategoryCandidates(category) {
  const raw = category?._raw ? category._raw : category;
  return [
    category?.name,
    category?.assetName,
    category?.fileName,
    category?.cleanKey,
    category?.renderKey,
    category?.fbx,
    category?.asset_id,
    category?.id,
    category?.properties?.generatedAssetName,
    raw?.name,
    raw?.assetName,
    raw?.fileName,
    raw?.cleanKey,
    raw?.renderKey,
    raw?.fbx,
    raw?.asset_id,
    raw?.id,
    raw?.properties?.generatedAssetName
  ];
}

export function morphCategoryMatchesTarget(category, target) {
  const normalizedTarget = normalizeMorphName(target);
  return getMorphCategoryCandidates(category).some(
    (candidate) => normalizeMorphName(candidate) === normalizedTarget
  );
}

export function buildMorphPointTargets(category, pointCount, modelRoot, placements = []) {
  const mesh = findSampleMesh(modelRoot || category?.fbx);
  const positionAttribute = mesh?.geometry?.attributes?.position;
  const allAssets = Array.isArray(category?.assets)
    ? category.assets
    : Object.values(category?.assets || {});
  const assets = filterMorphAssetsByPlacements(allAssets, placements, { fallbackToAll: false });
  if (!positionAttribute || !assets.length || pointCount <= 0) {
    return null;
  }

  const pointsPerAsset = Math.max(1, Math.ceil(pointCount / assets.length));
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const temp = new THREE.Vector3();
  const localPoint = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const fallbackColor = new THREE.Color(normalizeColorInput(resolveCategoryColor(category, modelRoot)));
  const sampler = createSurfaceSampler(mesh.geometry);
  let writeIndex = 0;

  for (const asset of assets) {
    const transform = resolveAssetTransform(asset, mesh, category);
    matrix.compose(transform.position, transform.quaternion, transform.scale);
    const assetColor = new THREE.Color(normalizeColorInput(resolveAssetColor(asset, category)) || fallbackColor);

    for (let count = 0; count < pointsPerAsset && writeIndex < pointCount; count += 1) {
      sampler(localPoint);
      temp.copy(localPoint).applyMatrix4(matrix);
      positions[writeIndex * 3] = temp.x;
      positions[writeIndex * 3 + 1] = temp.y;
      positions[writeIndex * 3 + 2] = temp.z;
      colors[writeIndex * 3] = assetColor.r;
      colors[writeIndex * 3 + 1] = assetColor.g;
      colors[writeIndex * 3 + 2] = assetColor.b;
      writeIndex += 1;
    }
  }

  while (writeIndex < pointCount && writeIndex > 0) {
    const sourceIndex = Math.floor(Math.random() * writeIndex);
    positions[writeIndex * 3] = positions[sourceIndex * 3];
    positions[writeIndex * 3 + 1] = positions[sourceIndex * 3 + 1];
    positions[writeIndex * 3 + 2] = positions[sourceIndex * 3 + 2];
    colors[writeIndex * 3] = colors[sourceIndex * 3];
    colors[writeIndex * 3 + 1] = colors[sourceIndex * 3 + 1];
    colors[writeIndex * 3 + 2] = colors[sourceIndex * 3 + 2];
    writeIndex += 1;
  }

  return { positions, colors };
}

export function getMorphTargetPlacements(morph, target) {
  const placements = morph?.targetPlacements || {};
  const normalizedTarget = normalizeMorphName(target);
  const entry = Object.entries(placements).find(([key]) => normalizeMorphName(key) === normalizedTarget);
  return Array.isArray(entry?.[1]) ? entry[1] : [];
}

export function filterMorphAssetsByPlacements(assets, placements = [], options = {}) {
  const normalizedPlacements = Array.isArray(placements)
    ? placements.filter(isMorphPlacement)
    : [];
  const fallbackToAll = options?.fallbackToAll !== false;
  const assetList = Array.isArray(assets) ? assets : [];

  if (!normalizedPlacements.length) {
    return assetList;
  }

  const matchedAssets = assetList.filter((asset) =>
    normalizedPlacements.some((placement) => assetMatchesMorphPlacement(asset, placement))
  );

  return matchedAssets.length || !fallbackToAll ? matchedAssets : assetList;
}

function createSurfaceSampler(geometry) {
  const position = geometry?.attributes?.position;
  if (!position || position.count < 3) {
    return (target) => target.set(0, 0, 0);
  }

  const triangles = [];
  const cumulativeAreas = [];
  let totalArea = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  const pushTriangle = (ai, bi, ci) => {
    a.fromBufferAttribute(position, ai);
    b.fromBufferAttribute(position, bi);
    c.fromBufferAttribute(position, ci);
    const area = triangleArea(a, b, c);
    if (area <= 0) {
      return;
    }
    totalArea += area;
    triangles.push([ai, bi, ci]);
    cumulativeAreas.push(totalArea);
  };

  if (geometry.index) {
    const index = geometry.index.array;
    for (let i = 0; i < index.length; i += 3) {
      pushTriangle(index[i], index[i + 1], index[i + 2]);
    }
  } else {
    for (let i = 0; i < position.count; i += 3) {
      pushTriangle(i, i + 1, i + 2);
    }
  }

  if (!triangles.length) {
    return (target) => target.fromBufferAttribute(position, 0);
  }

  return (target) => {
    const triangleIndex = pickTriangleIndex(cumulativeAreas, Math.random() * totalArea);
    const [ai, bi, ci] = triangles[triangleIndex];
    a.fromBufferAttribute(position, ai);
    b.fromBufferAttribute(position, bi);
    c.fromBufferAttribute(position, ci);
    samplePointInTriangle(a, b, c, target);
  };
}

function triangleArea(a, b, c) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  return ab.cross(ac).length() * 0.5;
}

function pickTriangleIndex(cumulativeAreas, value) {
  let low = 0;
  let high = cumulativeAreas.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (value <= cumulativeAreas[mid]) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return low;
}

function samplePointInTriangle(a, b, c, target) {
  let u = Math.random();
  let v = Math.random();
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }

  target
    .copy(a)
    .addScaledVector(new THREE.Vector3().subVectors(b, a), u)
    .addScaledVector(new THREE.Vector3().subVectors(c, a), v);
}

function findSampleMesh(root) {
  let result = null;
  root?.traverse?.((child) => {
    if (!result && child?.isMesh && child.geometry?.attributes?.position) {
      result = child;
    }
  });
  return result;
}

function resolveAssetTransform(asset, mesh, category) {
  const fields = asset?.fields || {};
  const x = Number(fields["X-pos"]?.value || 0);
  const y = Number(fields["Y-pos"]?.value || 0);
  const z = Number(fields["Z-pos"]?.value || 0);
  const width = Number(fields["Width"]?.value || 0);
  const height = Number(fields["Height"]?.value || 0);
  const length = Number(fields["Length"]?.value || 0);
  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = mesh.scale.clone().multiplyScalar(0.01);
  if (width > 0 && size.x > 0) scale.y = (width / 10) / size.x * 0.01;
  if (height > 0 && size.y > 0) scale.z = (height / 10) / size.y * 0.01;
  if (length > 0 && size.z > 0) scale.x = (length / 10) / size.z * 0.01;
  const euler = new THREE.Euler(-Math.PI/2, 0, 0, "XYZ");

  return {
    position: new THREE.Vector3(x, z, y).multiplyScalar(0.01),
    quaternion: new THREE.Quaternion().setFromEuler(euler),
    scale,
    color: resolveAssetColor(asset, category)
  };
}

function assetMatchesMorphPlacement(asset, placement) {
  const assetPosition = getAssetPlacement(asset);
  return approximatelyEqual(assetPosition.x, placement.x)
    && approximatelyEqual(assetPosition.y, placement.y)
    && approximatelyEqual(assetPosition.z, placement.z);
}

function getAssetPlacement(asset) {
  const fields = asset?.fields || {};
  const x = Number(fields["X-pos"]?.value ?? asset?.x ?? asset?.position?.x ?? 0);
  const y = Number(fields["Z-pos"]?.value ?? asset?.y ?? asset?.position?.y ?? 0);
  const z = Number(fields["Y-pos"]?.value ?? asset?.z ?? asset?.position?.z ?? 0);
  return { x, y, z };
}

function isMorphPlacement(value) {
  return !!value
    && Number.isFinite(Number(value.x))
    && Number.isFinite(Number(value.y))
    && Number.isFinite(Number(value.z));
}

function approximatelyEqual(left, right, epsilon = 0.001) {
  return Math.abs(Number(left || 0) - Number(right || 0)) <= epsilon;
}

function resolveAssetColor(asset, category) {
  return asset?.fields?.Color?.value || resolveCategoryColor(category);
}

function resolveCategoryColor(category, modelRoot) {
  const mesh = findSampleMesh(modelRoot || category?.fbx);
  return (
    category?.defaultColor ||
    category?.default_color ||
    resolveMeshDisplayColor(modelRoot || category?.fbx) ||
    (mesh?.material?.color?.getHexString?.() ? `#${mesh.material.color.getHexString()}` : "#ffffff")
  );
}

function normalizeColorInput(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "#ffffff";
  }

  const embeddedHex = normalized.match(/#?[0-9a-fA-F]{3,8}/);
  if (embeddedHex?.[0]) {
    const extracted = embeddedHex[0];
    return extracted.startsWith("#") ? extracted : `#${extracted}`;
  }

  if (/^#[0-9a-fA-F]{3,8}$/.test(normalized)) {
    return normalized;
  }

  if (/^[0-9a-fA-F]{3,8}$/.test(normalized)) {
    return `#${normalized}`;
  }

  return normalized;
}

function resolveMeshDisplayColor(root) {
  const colors = [];

  root?.traverse?.((child) => {
    if (!child?.isMesh) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      const color = resolveMaterialDisplayColor(material);
      if (color) {
        colors.push(color);
      }
    }
  });

  if (!colors.length) {
    return null;
  }

  const mixed = colors.reduce(
    (acc, color) => {
      acc.r += color.r;
      acc.g += color.g;
      acc.b += color.b;
      return acc;
    },
    { r: 0, g: 0, b: 0 }
  );

  const count = colors.length;
  return new THREE.Color(mixed.r / count, mixed.g / count, mixed.b / count).getStyle();
}

function resolveMaterialDisplayColor(material) {
  if (!material) {
    return null;
  }

  const baseColor = material.color?.isColor ? material.color.clone() : null;
  const mapColor = sampleTextureAverageColor(material.map);

  if (mapColor && baseColor) {
    return mapColor.multiply(baseColor);
  }

  if (mapColor) {
    return mapColor;
  }

  if (baseColor) {
    return baseColor;
  }

  return null;
}

function sampleTextureAverageColor(texture) {
  const image = texture?.image;
  if (!image || typeof document === "undefined") {
    return null;
  }

  const cached = textureColorCache.get(image);
  if (cached) {
    return cached.clone();
  }

  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  try {
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let weight = 0;

    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3] / 255;
      if (alpha <= 0) {
        continue;
      }

      r += (data[index] / 255) * alpha;
      g += (data[index + 1] / 255) * alpha;
      b += (data[index + 2] / 255) * alpha;
      weight += alpha;
    }

    if (!weight) {
      return null;
    }

    const average = new THREE.Color(r / weight, g / weight, b / weight);
    textureColorCache.set(image, average.clone());
    return average;
  } catch {
    return null;
  }
}
