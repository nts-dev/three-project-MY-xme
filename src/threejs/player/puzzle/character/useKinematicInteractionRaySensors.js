import { useCallback, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import * as THREE from "three";
import useInteractionIndexWorker from "./interactionIndex/useInteractionIndexWorker";

const RAY_LENGTH = 0.05;
const RAY_UPWARD_BIAS = 0.85;
const PUSH_SPEED = 0.1;
const RAY_HZ = 30;
const LADDER_RAY_HOLD_TIME = 0.18;
const PUSH_HOLD_TIME = 0.18;
const LADDER_CACHE_REFRESH_MS = 1000;

const tempVec3 = new THREE.Vector3();
const tempWorldPos = new THREE.Vector3();
const tempWorldScale = new THREE.Vector3();

// Small helper to avoid repeated string allocations
function getBodyNameFast(collider, body) {
  const colliderName =
    collider?.userData?.name ||
    collider?.object?.userData?.name ||
    collider?.object?.name ||
    "";
  const bodyName =
    body?.userData?.name ||
    body?.object?.userData?.name ||
    body?.object?.name ||
    "";

  return `${colliderName} ${bodyName}`.toLowerCase();
}

function isPushBlockName(name) {
  return name.includes("pushliftblocks") || name.includes("movingblock") || name.includes("game_box");
}

function isLadderName(name) {
  return name.includes("ladder");
}

function objectOrParentHasLadderName(object) {
  let cursor = object;
  while (cursor) {
    const objectName = cursor.name || "";
    const userName = cursor.userData?.name || "";
    if (
      (objectName && isLadderName(objectName.toLowerCase())) ||
      (userName && isLadderName(userName.toLowerCase()))
    ) {
      return true;
    }
    cursor = cursor.parent;
  }
  return false;
}

function collectLadderRaycastObjects(scene, target) {
  target.length = 0;
  scene.traverse((object) => {
    if (!object.isMesh || !objectOrParentHasLadderName(object)) return;
    target.push(object);
  });
}

function buildLadderIndexRecords(objects, target) {
  target.length = 0;
  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    if (!object) continue;

    object.updateWorldMatrix?.(true, false);
    object.getWorldPosition(tempWorldPos);
    object.getWorldScale(tempWorldScale);

    const geometry = object.geometry;
    if (geometry && !geometry.boundingSphere) {
      geometry.computeBoundingSphere();
    }

    const baseRadius = geometry?.boundingSphere?.radius || 0.1;
    const radius = baseRadius * Math.max(
      Math.abs(tempWorldScale.x) || 1,
      Math.abs(tempWorldScale.y) || 1,
      Math.abs(tempWorldScale.z) || 1
    );

    target.push({
      id: i,
      x: tempWorldPos.x,
      y: tempWorldPos.y,
      z: tempWorldPos.z,
      radius,
    });
  }
}

function isPushableDynamicBody(body) {
  if (!body || typeof body.setLinvel !== "function") return false;
  if (typeof body.bodyType === "function" && body.bodyType() !== 0) return false;
  return typeof body.mass !== "function" || body.mass() > 0;
}

