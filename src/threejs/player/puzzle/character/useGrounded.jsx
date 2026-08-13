import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import * as Rapier from "@dimforge/rapier3d-compat";
import { QueryFilterFlags } from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";

export default function useGrounded(
  bodyRef,
  characterModel,
  bottomOffset = 0.05,
  rayLength = 0.04,
  stairRayLength = 0.03,
  stairHeight = 0.05,
  debug = false
) {
  const isOnGround = useRef(false);
  const justLanded = useRef(false);
  const wasOnGround = useRef(false);
  const groundHit = useRef(null);
  const approachingStair = useRef(false);
  const facingDirectionRef = useRef(new Vector3(0, 0, -1));

  const { world } = useRapier();

  // --- Preallocate Rapier objects once (NO per-frame new) ---
  const downDirRef = useRef(null);
  const originRef = useRef(null);
  const rayRef = useRef(null);

  if (downDirRef.current === null) {
    downDirRef.current = new Rapier.Vector3(0, -1, 0);
    originRef.current = new Rapier.Vector3(0, 0, 0);
    rayRef.current = new Rapier.Ray(originRef.current, downDirRef.current);
  }

  // THREE temp (you had this but didn’t use it; keep none)
  // const tempVec = useMemo(() => new Vector3(), []);

  // Precompute offsets once (keep identical values)
  const rayOffsets = useMemo(
    () => [
      { x: 0, z: 0 },
      { x: 0.1, z: 0 },
      { x: -0.1, z: 0 },
      { x: 0, z: 0.1 },
      { x: 0, z: -0.1 },
    ],
    []
  );

  useFrame(() => {
    const body = bodyRef.current;
    const model = characterModel;
    if (!body || !model) return;

    const pos = body.translation();
    const feetY = pos.y - bottomOffset;

    const origin = originRef.current;
    const ray = rayRef.current;

    let grounded = false;
    let hitResult = null;

    // Ground detection
    for (let i = 0; i < rayOffsets.length; i++) {
      const o = rayOffsets[i];

      origin.x = pos.x + o.x;
      origin.y = feetY;
      origin.z = pos.z + o.z;

      // ray uses same origin object reference, so no new Ray needed
      hitResult = world.castRay(
        ray,
        rayLength,
        false,
        QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined,
        body
      );

      if (hitResult && hitResult.collider) {
        grounded = true;
        break;
      }
    }

    groundHit.current = hitResult;

    // Landing detection (same logic)
    justLanded.current = !wasOnGround.current && grounded;
    wasOnGround.current = grounded;
    isOnGround.current = grounded;

    // Facing direction (same logic)
    facingDirectionRef.current
      .set(0, 0, -1)
      .applyQuaternion(model.quaternion)
      .normalize()
      .negate();
  });

  return { isOnGround, justLanded, approachingStair, groundHit };
}
