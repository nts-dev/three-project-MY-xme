import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Box3, BufferAttribute, BufferGeometry, Color, InstancedBufferAttribute, Object3D, Vector3 } from "three";
import useGame from "../../hooks/useGame";
import MergedInstanceTrimeshCollider from "../MergedInstanceTrimeshCollider";
import {
    buildCloneInstanceTransforms,
    getCloneBaseObject,
} from "./cloneInstanceTransforms";
import {
    clearFallLandingTilePositions,
    setFallLandingTilePositions,
} from "./landingTileStore";

const DEBUG_INFINITE_WORLD = false;
const WHITE_COLOR = new Color("#ffffff");
const EMPTY_ARRAY = Object.freeze([]);

const hashPart = (hash, value) => {
    const text = String(value ?? "");

    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(index);
        hash |= 0;
    }

    return hash;
};

const getInstancesSignatureHash = (instances = []) => {
    let hash = 0;

    for (let i = 0, len = instances.length; i < len; i++) {
        const instance = instances[i];

        const p = instance.position;
        const r = instance.rotation;
        const s = instance.scale;

        hash = hashPart(hash, instance.key);

        hash = hashPart(hash, p ? (p[0] ?? 0) : 0);
        hash = hashPart(hash, p ? (p[1] ?? 0) : 0);
        hash = hashPart(hash, p ? (p[2] ?? 0) : 0);

        hash = hashPart(hash, r ? (r[0] ?? 0) : 0);
        hash = hashPart(hash, r ? (r[1] ?? 0) : 0);
        hash = hashPart(hash, r ? (r[2] ?? 0) : 0);

        hash = hashPart(hash, s ? (s.x ?? 1) : 1);
        hash = hashPart(hash, s ? (s.y ?? 1) : 1);
        hash = hashPart(hash, s ? (s.z ?? 1) : 1);
    }

    return Math.abs(hash).toString(36);
};

const getFallLandingTileWorldPositions = (geometry, instances, dummy) => {
    if (!geometry || !instances.length) {
        return instances;
    }

    if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
    }

    const box = geometry.boundingBox;
    if (!box) {
        return instances;
    }

    const worldBox = new Box3();
    const worldCenter = new Vector3();

    return instances.map((instance) => {
        dummy.position.set(...(instance.position || [0, 0, 0]));
        dummy.rotation.set(...(instance.rotation || [0, 0, 0]));
        dummy.scale.set(
            instance.scale?.x ?? 1,
            instance.scale?.y ?? 1,
            instance.scale?.z ?? 1
        );
        dummy.updateMatrix();
        worldBox.copy(box).applyMatrix4(dummy.matrix);
        worldBox.getCenter(worldCenter);

        return {
            ...instance,
            position: [dummy.position.x, worldBox.max.y, dummy.position.z],
            boundsCenter: [worldCenter.x, worldCenter.y, worldCenter.z],
        };
    });
};

const setTransformMatrix = (target, offset, position, rotation, scale) => {
    const px = position ? (position[0] || 0) : 0;
    const py = position ? (position[1] || 0) : 0;
    const pz = position ? (position[2] || 0) : 0;
    const rx = rotation ? (rotation[0] || 0) : 0;
    const ry = rotation ? (rotation[1] || 0) : 0;
    const rz = rotation ? (rotation[2] || 0) : 0;
    const sx = scale?.x ?? 1;
    const sy = scale?.y ?? 1;
    const sz = scale?.z ?? 1;

    const a = Math.cos(rx);
    const b = Math.sin(rx);
    const c = Math.cos(ry);
    const d = Math.sin(ry);
    const e = Math.cos(rz);
    const f = Math.sin(rz);
    const ae = a * e;
    const af = a * f;
    const be = b * e;
    const bf = b * f;

    target[offset] = c * e * sx;
    target[offset + 1] = (af + be * d) * sx;
    target[offset + 2] = (bf - ae * d) * sx;
    target[offset + 3] = 0;
    target[offset + 4] = -c * f * sy;
    target[offset + 5] = (ae - bf * d) * sy;
    target[offset + 6] = (be + af * d) * sy;
    target[offset + 7] = 0;
    target[offset + 8] = d * sz;
    target[offset + 9] = -b * c * sz;
    target[offset + 10] = a * c * sz;
    target[offset + 11] = 0;
    target[offset + 12] = px;
    target[offset + 13] = py;
    target[offset + 14] = pz;
    target[offset + 15] = 1;
};