export default function useKinematicInteractionRaySensors(sensorRefs) {
  const { rapier, world } = useRapier();
  const { scene } = useThree();
  const { requestCandidates } = useInteractionIndexWorker();

  const rayRef = useRef(null);
  const sceneRaycasterRef = useRef(new THREE.Raycaster());
  const sceneOriginRef = useRef(new THREE.Vector3());
  const sceneDirectionRef = useRef(new THREE.Vector3());
  const ladderRaycastObjectsRef = useRef([]);
  const ladderIndexRecordsRef = useRef([]);
  const ladderCandidateObjectsRef = useRef([]);
  const ladderIntersectionsRef = useRef([]);
  const ladderCacheRefreshAtRef = useRef(0);

  const accRef = useRef(0);

  // Create Rapier ray once
  useEffect(() => {
    if (!rapier) return;
    rayRef.current = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  }, [rapier]);

  useEffect(() => {
    collectLadderRaycastObjects(scene, ladderRaycastObjectsRef.current);
    buildLadderIndexRecords(ladderRaycastObjectsRef.current, ladderIndexRecordsRef.current);
    ladderCacheRefreshAtRef.current = performance.now() + LADDER_CACHE_REFRESH_MS;
  }, [scene]);

  return useCallback(
    ({ body, position, forward, moveDirection, hasMove, dt }) => {
      const ray = rayRef.current;
      if (!world || !body || !ray || !position || !forward) return;

      // === Hold timers (run every frame) ===
      if (sensorRefs.ladderRayHold?.current > 0) {
        sensorRefs.ladderRayHold.current = Math.max(0, sensorRefs.ladderRayHold.current - dt);
        sensorRefs.ladderRayHit.current = true;
        sensorRefs.nearLadder.current = true;
      }

      if (sensorRefs.pushHold?.current > 0) {
        sensorRefs.pushHold.current = Math.max(0, sensorRefs.pushHold.current - dt);
        sensorRefs.isPushing.current = true;
      }

      // === Throttled raycast (30 Hz) ===
      accRef.current += dt;
      if (accRef.current < 1 / RAY_HZ) return;
      accRef.current = 0;

      // Reuse rapier ray
      ray.origin.x = position.x;
      ray.origin.y = position.y - 0.01;
      ray.origin.z = position.z;

      ray.dir.x = forward.x;
      ray.dir.y = RAY_UPWARD_BIAS;
      ray.dir.z = forward.z;

      const dirLen = Math.hypot(ray.dir.x, ray.dir.y, ray.dir.z) || 1;
      ray.dir.x /= dirLen;
      ray.dir.y /= dirLen;
      ray.dir.z /= dirLen;

      const hit = world.castRay(ray, RAY_LENGTH, true, undefined, undefined, undefined, body);

      const hitBody = hit?.collider ? 
        (typeof hit.collider.parent === "function" ? hit.collider.parent() : hit.collider._parent) 
        : null;

      const hitName = getBodyNameFast(hit?.collider, hitBody);
      const hitIsLadder = isLadderName(hitName);

      let ladderObject = null;

      // Fallback to Three.js raycast only against ladder meshes. Raycasting the
      // whole scene here is very expensive in dense levels.
      if (!hitIsLadder) {
        const now = performance.now();
        if (now >= ladderCacheRefreshAtRef.current) {
          collectLadderRaycastObjects(scene, ladderRaycastObjectsRef.current);
          buildLadderIndexRecords(ladderRaycastObjectsRef.current, ladderIndexRecordsRef.current);
          ladderCacheRefreshAtRef.current = now + LADDER_CACHE_REFRESH_MS;
        }

        if (!ladderRaycastObjectsRef.current.length) {
          const ladderRayHeld = (sensorRefs.ladderRayHold?.current || 0) > 0;
          sensorRefs.ladderRayHit.current = ladderRayHeld;
          sensorRefs.nearLadder.current = ladderRayHeld || Boolean(sensorRefs.ladderContact?.current);
        } else {

          const origin = sceneOriginRef.current.set(ray.origin.x, ray.origin.y, ray.origin.z);
          const direction = sceneDirectionRef.current
            .set(ray.dir.x, ray.dir.y, ray.dir.z)
            .normalize();

          const candidateIds = requestCandidates({
            records: ladderIndexRecordsRef.current,
            origin: origin,
            direction: direction,
            length: RAY_LENGTH,
            padding: 0.08,
            maxCandidates: 12,
          });
          let raycastObjects = ladderRaycastObjectsRef.current;

          if (candidateIds.length) {
            ladderCandidateObjectsRef.current.length = 0;
            for (let i = 0; i < candidateIds.length; i++) {
              const object = ladderRaycastObjectsRef.current[candidateIds[i]];
              if (object) ladderCandidateObjectsRef.current.push(object);
            }
            if (ladderCandidateObjectsRef.current.length) {
              raycastObjects = ladderCandidateObjectsRef.current;
            }
          }

          const raycaster = sceneRaycasterRef.current;
          raycaster.set(origin, direction);
          raycaster.near = 0;
          raycaster.far = RAY_LENGTH;

          const intersections = ladderIntersectionsRef.current;
          intersections.length = 0;
          raycaster.intersectObjects(raycastObjects, false, intersections);
          ladderObject = intersections[0]?.object || null;
          intersections.length = 0;
        }
      }

      const hitIsClimbable = hitIsLadder || Boolean(ladderObject);

      if (hitIsClimbable) {
        sensorRefs.ladderRayHold.current = LADDER_RAY_HOLD_TIME;
        sensorRefs.nearLadder.current = true;
        sensorRefs.ladderRayHit.current = true;
        sensorRefs.collidedInstance.current = ladderObject || hitBody?.object || hitBody;
      } else {
        const ladderRayHeld = (sensorRefs.ladderRayHold?.current || 0) > 0;
        sensorRefs.ladderRayHit.current = ladderRayHeld;
        sensorRefs.nearLadder.current = ladderRayHeld || Boolean(sensorRefs.ladderContact?.current);
      }

      // === Push logic ===
      const hitIsPushable = isPushBlockName(hitName) || isPushableDynamicBody(hitBody);

      if (!hitIsPushable) {
        if (!sensorRefs.nearLadder.current) {
          sensorRefs.collidedInstance.current = null;
        }
        sensorRefs.isPushing.current = (sensorRefs.pushHold?.current || 0) > 0;
        return;
      }

      if (sensorRefs.pushHold) {
        sensorRefs.pushHold.current = PUSH_HOLD_TIME;
      }
      sensorRefs.isPushing.current = true;

      if (!hasMove || !moveDirection || typeof hitBody?.setLinvel !== "function") return;

      // Reuse temp vector for setLinvel
      tempVec3.set(
        moveDirection.x * PUSH_SPEED,
        hitBody.linvel?.().y || 0,
        moveDirection.z * PUSH_SPEED
      );

      hitBody.setLinvel(tempVec3, true);
    },
    [requestCandidates, scene, world, sensorRefs] // sensorRefs is usually stable if created with useRef
  );
}
