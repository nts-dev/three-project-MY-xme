import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import useGame from "../../hooks/useGame";
import { avatarFacingYawDegrees, fallSceneCenterOverride, realTimeChaPosition } from "../player/puzzle/character/Constants.jsx";
import { getCellKey, getPlayerCell, getPositionInsideCell, getWorldMetrics } from "./infiniteWorldUtils";

const UPDATE_INTERVAL = 0.18;
const VERTICAL_FALL_TRIGGER_Y = -1;
const VERTICAL_FALL_PROMOTE_MARGIN = 0.35;
const SCENE_REMOVAL_FORGIVENESS_DISTANCE = 0.05;
const PREFETCH_EDGE_MULTIPLIER = 1.8;
const FRONT_EDGE_RETENTION_MULTIPLIER = 2.6;
const SIDE_EDGE_RETENTION_MULTIPLIER = 2;
const HORIZONTAL_VIEW_FOV_DEGREES = 180;
const HORIZONTAL_VIEW_MAX_CELL_DISTANCE = 1.65;
const DEBUG_INFINITE_WORLD = true;

const isFallCell = (cell) => cell?.mode === "currentSceneFall";

const createCellMap = (current) => new Map([[getCellKey(current), current]]);

const addCell = (cells, cell) => {
    cells.set(getCellKey(cell), cell);
};

const withPlatformVerticalOffset = (cell, platformVerticalOffset = 0) => {
    if (!Number.isFinite(platformVerticalOffset) || Math.abs(platformVerticalOffset) < 0.0001) {
        return cell;
    }

    return {
        ...cell,
        verticalOffset: platformVerticalOffset,
    };
};

const normalizeYawDegrees = (yawDegrees = 0) => (
    ((Number(yawDegrees) || 0) % 360 + 360) % 360
);

const getFacingGenerationDirection = (yawDegrees = 0) => {
    const normalizedYaw = normalizeYawDegrees(yawDegrees);

    if (normalizedYaw >= 315 || normalizedYaw < 45) {
        return { eastStep: 0, northStep: 1, direction: "north", yawDegrees: normalizedYaw };
    }

    if (normalizedYaw < 135) {
        return { eastStep: 1, northStep: 0, direction: "east", yawDegrees: normalizedYaw };
    }

    if (normalizedYaw < 225) {
        return { eastStep: 0, northStep: -1, direction: "south", yawDegrees: normalizedYaw };
    }

    return { eastStep: -1, northStep: 0, direction: "west", yawDegrees: normalizedYaw };
};

const getFacingVector = (yawDegrees = 0) => {
    const radians = (normalizeYawDegrees(yawDegrees) * Math.PI) / 180;
    return {
        x: Math.sin(radians),
        z: Math.cos(radians),
    };
};

const isNearFacingEdge = (local, metrics, direction, prefetch = false) => {
    const edgeDistanceX = prefetch
        ? Math.min(Math.max(metrics.spanX / 2 - 0.01, 0.01), metrics.edgeDistanceX * PREFETCH_EDGE_MULTIPLIER)
        : metrics.edgeDistanceX;
    const edgeDistanceZ = prefetch
        ? Math.min(Math.max(metrics.spanZ / 2 - 0.01, 0.01), metrics.edgeDistanceZ * PREFETCH_EDGE_MULTIPLIER)
        : metrics.edgeDistanceZ;

    if (direction === "east") {
        return local.x > metrics.spanX / 2 - edgeDistanceX;
    }

    if (direction === "west") {
        return local.x < -metrics.spanX / 2 + edgeDistanceX;
    }

    if (direction === "north") {
        return local.z > metrics.spanZ / 2 - edgeDistanceZ;
    }

    if (direction === "south") {
        return local.z < -metrics.spanZ / 2 + edgeDistanceZ;
    }

    return false;
};

