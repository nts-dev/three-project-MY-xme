import React from "react";
import useInfiniteWorldCells from "./useInfiniteWorldCells";
import InfiniteWorldCell from "./InfiniteWorldCell";
import { getCellKey, isOriginCell } from "./infiniteWorldUtils";
import useInfiniteWorldClones from "./useInfiniteWorldClones";
import useProgressiveCloneCells from "./useProgressiveCloneCells";
import useGame from "../../hooks/useGame";

export default function InfiniteWorldRenderer({ data, projectId, world, scene, floors }) {
    const buttonMode = useGame((state) => state.buttonMode);
    const { cells, prefetchCells, metrics } = useInfiniteWorldCells(projectId);
    const cloneCells = useInfiniteWorldClones(data, cells, metrics, prefetchCells);
    const visibleCloneCells = useProgressiveCloneCells(cloneCells);
    const isEditMode = buttonMode === "Edit Mode";
    const shouldRenderOrigin = isEditMode || cells.some(isOriginCell);
    const clonesVisible = buttonMode === "Play mode";
    const metricsKey = [
        metrics.spanX,
        metrics.spanY,
        metrics.spanZ,
        metrics.originX,
        metrics.originZ,
    ].map((value) => Number(value || 0).toFixed(4)).join(":");

    if (!data?.length) {
        return null;
    }

    return (
        <>
            {shouldRenderOrigin && (
                <InfiniteWorldCell
                    key={`${projectId}:${metricsKey}:0,0,0`}
                    projectId={projectId}
                    metricsKey={metricsKey}
                    cellKey="0,0,0"
                    cell={{ north: 0, east: 0, level: 0 }}
                    metrics={metrics}
                    data={data}
                    world={world}
                    scene={scene}
                    floors={floors}
                />
            )}
            {visibleCloneCells.map((cloneCell) => (
                <InfiniteWorldCell
                    key={`${projectId}:${metricsKey}:${cloneCell.cellKey || getCellKey(cloneCell.cell)}`}
                    projectId={projectId}
                    metricsKey={metricsKey}
                    cellKey={cloneCell.cellKey || getCellKey(cloneCell.cell)}
                    worldCellKey={cloneCell.cellKey || getCellKey(cloneCell.cell)}
                    cell={cloneCell.cell}
                    metrics={metrics}
                    data={cloneCell.categories}
                    visible={clonesVisible}
                    world={world}
                    scene={scene}
                    floors={floors}
                />
            ))}
        </>
    );
}
