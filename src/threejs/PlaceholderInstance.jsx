import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { AURA_SCALE, SNAP_DURATION } from "./placeholders/placeholderConstants";

const targetEuler = new THREE.Euler(0, 0, 0, "XYZ");

function PlaceholderSnapAnimator({
  snappingRbRef,
  snappedRbRef,
  isAnimatingRef,
  animT,
  startPos,
  startQuat,
  targetPos,
  targetQuat,
  framePos,
  frameQuat,
  halfHeight,
  onIdle,
}) {
  useFrame((_, delta) => {
    const rb = snappingRbRef.current;
    if (!rb) {
      onIdle();
      return;
    }

    animT.current = Math.min(animT.current + delta / SNAP_DURATION, 1);
    const t = THREE.MathUtils.smoothstep(animT.current, 0, 1);

    const p = framePos.current.copy(startPos.current).lerp(targetPos.current, t);
    const q = frameQuat.current.copy(startQuat.current).slerp(targetQuat.current, t);

    rb.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    rb.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

    if (t >= 1) {
      rb.setTranslation({ x: targetPos.current.x, y: p.y - halfHeight, z: targetPos.current.z }, true);
      rb.setRotation(
        { x: targetQuat.current.x, y: targetQuat.current.y, z: targetQuat.current.z, w: targetQuat.current.w },
        true
      );
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      snappedRbRef.current = rb;
      snappingRbRef.current = null;
      isAnimatingRef.current = false;
      onIdle();
    }
  });

  return null;
}

