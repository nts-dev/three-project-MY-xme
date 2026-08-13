const POSITION_TRACK = "position";
const ROTATION_TRACK = "rotation";
const COLOR_TRACK = "color";

export async function hydrateSceneCategoriesWithDbAnimations(projectKey, categories = []) {
  
  const sceneIdentity = parseProjectLevelKey(projectKey);
  if (!sceneIdentity.projectId || !sceneIdentity.level || !Array.isArray(categories) || !categories.length) {
    return categories;
  }

  const rows = await fetchGamePathRows(sceneIdentity.projectId, sceneIdentity.level);
  if (!rows.length) {
    return categories;
  }

  const rowsByAsset = groupRowsByAsset(rows);
  return categories.map((category) => attachCategoryAnimations(category, rowsByAsset));
}

function parseProjectLevelKey(projectKey) {
  const normalized = String(projectKey || "").trim();
  const match = normalized.match(/^(.+?)_(L\d+)$/i);
  if (!match) {
    return { projectId: "", level: "" };
  }

  return {
    projectId: match[1],
    level: match[2].toUpperCase(),
  };
}

async function fetchGamePathRows(projectId, level) {
  
  const url = new URL(`${import.meta.env.VITE_API_URL}/game-path`);
  url.searchParams.set("project_id", projectId);
  url.searchParams.set("level", level);

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load game_path rows for ${projectId}/${level}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.rows) ? payload.rows : [];
}

function groupRowsByAsset(rows) {
  return rows.reduce((map, row) => {
    const assetId = normalizeAssetId(row?.asset_id);
    if (!assetId) {
      return map;
    }

    const group = map.get(assetId) || [];
    group.push(row);
    map.set(assetId, group);
    return map;
  }, new Map());
}

function attachCategoryAnimations(category, rowsByAsset) {
  const nextCategory = { ...category };
  const properties = parseProperties(nextCategory.properties);
  if (Array.isArray(properties.dslAnimations) && properties.dslAnimations.length) {
    return nextCategory;
  }

  const assetIds = collectCategoryAssetIds(nextCategory);
  // console.log(assetIds,rowsByAsset)
  const matchedAssetId = assetIds.find((assetId) => rowsByAsset.has(assetId));
  const rows = matchedAssetId ? (rowsByAsset.get(matchedAssetId) || []) : [];
  const dslAnimations = buildAnimationsFromRows(matchedAssetId || assetIds[0] || "", rows);
  if (!dslAnimations.length) {
    return nextCategory;
  }

  nextCategory.properties = { ...properties, dslAnimations };
  return nextCategory;
}

function collectCategoryAssetIds(category) {
  const candidates = [
    category?.name,
    category?.assetName,
    category?.fbx,
  ];

  return candidates
    .map(normalizeAssetId)
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function buildAnimationsFromRows(assetId, rows) {
  const tracks = groupRowsByTrack(rows);
 
  return Array.from(tracks.values())
    .map((trackRows) => buildAnimationEntry(assetId, trackRows))
    .filter((entry) => entry.steps.length > 0);
}

function groupRowsByTrack(rows) {
  return rows.reduce((map, row) => {
    const trackKey = String(row?.track_index || "0");
    const group = map.get(trackKey) || [];
    group.push(row);
    map.set(trackKey, group);
    return map;
  }, new Map());
}

function buildAnimationEntry(assetId, rows) {
  const orderedRows = [...rows].sort(compareRows);
  const repeatValue = toNumberOrUndefined(orderedRows.find((row) => row?.repeat_value != null && row.repeat_value !== "")?.repeat_value);
  const useTimelineRepeat = repeatValue !== undefined && (
    orderedRows.length > 2 ||
    orderedRows.some((row) => String(row?.interpolation || "").toLowerCase() === "hold")
  );
  const positionOrigin = readVector(orderedRows[0], "_pos");
  const rotationOrigin = readVector(orderedRows[0], "angle_");
  const entry = {
    target: assetId,
    repeat: useTimelineRepeat ? repeatValue : undefined,
    steps: [],
  };

  for (let index = 1; index < orderedRows.length; index += 1) {
    const previous = orderedRows[index - 1];
    const current = orderedRows[index];
    const step = createTweenStep(
      previous,
      current,
      useTimelineRepeat ? undefined : repeatValue,
      positionOrigin,
      rotationOrigin
    );
    if (step) {
      entry.steps.push(step);
    }
  }

  return entry;
}

function createTweenStep(previous, current, repeatValue, positionOrigin, rotationOrigin) {
  const duration = Number(current?.duration || 0);
  if ((current?.interpolation || "").toLowerCase() === "hold") {
    return { type: "wait", duration };
  }

  const track = String(current?.track || previous?.track || POSITION_TRACK).toLowerCase();
  if (track === COLOR_TRACK) {
    if (!previous?.color || !current?.color || previous.color === current.color) {
      return duration > 0 ? { type: "wait", duration } : null;
    }
    return buildTween("color", previous.color, current.color, current, duration, repeatValue);
  }

  if (track === ROTATION_TRACK) {
    return buildVectorTween("rotate", previous, current, "angle_", duration, repeatValue, rotationOrigin);
  }

  return buildVectorTween("move", previous, current, "_pos", duration, repeatValue, positionOrigin);
}

function buildVectorTween(property, previous, current, suffix, duration, repeatValue, origin) {
  const from = toRelativeVector(readVector(previous, suffix), origin);
  const to = toRelativeVector(readVector(current, suffix), origin);
  if (!from || !to) {
    return duration > 0 ? { type: "wait", duration } : null;
  }
  if (from[0] === to[0] && from[1] === to[1] && from[2] === to[2]) {
    return duration > 0 ? { type: "wait", duration } : null;
  }

  return buildTween(property, from, to, current, duration, repeatValue);
}

function buildTween(property, from, to, row, duration, repeatValue) {
  return {
    type: "tween",
    property,
    from,
    to,
    duration,
    ease: row?.ease || undefined,
    yoyo: toBooleanOrUndefined(row?.yoyo),
    repeat: repeatValue,
    random: toBooleanOrUndefined(row?.is_random),
  };
}

function readVector(row, suffix) {
  const x = row?.[`x${suffix}`];
  const y = row?.[`y${suffix}`];
  const z = row?.[`z${suffix}`];
  if (x == null || y == null || z == null) {
    return null;
  }

  return [Number(x || 0), Number(y || 0), Number(z || 0)];
}

function toRelativeVector(value, origin) {
  if (!value) {
    return null;
  }
  if (!origin) {
    return value;
  }

  return [
    value[0] - origin[0],
    value[1] - origin[1],
    value[2] - origin[2],
  ];
}

function compareRows(left, right) {
  const trackDiff = Number(left?.track_index || 0) - Number(right?.track_index || 0);
  if (trackDiff !== 0) {
    return trackDiff;
  }

  const stepDiff = Number(left?.step_index || 0) - Number(right?.step_index || 0);
  if (stepDiff !== 0) {
    return stepDiff;
  }

  return Number(left?.id || 0) - Number(right?.id || 0);
}

function parseProperties(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
}

function normalizeAssetId(value) {
  return String(value || "")
    .replace(/\.(fbx|glb|gltf)$/i, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toLowerCase();
}

function toBooleanOrUndefined(value) {
  if (value == null || value === "") {
    return undefined;
  }
  return String(value).toLowerCase() === "true";
}

function toNumberOrUndefined(value) {
  if (value == null || value === "") {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}
