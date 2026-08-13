import React, { useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import useGame from "../hooks/useGame";
import TokenInstance from "./tokens/TokenInstance.jsx";
import AccessKeyCode from "./tokens/AccessKeyCode.jsx";
import { objects, sceneAssets } from "./player/puzzle/character/Constants.jsx";
import TemplateInstanceMotion from "./TemplateInstanceMotion.jsx";
import {
  clearFallLandingTilePositions,
  setFallLandingTilePositions,
} from "./infiniteWorld/landingTileStore.js";
import MergedInstanceTrimeshCollider from "./MergedInstanceTrimeshCollider.jsx";

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});

const isNumericLikeProjectId = (projectId) => !isNaN(projectId) || /_L\d+$/i.test(String(projectId));

const hashPart = (hash, value) => {
  const text = String(value ?? "");

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }

  return hash;
};

const getInstanceDataSignatureHash = (instances = []) => {
  let hash = 0;

  for (let i = 0, len = instances.length; i < len; i += 1) {
    const item = instances[i];
    if (!item) continue;

    const p = item.position;
    const r = item.rotation;
    const s = item.scale;

    hash = hashPart(hash, item.key);
    hash = hashPart(hash, p ? (p[0] ?? 0) : 0);
    hash = hashPart(hash, p ? (p[1] ?? 0) : 0);
    hash = hashPart(hash, p ? (p[2] ?? 0) : 0);
    hash = hashPart(hash, r ? (r[0] ?? 0) : 0);
    hash = hashPart(hash, r ? (r[1] ?? 0) : 0);
    hash = hashPart(hash, r ? (r[2] ?? 0) : 0);
    hash = hashPart(hash, s ? (s.x ?? 1) : 1);
    hash = hashPart(hash, s ? (s.y ?? 1) : 1);
    hash = hashPart(hash, s ? (s.z ?? 1) : 1);
    hash = hashPart(hash, item.color);
  }

  return Math.abs(hash).toString(36);
};