function CloneBatchedInstanceCategory({
    fbx,
    assets,
    name,
    fileName,
    defaultColor,
    id,
    cleanKey,
    cellKey,
}) {
    const meshRef = useRef(null);
    const dummyRef = useRef(new Object3D());
    const colorRef = useRef(new Color());
    const projectId = useGame((state) => state.projectID);
    const safeName = String(cleanKey || name || fileName || "clone_asset");
    const object = useMemo(() => getCloneBaseObject(fbx), [fbx]);
    const geometry = object?.geometry;
    const material = object?.material;
    const instances = useMemo(
        () => buildCloneInstanceTransforms({
            assets,
            object,
            material,
            defaultColor,
            projectId,
            name: safeName,
            fileName,
            id,
        }),
        [assets, object, material, defaultColor, projectId, safeName, fileName, id]
    );
    const isFallFloorClone = String(cellKey || "").includes("@currentSceneFall")
        && safeName.toLowerCase() === "floor_cube";
    const fallLandingInstances = useMemo(
        () => isFallFloorClone
            ? getFallLandingTileWorldPositions(geometry, instances, dummyRef.current)
            : EMPTY_ARRAY,
        [geometry, instances, isFallFloorClone]
    );
    const instanceSignature = useMemo(
        () => getInstancesSignatureHash(instances),
        [instances]
    );
    const instanceMatrices = useMemo(() => {
        if (!instances.length) {
            return null;
        }

        const matrices = new Float32Array(instances.length * 16);

        for (let i = 0, len = instances.length; i < len; i += 1) {
            const instance = instances[i];
            setTransformMatrix(
                matrices,
                i * 16,
                instance.position,
                instance.rotation,
                instance.scale
            );
        }

        return matrices;
    }, [instances]);
    const instanceColors = useMemo(() => {
        if (!instances.length) {
            return null;
        }

        const colors = new Float32Array(instances.length * 3);
        const color = colorRef.current;

        for (let i = 0, len = instances.length; i < len; i += 1) {
            const offset = i * 3;
            color.set(instances[i].color || WHITE_COLOR);
            colors[offset] = color.r;
            colors[offset + 1] = color.g;
            colors[offset + 2] = color.b;
        }

        return colors;
    }, [instances]);
    const colliderSignature = instanceSignature;
    const mergedGeometry = useMemo(() => {
        if (!geometry || !instances.length || !instanceMatrices) {
            return null;
        }

        const merged = new BufferGeometry();
        const positionAttr = geometry.attributes.position;
        if (!positionAttr) {
            return null;
        }

        const indexAttr = geometry.index;
        const instanceCount = instances.length;
        const baseVertexCount = positionAttr.count;
        const vertexCount = baseVertexCount * instanceCount;
        const baseIndexCount = indexAttr ? indexAttr.count : baseVertexCount;
        const indexCount = baseIndexCount * instanceCount;
        const positions = new Float32Array(vertexCount * 3);
        const indices = vertexCount > 65535
            ? new Uint32Array(indexCount)
            : new Uint16Array(indexCount);
        let positionOffset = 0;
        let indexOffset = 0;
        const positionArray = positionAttr.array;
        const indexArray = indexAttr?.array;

        for (let instanceIndex = 0; instanceIndex < instanceCount; instanceIndex += 1) {
            const matrixOffset = instanceIndex * 16;
            const m0 = instanceMatrices[matrixOffset];
            const m1 = instanceMatrices[matrixOffset + 1];
            const m2 = instanceMatrices[matrixOffset + 2];
            const m4 = instanceMatrices[matrixOffset + 4];
            const m5 = instanceMatrices[matrixOffset + 5];
            const m6 = instanceMatrices[matrixOffset + 6];
            const m8 = instanceMatrices[matrixOffset + 8];
            const m9 = instanceMatrices[matrixOffset + 9];
            const m10 = instanceMatrices[matrixOffset + 10];
            const m12 = instanceMatrices[matrixOffset + 12];
            const m13 = instanceMatrices[matrixOffset + 13];
            const m14 = instanceMatrices[matrixOffset + 14];

            for (let i = 0; i < baseVertexCount; i += 1) {
                const attrIndex = i * 3;
                const x = positionArray[attrIndex];
                const y = positionArray[attrIndex + 1];
                const z = positionArray[attrIndex + 2];

                positions[positionOffset++] = (m0 * x) + (m4 * y) + (m8 * z) + m12;
                positions[positionOffset++] = (m1 * x) + (m5 * y) + (m9 * z) + m13;
                positions[positionOffset++] = (m2 * x) + (m6 * y) + (m10 * z) + m14;
            }

            const vertexOffset = instanceIndex * baseVertexCount;
            if (indexArray) {
                for (let i = 0; i < baseIndexCount; i += 1) {
                    indices[indexOffset++] = indexArray[i] + vertexOffset;
                }
            } else {
                for (let i = 0; i < baseVertexCount; i += 1) {
                    indices[indexOffset++] = vertexOffset + i;
                }
            }
        }

        merged.setAttribute("position", new BufferAttribute(positions, 3));
        merged.setIndex(new BufferAttribute(indices, 1));

        return merged;
    }, [geometry,  instanceMatrices]);

useLayoutEffect(() => {
    const mesh = meshRef.current;

    if (!mesh || !instances.length || !instanceMatrices) return;

    mesh.instanceMatrix.array.set(instanceMatrices);
    mesh.instanceMatrix.needsUpdate = true;

    if (instanceColors) {
        if (!mesh.instanceColor || mesh.instanceColor.count !== instances.length) {
            mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(instances.length * 3), 3);
        }
        mesh.instanceColor.array.set(instanceColors);
        mesh.instanceColor.needsUpdate = true;
    }
}, [instances, instanceMatrices, instanceColors]);

    useEffect(() => () => {
        mergedGeometry?.dispose?.();
    }, [mergedGeometry]);

    useEffect(() => {
        if (!isFallFloorClone) {
            return undefined;
        }

        setFallLandingTilePositions(cellKey, fallLandingInstances);
        // console.warn("[InfiniteWorld] registered beneath floor landing tiles", {
        //     cellKey,
        //     count: fallLandingInstances.length,
        //     firstTile: fallLandingInstances[0],
        // });

        return () => {
            clearFallLandingTilePositions(cellKey);
        };
    }, [cellKey, fallLandingInstances, safeName]);

    if (!geometry || !material || !instances.length) {
        return null;
    }

    return (
        <>
            <instancedMesh
                ref={meshRef}
                args={[geometry, material, instances.length]}
                name={safeName}
                frustumCulled={false}
            />

            {mergedGeometry && (
                <MergedInstanceTrimeshCollider
                    colliderKey={`${projectId}_${safeName}_${cellKey || "origin"}_${colliderSignature}_merged_trimesh`}
                    geometry={mergedGeometry}
                    name={safeName}
                />
            )}
        </>
    );
}

export default React.memo(CloneBatchedInstanceCategory);
