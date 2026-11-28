import * as THREE from "three";
import { sceneAssets } from "./puzzle/character/Constants.jsx";
import { getTerrainHeightAt } from "../terrain/terrainData";

/**
 * Character-view starting points per project: in front of a named building (its Company Name),
 * facing it. Worked out from the building as it is placed in the scene, so the start point
 * follows the building if it is moved.
 */
type SpawnTarget = {
    companyName: string;
    distance: number;
    assetId?: string;
    fallback?: { facade: [number, number]; angle: number; ground: number };
};

const SPAWN_IN_FRONT_OF: Record<string, SpawnTarget> = {
    "153_L2": { companyName: "NTS Computers", distance: 6 }, // metres in front of the facade
    "33_L0": {
        companyName: "NTS Computers",
        assetId: "654795",
        distance: 4,
        // The storefront's position and orientation when opening Character view before the model loads.
        fallback: { facade: [1.073, -2.511], angle: 191.443024, ground: -0.7 },
    },
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
        instance.updateWorldMatrix(true, false);
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
    // Imported buildings do not all use the same vertical axis.
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        corners.push(new THREE.Vector3(x, y, z).applyMatrix4(matrix));
    }
    return corners;
}

/** The placed building (scene asset) with this Company Name (exact, else containing it), or null. */
export function findCompanyAsset(companyName: string): any {
    const wanted = companyName.trim().toLowerCase();
    if (!wanted) return null;
    const assets = Object.values(sceneAssets);
    const nameOf = (candidate: any) => fieldValue(candidate?.instanceData?.assetObject?.fields, "Company Name").trim().toLowerCase();
    return assets.find((candidate: any) => nameOf(candidate) === wanted)
        || assets.find((candidate: any) => nameOf(candidate).includes(wanted))
        || null;
}

/** The named buildings of the scene (Company Name, number, street), sorted by name. */
export function companyList(): { name: string; number: string; street: string }[] {
    const seen = new Set<string>();
    const list: { name: string; number: string; street: string }[] = [];
    for (const asset of Object.values(sceneAssets) as any[]) {
        const fields = asset?.instanceData?.assetObject?.fields;
        const name = fieldValue(fields, "Company Name").trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        list.push({ name, number: fieldValue(fields, "Building Number").trim(), street: fieldValue(fields, "Street Name").trim() });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Ground point `distance` metres in front of a building's facade (scene x / z), and the direction
 * its front faces; null when the building is not in the scene (yet).
 */
export function frontOfCompany(companyName: string, distance: number): { x: number; z: number; front: THREE.Vector3 } | null {
    return frontOfAsset(findCompanyAsset(companyName), distance);
}

/** The same, for a scene asset by its id (any building, also one without a company name). */
export function frontOfAssetId(assetId: string, distance: number) {
    return frontOfAsset((sceneAssets as any)[assetId], distance);
}

function frontOfAsset(asset: any, distance: number): { x: number; z: number; front: THREE.Vector3 } | null {
    const corners = asset ? footprintCorners(asset) : null;
    if (!corners) return null;
    const angle = THREE.MathUtils.degToRad(Number(asset.angle) || 0);
    const front = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const facade = new THREE.Vector3();
    for (const corner of corners) facade.add(corner);
    facade.multiplyScalar(1 / corners.length);
    const frontPlane = Math.max(...corners.map(corner => corner.dot(front)));
    facade.addScaledVector(front, frontPlane - facade.dot(front) + distance);
    return { x: facade.x, z: facade.z, front };
}

/** Start position and facing (yaw, rad) for the character in this project, or null for the default. */
export function getProjectSpawn(projectId: unknown): { position: [number, number, number]; yaw: number } | null {
    const target = SPAWN_IN_FRONT_OF[String(projectId ?? "").trim().toUpperCase()];
    if (!target) return null;
    const wanted = target.companyName.toLowerCase();
    const asset: any = target.assetId ? sceneAssets[target.assetId] : Object.values(sceneAssets).find((candidate: any) => (
        fieldValue(candidate?.instanceData?.assetObject?.fields, "Company Name").toLowerCase().includes(wanted)
    ));
    const corners = asset ? footprintCorners(asset) : null;
    const fallback = target.fallback;
    if (!corners && !fallback) return null;

    // The facade faces the building's local +z (towards the street in front of its row).
    const angle = THREE.MathUtils.degToRad(corners ? Number(asset.angle) || 0 : fallback?.angle ?? 0);
    const front = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const facade = fallback ? new THREE.Vector3(fallback.facade[0], 0, fallback.facade[1]) : new THREE.Vector3();
    if (corners) {
        facade.set(0, 0, 0);
        for (const corner of corners) facade.add(corner);
        facade.multiplyScalar(1 / corners.length);
        const frontPlane = Math.max(...corners.map(corner => corner.dot(front)));
        facade.addScaledVector(front, frontPlane - facade.dot(front));
    }
    const spot = facade.addScaledVector(front, target.distance);
    const ground = getTerrainHeightAt(spot.x, spot.z) ?? fallback?.ground ?? 0;
    return {
        position: [spot.x, ground + CAPSULE_CENTRE_HEIGHT, spot.z],
        yaw: Math.atan2(-front.x, -front.z), // facing the building
    };
}
