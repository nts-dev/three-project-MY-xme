import React, { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import useGame from "../hooks/useGame";
import { sceneAssets } from "./player/puzzle/character/Constants.jsx";
import { applyDslAnimations, clearDslAnimations } from "./dslAnimationRuntime";

export default function TemplateInstanceMotion({
  meshRef,
  animations = [],
  instanceData = [],
  instanceSignature,
  name,
}) {
  const projectId = useGame((s) => s.projectID);
  const invalidate = useThree((state) => state.invalidate);
  const animatedDummy = useRef(new THREE.Object3D());
  const animatedEuler = useRef(new THREE.Euler());
  const animatedQuaternion = useRef(new THREE.Quaternion());
  const animatedDeltaQuaternion = useRef(new THREE.Quaternion());

  const activeAnimations = useMemo(() => (
    Array.isArray(animations) ? animations : []
  ), [animations]);

  useEffect(() => {
    if (!meshRef.current || activeAnimations.length === 0 || instanceData.length === 0) {
      clearDslAnimations(`${projectId}:${name}:game`);
      return;
    }

    const mesh = meshRef.current;
    const keyToIndex = {
      ...Object.fromEntries(instanceData.map((item, index) => [String(item.key), index])),
      ...(mesh.userData?.keyToIndex || {}),
    };
    ensureAnimatedInstanceIds(mesh);

    const cleanup = applyDslAnimations(
      `${projectId}:${name}:game`,
      activeAnimations,
      () => ({
        position: new THREE.Vector3(),
        rotation: new THREE.Euler()
      }),
      (target) => {
        const hasTargetScope = Array.isArray(target.targetInstanceIds);
        const targetIds = hasTargetScope ? target.targetInstanceIds.map(String) : [];
        const activeIds = hasTargetScope ? targetIds : instanceData.map((item) => String(item.key));

        activeIds.forEach((assetId) => {
          const index = keyToIndex[assetId];
          if (index === undefined) return;

          const asset = sceneAssets[assetId];
          const data = instanceData[index];
          if (!asset || !data) return;
          ensureAnimatedInstanceIds(mesh).add(String(assetId));

          if (!asset.baseAnimationPosition) {
            asset.baseAnimationPosition = asset.position?.clone?.() || new THREE.Vector3(...(data.position || [0, 0, 0]));
          }
          if (asset.baseAnimationAngle === undefined) {
            asset.baseAnimationAngle = asset.angle || 0;
          }
          if (!asset.baseAnimationQuaternion) {
            asset.baseAnimationQuaternion = getBaseAnimationQuaternion(asset, data);
          }

          const basePosition = asset.baseAnimationPosition;
          const absoluteOffset = target.__absolutePosition
            ? getAbsolutePositionOffset(asset, basePosition, target)
            : null;
          const nextPosition = target.__absolutePosition
            ? new THREE.Vector3(
              target.x !== undefined ? target.x + absoluteOffset.x : basePosition.x,
              target.y !== undefined ? target.y + absoluteOffset.y : basePosition.y,
              target.z !== undefined ? target.z + absoluteOffset.z : basePosition.z
            )
            : new THREE.Vector3(
              basePosition.x + (target.x || 0),
              basePosition.y + (target.y || 0),
              basePosition.z + (target.z || 0)
            );

          animatedEuler.current.set(
            target.rx || 0,
            target.ry || 0,
            target.rz || 0
          );
          animatedDeltaQuaternion.current.setFromEuler(animatedEuler.current);
          animatedQuaternion.current
            .copy(asset.baseAnimationQuaternion)
            .multiply(animatedDeltaQuaternion.current);

          asset.position.copy(nextPosition);
          asset.quart = animatedQuaternion.current.clone();
          asset.quarternion = animatedQuaternion.current.clone();

          animatedDummy.current.position.copy(nextPosition);
          if (data.vAlignValue > 0) {
            animatedDummy.current.position.y += data.vAlignValue;
          }
          animatedDummy.current.quaternion.copy(animatedQuaternion.current);
          animatedDummy.current.scale.copy(asset.scale || data.scale || new THREE.Vector3(1, 1, 1));
          animatedDummy.current.updateMatrix();

          mesh.setMatrixAt(index, animatedDummy.current.matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;
        invalidate();
      }
    );
    return () => {
      cleanup?.();
    };
  }, [activeAnimations, instanceData, instanceSignature, meshRef, name, projectId, invalidate]);

  return null;
}

function getAbsolutePositionOffset(asset, basePosition, target) {
  if (!asset.baseAnimationAbsoluteOffset) {
    asset.baseAnimationAbsoluteOffset = new THREE.Vector3(
      target.x !== undefined ? basePosition.x - target.x : 0,
      target.y !== undefined ? basePosition.y - target.y : 0,
      target.z !== undefined ? basePosition.z - target.z : 0
    );
  }

  return asset.baseAnimationAbsoluteOffset;
}

function ensureAnimatedInstanceIds(mesh) {
  mesh.userData = mesh.userData || {};
  if (!(mesh.userData.animatedInstanceIds instanceof Set)) {
    mesh.userData.animatedInstanceIds = new Set();
  }
  return mesh.userData.animatedInstanceIds;
}

function getBaseAnimationQuaternion(asset, data) {
  const storedQuaternion = asset.quart || asset.quarternion;
  if (storedQuaternion?.clone) {
    return storedQuaternion.clone();
  }

  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(...(data.rotation || [0, 0, 0]))
  );
}
