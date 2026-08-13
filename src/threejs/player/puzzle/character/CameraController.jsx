import { useCallback, useRef } from "react";
import * as THREE from "three";

export function useCameraController({
  cameraRef,
  orbitControlsRef,
  characterModel,
  world,
  rapier,
  bodyRef,
}) {
  const springPosRef = useRef(new THREE.Vector3());
  const springPosVelRef = useRef(new THREE.Vector3());
  const springTargetRef = useRef(new THREE.Vector3());
  const springTargetVelRef = useRef(new THREE.Vector3());
  const initializedRef = useRef(false);

  const sideOffsetRef = useRef(0);
  const sideOffsetVelRef = useRef(0);
  const collisionSampleTimerRef = useRef(0);
  const safeDistanceRef = useRef(0.2667);
  const collisionLiftRef = useRef(0);

  const rayOriginRef = useRef({ x: 0, y: 0, z: 0 });
  const rayDirRef = useRef({ x: 0, y: 0, z: 1 });
  const rayRef = useRef(null);

  const tmpForward = useRef(new THREE.Vector3());
  const tmpRight = useRef(new THREE.Vector3());
  const tmpPivot = useRef(new THREE.Vector3());
  const tmpDesiredPos = useRef(new THREE.Vector3());
  const tmpTarget = useRef(new THREE.Vector3());
  const tmpCandidate = useRef(new THREE.Vector3());
  const tmpDiff = useRef(new THREE.Vector3());

  const castClearance = useCallback(
    (origin, target) => {
      if (!world || !rapier) return { clear: target.distanceTo(origin), hit: false };
      if (!rayRef.current) {
        rayRef.current = new rapier.Ray(rayOriginRef.current, rayDirRef.current);
      }

      tmpDiff.current.copy(target).sub(origin);
      const length = Math.max(0.0001, tmpDiff.current.length());
      tmpDiff.current.multiplyScalar(1 / length);

      rayOriginRef.current.x = origin.x;
      rayOriginRef.current.y = origin.y;
      rayOriginRef.current.z = origin.z;
      rayDirRef.current.x = tmpDiff.current.x;
      rayDirRef.current.y = tmpDiff.current.y;
      rayDirRef.current.z = tmpDiff.current.z;

      const hit = world.castRay(
        rayRef.current,
        length,
        true,
        undefined,
        undefined,
        undefined,
        bodyRef?.current || undefined
      );
      if (!hit?.timeOfImpact && hit?.timeOfImpact !== 0) {
        return { clear: length, hit: false };
      }
      return { clear: Math.max(0, hit.timeOfImpact), hit: true };
    },
    [bodyRef, rapier, world]
  );

  return useCallback(
    ({ dt, tr, movement, hasMoveInput, walkTime }) => {
      const camera = cameraRef?.current;
      if (!camera) return;

      if (characterModel) {
        tmpForward.current.set(0, 0, 1).applyQuaternion(characterModel.quaternion);
        tmpForward.current.y = 0;
        tmpForward.current.normalize();
      } else {
        camera.getWorldDirection(tmpForward.current);
        tmpForward.current.y = 0;
        tmpForward.current.normalize();
      }
      tmpRight.current.set(tmpForward.current.z, 0, -tmpForward.current.x).normalize();

      const px = tr.x + movement.x;
      const py = tr.y + movement.y;
      const pz = tr.z + movement.z;

      const baseDistance = 0.2667;
      const minDistance = 0.08;
      const baseHeight = 0.11;
      const lookAhead = 0.05;
      const collisionPadding = 0.02;
      const collisionSampleHz = 30;

      tmpPivot.current.set(px, py + 0.02, pz);
      tmpDesiredPos.current.set(
        px - tmpForward.current.x * baseDistance,
        py + baseHeight,
        pz - tmpForward.current.z * baseDistance
      );

      collisionSampleTimerRef.current += dt;
      let sampleSafeDistance = safeDistanceRef.current;
      let sampleCollisionLift = collisionLiftRef.current;
      if (collisionSampleTimerRef.current >= 1 / collisionSampleHz) {
        collisionSampleTimerRef.current = 0;
        const clearance = castClearance(tmpPivot.current, tmpDesiredPos.current);
        sampleSafeDistance = baseDistance;
        if (clearance.hit) {
          sampleSafeDistance = THREE.MathUtils.clamp(
            clearance.clear - collisionPadding,
            minDistance,
            baseDistance
          );
        }
        const compressionNow = 1 - sampleSafeDistance / baseDistance;
        sampleCollisionLift = Math.max(0, compressionNow) * 0.06;
      }

      const distanceLerp = 1 - Math.exp(-16 * dt);
      safeDistanceRef.current = THREE.MathUtils.lerp(
        safeDistanceRef.current,
        sampleSafeDistance,
        distanceLerp
      );
      collisionLiftRef.current = THREE.MathUtils.lerp(
        collisionLiftRef.current,
        sampleCollisionLift,
        distanceLerp
      );

      const safeDistance = safeDistanceRef.current;
      const collisionLift = collisionLiftRef.current;
      const compression = 1 - safeDistance / baseDistance;

      let targetSideOffset = 0;
      if (compression > 0.05 && world && rapier) {
        tmpCandidate.current.set(
          px - tmpForward.current.x * safeDistance + tmpRight.current.x * 0.08,
          py + baseHeight + collisionLift,
          pz - tmpForward.current.z * safeDistance + tmpRight.current.z * 0.08
        );
        const leftClear = castClearance(tmpPivot.current, tmpCandidate.current).clear;

        tmpCandidate.current.set(
          px - tmpForward.current.x * safeDistance - tmpRight.current.x * 0.08,
          py + baseHeight + collisionLift,
          pz - tmpForward.current.z * safeDistance - tmpRight.current.z * 0.08
        );
        const rightClear = castClearance(tmpPivot.current, tmpCandidate.current).clear;

        if (Math.abs(leftClear - rightClear) > 0.01) {
          targetSideOffset = leftClear > rightClear ? 0.06 : -0.06;
        }
      }

      const sideAcc = (targetSideOffset - sideOffsetRef.current) * 40 - sideOffsetVelRef.current * 12;
      sideOffsetVelRef.current += sideAcc * dt;
      sideOffsetRef.current += sideOffsetVelRef.current * dt;

      tmpDesiredPos.current.set(
        px - tmpForward.current.x * safeDistance + tmpRight.current.x * sideOffsetRef.current,
        py + baseHeight + collisionLift + (hasMoveInput ? Math.sin(walkTime * 10) * 0.005 : 0),
        pz - tmpForward.current.z * safeDistance + tmpRight.current.z * sideOffsetRef.current
      );

      tmpTarget.current.set(
        px + tmpForward.current.x * lookAhead,
        py + 0.07 + collisionLift * 0.6,
        pz + tmpForward.current.z * lookAhead
      );

      if (!initializedRef.current) {
        initializedRef.current = true;
        springPosRef.current.copy(tmpDesiredPos.current);
        springTargetRef.current.copy(tmpTarget.current);
        springPosVelRef.current.set(0, 0, 0);
        springTargetVelRef.current.set(0, 0, 0);
        safeDistanceRef.current = baseDistance;
        collisionLiftRef.current = 0;
      }

      const posStiffness = 72;
      const posDamping = 10;
      tmpDiff.current.copy(tmpDesiredPos.current).sub(springPosRef.current);
      springPosVelRef.current.addScaledVector(tmpDiff.current, posStiffness * dt);
      springPosVelRef.current.multiplyScalar(Math.max(0, 1 - posDamping * dt));
      springPosRef.current.addScaledVector(springPosVelRef.current, dt);

      const targetStiffness = 64;
      const targetDamping = 9;
      tmpDiff.current.copy(tmpTarget.current).sub(springTargetRef.current);
      springTargetVelRef.current.addScaledVector(tmpDiff.current, targetStiffness * dt);
      springTargetVelRef.current.multiplyScalar(Math.max(0, 1 - targetDamping * dt));
      springTargetRef.current.addScaledVector(springTargetVelRef.current, dt);

      camera.position.copy(springPosRef.current);
      if (orbitControlsRef?.current) {
        orbitControlsRef.current.target.copy(springTargetRef.current);
      } else {
        camera.lookAt(springTargetRef.current);
      }
    },
    [bodyRef, cameraRef, castClearance, characterModel, orbitControlsRef, rapier, world]
  );
}
