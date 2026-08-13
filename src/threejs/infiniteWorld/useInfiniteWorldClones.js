import { useEffect, useMemo, useRef, useState } from "react";
import { buildScenePayload, buildWorldCloneCells } from "./infiniteWorldCloneProcessing";
import { getCellKey, isOriginCell } from "./infiniteWorldUtils";

const createWorker = () => {
    if (typeof Worker === "undefined") {
        return null;
    }

    return new Worker(new URL("./infiniteWorldClone.worker.js", import.meta.url), { type: "module" });
};

const getDataSignature = (data = []) => data
    .map((item) => `${item.renderKey || item.cleanKey || item.fileName || item.name}:${item.sceneSig || ""}`)
    .join("|");

const MAX_CACHED_CLONE_CELLS = 6;
const HORIZONTAL_POOL_SLOT_COUNT = 6;

const pruneCloneCache = (cacheCells, activeKeys) => {
    const activeKeySet = new Set(activeKeys);

    activeKeys.forEach((key) => {
        const cachedCell = cacheCells.get(key);
        if (!cachedCell) {
            return;
        }

        cacheCells.delete(key);
        cacheCells.set(key, cachedCell);
    });

    if (cacheCells.size <= MAX_CACHED_CLONE_CELLS) {
        return;
    }

    for (const key of cacheCells.keys()) {
        if (activeKeySet.has(key)) {
            continue;
        }

        cacheCells.delete(key);
        if (cacheCells.size <= MAX_CACHED_CLONE_CELLS) {
            return;
        }
    }
};

const mergeCellCategories = (data, workerCell) => ({
    cell: workerCell.cell,
    cellKey: workerCell.cellKey,
    categories: workerCell.categories.map((category) => ({
        ...data[category.sourceIndex],
        assets: category.assets,
        renderKey: category.renderKey,
    })),
});

const getUniqueWorkerCells = (visibleCells, prefetchCells) => {
    const cellsByKey = new Map();

    visibleCells.forEach((cell) => {
        cellsByKey.set(getCellKey(cell), cell);
    });

    prefetchCells.forEach((cell) => {
        const key = getCellKey(cell);
        if (!isOriginCell(cell) && !cellsByKey.has(key)) {
            cellsByKey.set(key, cell);
        }
    });

    return Array.from(cellsByKey.values());
};

const getHorizontalPoolSlotKey = (cell, slotIndex) => `horizontal-slot-${slotIndex % HORIZONTAL_POOL_SLOT_COUNT}`;

const isFallCell = (cell) => cell?.mode === "currentSceneFall";

const getCurrentVisibleCell = (visibleCells = []) => (
    visibleCells.find((cell) => !isOriginCell(cell) && !isFallCell(cell))
    || visibleCells.find((cell) => !isFallCell(cell))
    || { north: 0, east: 0, level: 0 }
);

const getRelativeSlotOrder = (cell, currentCell) => {
    const eastDelta = (cell.east || 0) - (currentCell.east || 0);
    const northDelta = (cell.north || 0) - (currentCell.north || 0);

    if (northDelta === 0 && eastDelta === 0) return -1;
    if (northDelta === 1 && eastDelta === 0) return 0;
    if (northDelta === 1 && eastDelta === -1) return 1;
    if (northDelta === 1 && eastDelta === 1) return 2;
    if (northDelta === 0 && eastDelta === -1) return 3;
    if (northDelta === 0 && eastDelta === 1) return 4;
    if (northDelta === -1 && eastDelta === 0) return 5;

    return Math.abs(northDelta) * 10 + Math.abs(eastDelta) * 5 + (northDelta < 0 ? 2 : 0) + (eastDelta < 0 ? 1 : 0);
};

const assignClonePoolSlots = (cells = []) => {
    const currentCell = getCurrentVisibleCell(cells.map((item) => item.cell).filter(Boolean));
    const horizontalCells = cells
        .filter((cell) => !isFallCell(cell.cell))
        .sort((left, right) => (
            getRelativeSlotOrder(left.cell, currentCell) - getRelativeSlotOrder(right.cell, currentCell)
        ));
    const horizontalSlotByCellKey = new Map();

    horizontalCells.forEach((cell, index) => {
        horizontalSlotByCellKey.set(cell.cellKey, getHorizontalPoolSlotKey(cell.cell, index));
    });

    return cells.map((cell) => {
        const slotKey = isFallCell(cell.cell)
            ? `fall-${cell.cellKey}`
            : horizontalSlotByCellKey.get(cell.cellKey) || getHorizontalPoolSlotKey(cell.cell, 0);

        return {
            ...cell,
            slotKey,
            categories: cell.categories.map((category) => ({
                ...category,
                renderKey: `${category.cleanKey || category.fileName || category.name || category.renderKey}_${cell.cellKey}`,
            })),
        };
    });
};

