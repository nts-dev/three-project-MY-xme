import React, { useEffect, useRef, useState, useCallback } from "react";
import { RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import useGame from "../hooks/useGame";
import { useGame1 } from "../hooks/useGame1";
import * as THREE from 'three'

const LIFT_SPEED = 0.6;       // meters per second
const MAX_LIFT = 0.95;         // max height above starting position
const TOP_THRESHOLD_DESKTOP = 0.7;
const TOP_THRESHOLD_MOBILE = 0.45; // looser for mobile contacts
const SIDE_PUSH_MAX_SPEED = 0.12;
const SIDE_PUSH_SPEED_SCALE = 0.65;
const SIDE_PUSH_ACCEL = 18;
const SIDE_PUSH_DECEL = 10;
const SIDE_PUSH_MIN_MOVE = 0.000001;

export default function MovingBlock({ index, inst, object }) {

  const rbRef = useRef(null);
  const characterRefFromStore = useGame((s) => s.gameCharacterRef);
  const setIsClimbing = useGame((s) => s.setIsClimbing);
  const setHasJumped = useGame((s) => s.setHasJumped);
  const hasJumped = useGame((s) => s.hasJumped);
  const setAtTop = useGame((s) => s.setAtTop);
  const standingOnMovingBlock = useGame((s) => s.standingOnMovingBlock);
  const meshRef = useRef(null);
  const climbing = useGame((s) => s.isClimbing);
  const isMobile = useGame((s) => s.isMobile);
  const setHeadHit = useGame((s) => s.setHeadHit);
  const headHit = useGame((s) => s.headHit);
  const buttonMode = useGame((s) => s.buttonMode);
  const setPlayAssetInfoRequest = useGame((s) => s.setPlayAssetInfoRequest);
  const movedown = useRef(false)
  const targetY = useRef(0)
  const isKinematic = useRef(false)
  const [ready, setReady] = useState(false);
  const idleAnimation = useGame1((state) => state.idle);
  const baseYRef = useRef(null);
  const yOffsetRef = useRef(0);           // relative offset from base
  const isStandingRef = useRef(false);
  const standingContactsRef = useRef(0);
  const sidePushActiveRef = useRef(false);
  const worldPosTmpRef = useRef(new THREE.Vector3());
  const lastCharacterPosRef = useRef(new THREE.Vector3());
  const hasLastCharacterPosRef = useRef(false);
  const sidePushVelocityRef = useRef(new THREE.Vector3());
  const EPS = 1e-5;

  // Start after short delay to make sure physics is settled
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);


  // Capture starting Y position once physics is ready
  useEffect(() => {
    if (!ready || !rbRef.current) return;

    const y = rbRef.current.translation().y;
    baseYRef.current = y;
    yOffsetRef.current = 0; // start at base position
  }, [ready]);

  const getCharacterBody = useCallback(() => {
    if (!characterRefFromStore) return null;
    return characterRefFromStore.current ?? characterRefFromStore;
  }, [characterRefFromStore]);

  const isCharacter = useCallback((e) => {
    const otherName = e.other?.rigidBodyObject?.name;
    if (otherName === "character") return true;

    const char = getCharacterBody();
    if (char && e.other?.rigidBody && e.other.rigidBody() === char) return true;

    return false;
  }, [getCharacterBody]);



  
const collisionIsFromTop = useCallback((e) => {
  const m = e.manifold;
  if (!m) return false;

  // Prefer world normal if present; fall back to localNormal1
  const n = m.normal ? m.normal() : m.localNormal1?.();
  if (!n) return false;

  const y = Math.abs(n.y ?? 0);

  const threshold = isMobile ? TOP_THRESHOLD_MOBILE : TOP_THRESHOLD_DESKTOP;
  return y >= threshold;
}, [isMobile]);

  const handlePlayInfoClick = useCallback((e) => {
    e.stopPropagation();
    const instanceId =
      inst?.key || inst?.assetId || inst?.assetID || inst?.instanceId || inst?.instance_id || inst?.userData?.instance_id;

    if (!instanceId) return;

    setPlayAssetInfoRequest({
      instanceId,
      name: inst?.name || object?.name || `movingBlock_${index}`,
      instanceIndex: index,
    });
  }, [index, inst, object?.name, setPlayAssetInfoRequest]);

  const onCollisionEnter = useCallback((e) => {
    if (!isCharacter(e)) return;
    const cl = collisionIsFromTop(e)

    if (!cl) {
      sidePushActiveRef.current = true;
      const char = getCharacterBody();
      const charPos = char?.translation?.();
      if (charPos) {
        lastCharacterPosRef.current.set(charPos.x, charPos.y, charPos.z);
        hasLastCharacterPosRef.current = true;
      }
      return;
    }
    if (!hasJumped) return;

    if (!isKinematic.current) {
      rbRef.current.setBodyType(2, true);
      isKinematic.current = true;
    }

    standingContactsRef.current += 1;
    isStandingRef.current = true;

  }, [collisionIsFromTop, getCharacterBody, hasJumped, isCharacter]);

  const onCollisionExit = useCallback((e) => {
    if (!isCharacter(e)) return;

    sidePushActiveRef.current = false;
    hasLastCharacterPosRef.current = false;
    sidePushVelocityRef.current.set(0, 0, 0);
    standingContactsRef.current = Math.max(0, standingContactsRef.current - 1);

  }, [isCharacter]);

  useFrame((_, delta) => {
    if (!ready || !rbRef.current || baseYRef.current === null) return;

    const safeDelta = Math.min(delta, 0.0167)
    const rb = rbRef.current;
    const currentPos = rb.translation();
    const baseY = baseYRef.current;

    // Side push sliding: keep original lift behavior, add explicit lateral push response.
    if (!isStandingRef.current && sidePushActiveRef.current && !isKinematic.current) {
      const char = getCharacterBody();
      const charPos = char?.translation?.();
      if (charPos) {
        const lastCharPos = lastCharacterPosRef.current;
        const pushVelocity = sidePushVelocityRef.current;

        if (!hasLastCharacterPosRef.current) {
          lastCharPos.set(charPos.x, charPos.y, charPos.z);
          hasLastCharacterPosRef.current = true;
        }

        const moveX = charPos.x - lastCharPos.x;
        const moveZ = charPos.z - lastCharPos.z;
        lastCharPos.set(charPos.x, charPos.y, charPos.z);

        const moveLen = Math.hypot(moveX, moveZ);
        const alpha = 1 - Math.exp(-SIDE_PUSH_ACCEL * safeDelta);
        const decayAlpha = 1 - Math.exp(-SIDE_PUSH_DECEL * safeDelta);

        if (moveLen > SIDE_PUSH_MIN_MOVE) {
          const charSpeed = moveLen / Math.max(safeDelta, 1e-5);
          const targetSpeed = Math.min(charSpeed * SIDE_PUSH_SPEED_SCALE, SIDE_PUSH_MAX_SPEED);
          const invMoveLen = 1 / moveLen;
          pushVelocity.lerp(
            {
              x: moveX * invMoveLen * targetSpeed,
              y: 0,
              z: moveZ * invMoveLen * targetSpeed,
            },
            alpha
          );
        } else {
          pushVelocity.lerp({ x: 0, y: 0, z: 0 }, decayAlpha);
        }

        if (pushVelocity.lengthSq() > 0.0000001) {
          rb.setLinvel({ x: pushVelocity.x, y: rb.linvel().y, z: pushVelocity.z }, true);
        }
      } else {
        hasLastCharacterPosRef.current = false;
      }
    }

    const thisBlockName = `movingBlock_${index}`;
    const standingViaRay = standingOnMovingBlock === thisBlockName;

    if (standingViaRay && hasJumped) {
      if (!isKinematic.current) {
        rbRef.current.setBodyType(2, true);
        isKinematic.current = true;
      }
      isStandingRef.current = true;
    } else if (!standingViaRay && standingContactsRef.current <= 0) {
      isStandingRef.current = false;
    }

    if (!hasJumped && !movedown.current) return;

    if (isStandingRef.current) {
      const worldPos = worldPosTmpRef.current;
      worldPos.set(currentPos.x, currentPos.y, currentPos.z);
      const mesh = meshRef.current;
      const parent = mesh.parent;

      if (parent) {
        parent.worldToLocal(worldPos);
      }

      mesh.position.copy(worldPos);
      if (!movedown.current ) {
        yOffsetRef.current = Math.min(yOffsetRef.current + LIFT_SPEED * safeDelta * 0.2, MAX_LIFT);
        targetY.current = baseY + yOffsetRef.current;
        if (!climbing) {
          idleAnimation()
          setIsClimbing(true)
        }

      } else  {
        yOffsetRef.current = Math.max(yOffsetRef.current - LIFT_SPEED * safeDelta * 0.2, 0);
        targetY.current = baseY + yOffsetRef.current
        if (climbing) {
          setIsClimbing(false)
        }

      }

      if (yOffsetRef.current >= MAX_LIFT - EPS || headHit) {
        isStandingRef.current = false
        movedown.current = true
        setAtTop(true)
        setHasJumped(false)
        setHeadHit(false)
      }

      if (yOffsetRef.current <= EPS) {
        isStandingRef.current = false
        movedown.current = false
        setIsClimbing(false)
        setAtTop(false)
         setHasJumped(false)
        if (isKinematic.current) {
          rbRef.current.setBodyType(0, true);
          isKinematic.current = false;
        }
      }

      rb.setNextKinematicTranslation({
        x: currentPos.x,
        y: targetY.current,
        z: currentPos.z,
      });

    }


  });

  if (!object?.geometry || !ready) return null;

  return (
    <RigidBody
      ref={rbRef}
      name={`movingBlock_${index}`}
      userData={{ name: `movingBlock_${index}`, source: "MovingBlock", index }}
      type={"dynamic"}
      colliders="hull"
      mass={1}
      friction={0.01}
      linearDamping={5}
      restitution={0}
      position={inst.position}
      rotation={inst.rotation}
       scale={[0.05,0.05,0.05]}
      enabledRotations={[false, false, false]}
      onCollisionEnter={onCollisionEnter}
      onCollisionExit={onCollisionExit}
    >
      <mesh
        ref={meshRef}
        geometry={object.geometry}
        material={object.material}
        onPointerDown={buttonMode === "Play mode" ? handlePlayInfoClick : undefined}
      />
    </RigidBody>
  );
}
