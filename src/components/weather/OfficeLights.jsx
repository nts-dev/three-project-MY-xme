import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mapBuildingLodGeometries } from "../../threejs/lighting/buildingLod";
import { ambientLightLevel, useSkyStore, useWeatherStore } from "./weatherStore";
import { isOpenAt, parseOpeningHours } from "./openingHours";
import { siteClock } from "./siteClock";

// Office lights: the inside of a unit is lit while the company is open (its "Opening Hours" at the
// site's clock, or ?time=) and dark when it is closed (or the hours are not known). Seen through the
// windows at dusk and at night; faint in daylight.
// No light sources and no extra draw calls: the unit models' materials get a small shader addition
// (one compile, at load) that adds warm light to the surfaces inside the building's shell (interior
// walls, floors, stairs, the glass front), switched per instance by a 0 / 1 attribute. The attribute
// is rewritten only when a company opens or closes (checked every CHECK_SECONDS).

const MODEL = /^MalaysiaEnvironmentBuildings/;
const SCAN_SECONDS = 4;
const CHECK_SECONDS = 30;
const INSET = 1.0; // model units (~metres): walls, recessed fronts and window frames this close to the outside stay unlit
const ROOF_INSET = 0.35;
const LIGHT_COLOR = new THREE.Color("#ffe1b0"); // warm white office lighting
// Indoor light strength by outdoor light level (ambientLightLevel 0 dark .. 1 bright day).
const DAY_STRENGTH = 0.12;
const NIGHT_STRENGTH = 1.0;

const officeUniforms = {
    uOfficeLevel: { value: 0 },
    uOfficeColor: { value: LIGHT_COLOR.clone() },
};

/** Adds the office light to a unit material: warm light inside `box` (model space), per instance. */
function applyOfficeLight(material, box) {
    if (!material || material.userData.officeLight) return;
    material.userData.officeLight = true;
    const glass = /glass/i.test(material.name || "");
    const local = {
        uOfficeMin: { value: new THREE.Vector3(box.min.x + INSET, box.min.y + INSET, box.min.z) },
        uOfficeMax: { value: new THREE.Vector3(box.max.x - INSET, box.max.y - INSET, box.max.z - ROOF_INSET) },
        uOfficeGlass: { value: glass ? 1 : 0 },
    };
    local.uOfficeMin.value.z = box.min.z + 0.02; // ground floor included (the shell's bottom is the ground)
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        previous?.(shader, renderer);
        Object.assign(shader.uniforms, officeUniforms, local);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
                attribute float aOfficeLit;
                varying float vOfficeLit;
                varying vec3 vOfficeLocal;`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
                vOfficeLit = aOfficeLit;
                vOfficeLocal = position;`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
                varying float vOfficeLit;
                varying vec3 vOfficeLocal;
                uniform float uOfficeLevel;
                uniform vec3 uOfficeColor;
                uniform vec3 uOfficeMin;
                uniform vec3 uOfficeMax;
                uniform float uOfficeGlass;`)
            .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
                if (vOfficeLit > 0.5 && uOfficeLevel > 0.0) {
                    vec3 inside = step(uOfficeMin, vOfficeLocal) * step(vOfficeLocal, uOfficeMax);
                    float lit = uOfficeGlass > 0.5 ? 1.0 : inside.x * inside.y * inside.z;
                    totalEmissiveRadiance += (uOfficeGlass > 0.5 ? uOfficeColor * 0.7 : diffuseColor.rgb * uOfficeColor) * uOfficeLevel * lit;
                }`);
    };
    const previousKey = material.customProgramCacheKey?.bind(material);
    material.customProgramCacheKey = () => `${previousKey ? previousKey() : ""}|office`;
    material.needsUpdate = true;
}

/** The building shell (outer walls) of the model: bounds of its "Dark grey" faces, in model space. */
function shellBox(geometry, materials) {
    const index = materials.findIndex((material) => /dark\s*grey/i.test(material?.name || ""));
    const group = geometry.groups.find((g) => g.materialIndex === index);
    const position = geometry.attributes.position;
    const box = new THREE.Box3();
    const point = new THREE.Vector3();
    const start = group ? group.start : 0;
    const end = group ? group.start + group.count : (geometry.index ? geometry.index.count : position.count);
    for (let i = start; i < end; i++) {
        const vertex = geometry.index ? geometry.index.getX(i) : i;
        box.expandByPoint(point.fromBufferAttribute(position, vertex));
    }
    return box;
}

