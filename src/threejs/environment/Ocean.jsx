import { useMemo } from "react";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import { getWorldMetrics } from "../infiniteWorld/infiniteWorldUtils";

const OCEAN_THICKNESS = 0.04;
const OCEAN_TOP_GAP = 0.02;

const getCellCenter = (cell = {}, metrics = {}) => {
    const centerX = cell.mode === "currentSceneFall"
        ? (metrics.originX || 0) + (cell.horizontalOffsetX || 0)
        : (metrics.originX || 0) + (cell.east || 0) * metrics.spanX;
    const centerZ = cell.mode === "currentSceneFall"
        ? (metrics.originZ || 0) + (cell.horizontalOffsetZ || 0)
        : (metrics.originZ || 0) + (cell.north || 0) * metrics.spanZ;
    const bottomY = Number.isFinite(cell.verticalOffset)
        ? cell.verticalOffset
        : (cell.level || 0) * metrics.spanY;

    return {
        x: centerX,
        y: bottomY - OCEAN_TOP_GAP - OCEAN_THICKNESS / 2,
        z: centerZ,
    };
};

export default function Ocean({ cell = { north: 0, east: 0, level: 0 }, metrics: providedMetrics }) {
    const projectId = useGame((state) => state.projectID);
    const gridSize = useGame((state) => state.gridSize);
    const fallbackMetrics = useMemo(
        () => getWorldMetrics(gridSize, projectId),
        [gridSize, projectId]
    );
    const metrics = providedMetrics || fallbackMetrics;
    const center = useMemo(() => getCellCenter(cell, metrics), [cell, metrics]);
    const size = useMemo(() => ({
        x: Math.max(Number(metrics.spanX) || 1, 0.1),
        y: OCEAN_THICKNESS,
        z: Math.max(Number(metrics.spanZ) || 1, 0.1),
    }), [metrics]);

    return (
        <RigidBody
            type="fixed"
            restitution={0}
            friction={0}
            colliders="cuboid"
            key={`ocean_${cell?.north || 0}_${cell?.east || 0}_${cell?.level || 0}_${cell?.mode || "scene"}`}
        >
            <mesh
                position={[center.x, center.y+0.02, center.z]}
                userData={{ name: "OceanGridSafetyPlane" }}
            >
                <boxGeometry args={[size.x, size.y, size.z]} />
                <meshStandardMaterial
                    color={new THREE.Color("#d50b0b")}
                    metalness={0.8}
                    roughness={0.2}
                    transparent
                    opacity={0}
                    depthWrite={false}
                />
            </mesh>
        </RigidBody>
    );
}
