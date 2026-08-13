import { useCallback, useRef } from "react";
import useGame from "../../../../hooks/useGame";

function getRigidBodyObject(event) {
  return event?.rigidBodyObject || event?.other?.rigidBodyObject || null;
}

function getObjectNames(object) {
  const parentName = String(object?.parent?.name || "");
  const grandParentName = String(object?.parent?.parent?.name || "");
  const objectName = String(object?.name || "");
  const userDataName = String(object?.userData?.name || "");
  const allNames = `${objectName} ${parentName} ${grandParentName} ${userDataName}`.toLowerCase();
  return {
    parentName: parentName.toLowerCase(),
    objectName,
    objectNameLower: objectName.toLowerCase(),
    allNames,
  };
}

function isPushBlockName(name) {
  return name.includes("pushliftblocks") || name.includes("movingblock") || name.includes("game_box");
}

function isLadderName(name) {
  return name.includes("ladder");
}

export default function useKinematicCollisionSensors() {
  const isPushing = useRef(false);
  const pushHold = useRef(0);
  const movingOnTile = useRef(false);
  const nearLadder = useRef(false);
  const ladderContact = useRef(false);
  const ladderRayHit = useRef(false);
  const ladderRayHold = useRef(0);
  const collidedInstance = useRef(null);
  const isOnRamp = useRef(1);
  const colliderName = useRef("");

  const setHitPoint = useGame((state) => state.setHitPoint);
  const setHeadHit = useGame((state) => state.setHeadHit);
  const atTop = useGame((state) => state.atTop);
  const isClimbing = useGame((state) => state.isClimbing);

  const onCollisionEnter = useCallback(
    (event) => {
      const instance = getRigidBodyObject(event);
      const { parentName, objectName, objectNameLower, allNames } = getObjectNames(instance);

      if (isPushBlockName(allNames) && !isClimbing) {
        isPushing.current = true;
      }

      if (parentName === "floor cube") setHitPoint(true);
      if (objectName.includes("Moving Tile")) movingOnTile.current = true;
      if (parentName.includes("escalator") || parentName.includes("ramp")) {
        isOnRamp.current = 1.2;
      }

      colliderName.current = parentName || objectNameLower;
      
      if (isLadderName(allNames)) {
        ladderContact.current = true;
        nearLadder.current = true;
        collidedInstance.current = instance;
      }
    },
    [isClimbing, setHitPoint]
  );

  const onCollisionExit = useCallback(
    (event) => {
      const instance = getRigidBodyObject(event);
      const { parentName, objectName, objectNameLower, allNames } = getObjectNames(instance);

      if (isPushBlockName(allNames)) {
        isPushing.current = false;
      }

      if (parentName === "floor cube") setHitPoint(false);
      if (objectName.includes("Moving Tile")) movingOnTile.current = false;
      if (parentName.includes("escalator") || parentName.includes("ramp")) {
        isOnRamp.current = 1;
      }

      if (isLadderName(allNames)) {
        ladderContact.current = false;
        nearLadder.current = ladderRayHit.current;
        collidedInstance.current = null;
      }
    },
    [setHitPoint]
  );

  const onHeadIntersectionEnter = useCallback(
    (payload) => {
      const other = payload?.other?.rigidBodyObject;
      if (!other || other.name === "character" || atTop) return;
      setHeadHit(true);
    },
    [atTop, setHeadHit]
  );

  const onIntersectionEnter = useCallback((payload) => {
    const other = payload?.other?.rigidBodyObject;
    const { allNames } = getObjectNames(other);
    if (!isLadderName(allNames)) return;
    ladderContact.current = true;
    nearLadder.current = true;
    collidedInstance.current = other;
  }, []);

  const onIntersectionExit = useCallback((payload) => {
    const other = payload?.other?.rigidBodyObject;
    const { allNames } = getObjectNames(other);
    if (!isLadderName(allNames)) return;
    ladderContact.current = false;
    nearLadder.current = ladderRayHit.current;
    collidedInstance.current = null;
  }, []);

  return {
    refs: {
      isPushing,
      pushHold,
      movingOnTile,
      nearLadder,
      ladderContact,
      ladderRayHit,
      ladderRayHold,
      collidedInstance,
      isOnRamp,
      colliderName,
    },
    handlers: {
      onCollisionEnter,
      onCollisionExit,
      onIntersectionEnter,
      onIntersectionExit,
      onHeadIntersectionEnter,
    },
  };
}