const getEdgeDistanceDebug = (local, metrics, facing) => {
    const halfX = metrics.spanX / 2;
    const halfZ = metrics.spanZ / 2;
    const distances = {
        east: halfX - local.x,
        west: local.x + halfX,
        north: halfZ - local.z,
        south: local.z + halfZ,
    };
    const thresholds = {
        east: metrics.edgeDistanceX,
        west: metrics.edgeDistanceX,
        north: metrics.edgeDistanceZ,
        south: metrics.edgeDistanceZ,
    };
    const facingDistance = distances[facing.direction] ?? Infinity;
    const facingThreshold = thresholds[facing.direction] ?? 0;

    return {
        localPosition: {
            x: Number(local.x.toFixed(4)),
            z: Number(local.z.toFixed(4)),
        },
        sceneHalfSpan: {
            x: Number(halfX.toFixed(4)),
            z: Number(halfZ.toFixed(4)),
        },
        distanceToEdges: {
            east: Number(distances.east.toFixed(4)),
            west: Number(distances.west.toFixed(4)),
            north: Number(distances.north.toFixed(4)),
            south: Number(distances.south.toFixed(4)),
        },
        facingEdgeDistance: Number(facingDistance.toFixed(4)),
        generationThreshold: Number(facingThreshold.toFixed(4)),
        shouldGenerate: facingDistance <= facingThreshold,
    };
};

const addFacingHorizontalCell = (cells, current, local, metrics, facing, prefetch = false) => {
    if (!isNearFacingEdge(local, metrics, facing.direction, prefetch)) {
        return null;
    }

    const cell = withPlatformVerticalOffset({
        north: current.north + facing.northStep,
        east: current.east + facing.eastStep,
        level: current.level,
    }, current.verticalOffset || 0);
    addCell(cells, cell);

    return cell;
};

const addHorizontalWindowCells = (cells, current, local, metrics, facing) => {
    const frontEdgeDistanceX = Math.min(
        Math.max(metrics.spanX / 2 - 0.01, 0.01),
        (metrics.edgeDistanceX * FRONT_EDGE_RETENTION_MULTIPLIER) + SCENE_REMOVAL_FORGIVENESS_DISTANCE
    );
    const frontEdgeDistanceZ = Math.min(
        Math.max(metrics.spanZ / 2 - 0.01, 0.01),
        (metrics.edgeDistanceZ * FRONT_EDGE_RETENTION_MULTIPLIER) + SCENE_REMOVAL_FORGIVENESS_DISTANCE
    );
    const nearEast = local.x > metrics.spanX / 2 - frontEdgeDistanceX;
    const nearWest = local.x < -metrics.spanX / 2 + frontEdgeDistanceX;
    const nearNorth = local.z > metrics.spanZ / 2 - frontEdgeDistanceZ;
    const nearSouth = local.z < -metrics.spanZ / 2 + frontEdgeDistanceZ;

    const lookingAtActiveEdge =
        (facing.direction === "east" && nearEast)
        || (facing.direction === "west" && nearWest)
        || (facing.direction === "north" && nearNorth)
        || (facing.direction === "south" && nearSouth);

    return lookingAtActiveEdge
        ? addFacingHorizontalCell(cells, current, local, metrics, facing, false)
        : null;
};

const getNeighborEdgeRequirement = (step, localValue, halfSpan, edgeDistance) => {
    if (step > 0) {
        return localValue > halfSpan - edgeDistance;
    }

    if (step < 0) {
        return localValue < -halfSpan + edgeDistance;
    }

    return true;
};

const getCellDistanceFromAvatar = (cell, current, local, metrics) => {
    const centerX = (cell.east - current.east) * metrics.spanX - local.x;
    const centerZ = (cell.north - current.north) * metrics.spanZ - local.z;
    const distanceToRectX = Math.max(Math.abs(centerX) - metrics.spanX / 2, 0);
    const distanceToRectZ = Math.max(Math.abs(centerZ) - metrics.spanZ / 2, 0);
    const closestX = Math.sign(centerX) * distanceToRectX;
    const closestZ = Math.sign(centerZ) * distanceToRectZ;

    return {
        centerX,
        centerZ,
        closestX,
        closestZ,
        distance: Math.sqrt(distanceToRectX * distanceToRectX + distanceToRectZ * distanceToRectZ),
    };
};