function PlaceholderInstance({
  inst,
  index,
  object,
  freeAuraMaterial,
  occupiedAuraMaterial,
  isPlayMode,
  setPlayAssetInfoRequest,
}) {
  const rbRef = useRef(null);
  const rbCollider = useRef(null);
  const meshRef = useRef(null);
  const timeoutsRef = useRef([]);
  const [snapAnimatorActive, setSnapAnimatorActive] = useState(false);

  // Physics snap state
  const snappingRbRef = useRef(null);
  const snappedRbRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const occupiedRef = useRef(false);

  const animT = useRef(0);

  const startPos = useRef(new THREE.Vector3());
  const startQuat = useRef(new THREE.Quaternion());
  const targetPos = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());
  const framePos = useRef(new THREE.Vector3());
  const frameQuat = useRef(new THREE.Quaternion());
  const auraStateRef = useRef("");

  const sensorSize = inst.sensorSize;
  const halfHeight = inst.halfHeight;
  const inCage = useRef(false)

  const setAuraMaterial = useCallback(
    (material) => {
      if (meshRef.current && meshRef.current.material !== material) {
        meshRef.current.material = material;
      }
    },
    []
  );

  const stopSnapAnimator = useCallback(() => {
    setSnapAnimatorActive(false);
  }, []);

  const scheduleTimeout = useCallback((callback, delay) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((timeoutId) => timeoutId !== id);
      callback();
    }, delay);
    timeoutsRef.current.push(id);
  }, []);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, []);

  const onEnter = useCallback(
    (e) => {
      const otherRb = e.other?.rigidBody;
      const otherName = e.other?.rigidBodyObject?.name || "";

      if (!otherRb) return;

      // Character → make collider SOLID (blocks character)
      if (otherName === "character" || otherName==="treasure_0") {
        rbCollider.current?.setSensor(false);
        return;
      }
  
      // Other objects → keep sensor (they can pass through)
      rbCollider.current?.setSensor(true);

      // Only snap non-character objects
      if (occupiedRef.current || isAnimatingRef.current) return;

      occupiedRef.current = true;
      isAnimatingRef.current = true;
      auraStateRef.current = "occupied";
      setAuraMaterial(occupiedAuraMaterial);
      snappingRbRef.current = otherRb;
      setSnapAnimatorActive(true);

      // kinematic during snap
      otherRb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      otherRb.setAngvel({ x: 0, y: 0, z: 0 }, true);

       otherRb.setBodyType(2);
       const p0 = otherRb.translation();
        const r0 = otherRb.rotation();
        startPos.current.set(p0.x, p0.y, p0.z);
        startQuat.current.set(r0.x, r0.y, r0.z, r0.w)

        targetPos.current.set(inst.position[0], inst.position[1] + halfHeight, inst.position[2]);
        targetEuler.set(inst.rotation[0], inst.rotation[1], inst.rotation[2], "XYZ");
        targetQuat.current.setFromEuler(targetEuler)

      scheduleTimeout(() => {
        inCage.current = true
        auraStateRef.current = "free";
        setAuraMaterial(freeAuraMaterial);
        otherRb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        otherRb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        otherRb.setBodyType(0)
      }, 1000)

      scheduleTimeout(() => {
        snappingRbRef.current = otherRb;
        setSnapAnimatorActive(true);
        inCage.current = false
        auraStateRef.current = "occupied";
        setAuraMaterial(occupiedAuraMaterial);
        otherRb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        otherRb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        otherRb.setBodyType(2)
      }, 1500)

       scheduleTimeout(() => {
        snappingRbRef.current = null;
        setSnapAnimatorActive(false);
        inCage.current = true
        auraStateRef.current = "free";
        setAuraMaterial(freeAuraMaterial);
      }, 2000)



      animT.current = 0;
    },
    [freeAuraMaterial, occupiedAuraMaterial, scheduleTimeout, setAuraMaterial, inst.position, inst.rotation, halfHeight]
  );

  const onExit = useCallback((e) => {
    const otherRb = e.other?.rigidBody;
    const otherName = e.other?.rigidBodyObject?.name || "";

    if (!otherRb) return;

    // When character exits → restore sensor (allow others to pass again)
    if (otherName === "character") {
      rbCollider.current?.setSensor(true);
      return;
    }

    // When snapped object exits → allow new objects to be placed
    if (snappedRbRef.current && otherRb === snappedRbRef.current) {
      snappedRbRef.current = null;
      occupiedRef.current = false;
      auraStateRef.current = "free";
      setAuraMaterial(freeAuraMaterial);
    }
  }, [freeAuraMaterial, setAuraMaterial]);

  const handlePlayInfoClick = useCallback((e) => {
    e.stopPropagation();
    const instanceId =
      inst?.key || inst?.assetId || inst?.assetID || inst?.instanceId || inst?.instance_id || inst?.userData?.instance_id;

    if (!instanceId) return;

    setPlayAssetInfoRequest({
      instanceId,
      name: inst?.name || object?.name || `placeholder_${index}`,
      instanceIndex: index,
    });
  }, [index, inst, object?.name, setPlayAssetInfoRequest]);

  if (!object?.geometry) return null;

  return (
    <RigidBody
      ref={rbRef}
      name={`placeholder_${index}`}
      type="fixed"
      colliders={false}
      position={inst.position}
      rotation={inst.rotation}
    >
      <group position={[0, 0, 0]}>
        <CuboidCollider
          ref={rbCollider}
          args={[sensorSize[0] / 2, sensorSize[1] / 2, sensorSize[2] / 2]}
          sensor
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />

        <mesh
          geometry={object.geometry}
          material={freeAuraMaterial}
          ref={meshRef}
          scale={[AURA_SCALE, AURA_SCALE, AURA_SCALE]}
          onPointerDown={isPlayMode ? handlePlayInfoClick : undefined}
        // frustumCulled={false}
        />
      </group>
      {snapAnimatorActive && (
        <PlaceholderSnapAnimator
          snappingRbRef={snappingRbRef}
          snappedRbRef={snappedRbRef}
          isAnimatingRef={isAnimatingRef}
          animT={animT}
          startPos={startPos}
          startQuat={startQuat}
          targetPos={targetPos}
          targetQuat={targetQuat}
          framePos={framePos}
          frameQuat={frameQuat}
          halfHeight={halfHeight}
          onIdle={stopSnapAnimator}
        />
      )}
    </RigidBody>
  );
}

export default React.memo(PlaceholderInstance);
