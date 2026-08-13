import { useSyncExternalStore } from "react";

let landingTilePositions = [];
let landingTileSignature = "";
let fallLandingTiles = [];
let fallLandingTileSignature = "";
const fallLandingTilesByCell = new Map();
const listeners = new Set();
const fallListeners = new Set();

const getTileSignature = (tiles = []) => tiles
    .map((tile) => {
        const position = tile?.position || [];
        return `${tile?.key ?? ""}:${position[0] ?? ""}:${position[1] ?? ""}:${position[2] ?? ""}`;
    })
    .join("|");

export function setLandingTilePositions(instanceData = []) {
    const tiles = instanceData
        .filter((item) => Array.isArray(item?.position) && item.position.length >= 3)
        .map((item) => ({
            key: item.key,
            position: [Number(item.position[0]) || 0, Number(item.position[1]) || 0, Number(item.position[2]) || 0],
            boundsSize: item.boundsSize,
            boundsCenter: item.boundsCenter,
        }));
    const nextSignature = getTileSignature(tiles);

    if (nextSignature === landingTileSignature) {
        return;
    }

    landingTileSignature = nextSignature;
    landingTilePositions = tiles;
    listeners.forEach((listener) => listener());
}

export function clearLandingTilePositions() {
    if (!landingTilePositions.length && !landingTileSignature) {
        return;
    }

    landingTilePositions = [];
    landingTileSignature = "";
    listeners.forEach((listener) => listener());
}