const isCellInForwardView = (cell, current, local, metrics, facing) => {
    const { centerX, centerZ, closestX, closestZ, distance } = getCellDistanceFromAvatar(cell, current, local, metrics);
    const maxDistance = Math.max(metrics.spanX, metrics.spanZ) * HORIZONTAL_VIEW_MAX_CELL_DISTANCE;

    if (distance > maxDistance) {
        return false;
    }

    const viewX = Math.abs(closestX) > 0.0001 || Math.abs(closestZ) > 0.0001 ? closestX : centerX;
    const viewZ = Math.abs(closestX) > 0.0001 || Math.abs(closestZ) > 0.0001 ? closestZ : centerZ;
    const vectorLength = Math.hypot(viewX, viewZ);
    if (vectorLength < 0.0001) {
        return true;
    }

    const facingVector = getFacingVector(facing.yawDegrees);
    const dot = ((viewX / vectorLength) * facingVector.x) + ((viewZ / vectorLength) * facingVector.z);
    const minDot = Math.cos((HORIZONTAL_VIEW_FOV_DEGREES / 2) * Math.PI / 180) - 0.01;

    return dot >= minDot;
};

const addVisibleHorizontalCells = (cells, current, local, metrics, facing) => {
    const halfX = metrics.spanX / 2;
    const halfZ = metrics.spanZ / 2;
    const sideEdgeDistanceX = Math.min(
        Math.max(metrics.spanX * 0.5 - 0.01, 0.01),
        (metrics.edgeDistanceX * SIDE_EDGE_RETENTION_MULTIPLIER) + SCENE_REMOVAL_FORGIVENESS_DISTANCE
    );
    const sideEdgeDistanceZ = Math.min(
        Math.max(metrics.spanZ * 0.5 - 0.01, 0.01),
        (metrics.edgeDistanceZ * SIDE_EDGE_RETENTION_MULTIPLIER) + SCENE_REMOVAL_FORGIVENESS_DISTANCE
    );
    const frontEdgeDistanceX = Math.min(
        Math.max(metrics.spanX * 0.5 - 0.01, 0.01),
        (metrics.edgeDistanceX * FRONT_EDGE_RETENTION_MULTIPLIER) + SCENE_REMOVAL_FORGIVENESS_DISTANCE
    );
    const frontEdgeDistanceZ = Math.min(
        Math.max(metrics.spanZ * 0.5 - 0.01, 0.01),
        (metrics.edgeDistanceZ * FRONT_EDGE_RETENTION_MULTIPLIER) + SCENE_REMOVAL_FORGIVENESS_DISTANCE
    );

    for (let northStep = -1; northStep <= 1; northStep += 1) {
        for (let eastStep = -1; eastStep <= 1; eastStep += 1) {
            if (northStep === 0 && eastStep === 0) {
                continue;
            }

            const isFacingNeighbor = eastStep === facing.eastStep && northStep === facing.northStep;
            const edgeDistanceX = isFacingNeighbor ? frontEdgeDistanceX : sideEdgeDistanceX;
            const edgeDistanceZ = isFacingNeighbor ? frontEdgeDistanceZ : sideEdgeDistanceZ;
            const nearEastWestEdge = getNeighborEdgeRequirement(eastStep, local.x, halfX, edgeDistanceX);
            const nearNorthSouthEdge = getNeighborEdgeRequirement(northStep, local.z, halfZ, edgeDistanceZ);

            if (!nearEastWestEdge || !nearNorthSouthEdge) {
                continue;
            }

            const cell = withPlatformVerticalOffset({
                north: current.north + northStep,
                east: current.east + eastStep,
                level: current.level,
            }, current.verticalOffset || 0);
            const isDirectSideNeighbor = (
                (eastStep !== 0 && northStep === 0)
                || (northStep !== 0 && eastStep === 0)
            );

            if (isDirectSideNeighbor || isCellInForwardView(cell, current, local, metrics, facing)) {
                addCell(cells, cell);
            }
        }
    }
};

