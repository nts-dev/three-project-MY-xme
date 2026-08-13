import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import useGame from "../../../../hooks/useGame";

const SENSOR_HZ = 20;
const RAY_LENGTH = 0.16;

function getColliderHandle(collider) {
  if (!collider) return null;
  const handle = typeof collider.handle === "function" ? collider.handle() : collider.handle;
  return handle === undefined || handle === null ? null : String(handle);
}

export default function useKinematicCollectibleSensor(bodyRef, active) {
  const { rapier, world } = useRapier();
  const rayRef = useRef(null);
  const accRef = useRef(0);
  const lastHitRef = useRef(null);
  const handlesRef = useRef({});

  const collectibleColliderHandles = useGame((state) => state.collectibleColliderHandles);
  const setCollectibleRayHit = useGame((state) => state.setCollectibleRayHit);

  useEffect(() => {
    handlesRef.current = collectibleColliderHandles || {};
  }, [collectibleColliderHandles]);

  useEffect(() => {
    if (!rapier) return;
    rayRef.current = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  }, [rapier]);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    const ray = rayRef.current;
    if (!active || !world || !body || !ray) return;

    accRef.current += delta;
    if (accRef.current < 1 / SENSOR_HZ) return;
    accRef.current = 0;

    const pos = body.translation();
    ray.origin.x = pos.x;
    ray.origin.y = pos.y + 0.03;
    ray.origin.z = pos.z;

    const hit = world.castRay(ray, RAY_LENGTH, true, undefined, undefined, undefined, body);
    const handle = getColliderHandle(hit?.collider);
    const collectibleId = handle ? handlesRef.current[handle] : null;
    if (!collectibleId) {
      lastHitRef.current = null;
      return;
    }
    if (lastHitRef.current === collectibleId) return;

    lastHitRef.current = collectibleId;
    setCollectibleRayHit(collectibleId);
  });
}