export default function TemplateInstances({
  instanceData = [],
  geometry,
  material,
  name,
  size,
  object,
  id,
  animations = [],
  cellKey,
  registerGlobalInstances = true,
  visible
}) {
  const meshRef = useRef();
  const { gl, scene } = useThree();



  // Zustand selectors
  const setScan = useGame((s) => s.setScan);
  const scan = useGame((s) => s.scan);
  const setSearchItem = useGame((s) => s.setSearchItem);
  const setScannedId = useGame((s) => s.setScannedId);
  const levelValue = useGame((s) => s.controlButtonIndex);
  const buttonMode = useGame((s) => s.buttonMode);
  const editorSelectionEnabled = useGame((s) => s.editorSelectionEnabled);
  const setInstanceData = useGame((s) => s.setInstanceData);
  const instanceDataList = useGame((s) => registerGlobalInstances ? s.instanceDataList : EMPTY_ARRAY);
  const setGameInstances = useGame((s) => s.setGameInstances);
  const gameInstances = useGame((s) => registerGlobalInstances ? s.gameInstances : EMPTY_OBJECT);
  const setAnimationRef = useGame((s) => s.setAnimationRef);
  const rotationValue = useGame((s) => s.rotationValue);
  const selectedAssetId = useGame((s) => s.selectedAssetId);
  const dragObjectProperties = useGame((s) => s.dragObjectProperties);
  const blackListedCoins = useGame((s) => s.blackListedCoins);
  const setBlackListedCoins = useGame((s) => s.setBlackListedCoins);
  const removedObject = useGame((s) => s.removedObject);
  const deleteObject = useGame((s) => s.deleteObject);
  const setDeleteAssetId = useGame((s) => s.setDeleteAssetId);
  const verticalAlign = useGame((s) => s.vAlignValue);
  const setAssetColor = useGame((s) => s.setAssetColor);
  const assetColor = useGame((s) => s.assetColor);
  const setSelectedId = useGame((s) => s.setSelectedId);
  const selectedId = useGame((s) => s.selectedId);
  const projectId = useGame((s) => s.projectID);
  const numericLikeProjectId = isNumericLikeProjectId(projectId);
  const setSelectedAssetId = useGame((s) => s.setSelectedAssetId);
  const setSelectedCatId = useGame((s) => s.setSelectedCatId);
  const setEditAssetId = useGame((s) => s.setEditAssetId);
  const setEditProps = useGame((s) => s.setEditProps);
  const setSelectedEditorInstance = useGame((s) => s.setSelectedEditorInstance);
  const setPlayAssetInfoRequest = useGame((s) => s.setPlayAssetInfoRequest);
  const editing = useGame((s) => s.isEditing);
  const hasUnsavedTransformUpdate = useGame((s) => s.hasUnsavedTransformUpdate);
  const setAssetSelected = useGame((s) => s.setAssetSelected);
 const isGizmoActive = useGame((state) => state.isGizmoActive);


  const animRef = useRef(null);
  // Memoized static values
  const meshGeometry = useMemo(() => geometry, [geometry]);
  const meshMaterial = useMemo(() => material, [material]);

  // Refs – will be reset when projectId changes
  const dummy = useRef(new THREE.Object3D());
  const positionsRef = useRef({});
  const animationTargetsRef = useRef({});
  const animationActiveRef = useRef(new Set());
  const mergedGeometryCacheRef = useRef({ sig: "", source: null, geometry: null });
  const instanceListWriteSigRef = useRef("");
  const gameInstancesWriteSigRef = useRef("");

  const fallFloorTileData = useMemo(() => {
    const isFallFloorClone = String(cellKey || "").includes("@currentSceneFall")
      && String(name || "").toLowerCase() === "floor_cube";

    if (!isFallFloorClone || !geometry || !instanceData.length) {
      return [];
    }

    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }

    const sourceBox = geometry.boundingBox;
    if (!sourceBox) {
      return [];
    }

    const worldBox = new THREE.Box3();
    const worldCenter = new THREE.Vector3();
    const worldSize = new THREE.Vector3();
    const landingDummy = new THREE.Object3D();

    return instanceData.map((data) => {
      landingDummy.position.set(...(data.position || [0, 0, 0]));
      if (data.vAlignValue > 0) {
        landingDummy.position.y += data.vAlignValue;
      }
      landingDummy.rotation.set(...(data.rotation || [0, 0, 0]));
      landingDummy.scale.set(
        data.scale?.x ?? 1,
        data.scale?.y ?? 1,
        data.scale?.z ?? 1
      );
      landingDummy.updateMatrix();
      worldBox.copy(sourceBox).applyMatrix4(landingDummy.matrix);
      worldBox.getCenter(worldCenter);
      worldBox.getSize(worldSize);

      return {
        key: data.key,
        landingTile: {
          ...data,
          position: [landingDummy.position.x, worldBox.max.y, landingDummy.position.z],
          boundsCenter: [worldCenter.x, worldCenter.y, worldCenter.z],
          boundsSize: [worldSize.x, worldSize.y, worldSize.z],
        },
      };
    });
  }, [cellKey, geometry, instanceData, name]);

  const fallLandingTileInstances = useMemo(
    () => fallFloorTileData.map((item) => item.landingTile),
    [fallFloorTileData]
  );

  useEffect(() => {
    const isFallFloorClone = String(cellKey || "").includes("@currentSceneFall")
      && String(name || "").toLowerCase() === "floor_cube";

    if (!isFallFloorClone) {
      return undefined;
    }

    setFallLandingTilePositions(cellKey, fallLandingTileInstances);


    return () => {
      clearFallLandingTilePositions(cellKey);
    };
  }, [cellKey, fallLandingTileInstances, name]);

  const createInstancedSelectionProxy = (mesh, instanceIndex, instanceInfo = {}) => {
    if (!mesh?.isInstancedMesh || instanceIndex === undefined || instanceIndex < 0) {
      return null;
    }

    const previousProxy = scene.getObjectByName('__editorInstanceProxy');
    
    if (previousProxy) {
      window.dispatchEvent(new CustomEvent('editor-detach-transform-controls'));
      previousProxy.parent?.remove(previousProxy);
    }

    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(instanceIndex, matrix);

    const proxy = new THREE.Object3D();
    proxy.name = '__editorInstanceProxy';
    proxy.userData = {
      ...mesh.userData,
      ...instanceInfo,
      name: instanceInfo.name || mesh.name,
      instanceId: instanceInfo.assetId || instanceInfo.instanceId || instanceInfo.instance_id,
      __instancedSelection: {
        mesh,
        instanceIndex,
        instanceInfo,
      },
    };

    matrix.decompose(proxy.position, proxy.quaternion, proxy.scale);
    proxy.updateMatrix();
    (mesh.parent || scene).add(proxy);
    proxy.updateMatrixWorld(true);

    return proxy;
  };

  const selectEditorInstance = (instanceIndex) => {
    if (!editorSelectionEnabled || instanceIndex === undefined || !instanceData[instanceIndex]) {
      return;
    }

    const item = instanceData[instanceIndex];

    const key = item.key;
    const assetMeta = sceneAssets[key] || {};
    const assetName = assetMeta.name || item.name || name || String(key);
    const instanceInfo = {
      ...assetMeta,
      ...item,
      assetId: key,
      instanceId: key,
      instance_id: key,
      name: assetName,
      categoryIndex: assetMeta.categoryIndex || assetMeta.category || id,
      template_id: assetMeta.template_id || item.template_id,
    };
    const proxy = createInstancedSelectionProxy(meshRef.current, instanceIndex, instanceInfo);

    if (!proxy) {
      return;
    }

    const gameObject = {
      name: assetName,
      position: {
        x: proxy.position.x,
        y: proxy.position.y,
        z: proxy.position.z,
      },
      rotation: {
        x: proxy.rotation.x,
        y: proxy.rotation.y,
        z: proxy.rotation.z,
      },
      scale: {
        x: proxy.scale.x,
        y: proxy.scale.y,
        z: proxy.scale.z,
      },
      components: [
        {
          type: 'model',
          assetPath: assetName,
        },
      ],
      source: {
        ...instanceInfo,
        instanceId: key,
        instance_id: key,
      },
    };

    setEditProps({
      name: assetName,
      position: proxy.position.clone(),
      angle: proxy.rotation.y || 0,
      obj: proxy,
      categoryIndex: instanceInfo.categoryIndex,
      assetID: key,
      template_id: instanceInfo.template_id,
    });
    setEditAssetId(key);
    setSelectedAssetId(key);

    setSelectedEditorInstance({
      instanceId: key,
      scenePath: `game-project:${projectId}`,
      object: proxy,
      gameObject,
      apiObject: instanceInfo,
      cleanKey: name
    });
  };

  const instanceSignature = useMemo(() => {
    return getInstanceDataSignatureHash(instanceData);
  }, [instanceData]);

  const animationTargetIds = useMemo(() => {
    const ids = new Set();
    if (!Array.isArray(animations)) {
      return ids;
    }

    animations.forEach((entry) => {
      if (Array.isArray(entry?.targetInstanceIds)) {
        entry.targetInstanceIds.forEach((targetId) => ids.add(String(targetId)));
      }
    });

    return ids;
  }, [animations]);

  // Reset memory when projectId changes
  useEffect(() => {
    // Clear all cached data
    positionsRef.current = {};
    animationTargetsRef.current = {};
    animationActiveRef.current.clear();

    // Reset mesh userData
    if (meshRef.current) {
      meshRef.current.userData = {
        positions: {},
        keyToIndex: {},
      };
    }

    // Optional: log for debugging
    // console.log(`[TemplateInstances] Memory cleared for project: ${projectId}`);

    return () => {
      // Additional cleanup when component unmounts or projectId changes again
      if (meshRef.current) {
        meshRef.current.userData = {};
      }
    };
  }, [projectId]);

  // Prepare merged geometry for TrimeshCollider
  const mergedGeometry = useMemo(() => {
    if (!geometry || instanceData.length === 0) return null;
    const cache = mergedGeometryCacheRef.current;
    if (cache.sig === instanceSignature && cache.source === geometry && cache.geometry) {
      return cache.geometry;
    }

    if (cache.geometry) {
      cache.geometry.dispose();
    }

    const merged = new THREE.BufferGeometry();
    const positionAttr = geometry.attributes.position;
    if (!positionAttr) return null;

    const indexAttr = geometry.index;
    const instanceCount = instanceData.length;
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
    const userPositions = meshRef.current?.userData?.positions;
    const dummyObj = dummy.current;

    for (let i = 0; i < instanceCount; i += 1) {
      const data = instanceData[i];
      const storedPos = userPositions?.[i];
      const p = data.position || [0, 0, 0];
      const r = data.rotation || [0, 0, 0];

      if (storedPos) {
        dummyObj.position.copy(storedPos);
      } else {
        dummyObj.position.set(p[0] || 0, p[1] || 0, p[2] || 0);
      }
      dummyObj.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0);
      dummyObj.scale.set(
        data.scale?.x ?? 1,
        data.scale?.y ?? 1,
        data.scale?.z ?? 1
      );
      dummyObj.updateMatrix();

      const matrix = dummyObj.matrix.elements;
      const m0 = matrix[0];
      const m1 = matrix[1];
      const m2 = matrix[2];
      const m4 = matrix[4];
      const m5 = matrix[5];
      const m6 = matrix[6];
      const m8 = matrix[8];
      const m9 = matrix[9];
      const m10 = matrix[10];
      const m12 = matrix[12];
      const m13 = matrix[13];
      const m14 = matrix[14];

      for (let j = 0; j < baseVertexCount; j += 1) {
        const attrIndex = j * 3;
        const x = positionArray[attrIndex];
        const y = positionArray[attrIndex + 1];
        const z = positionArray[attrIndex + 2];

        positions[positionOffset++] = (m0 * x) + (m4 * y) + (m8 * z) + m12;
        positions[positionOffset++] = (m1 * x) + (m5 * y) + (m9 * z) + m13;
        positions[positionOffset++] = (m2 * x) + (m6 * y) + (m10 * z) + m14;
      }

      const vertexOffset = i * baseVertexCount;
      if (indexArray) {
        for (let k = 0; k < baseIndexCount; k += 1) {
          indices[indexOffset++] = indexArray[k] + vertexOffset;
        }
      } else {
        for (let k = 0; k < baseVertexCount; k += 1) {
          indices[indexOffset++] = vertexOffset + k;
        }
      }
    }

    merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
    mergedGeometryCacheRef.current = { sig: instanceSignature, source: geometry, geometry: merged };
    return merged;
  }, [geometry, instanceSignature]);

  useEffect(() => {
    if (!mergedGeometry || !String(cellKey || "").includes("@currentSceneFall")) {
     
      return;
    }

    // console.warn("[InfiniteWorld] fall clone merged trimesh collider mounted", {
    //   cellKey,
    //   name,
    //   vertexCount: mergedGeometry.attributes.position.count,
    //   indexCount: mergedGeometry.index?.count || 0,
    // });
  }, [cellKey, mergedGeometry, name]);

  const updateMatrices = () => {
    const mesh = meshRef.current;
    const dummyObj = dummy.current;

    if (!mesh || !dummyObj) return;

    const animatedIds = mesh.userData?.animatedInstanceIds;
    const threshold = 0.1 + levelValue * 0.1 - 0.02;
    const isEditMode = buttonMode === "Edit Mode";
    const isViewMode = buttonMode === "View Mode";
    const lowerBound = threshold - 0.08;
    const upperBound = threshold + 0.01;

    const tempScale = new THREE.Vector3();
    const tempColor = new THREE.Color();

    for (let i = 0, len = instanceData.length; i < len; i++) {
      const data = instanceData[i];

      if (data.key <= 0) continue;

      const key = String(data.key);

      if (animatedIds?.has?.(key)) continue;

      const pos = positionsRef.current[i];

      const x = pos?.x || 0;
      const y = pos?.y || 0;
      const z = pos?.z || 0;

      const isAnimationTarget = animationTargetIds.has(key);

      let shouldShow = true;

      if (isAnimationTarget) {
        shouldShow = true;
      } else if (isEditMode) {
        shouldShow = y <= threshold;
      } else if (isViewMode) {
        shouldShow = y >= lowerBound && y <= upperBound;
      }

      dummyObj.position.set(x, y, z);

      if (data.vAlignValue > 0) {
        dummyObj.position.y += data.vAlignValue;
      }

      const rotation = data.rotation;

      if (rotation) {
        dummyObj.rotation.set(rotation[0], rotation[1], rotation[2]);
      } else {
        dummyObj.rotation.set(0, 0, 0);
      }

      const scale = data.scale;

      if (scale) {
        tempScale.set(scale.x, scale.y, scale.z);
      } else {
        tempScale.set(1, 1, 1);
      }

      if (!shouldShow) {
        tempScale.set(0, 0, 0);
      }

      dummyObj.scale.set(tempScale.x, tempScale.y, tempScale.z);
      dummyObj.updateMatrix();

      mesh.setMatrixAt(i, dummyObj.matrix);

      const dataColor = data.color;

      if (
        dataColor &&
        dataColor !== null &&
        !dataColor.includes("undefined")
      ) {
        tempColor.set(dataColor);
        mesh.setColorAt(i, tempColor);
      }
    }
  };

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const userData = mesh.userData;

    userData.keyToIndex = {};
    userData.animatedInstanceIds ??= new Set();

    const keyToIndex = userData.keyToIndex;

    for (let i = 0, len = instanceData.length; i < len; i++) {
      const key = instanceData[i]?.key;

      if (key != null) {
        keyToIndex[key] = i;
      }
    }
  }, [instanceData, instanceSignature]);

  // useEffect(() => {
  //   //if (!animations.length) return;
  //   console.log("[animateMotion template-instances]", {
  //     name,
  //     instanceKeys: instanceData.map((item) => String(item.key)),
  //     animationTargetIds: Array.from(animationTargetIds),
  //     animations,
  //   });
  // }, [animations, animationTargetIds, instanceData, name]);

  // Initialize positions and matrices when instanceData or projectId changes
  useLayoutEffect(() => {
    if (!geometry || !meshRef.current || !instanceData.length) return;

    // Ensure userData structure
    meshRef.current.userData = meshRef.current.userData || {};
    meshRef.current.userData.positions = meshRef.current.userData.positions || {};
    meshRef.current.userData.keyToIndex = meshRef.current.userData.keyToIndex || {};
    meshRef.current.userData.animatedInstanceIds = meshRef.current.userData.animatedInstanceIds || new Set();

    for (let i = 0, len = instanceData.length; i < len; i++) {
      const data = instanceData[i];

      if (data.key <= 0) continue;

      const key = data.key;
      meshRef.current.userData.keyToIndex[key] = i;

      const position = data.position || [0, 0, 0];
      const posVec = new THREE.Vector3(
        position[0],
        position[1],
        position[2]
      );

      meshRef.current.userData.positions[i] = posVec.clone();

      const animatedIds = meshRef.current.userData.animatedInstanceIds;

      if (!animatedIds?.has?.(String(key))) {
        positionsRef.current[i] =
          meshRef.current.userData.positions[i].clone();
      }
    }

    updateMatrices();
    if (meshRef.current.instanceMatrix) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [instanceData, instanceSignature, geometry, buttonMode, levelValue, projectId, animationTargetIds]);

  // Cleanup on unmount
  useLayoutEffect(() => {
    return () => {
      animationActiveRef.current.clear();
      animationTargetsRef.current = {};
      positionsRef.current = {};
      if (meshRef.current) {
        meshRef.current.userData = {};
      }
      const cachedGeometry = mergedGeometryCacheRef.current?.geometry;
      if (cachedGeometry) {
        cachedGeometry.dispose();
      }
      mergedGeometryCacheRef.current = { sig: "", source: null, geometry: null };
    };
  }, []);

  // Append to global instanceDataList
  useEffect(() => {
    if (!registerGlobalInstances) {
      return undefined;
    }

    const mergedMap = new Map();

    for (let i = 0, len = instanceDataList.length; i < len; i++) {
      const item = instanceDataList[i];

      if (item?.key == null) continue;

      mergedMap.set(String(item.key), item);
    }

    for (let i = 0, len = instanceData.length; i < len; i++) {
      const item = instanceData[i];

      if (item?.key == null) continue;

      mergedMap.set(String(item.key), item);
    }

    const mergedList = Array.from(mergedMap.values());

    let nextSig = "";

    for (let i = 0, len = mergedList.length; i < len; i++) {
      const item = mergedList[i];
      const p = item?.position || [0, 0, 0];

      if (i > 0) nextSig += "|";

      nextSig += `${item?.key}:${p[0] ?? 0}:${p[1] ?? 0}:${p[2] ?? 0}`;
    }

    if (nextSig === instanceListWriteSigRef.current) return;

    instanceListWriteSigRef.current = nextSig;
    setInstanceData(mergedList);
  }, [instanceData, instanceDataList, registerGlobalInstances, setInstanceData]);

  // Register mesh in gameInstances
  useEffect(() => {
    if (!registerGlobalInstances) {
      return undefined;
    }

    if (meshRef.current) {
      const nextSig = `${name}:${instanceSignature}:${meshRef.current.uuid}`;
      if (nextSig === gameInstancesWriteSigRef.current) return;
      gameInstancesWriteSigRef.current = nextSig;
      setGameInstances({
        [name]: { instanceData, instanceMesh: meshRef.current },
      });
    }

    return () => {
      gameInstancesWriteSigRef.current = "";
      setGameInstances({ [name]: undefined })
    }
  }, [name, instanceData, instanceSignature, registerGlobalInstances, setGameInstances]);

  // ────────────────────────────────────────────────
  // All other useEffect hooks remain unchanged
  // ────────────────────────────────────────────────

  useEffect(() => {
    if (!removedObject || !meshRef.current) return;
    const { name: removedName, id } = removedObject;
    if (!removedName || !id) return;

    const data = gameInstances[removedName];

    if (!data) return;

    const preObj = scene.getObjectByName('hovering');
    if (preObj) preObj.parent?.remove(preObj);

    const instanceMesh = meshRef.current;
    const index = instanceMesh?.userData?.keyToIndex[id];

    if (index === undefined) return;

    const matrix = new THREE.Matrix4();
    const newScale = new THREE.Vector3(0, 0, 0);
    const position = new THREE.Vector3(0, 0, 0);
    const quart = new THREE.Quaternion();
    matrix.compose(position, quart, newScale);

    instanceMesh.setMatrixAt(index, matrix);
    instanceMesh.instanceMatrix.needsUpdate = true;
    if (id) {
      blackListedCoins.add(id);
      setBlackListedCoins(new Set(blackListedCoins));
    }
  }, [removedObject]);


  useEffect(() => {
    if (!meshRef.current) return;
    if (!selectedAssetId) return;

    const asset = sceneAssets?.[selectedAssetId];
    if (!asset) return;

    const index = meshRef.current?.userData?.keyToIndex?.[selectedAssetId];
    if (index === undefined) return;

    const { position, scale, quart, fAngle = 0, vAlignValue = 0 } = asset;

    const hasRot = rotationValue !== null && rotationValue !== undefined;
    const hasV = verticalAlign !== null && verticalAlign !== undefined;
    if (!hasRot && !hasV) return;

    // Parse selected values
    const newVAlign = hasV ? (parseFloat(verticalAlign) || 0) : vAlignValue;

    // rotationValue can be "0" / "90" / "180" / "270"
    const newAngleDeg = hasRot ? (parseFloat(rotationValue) || 0) : fAngle;

    // ✅ baseY from loaded values: baseY = pos.y - vAlignValue
    if (asset.baseY === undefined || asset.baseY === null) {
      asset.baseY = (position?.y ?? 0) - (vAlignValue || 0);
    }
    const baseY = asset.baseY;

    // ✅ baseQuat from loaded values: baseQuat = quart * inverse(rotY(fAngle))
    // Only compute once (or if missing)
    if (!asset.baseQuat) {
      const q = quart?.clone?.() || new THREE.Quaternion();

      const qAngle = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1), // Y axis yaw
        THREE.MathUtils.degToRad(fAngle)
      );

      asset.baseQuat = q.clone().multiply(qAngle.clone().invert());
    }
    const baseQuat = asset.baseQuat.clone();

    // Build instance transform
    const dummyObj = new THREE.Object3D();

    // ✅ absolute vertical
    dummyObj.position.set(position.x, baseY + newVAlign, position.z);

    // ✅ absolute rotation from baseQuat
    const qNewAngle = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      THREE.MathUtils.degToRad(newAngleDeg)
    );

    const newQuat = baseQuat.multiply(qNewAngle);
    dummyObj.quaternion.copy(newQuat);

    dummyObj.scale.set(scale?.x ?? 1, scale?.y ?? 1, scale?.z ?? 1);
    dummyObj.updateMatrix();

    meshRef.current.setMatrixAt(index, dummyObj.matrix);
    meshRef.current.instanceMatrix.needsUpdate = true;

    // Persist back
    if (hasV) {
      position.y = baseY + newVAlign;
      asset.position = position;
      asset.vAlignValue = newVAlign;
    }

    if (hasRot) {
      asset.fAngle = newAngleDeg;  // store selected 0/90/180/270
      asset.angle = newAngleDeg;
      asset.quart = newQuat;
    }
  }, [rotationValue, verticalAlign, selectedAssetId]);




  useEffect(() => {
    if (rotationValue === null || rotationValue === undefined || !selectedAssetId || !name || !dragObjectProperties) return;

    const newPosition = dragObjectProperties.position;
    const { scale, quart, fAngle } = sceneAssets[selectedAssetId];
    const rotation = new THREE.Euler(0, THREE.MathUtils.degToRad(parseFloat(rotationValue) - fAngle), 0, 'XYZ');
    const quaternion = new THREE.Quaternion().setFromEuler(rotation);

    const index = meshRef.current?.userData?.keyToIndex[selectedAssetId];
    if (index === undefined) return;

    const dummyObj = new THREE.Object3D();
    dummyObj.position.copy(newPosition);
    dummyObj.quaternion.copy(quart.clone().multiply(quaternion));
    dummyObj.scale.set(scale?.x ?? 1, scale?.y ?? 1, scale?.z ?? 1);
    dummyObj.updateMatrix();

    meshRef.current?.setMatrixAt(index, dummyObj.matrix);
    meshRef.current.instanceMatrix.needsUpdate = true;

    sceneAssets[selectedAssetId].position = newPosition;


  }, [dragObjectProperties]);

  useEffect(() => {
    const index = meshRef.current?.userData?.keyToIndex?.[selectedId];
    if (index === undefined) return;

    const mesh = meshRef.current;
    if (selectedId && assetColor) {
      // updateColor(selectedId, assetColor);  // Commented out in original
      const color = new THREE.Color(assetColor);
      mesh.setColorAt(index, color);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [selectedId, assetColor]);

  // ────────────────────────────────────────────────
  // Event handlers (unchanged)
  // ────────────────────────────────────────────────

  const setMaterialColor = (object, hexColor, alpha = 1) => {
    if (!hexColor || typeof hexColor !== 'string') return;

    const updateMaterial = (material) => {
      const materialClone = material.clone();
      if (materialClone?.color) {
        try {
          materialClone.color.set(hexColor);
        } catch (e) {
          console.warn('Invalid color:', e);
        }
      }
      return materialClone;
    };

    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material = object.material.map(updateMaterial);
      } else {
        object.material = updateMaterial(object.material);
      }
    }

    if (object.children?.length) {
      object.children.forEach((child) => setMaterialColor(child, hexColor, alpha));
    }
  };

  const isChessBoardInteractionBlocker = (object) => {
    let current = object;
    while (current) {
      if (current.userData?.__chessBoardInteractionBlocker) {
        return true;
      }

      current = current.parent;
    }

    return false;
  };

  const isBlockedByChessBoard = (event) => {
    const intersections = event?.intersections;
    if (!Array.isArray(intersections) || !intersections.length) {
      return false;
    }

    const currentObject = event.object;
    const currentEventObject = event.eventObject;

    for (const intersection of intersections) {
      const object = intersection.object;
      if (object === currentObject || object === currentEventObject) {
        return false;
      }

      if (isChessBoardInteractionBlocker(object)) {
        return true;
      }
    }

    return false;
  };

  const showPopup = (instanceId) => {
    gl.domElement.style.cursor = 'pointer';
    const preObj = scene.getObjectByName('hovering');
    if (preObj) preObj.parent?.remove(preObj);

    if (!sceneAssets[instanceId]) return;

    const { object: assetObject, position, quarternion, vAlignValue } = sceneAssets[instanceId];
    if (!assetObject) return;

    assetObject.name = 'hovering';
    assetObject.position.copy(position);
    assetObject.position.y += vAlignValue;
    assetObject.quaternion.copy(quarternion);
    setMaterialColor(assetObject, 'rgb(243,255,211)', 1);
    scene.add(assetObject);
  };

  const handleDbClick = (event) => {
    if (isBlockedByChessBoard(event)) {
      event.stopPropagation();
      return;
    }

    event.stopPropagation();
    setAnimationRef(null);
    const instanceId = event.instanceId;
    if (instanceId !== undefined && instanceData[instanceId]) {
      const key = instanceData[instanceId].key;
      setScannedId(`${key}t_click`);
      setSearchItem({ noZoom: true });
      setScan(!scan);
    }
  };

  const handlePointerOver = (e) => {

    if (isBlockedByChessBoard(e)) {
      e.stopPropagation();
      return;
    }

    e.stopPropagation();
      if (isGizmoActive) {
      return;
    }
    const instanceId = e.instanceId;
    if (instanceId !== undefined && instanceData[instanceId]) {
      const key = instanceData[instanceId].key;
      if (key) showPopup(key);
    }
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    const preObj = scene.getObjectByName('hovering');
    if (preObj) preObj.parent?.remove(preObj);
  };

  const handleClick = (e) => {
   
    if (isBlockedByChessBoard(e)) {
      e.stopPropagation();
      return;
    }

    e.stopPropagation();
  
    if (isGizmoActive) {
      return;
    }

    if (editing && (hasUnsavedTransformUpdate || useGame.getState?.()?.hasUnsavedTransformUpdate)) {
      setAssetSelected(true)
      return;
    }


    const instanceId = e.instanceId;
    if (instanceId !== undefined && instanceData[instanceId]) {
      const key = instanceData[instanceId].key;
      const { name: assetName, color } = sceneAssets[key] || {};
      const { defaultColor } = objects[assetName] || {};

      if (defaultColor || color) {
        setAssetColor(defaultColor || color);
        setSelectedId(key);
        setSelectedAssetId(key)
      }
      if (!isNaN(id)) {

        setSelectedCatId(id)
      }

      selectEditorInstance(instanceId);

      if (!deleteObject) return;
      setDeleteAssetId(key);
    }
  };

  const handlePlayInfoClick = (e) => {
    e.stopPropagation();

    const instanceId = e.instanceId;
    if (instanceId === undefined || !instanceData[instanceId]) {
      return;
    }

    const item = instanceData[instanceId];
    const key = item.key || item.assetId || item.assetID || item.instanceId || item.instance_id;

    if (!key) {
      return;
    }

    setPlayAssetInfoRequest({
      instanceId: key,
      name: item.name || name,
      instanceIndex: instanceId,
    });
  };

  const handleRightClick = (e) => {
    // e.stopPropagation();

    const instanceId = e.instanceId;
    if (instanceId !== undefined && instanceData[instanceId]) {
      const key = instanceData[instanceId].key;
      // if (!deleteObject) return;

      setDeleteAssetId(key);
    }
  }

  useEffect(() => {
    const handler = (e) => e.preventDefault();

    window.addEventListener("contextmenu", handler);

    return () => window.removeEventListener("contextmenu", handler);
  }, []);


  return (
    <group name={name} key={`${name}_${projectId}`}>
      <instancedMesh
        ref={meshRef}
        args={[meshGeometry, meshMaterial, instanceData.length]}
        name={name}
        onDoubleClick={buttonMode === 'Edit Mode' && visible && editorSelectionEnabled ? handleDbClick : undefined}
        onPointerDown={
          buttonMode === 'Play mode'
            ? handlePlayInfoClick
            : buttonMode === 'Edit Mode' && visible && editorSelectionEnabled
              ? (e) => {
                // e.stopPropagation();

                // LEFT click
                if (e.button === 0) {
                   handleClick(e);
                }

                // RIGHT click
                // if (e.button === 2) {
                //   handleRightClick(e);
                // }
              }
              : undefined
        }
        onPointerOver={buttonMode === 'Edit Mode' && visible && editorSelectionEnabled ? handlePointerOver : undefined}
        onPointerOut={buttonMode === 'Edit Mode' && visible && editorSelectionEnabled ? handlePointerOut : undefined}
        frustumCulled={false}
      />

      <TemplateInstanceMotion
        meshRef={meshRef}
        animations={animations}
        instanceData={instanceData}
        instanceSignature={instanceSignature}
        name={name}
      />

      {mergedGeometry && (
        <MergedInstanceTrimeshCollider
          colliderKey={`${projectId}_${name}_${cellKey || "origin"}_merged_trimesh`}
          geometry={mergedGeometry}
          name={name}
        />
      )}

      {numericLikeProjectId && name.toLowerCase() === "floor_cube" && instanceData.length > 0 && (
        <TokenInstance
          key={`${projectId}_${name}_instances`}
          instanceData={instanceData}
          size={size}
          object={object}
          name={name}
        />
      )}

      {/* {numericLikeProjectId && name.toLowerCase() === "wall_glass_cube_1" && instanceData.length > 0 && (
        <AccessKeyCode
          key={`${projectId}_${name}_accessKeyCode`}
          size={size}
          instanceData={instanceData}
        />
      )} */}
    </group>
  );
}