const addHorizontalPrefetchCells = (cells, current, local, metrics, facing) => {
    return addFacingHorizontalCell(cells, current, local, metrics, facing, true);
};

const getRecentlyExitedCellDistance = (previousCell, currentCell, local, metrics) => {
    if (!previousCell || !currentCell) {
        return Infinity;
    }

    const eastDelta = currentCell.east - previousCell.east;
    const northDelta = currentCell.north - previousCell.north;

    if (eastDelta === 1 && northDelta === 0) {
        return local.x + metrics.spanX / 2;
    }

    if (eastDelta === -1 && northDelta === 0) {
        return metrics.spanX / 2 - local.x;
    }

    if (northDelta === 1 && eastDelta === 0) {
        return local.z + metrics.spanZ / 2;
    }

    if (northDelta === -1 && eastDelta === 0) {
        return metrics.spanZ / 2 - local.z;
    }

    return Infinity;
};

const keepRecentlyExitedCell = (activeCells, previousCell, currentCell, local, metrics) => {
    const exitDistance = getRecentlyExitedCellDistance(previousCell, currentCell, local, metrics);

    if (exitDistance > SCENE_REMOVAL_FORGIVENESS_DISTANCE) {
        return activeCells;
    }

    const cells = new Map(activeCells.map((cell) => [getCellKey(cell), cell]));
    addCell(cells, withPlatformVerticalOffset({
        ...previousCell,
        level: currentCell.level,
    }, currentCell.verticalOffset || 0));

    return Array.from(cells.values());
};

const addBelowPlatformCell = (
    cells,
    current,
    position,
    metrics,
    platformVerticalOffset = 0
) => {
    const belowVerticalOffset = platformVerticalOffset - metrics.spanY;
    const centerOverride = fallSceneCenterOverride.current;
    const horizontalOffsetX = centerOverride
        ? (Number(centerOverride.x) || 0) - (metrics.originX || 0)
        : (current.east || 0) * metrics.spanX;
    const horizontalOffsetZ = centerOverride
        ? (Number(centerOverride.z) || 0) - (metrics.originZ || 0)
        : (current.north || 0) * metrics.spanZ;
    const belowCell = {
        north: current.north,
        east: current.east,
        level: current.level - 1,
        mode: "currentSceneFall",
        horizontalOffsetX,
        horizontalOffsetZ,
        verticalOffset: belowVerticalOffset,
        centeredBelowAvatar: Boolean(centerOverride),
    };

    // if (DEBUG_INFINITE_WORLD) {
    //     console.log("[InfiniteWorld] adding vertical fall scene clone", {
    //         avatarPosition: {
    //             x: position.x,
    //             y: position.y,
    //             z: position.z,
    //         },
    //         currentCell: current,
    //         belowCell,
    //         triggerY: platformVerticalOffset + VERTICAL_FALL_TRIGGER_Y,
    //         sceneHeight: metrics.spanY,
    //         platformVerticalOffset,
    //         horizontalOffset: {
    //             x: belowCell.horizontalOffsetX,
    //             z: belowCell.horizontalOffsetZ,
    //         },
    //         verticalOffset: belowCell.verticalOffset,
    //     });
    // }

    addCell(cells, belowCell);
};