export function subscribeLandingTilePositions(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getLandingTilePositionsSnapshot() {
    return landingTilePositions;
}

export function useLandingTilePositions() {
    return useSyncExternalStore(
        subscribeLandingTilePositions,
        getLandingTilePositionsSnapshot,
        getLandingTilePositionsSnapshot
    );
}

export function setFallLandingTilePositions(cellKey = "", instanceData = []) {
    const tiles = instanceData
        .filter((item) => Array.isArray(item?.position) && item.position.length >= 3)
        .map((item) => ({
            key: item.key,
            cellKey,
            position: [Number(item.position[0]) || 0, Number(item.position[1]) || 0, Number(item.position[2]) || 0],
            boundsSize: item.boundsSize,
            boundsCenter: item.boundsCenter,
        }));
    const mapKey = cellKey || "__global";
    const previousTiles = fallLandingTilesByCell.get(mapKey) || [];
    const previousSignature = getTileSignature(previousTiles);
    const nextCellSignature = getTileSignature(tiles);

    if (nextCellSignature === previousSignature) {
        return;
    }

    if (tiles.length) {
        fallLandingTilesByCell.set(mapKey, tiles);
    } else {
        fallLandingTilesByCell.delete(mapKey);
    }

    fallLandingTiles = Array.from(fallLandingTilesByCell.values()).flat();
    const nextSignature = getTileSignature(fallLandingTiles);
    if (nextSignature === fallLandingTileSignature) {
        return;
    }

    fallLandingTileSignature = nextSignature;
    console.warn("[InfiniteWorld] fall landing tile store updated", {
        cellKey,
        registeredCount: tiles.length,
        totalCount: fallLandingTiles.length,
        firstTile: fallLandingTiles[0] || null,
    });
    fallListeners.forEach((listener) => listener());
}

export function clearFallLandingTilePositions(cellKey = "") {
    const mapKey = cellKey || "__global";
    if (cellKey && !fallLandingTilesByCell.has(mapKey)) {
        return;
    }

    if (cellKey) {
        fallLandingTilesByCell.delete(mapKey);
    } else {
        fallLandingTilesByCell.clear();
    }
    fallLandingTiles = Array.from(fallLandingTilesByCell.values()).flat();
    fallLandingTileSignature = getTileSignature(fallLandingTiles);
    console.warn("[InfiniteWorld] fall landing tile store cleared", {
        cellKey,
        totalCount: fallLandingTiles.length,
        firstTile: fallLandingTiles[0] || null,
    });
    fallListeners.forEach((listener) => listener());
}

export function subscribeFallLandingTilePositions(listener) {
    fallListeners.add(listener);
    return () => {
        fallListeners.delete(listener);
    };
}

export function getFallLandingTilePositionsSnapshot() {
    return fallLandingTiles;
}

export function getNearestFallLandingTile(position = {}) {
    if (!fallLandingTiles.length) {
        return null;
    }

    let nearestTile = null;
    let nearestDistanceSq = Infinity;
    const targetX = Number(position.x) || 0;
    const targetY = Number.isFinite(position.y) ? Number(position.y) : null;
    const targetZ = Number(position.z) || 0;

    fallLandingTiles.forEach((tile) => {
        const tilePosition = tile.position || [];
        const tileY = Number(tilePosition[1]) || 0;
        if (targetY !== null && Math.abs(tileY - targetY) > 0.75) {
            return;
        }

        const dx = (Number(tilePosition[0]) || 0) - targetX;
        const dz = (Number(tilePosition[2]) || 0) - targetZ;
        const distanceSq = dx * dx + dz * dz;

        if (distanceSq < nearestDistanceSq) {
            nearestDistanceSq = distanceSq;
            nearestTile = tile;
        }
    });

    return nearestTile;
}

export function getRandomFallLandingTile(position = {}, lockedTile = null, options = {}) {
    const useBaseLandingTiles = landingTilePositions.length > 0;
    const sourceTiles = useBaseLandingTiles ? landingTilePositions : fallLandingTiles;

    if (!sourceTiles.length) {
        return null;
    }

    if (lockedTile) {
        return lockedTile;
    }

    const selectedTile = sourceTiles[Math.floor(Math.random() * sourceTiles.length)];
    if (!useBaseLandingTiles) {
        return selectedTile;
    }

    const horizontalOffsetX = Number(options.horizontalOffsetX) || 0;
    const horizontalOffsetZ = Number(options.horizontalOffsetZ) || 0;
    const verticalOffset = Number(options.verticalOffset) || 0;
    const tilePosition = selectedTile.position || [];

    return {
        ...selectedTile,
        sourcePosition: tilePosition,
        position: [
            (Number(tilePosition[0]) || 0) + horizontalOffsetX,
            (Number(tilePosition[1]) || 0) + verticalOffset,
            (Number(tilePosition[2]) || 0) + horizontalOffsetZ,
        ],
        horizontalOffset: {
            x: horizontalOffsetX,
            z: horizontalOffsetZ,
        },
        verticalOffset,
    };
}

const projectBaseTileIntoCell = (tile, options = {}) => {
    const tilePosition = tile?.position || [];
    const horizontalOffsetX = Number(options.horizontalOffsetX) || 0;
    const horizontalOffsetZ = Number(options.horizontalOffsetZ) || 0;
    const verticalOffset = Number(options.verticalOffset) || 0;

    return {
        ...tile,
        sourcePosition: tilePosition,
        position: [
            (Number(tilePosition[0]) || 0) + horizontalOffsetX,
            (Number(tilePosition[1]) || 0) + verticalOffset,
            (Number(tilePosition[2]) || 0) + horizontalOffsetZ,
        ],
        boundsSize: tile.boundsSize,
        boundsCenter: tile.boundsCenter
            ? [
                (Number(tile.boundsCenter[0]) || 0) + horizontalOffsetX,
                (Number(tile.boundsCenter[1]) || 0) + verticalOffset,
                (Number(tile.boundsCenter[2]) || 0) + horizontalOffsetZ,
            ]
            : undefined,
        horizontalOffset: {
            x: horizontalOffsetX,
            z: horizontalOffsetZ,
        },
        verticalOffset,
        projectedFromBaseScene: true,
    };
};

const getRandomTile = (tiles = []) => {
    if (!tiles.length) {
        return null;
    }

    return tiles[Math.floor(Math.random() * tiles.length)] || null;
};

const findNearestTile = (tiles = [], position = {}) => {
    const targetX = Number(position.x) || 0;
    const targetZ = Number(position.z) || 0;
    let selectedTile = null;
    let nearestDistanceSq = Infinity;

    tiles.forEach((tile) => {
        const tilePosition = tile?.position || [];
        const dx = (Number(tilePosition[0]) || 0) - targetX;
        const dz = (Number(tilePosition[2]) || 0) - targetZ;
        const distanceSq = dx * dx + dz * dz;

        if (distanceSq < nearestDistanceSq) {
            nearestDistanceSq = distanceSq;
            selectedTile = tile;
        }
    });

    return selectedTile
        ? {
            ...selectedTile,
            deterministic: true,
            distanceSq: nearestDistanceSq,
        }
        : null;
};

export function getDeterministicFallLandingTile(position = {}, lockedTile = null, options = {}) {
    if (lockedTile?.position) {
        return lockedTile;
    }

    const projectedBaseTiles = landingTilePositions.map((tile) => projectBaseTileIntoCell(tile, options));
    const projectedBaseTile = getRandomTile(projectedBaseTiles);
    if (projectedBaseTile) {
        return {
            ...projectedBaseTile,
            deterministic: true,
            lookupSource: "projectedBaseSceneTile",
            selectionMode: "randomProjectedBaseSceneTile",
        };
    }

    const registeredFallTile = getRandomTile(fallLandingTiles) || findNearestTile(fallLandingTiles, position);
    return registeredFallTile
        ? {
            ...registeredFallTile,
            deterministic: true,
            lookupSource: "registeredGeneratedSceneTile",
            selectionMode: "randomRegisteredGeneratedSceneTile",
        }
        : null;
}

export function useFallLandingTilePositions() {
    return useSyncExternalStore(
        subscribeFallLandingTilePositions,
        getFallLandingTilePositionsSnapshot,
        getFallLandingTilePositionsSnapshot
    );
}
