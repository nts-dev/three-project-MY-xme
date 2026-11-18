import * as THREE from "three";
import { sceneAssets } from "./puzzle/character/Constants.jsx";
import { getTerrainHeightAt } from "../terrain/terrainData";

/**
 * Character-view starting points per project: in front of a named building (its Company Name),
 * facing it. Worked out from the building as it is placed in the scene, so the start point
 * follows the building if it is moved.
 */
const SPAWN_IN_FRONT_OF: Record<string, { companyName: string; distance: number }> = {
    "153_L2": { companyName: "NTS Computers", distance: 6 }, // metres in front of the facade
};

const CAPSULE_CENTRE_HEIGHT = 1.2; // above the ground: the character drops onto it

const fieldValue = (fields: any, name: string): string => {
    if (!fields) return "";
    if (Array.isArray(fields)) return String(fields.find((field: any) => field?.name === name)?.value ?? "");
    const field = fields[name];
    return String(field && typeof field === "object" ? field.value ?? "" : field ?? "");
};

/** Oriented footprint corners (x, z) of an asset's drawn instance, or null. */
function footprintCorners(asset: any): THREE.Vector3[] | null {
    const instance = asset?.instance;
    if (!instance) return null;
    let box: THREE.Box3 | null = null;
    const matrix = new THREE.Matrix4();
    if (instance.isInstancedMesh && Number.isInteger(asset.index)) {
        if (!instance.geometry.boundingBox) instance.geometry.computeBoundingBox();
        box = instance.geometry.boundingBox;
        instance.getMatrixAt(asset.index, matrix);
        matrix.premultiply(instance.matrixWorld);
    } else if (instance.isMesh) {
        if (!instance.geometry.boundingBox) instance.geometry.computeBoundingBox();
        box = instance.geometry.boundingBox;
        instance.updateWorldMatrix(true, false);
        matrix.copy(instance.matrixWorld);
    }
    if (!box) return null;
    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) {
        corners.push(new THREE.Vector3(x, box.min.y, z).applyMatrix4(matrix));
    }
    return corners;
}

/** Start position and facing (yaw, rad) for the character in this project, or null for the default. */
export function getProjectSpawn(projectId: unknown): { position: [number, number, number]; yaw: number } | null {
    const target = SPAWN_IN_FRONT_OF[String(projectId ?? "").trim().toUpperCase()];
    if (!target) return null;
    const wanted = target.companyName.toLowerCase();
    const asset: any = Object.values(sceneAssets || {}).find((candidate: any) => (
        fieldValue(candidate?.instanceData?.assetObject?.fields, "Company Name").toLowerCase().includes(wanted)
    ));
    const corners = asset ? footprintCorners(asset) : null;
    if (!corners) return null;

    const centre = corners.reduce((sum, corner) => sum.add(corner), new THREE.Vector3()).multiplyScalar(1 / corners.length);
    // The facade faces the building's local +z (towards the street in front of its row).
    const angle = THREE.MathUtils.degToRad(Number(asset.angle) || 0);
    const front = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const halfDepth = Math.max(...corners.map((corner) => corner.clone().sub(centre).dot(front)));
    const spot = centre.clone().addScaledVector(front, halfDepth + target.distance);
    const ground = getTerrainHeightAt(spot.x, spot.z) ?? 0;
    return {
        position: [spot.x, ground + CAPSULE_CENTRE_HEIGHT, spot.z],
        yaw: Math.atan2(-front.x, -front.z), // facing the building
    };
}