const buildWorldWindowCells = (
    position,
    metrics,
    movement = { x: 0, z: 0 },
    shouldAddFallClone = false,
    facing = getFacingGenerationDirection(),
    platformVerticalOffset = 0
) => {
    const current = withPlatformVerticalOffset({ ...getPlayerCell(position, metrics), level: 0 }, platformVerticalOffset);
    const local = getPositionInsideCell(position, current, metrics);
    const cells = createCellMap(current);

    addHorizontalWindowCells(cells, current, local, metrics, facing);
    addVisibleHorizontalCells(cells, current, local, metrics, facing);

    if (shouldAddFallClone) {
        addBelowPlatformCell(
            cells,
            current,
            position,
            metrics,
            platformVerticalOffset
        );
    }

    return Array.from(cells.values());
};

const buildWorldPrefetchCells = (
    position,
    metrics,
    movement = { x: 0, z: 0 },
    facing = getFacingGenerationDirection(),
    platformVerticalOffset = 0
) => {
    const current = withPlatformVerticalOffset({ ...getPlayerCell(position, metrics), level: 0 }, platformVerticalOffset);
    const local = getPositionInsideCell(position, current, metrics);
    const cells = new Map();

    addHorizontalPrefetchCells(cells, current, local, metrics, facing);
    cells.delete(getCellKey(current));

    return Array.from(cells.values());
};

