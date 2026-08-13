import React from "react";
import R3fInstancePattern from "../r3fInstancePattern";
import CloneBatchedInstanceCategory from "./CloneBatchedInstanceCategory";
import { isCloneBatchCandidate } from "./cloneBatchClassifier";
import Ocean from "../environment/Ocean";

const DEBUG_CELL_BORDER = true;

function InfiniteWorldCellBorder({ cell, metrics }) {
    if (!DEBUG_CELL_BORDER || !cell || !metrics) {
        return null;
    }

    const centerX = cell.mode === "currentSceneFall"
        ? (metrics.originX || 0) + (cell.horizontalOffsetX || 0)
        : (metrics.originX || 0) + (cell.east || 0) * metrics.spanX;
    const centerZ = cell.mode === "currentSceneFall"
        ? (metrics.originZ || 0) + (cell.horizontalOffsetZ || 0)
        : (metrics.originZ || 0) + (cell.north || 0) * metrics.spanZ;
    const bottomY = Number.isFinite(cell.verticalOffset)
        ? cell.verticalOffset
        : (cell.level || 0) * metrics.spanY;
    const halfY = metrics.spanY / 2;
    const centerY = bottomY + halfY;
    const thickness = Math.max(Math.min(metrics.spanX, metrics.spanZ) * 0.006, 0.025);
    const longX = metrics.spanX + thickness;
    const longZ = metrics.spanZ + thickness;
    const longY = metrics.spanY + thickness;
    const yLevels = [-halfY, halfY];

    return (
        <group position={[centerX, centerY, centerZ]} renderOrder={10000}>
            {yLevels.map((y) => (
                <React.Fragment key={y}>
                    <mesh position={[0, y, metrics.spanZ / 2]}>
                        <boxGeometry args={[longX, thickness, thickness]} />
                        <meshBasicMaterial color="red" depthTest={false} depthWrite={false} />
                    </mesh>
                    <mesh position={[0, y, -metrics.spanZ / 2]}>
                        <boxGeometry args={[longX, thickness, thickness]} />
                        <meshBasicMaterial color="red" depthTest={false} depthWrite={false} />
                    </mesh>
                    <mesh position={[metrics.spanX / 2, y, 0]}>
                        <boxGeometry args={[thickness, thickness, longZ]} />
                        <meshBasicMaterial color="red" depthTest={false} depthWrite={false} />
                    </mesh>
                    <mesh position={[-metrics.spanX / 2, y, 0]}>
                        <boxGeometry args={[thickness, thickness, longZ]} />
                        <meshBasicMaterial color="red" depthTest={false} depthWrite={false} />
                    </mesh>
                </React.Fragment>
            ))}
            {[-metrics.spanX / 2, metrics.spanX / 2].map((x) => (
                [-metrics.spanZ / 2, metrics.spanZ / 2].map((z) => (
                    <mesh key={`${x}:${z}`} position={[x, 0, z]}>
                        <boxGeometry args={[thickness, longY, thickness]} />
                        <meshBasicMaterial color="red" depthTest={false} depthWrite={false} />
                    </mesh>
                ))
            ))}
        </group>
    );
}

function InfiniteWorldCell({
    cellKey,
    worldCellKey,
    cell,
    metrics,
    metricsKey = "",
    projectId,
    data,
    visible = true,
    world,
    scene,
    floors,
}) {
    const isCloneCell = cellKey !== "0,0,0";
    const physicsCellKey = worldCellKey || cellKey;

    return (
        <group visible={visible} key={`${projectId || ""}:${metricsKey}:${cellKey}`}>
            <Ocean cell={cell} metrics={metrics} />
            {/* <InfiniteWorldCellBorder cell={cell} metrics={metrics} /> */}
            {data.map((item) => {
                const key = `${projectId || ""}_${metricsKey}_${cellKey}_${item.renderKey || item.cleanKey || item.fileName || item.name}`;

                if (isCloneCell && isCloneBatchCandidate(item)) {
                    return (
                        <CloneBatchedInstanceCategory
                            key={key}
                            fbx={item.fbx}
                            assets={item.assets}
                            name={item.name}
                            fileName={item.fileName}
                            defaultColor={item.defaultColor}
                            id={item.id}
                            cleanKey={item.cleanKey}
                            cellKey={physicsCellKey}
                        />
                    );
                }

                return (
                    <R3fInstancePattern
                        key={key}
                        fbx={item.fbx}
                        assets={item.assets}
                        name={item.name}
                        world={world}
                        cscene={scene}
                        floors={floors}
                        properties={item.properties}
                        fileName={item.fileName}
                        defaultColor={item.defaultColor}
                        id={item.id}
                        cleanKey={item.cleanKey}
                        renderKey={item.renderKey}
                        commandOverlay={item.commandOverlay}
                        cellKey={physicsCellKey}
                        registerGlobalInstances={!isCloneCell}
                        visible={visible}
                    />
                );
            })}
        </group>
    );
}

const areEqual = (prev, next) => (
    prev.cellKey === next.cellKey
    && prev.worldCellKey === next.worldCellKey
    && prev.cell === next.cell
    && prev.metrics === next.metrics
    && prev.metricsKey === next.metricsKey
    && prev.projectId === next.projectId
    && prev.data === next.data
    && prev.visible === next.visible
    && prev.world === next.world
    && prev.scene === next.scene
    && prev.floors === next.floors
);

export default React.memo(InfiniteWorldCell, areEqual);
