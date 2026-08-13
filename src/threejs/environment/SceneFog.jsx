import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import { getWorldMetrics } from "../infiniteWorld/infiniteWorldUtils";

const DEFAULT_FOG_COLOR = "#0c1011";
const BASE_FOG_DENSITY = 2;
const BASE_FOG_SPAN = 1;
const MIN_FOG_DENSITY = 0.15;
const MAX_FOG_DENSITY = 2;

const clampFogDensity = (value) => (
    Math.max(MIN_FOG_DENSITY, Math.min(MAX_FOG_DENSITY, value))
);

const getGridFogDensity = (gridSize, projectId) => {
    const metrics = getWorldMetrics(gridSize, projectId);
    const visibleSpan = Math.max(1, metrics.spanX || 1, metrics.spanZ || 1);

    return clampFogDensity(BASE_FOG_DENSITY * (BASE_FOG_SPAN / visibleSpan));
};

export default function SceneFog({
    color = DEFAULT_FOG_COLOR,
    density,
    matchBackground = true,
}) {
    const { scene } = useThree();
    const gridSize = useGame((state) => state.gridSize);
    const projectId = useGame((state) => state.projectID);
    const fogDensity = useMemo(
        () => density ?? getGridFogDensity(gridSize, projectId),
        [density, gridSize, projectId]
    );

    const getFogColor = () => {
        if (matchBackground && scene.background?.isColor) {
            return scene.background;
        }

        return color;
    };

    useEffect(() => {
        const previousFog = scene.fog;
        scene.fog = new THREE.FogExp2(getFogColor(), fogDensity);

        return () => {
            scene.fog = previousFog;
        };
    }, [scene, color, fogDensity, matchBackground]);

    useFrame(() => {
        if (!matchBackground || !scene.fog || !scene.background?.isColor) {
            return;
        }

        scene.fog.color.copy(scene.background);
    });

    return null;
}