/**
 * A geometry for `mesh` with its own per-instance aOfficeLit and every other attribute shared with
 * the original (no copies: the GPU buffers are the same). The spatial batches share one geometry,
 * so each needs its own wrapper for its own instances.
 */
function litGeometry(source, lit) {
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(source.index);
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
    for (const group of source.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
    geometry.boundingBox = source.boundingBox;
    geometry.boundingSphere = source.boundingSphere;
    geometry.setDrawRange(source.drawRange.start, source.drawRange.count);
    geometry.setAttribute("aOfficeLit", lit);
    geometry.userData.officeWrapper = true;
    return geometry;
}

/** Opening hours of each instance of a unit mesh (parsed once). */
function instanceHours(mesh) {
    return (mesh.userData.instances || []).map((instance) => {
        const fields = instance?.assetObject?.fields || {};
        return parseOpeningHours(fields["Opening Hours"]?.value);
    });
}

export default function OfficeLights() {
    const gl = useThree((state) => state.gl);
    const scene = useThree((state) => state.scene);
    const camera = useThree((state) => state.camera);
    const state = useRef({ units: [], scannedAt: -Infinity, checkedAt: -Infinity, clockKey: "" });
    const level = useMemo(() => ({ value: 0 }), []);

    useEffect(() => () => {
        officeUniforms.uOfficeLevel.value = 0;
    }, []);

    useFrame(({ clock }) => {
        const s = state.current;
        const time = clock.getElapsedTime();

        // New unit meshes (scene loaded / rebuilt): patch their materials and give each drawn mesh
        // (the spatial batches, or the mesh itself) its lit attribute.
        if (time - s.scannedAt > SCAN_SECONDS) {
            s.scannedAt = time;
            s.units = s.units.filter((unit) => unit.mesh.parent);
            const found = [];
            scene.traverse((object) => {
                if (!object.isInstancedMesh || !MODEL.test(object.name || "") || /:spatial$/.test(object.name)) return;
                if (object.userData.officeLights) return;
                found.push(object);
            });
            for (const mesh of found) {
                const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                const box = shellBox(mesh.geometry, materials);
                if (box.isEmpty()) continue;
                materials.forEach((material) => applyOfficeLight(material, box));
                const batches = mesh.children.filter((child) => child.isInstancedMesh && child.userData.sourceIndices);
                const targets = batches.length
                    ? batches.map((batch) => ({ object: batch, indices: batch.userData.sourceIndices }))
                    : [{ object: mesh, indices: Array.from({ length: mesh.count }, (_, i) => i) }];
                for (const { object, indices } of targets) {
                    const lit = new THREE.InstancedBufferAttribute(new Float32Array(indices.length), 1);
                    lit.setUsage(THREE.DynamicDrawUsage);
                    mapBuildingLodGeometries(object, (geometry) => litGeometry(geometry, lit));
                }
                mesh.userData.officeLights = true;
                s.units.push({ mesh, targets, hours: instanceHours(mesh), open: [] });
                gl.compileAsync?.(mesh, camera, scene).catch(() => {});
            }
            if (found.length) s.checkedAt = -Infinity;
        }

        // Who is open now: every CHECK_SECONDS, or at once when the shown time changes (?time=).
        const { timePreview } = useSkyStore.getState();
        if (time - s.checkedAt > CHECK_SECONDS || timePreview !== s.clockKey) {
            s.checkedAt = time;
            s.clockKey = timePreview;
            const { day, minutes } = siteClock();
            for (const unit of s.units) {
                const open = unit.hours.map((week) => (isOpenAt(week, day, minutes) ? 1 : 0));
                if (open.length === unit.open.length && open.every((value, i) => value === unit.open[i])) continue;
                unit.open = open;
                for (const { object, indices } of unit.targets) {
                    const attribute = object.geometry.attributes.aOfficeLit;
                    if (!attribute) continue;
                    indices.forEach((sourceIndex, localIndex) => { attribute.array[localIndex] = open[sourceIndex] || 0; });
                    attribute.needsUpdate = true;
                }
            }
        }

        // Strength from the outdoor light (one shared uniform).
        const sky = useSkyStore.getState();
        const { weather, preview } = useWeatherStore.getState();
        const outdoor = ambientLightLevel(sky, weather, preview);
        const t = Math.min(1, Math.max(0, (outdoor - 0.1) / 0.45)); // dark .. bright
        level.value = NIGHT_STRENGTH + (DAY_STRENGTH - NIGHT_STRENGTH) * (t * t * (3 - 2 * t));
        officeUniforms.uOfficeLevel.value = s.units.length ? level.value : 0;
    });

    return null;
}
