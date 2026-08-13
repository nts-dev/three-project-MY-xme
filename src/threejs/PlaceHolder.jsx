import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import PlaceholderInstance from "./PlaceholderInstance";
import { AURA_SCALE } from "./placeholders/placeholderConstants";
import { getGeometrySize } from "./placeholders/placeholderGeometry";
import usePlaceholderAuraMaterial from "./placeholders/usePlaceholderAuraMaterial";
import usePreparedPlaceholderInstances from "./placeholders/usePreparedPlaceholderInstances";
import useGame from "../hooks/useGame";

const FREE_COLORS = [
  new THREE.Color("#ffd000"),
  new THREE.Color("#ff6a00"),
  new THREE.Color("#6fe7ff"),
];

function updateFreeAuraUniforms(material, elapsed, color) {
  if (!material) return;

  const speed = 0.35;
  const u = (elapsed * speed) % 1;

  if (u < 1 / 3) color.copy(FREE_COLORS[0]).lerp(FREE_COLORS[1], u * 3);
  else if (u < 2 / 3) color.copy(FREE_COLORS[1]).lerp(FREE_COLORS[2], (u - 1 / 3) * 3);
  else color.copy(FREE_COLORS[2]).lerp(FREE_COLORS[0], (u - 2 / 3) * 3);

  const uniforms = material.uniforms;
  uniforms.uColor.value.copy(color);
  uniforms.uIntensity.value = 3.2 + 0.3 * Math.sin(elapsed * 3);
  uniforms.uOpacity.value = 0.95;
  uniforms.uPower.value = 2.2;
  uniforms.uTime.value = elapsed;
}

function ClonePlaceholderBatch({ object, name, instances }) {
  const meshRef = useRef(null);
  const dummy = useRef(new THREE.Object3D());
  const material = usePlaceholderAuraMaterial();
  const color = useMemo(() => new THREE.Color("#6fe7ff"), []);

  useLayoutEffect(() => {
    if (!meshRef.current || !instances.length) {
      return;
    }

    instances.forEach((inst, index) => {
      dummy.current.position.set(...(inst.position || [0, 0, 0]));
      dummy.current.rotation.set(...(inst.rotation || [0, 0, 0]));
      dummy.current.scale.set(AURA_SCALE, AURA_SCALE, AURA_SCALE);
      dummy.current.updateMatrix();
      meshRef.current.setMatrixAt(index, dummy.current.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [instances]);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    material.uniforms.uColor.value.copy(color);
    material.uniforms.uIntensity.value = 2.2;
    material.uniforms.uOpacity.value = 0.6;
    material.uniforms.uPower.value = 2.2;
    material.uniforms.uTime.value = elapsed;
  });

  if (!object?.geometry || !instances.length) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[object.geometry, material, instances.length]}
      name={`${name}_clone_placeholder_batch`}
      frustumCulled={false}
    />
  );
}

function InteractivePlaceholderGroup({ object, name, instances }) {
  const isPlayMode = useGame((state) => state.buttonMode === "Play mode");
  const setPlayAssetInfoRequest = useGame((state) => state.setPlayAssetInfoRequest);
  const freeAuraMaterial = usePlaceholderAuraMaterial();
  const occupiedAuraMaterial = usePlaceholderAuraMaterial();
  const freeAuraColor = useMemo(() => new THREE.Color("#ffd000"), []);

  useLayoutEffect(() => {
    const uniforms = occupiedAuraMaterial.uniforms;
    uniforms.uColor.value.set("#ff4444");
    uniforms.uIntensity.value = 5.0;
    uniforms.uOpacity.value = 1.0;
    uniforms.uPower.value = 1.6;
    uniforms.uTime.value = 0;
  }, [occupiedAuraMaterial]);

  useFrame((state) => {
    if (!instances.length) return;
    //updateFreeAuraUniforms(freeAuraMaterial, state.clock.getElapsedTime(), freeAuraColor);
  });

  return (
    <group name={`${name}_pushLiftBlocks`}>
      {instances.map((inst, i) => (
        <PlaceholderInstance
          key={`${name}_${inst.key || i}`}
          index={i}
          inst={inst}
          object={object}
          freeAuraMaterial={freeAuraMaterial}
          occupiedAuraMaterial={occupiedAuraMaterial}
          isPlayMode={isPlayMode}
          setPlayAssetInfoRequest={setPlayAssetInfoRequest}
        />
      ))}
    </group>
  );
}

export default function PlaceHolder({ object, name, createInstances, cellKey }) {
  const baseSize = React.useMemo(() => getGeometrySize(object?.geometry), [object?.geometry]);
  const preparedInstances = usePreparedPlaceholderInstances(createInstances, baseSize);
  const isCloneCell = Boolean(cellKey && cellKey !== "0,0,0");

  if (isCloneCell) {
    return (
      <group name={`${name}_clone_pushLiftBlocks`}>
        <ClonePlaceholderBatch
          object={object}
          name={name}
          instances={preparedInstances}
        />
      </group>
    );
  }

  return (
    <InteractivePlaceholderGroup
      object={object}
      name={name}
      instances={preparedInstances}
    />
  );
}