export default function useInfiniteWorldClones(data, cells, metrics, prefetchCells = []) {
    const workerRef = useRef(null);
    const requestIdRef = useRef(0);
    const cacheRef = useRef({ signature: "", cells: new Map() });
    const [cloneCells, setCloneCells] = useState([]);
    const dataSignature = useMemo(() => getDataSignature(data), [data]);
    const scenePayload = useMemo(() => buildScenePayload(data), [data, dataSignature]);
    const metricsSignature = `${metrics.spanX}:${metrics.spanZ}:${metrics.fieldScale}`;
    const cacheSignature = `${dataSignature}:${metricsSignature}`;
    const cloneCellsSignature = useMemo(
        () => cells.filter((cell) => !isOriginCell(cell)).map(getCellKey).join("|"),
        [cells]
    );
    const prefetchCellsSignature = useMemo(
        () => prefetchCells.filter((cell) => !isOriginCell(cell)).map(getCellKey).join("|"),
        [prefetchCells]
    );

    useEffect(() => {
        workerRef.current = createWorker();
        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);

    useEffect(() => {
        requestIdRef.current += 1;
        cacheRef.current = { signature: cacheSignature, cells: new Map() };
        setCloneCells([]);
        workerRef.current?.terminate();
        workerRef.current = createWorker();
    }, [cacheSignature]);

    useEffect(() => {
        const workerCells = cells.filter((cell) => !isOriginCell(cell));
        const buildCells = getUniqueWorkerCells(workerCells, prefetchCells);
        if (!workerCells.length || !data?.length) {
            setCloneCells([]);
            if (buildCells.length && data?.length) {
                // Keep prefetch-only cells warming in the cache even while none are visible.
            } else {
                return;
            }
        }

        if (!buildCells.length || !data?.length) {
            return;
        }

        if (cacheRef.current.signature !== cacheSignature) {
            cacheRef.current = { signature: cacheSignature, cells: new Map() };
        }

        const orderedKeys = workerCells.map(getCellKey);
        const orderedKeySet = new Set(orderedKeys);
        const warmupKeys = prefetchCells
            .map(getCellKey)
            .filter((key) => !orderedKeySet.has(key));
        const buildKeys = buildCells.map(getCellKey);
        pruneCloneCache(cacheRef.current.cells, buildKeys);
        const missingCells = buildCells.filter((cell) => !cacheRef.current.cells.has(getCellKey(cell)));
        const publishCachedCells = () => {
            const visibleCells = orderedKeys
                .map((key) => cacheRef.current.cells.get(key))
                .filter(Boolean);
            setCloneCells(assignClonePoolSlots(visibleCells));
        };

        if (!missingCells.length) {
            publishCachedCells();
            return;
        }

        publishCachedCells();

        const requestId = ++requestIdRef.current;
        const worker = workerRef.current;

        const applyCells = (builtCells) => {
            if (requestId !== requestIdRef.current) {
                return;
            }

            builtCells.forEach((cell) => {
                cacheRef.current.cells.set(cell.cellKey, mergeCellCategories(data, cell));
            });
            pruneCloneCache(cacheRef.current.cells, buildKeys);
            publishCachedCells();
        };

        if (!worker) {
            applyCells(buildWorldCloneCells({ scenePayload, cells: missingCells, metrics }));
            return;
        }

        const handleMessage = (event) => {
            const { id, cells: builtCells, error } = event.data || {};
            if (id !== requestId) {
                return;
            }

            worker.removeEventListener("message", handleMessage);
            if (error) {
                console.warn("[InfiniteWorld] Worker clone failed, using main-thread fallback:", error);
                applyCells(buildWorldCloneCells({ scenePayload, cells: buildCells, metrics }));
                return;
            }

            applyCells(builtCells || []);
        };

        worker.addEventListener("message", handleMessage);
        worker.postMessage({
            id: requestId,
            scenePayload,
            cells: missingCells,
            metrics,
        });

        return () => {
            worker.removeEventListener("message", handleMessage);
        };
    }, [cacheSignature, cloneCellsSignature, data, dataSignature, metrics, metricsSignature, prefetchCells, prefetchCellsSignature, scenePayload]);

    return cloneCells;
}
