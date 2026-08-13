import { useEffect, useRef, useState } from "react";

const FRAME_BUDGET_MS = 5;
const MIN_CATEGORIES_PER_FRAME = 1;

const getNow = () => (
    typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now()
);

const scheduleFrame = (callback) => {
    if (typeof requestAnimationFrame === "function") {
        return requestAnimationFrame(callback);
    }

    return setTimeout(callback, 16);
};

const cancelFrame = (id) => {
    if (typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(id);
        return;
    }

    clearTimeout(id);
};

const getCellVisibleKey = (cell) => cell.cellKey || `${cell.cell?.north || 0},${cell.cell?.east || 0},${cell.cell?.level || 0}`;
const isFallCell = (cell) => cell?.cell?.mode === "currentSceneFall"
    || String(cell?.cellKey || "").includes("@currentSceneFall");

const buildSteps = (cells, visibleByKey) => {
    const steps = [];

    cells.forEach((cell, cellIndex) => {
        if (isFallCell(cell)) {
            return;
        }

        const visibleCount = visibleByKey.get(getCellVisibleKey(cell))?.categories?.length || 0;

        cell.categories.slice(visibleCount).forEach((category) => {
            steps.push({ cellIndex, category });
        });
    });

    return steps;
};

const getInitialVisibleCells = (cells, previousCells) => {
    const previousByKey = new Map(previousCells.map((cell) => [getCellVisibleKey(cell), cell]));

    return cells.map((cell) => {
        const previous = previousByKey.get(getCellVisibleKey(cell));
        if (isFallCell(cell)) {
            return cell;
        }

        if (!previous) {
            return { ...cell, categories: [] };
        }

        if (previous.cellKey !== cell.cellKey) {
            return { ...cell, categories: [] };
        }

        return {
            ...cell,
            categories: previous.categories.slice(0, cell.categories.length),
        };
    });
};

export default function useProgressiveCloneCells(targetCells) {
    const [visibleCells, setVisibleCells] = useState([]);
    const runIdRef = useRef(0);
    const visibleCellsRef = useRef([]);

    useEffect(() => {
        visibleCellsRef.current = visibleCells;
    }, [visibleCells]);

    useEffect(() => {
        const runId = ++runIdRef.current;
        const cells = Array.isArray(targetCells) ? targetCells : [];

        if (!cells.length) {
            setVisibleCells([]);
            return undefined;
        }

        const initialCells = getInitialVisibleCells(cells, visibleCellsRef.current);
        const visibleByKey = new Map(initialCells.map((cell) => [getCellVisibleKey(cell), cell]));
        const steps = buildSteps(cells, visibleByKey);
        let stepIndex = 0;
        let frameId = null;
        let stagedCells = steps.length ? initialCells : cells;

        setVisibleCells(stagedCells);

        if (!steps.length) {
            return undefined;
        }

        const flushFrame = () => {
            if (runId !== runIdRef.current) {
                return;
            }

            const startedAt = getNow();
            let flushed = 0;

            while (
                stepIndex < steps.length
                && (flushed < MIN_CATEGORIES_PER_FRAME || getNow() - startedAt < FRAME_BUDGET_MS)
            ) {
                const step = steps[stepIndex];
                const currentCell = stagedCells[step.cellIndex];
                stagedCells = stagedCells.map((cell, index) => (
                    index === step.cellIndex
                        ? { ...currentCell, categories: [...currentCell.categories, step.category] }
                        : cell
                ));
                stepIndex += 1;
                flushed += 1;
            }

            setVisibleCells(stagedCells);

            if (stepIndex < steps.length) {
                frameId = scheduleFrame(flushFrame);
            }
        };

        frameId = scheduleFrame(flushFrame);

        return () => {
            runIdRef.current += 1;
            if (frameId !== null) {
                cancelFrame(frameId);
            }
        };
    }, [targetCells]);

    return visibleCells;
}