export default function useInfiniteWorldCells(projectId) {
    const gridSize = useGame((state) => state.gridSize);
    const metrics = useMemo(() => getWorldMetrics(gridSize, projectId), [gridSize, projectId]);
    const [cells, setCells] = useState(() => buildWorldWindowCells(realTimeChaPosition, metrics));
    const [prefetchCells, setPrefetchCells] = useState([]);
    const elapsedRef = useRef(0);
    const cellsRef = useRef(cells);
    const prefetchCellsRef = useRef(prefetchCells);
    const lastPositionRef = useRef({
        x: realTimeChaPosition.x,
        y: realTimeChaPosition.y,
        z: realTimeChaPosition.z,
    });
    const signatureRef = useRef(cells.map(getCellKey).join("|"));
    const prefetchSignatureRef = useRef("");
    const lastHorizontalGenerationLogRef = useRef("");
    const platformVerticalOffsetRef = useRef(0);
    const lastCurrentCellRef = useRef(null);

    useEffect(() => {
    

        platformVerticalOffsetRef.current = 0;
        elapsedRef.current = 0;
        lastPositionRef.current = {
            x: realTimeChaPosition.x,
            y: realTimeChaPosition.y,
            z: realTimeChaPosition.z,
        };
        const nextCells = buildWorldWindowCells(realTimeChaPosition, metrics);
        const nextCurrentCell = withPlatformVerticalOffset(
            { ...getPlayerCell(realTimeChaPosition, metrics), level: 0 },
            0
        );
        const nextPrefetchCells = [];
        const nextSignature = nextCells.map(getCellKey).join("|");

        signatureRef.current = nextSignature;
        prefetchSignatureRef.current = "";
        lastHorizontalGenerationLogRef.current = "";
        lastCurrentCellRef.current = nextCurrentCell;
        fallSceneCenterOverride.current = null;
        cellsRef.current = nextCells;
        prefetchCellsRef.current = nextPrefetchCells;
        setCells(nextCells);
        setPrefetchCells(nextPrefetchCells);
    }, [metrics, projectId]);

    useFrame((_, delta) => {
        elapsedRef.current += delta;
        if (elapsedRef.current < UPDATE_INTERVAL) {
            return;
        }

        elapsedRef.current = 0;
        const movement = {
            x: realTimeChaPosition.x - lastPositionRef.current.x,
            y: realTimeChaPosition.y - (lastPositionRef.current.y ?? realTimeChaPosition.y),
            z: realTimeChaPosition.z - lastPositionRef.current.z,
        };
        lastPositionRef.current = {
            x: realTimeChaPosition.x,
            y: realTimeChaPosition.y,
            z: realTimeChaPosition.z,
        };

        const nextPlatformVerticalOffset = platformVerticalOffsetRef.current - metrics.spanY;
        if (realTimeChaPosition.y <= nextPlatformVerticalOffset + VERTICAL_FALL_PROMOTE_MARGIN) {
            platformVerticalOffsetRef.current = nextPlatformVerticalOffset;
            // if (DEBUG_INFINITE_WORLD) {
            //     console.log("[InfiniteWorld] promoted avatar to lower platform level", {
            //         avatarY: Number(realTimeChaPosition.y.toFixed(4)),
            //         platformVerticalOffset: platformVerticalOffsetRef.current,
            //         sceneHeight: metrics.spanY,
            //     });
            // }
        }

        const platformVerticalOffset = platformVerticalOffsetRef.current;
        const shouldAddFallClone = realTimeChaPosition.y <= platformVerticalOffset + VERTICAL_FALL_TRIGGER_Y;
        const facing = getFacingGenerationDirection(avatarFacingYawDegrees.current);

        const windowCells = buildWorldWindowCells(
            realTimeChaPosition,
            metrics,
            movement,
            shouldAddFallClone,
            facing,
            platformVerticalOffset
        );
        const nextPrefetchCells = buildWorldPrefetchCells(
            realTimeChaPosition,
            metrics,
            movement,
            facing,
            platformVerticalOffset
        );
        const currentCell = withPlatformVerticalOffset(
            { ...getPlayerCell(realTimeChaPosition, metrics), level: 0 },
            platformVerticalOffset
        );
        const localPosition = getPositionInsideCell(realTimeChaPosition, currentCell, metrics);
        const activeCells = keepRecentlyExitedCell(
            windowCells,
            lastCurrentCellRef.current,
            currentCell,
            localPosition,
            metrics
        );
        lastCurrentCellRef.current = currentCell;
        // const localPosition = getPositionInsideCell(realTimeChaPosition, currentCell, metrics);
        // const edgeDebug = getEdgeDistanceDebug(localPosition, metrics, facing);
        // if (DEBUG_INFINITE_WORLD) {
        //     console.log("[InfiniteWorld] horizontal edge distance realtime", {
        //         yawDegrees: Number(facing.yawDegrees.toFixed(2)),
        //         direction: facing.direction,
        //         avatarPosition: {
        //             x: Number(realTimeChaPosition.x.toFixed(4)),
        //             y: Number(realTimeChaPosition.y.toFixed(4)),
        //             z: Number(realTimeChaPosition.z.toFixed(4)),
        //         },
        //         currentCell,
        //         platformVerticalOffset,
        //         ...edgeDebug,
        //     });
        // }
        const generatedHorizontalCells = activeCells.filter((cell) => (
            !isFallCell(cell)
            && cell.level === currentCell.level
            && (
                cell.north !== currentCell.north
                || cell.east !== currentCell.east
            )
        ));
        const horizontalGenerationLogKey = generatedHorizontalCells.map(getCellKey).join("|");
        if (
            DEBUG_INFINITE_WORLD
            && horizontalGenerationLogKey
            && horizontalGenerationLogKey !== lastHorizontalGenerationLogRef.current
        ) {
            lastHorizontalGenerationLogRef.current = horizontalGenerationLogKey;
            // console.log("[InfiniteWorld] horizontal scene generated from avatar facing", {
            //     yawDegrees: Number(facing.yawDegrees.toFixed(2)),
            //     direction: facing.direction,
            //     currentCell,
            //     generatedCells: generatedHorizontalCells,
            // });
        }
        const nextCells = activeCells;
        const nextSignature = nextCells.map(getCellKey).join("|");
        const nextPrefetchSignature = nextPrefetchCells.map(getCellKey).join("|");
  
        if (nextSignature !== signatureRef.current) {
            signatureRef.current = nextSignature;
            cellsRef.current = nextCells;
            setCells(nextCells);
        }

        if (nextPrefetchSignature !== prefetchSignatureRef.current) {
            prefetchSignatureRef.current = nextPrefetchSignature;
            prefetchCellsRef.current = nextPrefetchCells;
            setPrefetchCells(nextPrefetchCells);
        }
    });

    return { cells, prefetchCells, metrics };
}
