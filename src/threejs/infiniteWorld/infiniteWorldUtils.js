const getNumericFieldValue = (fields = {}, name) => Number.parseFloat(fields[name]?.value) || 0;
const SCENE_POSITION_Z_OFFSET = -0.3;
const HORIZONTAL_GENERATION_EDGE_DISTANCE = 2;
const HORIZONTAL_GENERATION_MIN_EDGE_MARGIN = 0.2;

const getHorizontalEdgeDistance = (span) => (
    Math.max(
        0.01,
        Math.min(
            HORIZONTAL_GENERATION_EDGE_DISTANCE,
            (Number(span) || 1) / 2 - HORIZONTAL_GENERATION_MIN_EDGE_MARGIN
        )
    )
);

export const getSceneBoundsMetrics = (data = [], projectId) => {
    const isNumericLike = !isNaN(projectId) || /_L\d+$/i.test(String(projectId));

    if (!isNumericLike || !Array.isArray(data) || !data.length) {
        return null;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let found = false;

    data.forEach((category) => {
        (category?.assets || []).forEach((asset) => {
            const fields = asset?.fields || {};
            const instanceKey = asset?._raw?.instance_id || asset?.instanceId || asset?.instance_id || asset?.key;

            if (!instanceKey || instanceKey === 0 || instanceKey === "0") {
                return;
            }

            const x = getNumericFieldValue(fields, "X-pos") * 0.01;
            const z = getNumericFieldValue(fields, "Y-pos") * 0.01;
            const width = getNumericFieldValue(fields, "Width") * 0.01;
            const length = getNumericFieldValue(fields, "Length") * 0.01;
            const halfWidth = width > 0 ? width / 2 : 0;
            const halfLength = length > 0 ? length / 2 : 0;

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, width > 0 ? x + width : x + halfWidth);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, length > 0 ? z + length : z + halfLength);
            found = true;
        });
    });

    if (!found || !Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
        return null;
    }

    return {
        minX,
        maxX,
        minZ,
        maxZ,
        originX: (minX + maxX) / 2,
        originZ: (minZ + maxZ) / 2,
        spanX: Math.max(1, maxX - minX),
        spanZ: Math.max(1, maxZ - minZ),
    };
};

export const getWorldMetrics = (gridSize = {}, projectId) => {
    const isNumericLike = !isNaN(projectId) || /_L\d+$/i.test(String(projectId));
    const tileStep = isNumericLike ? 0.1 : 1;
    const spanX = Math.max(1, Number(gridSize.x) || 1) * tileStep;
    const spanZ = Math.max(1, Number(gridSize.z) || 1) * tileStep;
    const rawSpanY = Math.max(1, Number(gridSize.y) || 1) * tileStep;
    const spanY = isNumericLike ? rawSpanY : Math.max(4, rawSpanY);

    return {
        spanX,
        spanY,
        spanZ,
        originX: spanX / 2,
        originZ: spanZ / 2 + SCENE_POSITION_Z_OFFSET,
        scenePositionZOffset: SCENE_POSITION_Z_OFFSET,
        minX: 0,
        maxX: spanX,
        minZ: SCENE_POSITION_Z_OFFSET,
        maxZ: spanZ + SCENE_POSITION_Z_OFFSET,
        edgeDistanceX: getHorizontalEdgeDistance(spanX),
        edgeDistanceY: spanY * 0.45,
        edgeDistanceZ: getHorizontalEdgeDistance(spanZ),
        fieldScale: isNumericLike ? 100 : 1,
    };
};

export const getLandingKey = (position = {}) => {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) {
        return "";
    }

    const x = Math.round(position.x * 2) / 2;
    const z = Math.round(position.z * 2) / 2;
    return `${x}:${z}`;
};

export const getCellKey = (cell) => {
    const baseKey = `${cell.north || 0},${cell.east || 0},${cell.level || 0}`;
    const modeKey = cell.mode ? `@${cell.mode}` : "";
    const horizontalKey = cell.mode === "currentSceneFall"
        ? `@x${Math.round((cell.horizontalOffsetX || 0) * 1000) / 1000}@z${Math.round((cell.horizontalOffsetZ || 0) * 1000) / 1000}`
        : "";
    const verticalKey = Number.isFinite(cell.verticalOffset)
        ? `@y${Math.round(cell.verticalOffset * 1000) / 1000}`
        : "";
    return cell.landing?.key ? `${baseKey}${modeKey}${horizontalKey}${verticalKey}@${cell.landing.key}` : `${baseKey}${modeKey}${horizontalKey}${verticalKey}`;
};

export const isOriginCell = (cell) => (
    (cell.north || 0) === 0
    && (cell.east || 0) === 0
    && (cell.level || 0) === 0
    && !Number.isFinite(cell.verticalOffset)
    && !cell.mode
);

export const getPlayerCell = (position, metrics) => ({
    east: Math.floor((position.x - (metrics.originX || 0) + metrics.spanX / 2) / metrics.spanX),
    level: Math.floor((position.y + metrics.spanY / 2) / metrics.spanY),
    north: Math.floor((position.z - (metrics.originZ || 0) + metrics.spanZ / 2) / metrics.spanZ),
});

export const getPositionInsideCell = (position, cell, metrics) => ({
    x: position.x - ((metrics.originX || 0) + cell.east * metrics.spanX),
    y: position.y - (cell.level || 0) * metrics.spanY,
    z: position.z - ((metrics.originZ || 0) + cell.north * metrics.spanZ),
});
