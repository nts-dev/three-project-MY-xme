import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { useRapier } from "@react-three/rapier";
import { QueryFilterFlags } from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import useGame from "../../../../hooks/useGame";
import { useGame1 } from "../../../../hooks/useGame1";
import useInterface from "../../../../hooks/stores/useInterface.jsx";
import { useJoystickControls } from "../../../../hooks/useJoystickControls";
import { emitSocketEvent } from "../../../../socket";
import KinematicPlayerBody from "./KinematicPlayerBody.jsx";
import useKinematicCollectibleSensor from "./useKinematicCollectibleSensor.js";
import useKinematicCollisionSensors from "./useKinematicCollisionSensors.js";
import useKinematicInteractionRaySensors from "./useKinematicInteractionRaySensors.js";
import { avatarFacingYawDegrees, enPc, fallSceneCenterOverride, horizontalSpeed, realTimeChaPosition } from "./Constants.jsx";
import {
  getFallLandingTilePositionsSnapshot,
  getDeterministicFallLandingTile,
  getLandingTilePositionsSnapshot,
} from "../../../infiniteWorld/landingTileStore.js";
import { getPlayerCell, getWorldMetrics } from "../../../infiniteWorld/infiniteWorldUtils.js";

const NET_HZ = 15;
const GRAVITY = 2.2;
const JUMP_HEIGHT = 0.135;
const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);
const RUN_MULTIPLIER = 3;
const TURN_LERP = 0.28;
const MOVING_TURN_LERP = TURN_LERP * 0.5;
const TURN_RATE = Math.PI * 0.5;
const AIRBORNE_HEIGHT_THRESHOLD = 0.3;
const JUMP_FORWARD_MULTIPLIER = 0.75;
const JUMP_FORWARD_DECAY = 0.2;
const WALK_SPEED_MULTIPLIER = 0.5;
const STAIR_CLIMB_Y_THRESHOLD = 0.005;
const STAIR_CLIMB_HOLD_TIME = 0.2;
const STAIR_CLIMB_RELEASE_TIME = 0.75;
const LADDER_CLIMB_START_SPEED = 0.03;
const LADDER_CLIMB_MAX_SPEED = 0.18;
const LADDER_CLIMB_ACCEL = 0.22;
const FALL_DEATH_DISTANCE = 0.4;
const DEATH_CAMERA_LERP = 1.8;
const MAX_FRAME_DELTA = 0.05;
const MOVE_ANIMATION_SPEED_THRESHOLD = 0.015;
const MOVE_ANIMATION_GRACE_TIME = 0.12;
const DISTANCE_COUNT_STEP = 2;
const MIN_SCENE_CAMERA_NEAR = 0.05;
// const INITIAL_SPAWN = { x: 2.32, y: 0.3, z: 1.2 };
const INITIAL_SPAWN = { x: 0.45, y: 0.3, z: 0.32 };
const INITIAL_GROUND_RAY_LENGTH = 4;
const INITIAL_GROUND_CLEARANCE = 0.08;
const FALL_TILE_PICK_DROP = 1;
const FALL_DEBUG_HOLD_Y = -1.45;
const FALL_TILE_RECOVERY_CLEARANCE = 0.1;
const FALL_CAMERA_SPRING_DISABLE_TIME = 1.5;
const FALL_CAMERA_SETTLE_DISTANCE = 0.35;
const SLOPE_RAY_START_HEIGHT = 0.14;
const SLOPE_RAY_LENGTH = 0.42;
const SLOPE_MIN_NORMAL_Y = 0.35;
const SLOPE_MAX_NORMAL_Y = 0.995;

const tmpMove = new THREE.Vector3();
const tmpForward = new THREE.Vector3();
const tmpLookForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpSlopeMove = new THREE.Vector3();
const tmpSlopeNormal = new THREE.Vector3();
const tmpLadderPosition = new THREE.Vector3();
const tmpPlayerPosition = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();

const getPlatformVerticalOffset = (groundY = 0, metrics = {}) => {
  const sceneHeight = Number(metrics.spanY) || 1;
  return Math.round((Number(groundY) || 0) / sceneHeight) * sceneHeight;
};

const getRayHitDistance = (hit) => {
  const distance =
    hit?.timeOfImpact ??
    hit?.toi ??
    (typeof hit?.timeOfImpact === "function" ? hit.timeOfImpact() : undefined) ??
    (typeof hit?.toi === "function" ? hit.toi() : undefined);

  return Number.isFinite(distance) ? distance : null;
};

function LandingTileDebugBorder({ tile }) {
  const marker = useMemo(() => {
    const position = tile?.position || [];
    if (!Array.isArray(position) || position.length < 3) {
      return null;
    }

    const boundsSize = tile?.boundsSize || [];
    const sizeX = Math.max(Number(boundsSize[0]) || 0.45, 0.18);
    const sizeZ = Math.max(Number(boundsSize[2]) || 0.45, 0.18);
    const radius = Math.max(sizeX, sizeZ) * 0.72;

    return {
      position: [
        Number(position[0]) || 0,
        (Number(position[1]) || 0) + 0.035,
        Number(position[2]) || 0,
      ],
      radius,
      tubeRadius: Math.max(radius * 0.055, 0.01),
    };
  }, [tile]);

  if (!marker) {
    return null;
  }

  return (
    <mesh
      position={marker.position}
      rotation={[-Math.PI / 2, 0, Math.PI / 4]}
      renderOrder={10000}
    >
      <ringGeometry args={[marker.radius, marker.radius + marker.tubeRadius, 4]} />
      <meshBasicMaterial color="#ff0000" side={THREE.DoubleSide} depthTest={false} depthWrite={false} />
    </mesh>
  );
}

export default function KinematicPlayer({ orbitControlsRef, characterModel, clientId }) {
  const bodyRef = useRef();
  const colliderRef = useRef();
  const controllerRef = useRef(null);
  const verticalVelocityRef = useRef(0);
  const ladderClimbSpeedRef = useRef(0);
  const jumpForwardVelocityRef = useRef(new THREE.Vector3());
  const emitAccRef = useRef(0);
  const wasJumpPressedRef = useRef(false);
  const jumpAnimTimerRef = useRef(0);
  const ungroundedTimeRef = useRef(0);
  const groundedGraceRef = useRef(0);
  const lastGroundedYRef = useRef(0);
  const stairClimbTimerRef = useRef(0);
  const stairClimbReleaseTimerRef = useRef(0);
  const stairClimbActiveRef = useRef(false);
  const animationStateRef = useRef("");
  const moveAnimationGraceRef = useRef(0);
  const walkTimeRef = useRef(0);
  const fallPeakYRef = useRef(null);
  const debugFallTileRef = useRef(null);
  const fallDebugHoldLoggedRef = useRef(false);
  const lethalFallPendingRef = useRef(false);
  const fallDeathTriggeredRef = useRef(false);
  const [, getKeys] = useKeyboardControls();
  const { rapier, world } = useRapier();
  const screenFactorRef = useRef(600);
  const zOffsetRef = useRef(0);
  const cameraYRef = useRef(0);
  const velocityYRef = useRef(0);
  const desiredPositionRef = useRef(new THREE.Vector3());
  const cameraOffsetRef = useRef(new THREE.Vector3());
  const cameraTargetRef = useRef(new THREE.Vector3());
  const cameraPosRef = useRef(new THREE.Vector3());
  const cameraForwardRef = useRef(new THREE.Vector3());
  const cameraRayRef = useRef(null);
  const slopeGroundRayRef = useRef(null);
  const slopeGroundRayOriginRef = useRef(null);
  const wasAirborneRef = useRef(false);
  const cameraSpringDisabledTimerRef = useRef(0);
  const startupGroundRayRef = useRef(null);
  const startupGroundRayOriginRef = useRef(null);
  const rayAccRef = useRef(0);
  const cachedRayHitRef = useRef(null);
  const firstGroundHitRef = useRef(false);
  const startupGroundedRef = useRef(false);
  const deathCameraPosRef = useRef(new THREE.Vector3());
  const interactionPayloadRef = useRef({
    body: null,
    position: null,
    forward: null,
    moveDirection: null,
    hasMove: false,
    dt: 0,
  });
  const desiredMoveRef = useRef({ x: 0, y: 0, z: 0 });
  const kinematicTranslationRef = useRef({ x: 0, y: 0, z: 0 });
  const ladderMovementRef = useRef({ x: 0, y: 0, z: 0 });
  const previousDistancePositionRef = useRef(new THREE.Vector3());
  const accumulatedDistanceRef = useRef(0);
  const distancePositionInitializedRef = useRef(false);
  const [debugLandingTile, setDebugLandingTile] = useState(null);

  const cameraRef = useGame((state) => state.cameraRef);
  const playerViewAngle = useGame((state) => state.playerViewAngle);
  const buttonMode = useGame((state) => state.buttonMode);
  const pauseGame = useGame((state) => state.pauseGame);
  const restart = useGame((state) => state.restart);
  const firstPerson = useGame((state) => state.character);
  const character = useGame((state) => state.firstPerson);
  const movingSpeed = useGame((state) => state.movingSpeed);
  const speedFactor = useGame((state) => state.speedFactor);
  const isMobile = useGame((state) => state.isMobile);
  const projectID = useGame((state) => state.projectID);
  const gridSize = useGame((state) => state.gridSize);
  const searchCenter = useGame((state) => state.searchCenter);
  const uName = useGame((state) => state.uName);
  const uColor = useGame((state) => state.uColor);
  const avatarColor = useGame((state) => state.avatarColor);
  const invisible = useGame((state) => state.invisible);
  const tokenCode = useGame((state) => state.tokenCode);
  const noOfLivesRemaining = useGame((state) => state.noOfLivesRemaining);
  const hp = useGame((state) => state.hp);
  const hasDied = useGame((state) => state.hasDied);
  const setCharacter = useGame((state) => state.setCharacter);
  const setFirstPerson = useGame((state) => state.setFirstPerson);
  const setHp = useGame((state) => state.setHp);
  const setHasDied = useGame((state) => state.setHasDied);
  const setTerminalMessage = useGame((state) => state.setTerminalMessage);
  const setConfirmationObj = useGame((state) => state.setConfirmationObj);
  const setRestart = useGame((state) => state.setRestart);
  const setButtonMode = useGame((state) => state.setButtonMode);
  const setShowInventory = useGame((state) => state.setShowInventory);
  const setGameCharacterRef = useGame((state) => state.setGameCharacterRef);
  const setDistanceCount = useGame((state) => state.setDistanceCount);
  const getJoystickValues = useJoystickControls((state) => state.getJoystickValues);
  const curButton2Pressed = useJoystickControls((state) => state.curButton2Pressed);

  const idleAnimation = useGame1((state) => state.idle);
  const walkAnimation = useGame1((state) => state.walk);
  const runAnimation = useGame1((state) => state.run);
  const jumpAnimation = useGame1((state) => state.jump);
  const leftAnimation = useGame1((state) => state.left);
  const rightAnimation = useGame1((state) => state.right);
  const climbStairs = useGame1((state) => state.upstairs);
  const climbAnimation = useGame1((state) => state.climb);
  const pushAnimation = useGame1((state) => state.push);
  const failAnimation = useGame1((state) => state.fail);
  const animationSet = useGame1((state) => state.animationSet);
  const failAnimationName = animationSet.fail;
  const curAnimation = useGame1((state) => state.curAnimation);
  const { refs: sensorRefs, handlers: sensorHandlers } = useKinematicCollisionSensors();
  const updateInteractionRaySensors = useKinematicInteractionRaySensors(sensorRefs);
  const phase = useInterface((state) => state.phase);
  const startInterfacePhase = useInterface((state) => state.start);
  const worldMetrics = useMemo(() => getWorldMetrics(gridSize, projectID), [gridSize, projectID]);

  useKinematicCollectibleSensor(bodyRef, buttonMode === "Play mode" && !pauseGame);

  useEffect(() => {
    if (buttonMode === "Play mode") setCharacter(true);
    else {
      setCharacter(false);
      setFirstPerson(false);
    }
  }, [buttonMode, setCharacter, setFirstPerson]);

  useEffect(() => {
    if (firstPerson || character) {
      setButtonMode("Play mode");
      setShowInventory(true);
      if (bodyRef.current) setGameCharacterRef(bodyRef.current);
      const camera = cameraRef?.current;
      if (camera) {
        camera.near = MIN_SCENE_CAMERA_NEAR;
        camera.updateProjectionMatrix();
      }
    }
  }, [cameraRef, character, firstPerson, setButtonMode, setGameCharacterRef, setShowInventory]);

  useEffect(() => {
    const dimension = isMobile
      ? Math.min(window.innerWidth, window.innerHeight)
      : Math.max(900, Math.min(window.innerWidth, window.innerHeight));
    screenFactorRef.current = dimension || 600;
  }, [isMobile]);

  useEffect(() => {
    if (!rapier) return;
    cameraRayRef.current = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    slopeGroundRayOriginRef.current = { x: 0, y: 0, z: 0 };
    slopeGroundRayRef.current = new rapier.Ray(slopeGroundRayOriginRef.current, { x: 0, y: -1, z: 0 });
    startupGroundRayOriginRef.current = { x: 0, y: 0, z: 0 };
    startupGroundRayRef.current = new rapier.Ray(startupGroundRayOriginRef.current, { x: 0, y: -1, z: 0 });
  }, [rapier]);

  useEffect(() => {
    if (!world) return undefined;
    const controller = world.createCharacterController(0.001);
    controller.enableAutostep(0.03, 0.02, false);
    controller.enableSnapToGround(0.15);
    controllerRef.current = controller;

    return () => {
      if (controllerRef.current) {
        world.removeCharacterController(controllerRef.current);
        controllerRef.current = null;
      }
    };
  }, [world]);

  useEffect(() => {
    if (!hasDied) {
      fallDeathTriggeredRef.current = false;
      lethalFallPendingRef.current = false;
      fallPeakYRef.current = bodyRef.current?.translation?.().y ?? null;
      return;
    }

    setConfirmationObj({
      visible: true,
      message: "You are dead! Do you want to continue?",
      response: restart,
      setResponse: setRestart,
    });
    animationStateRef.current = failAnimationName || "fail";
    failAnimation();
  }, [failAnimation, failAnimationName, hasDied, restart, setConfirmationObj, setRestart]);

  useEffect(() => {
    if (phase !== "ready" && !restart) return;

    fallDeathTriggeredRef.current = false;
    lethalFallPendingRef.current = false;
    debugFallTileRef.current = null;
    setDebugLandingTile(null);
    fallDebugHoldLoggedRef.current = false;
    firstGroundHitRef.current = false;
    startupGroundedRef.current = false;
    verticalVelocityRef.current = 0;
    jumpForwardVelocityRef.current.set(0, 0, 0);
    accumulatedDistanceRef.current = 0;
    distancePositionInitializedRef.current = false;
    setHp(100);
    setHasDied(false);
    setConfirmationObj({ visible: false });

    const rb = bodyRef.current;
    if (!rb) return;
    // const tr = rb.translation();
    // const spawn =
    //   Number(projectID) === 150
    //     ? { x: 6.2, y: 7.3, z: 6.8 }
    //     : searchCenter
    //       ? { x: 6.5, y: 0.3, z: 9.5 }
    //       : { x: tr.x, y: tr.y + 0.1, z: tr.z };

          const spawn = INITIAL_SPAWN

   
       
    rb.setNextKinematicTranslation?.(spawn);
    rb.setTranslation?.(spawn, true);
    fallPeakYRef.current = spawn.y;
  }, [phase, projectID, restart, searchCenter, setConfirmationObj, setHasDied, setHp]);

  const emitData = useCallback(
    (jump = false) => {
      if ((!firstPerson && !character) || clientId === "offline" || !bodyRef.current) return;
      emitSocketEvent("playerMove", {
        mType: "player",
        projectID,
        clientId,
        position: bodyRef.current.translation(),
        currentAnimation: curAnimation,
        angle: undefined,
        prevAnimation: "Idle 1",
        direction: undefined,
        quaternion: characterModel?.quaternion,
        speed: 1,
        dateTime: "",
        userName: uName,
        personColor: "",
        noOfLivesRemaining,
        jump,
        removedObject: null,
        movingSpeed,
        hpPct: hp,
        enPct: enPc.current,
        invisible,
        uColor,
        avatarColor,
        tokenCode: tokenCode?.codeValue,
      }, { volatile: true });
    },
    [
      avatarColor,
      character,
      characterModel,
      clientId,
      curAnimation,
      firstPerson,
      hp,
      invisible,
      movingSpeed,
      noOfLivesRemaining,
      projectID,
      tokenCode,
      uColor,
      uName,
    ]
  );

  useFrame((_, delta) => {
    const rb = bodyRef.current;
    const collider = colliderRef.current;
    const controller = controllerRef.current;
    const camera = cameraRef?.current;
    if (!rb || !collider || !controller || !camera || buttonMode !== "Play mode" || pauseGame) return;
    const dt = Math.min(delta, MAX_FRAME_DELTA);
    const tr = rb.translation();

    if (hasDied) {
      const nextAnimation = failAnimationName || "fail";
      if (animationStateRef.current !== nextAnimation) {
        animationStateRef.current = nextAnimation;
        failAnimation();
      }

      const orbitControls = orbitControlsRef?.current;
      cameraTargetRef.current.set(tr.x, tr.y + 0.08, tr.z);

      if (orbitControls) {
        orbitControls.target.lerp(cameraTargetRef.current, DEATH_CAMERA_LERP * dt);
        orbitControls.update?.();
      } else {
        camera.lookAt(cameraTargetRef.current);
      }
      return;
    }
 
    const keys = getKeys();
    const joystick = getJoystickValues();
    const joystickActive = joystick.joystickDis > 0.1;
    const jumpPressed = Boolean(keys.jump || joystick.button1Pressed);
    const running = Boolean((keys.run || joystick.runState || curButton2Pressed) && enPc.current > 0);
    const screenFactor = screenFactorRef.current;
    const cameraDistance = character ? 0.1 : 0.4;
    const screenScale = 600 / screenFactor;
    const cameraDistanceScaled = cameraDistance * screenScale;

    if (!startupGroundedRef.current) {
      const ray = startupGroundRayRef.current;
      const origin = startupGroundRayOriginRef.current;
      if (!ray || !origin) return;

      origin.x = INITIAL_SPAWN.x;
      origin.y = INITIAL_SPAWN.y;
      origin.z = INITIAL_SPAWN.z;

      const hit = world.castRay(
        ray,
        INITIAL_GROUND_RAY_LENGTH,
        true,
        QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined,
        rb
      );

      if (!hit?.collider) {
        startupGroundedRef.current = true;
        firstGroundHitRef.current = false;
        lastGroundedYRef.current = tr.y;
        fallPeakYRef.current = tr.y;
        realTimeChaPosition.set(tr.x, tr.y, tr.z);
       
      } else {
        const hitDistance = getRayHitDistance(hit);
        if (hitDistance === null) {
          startupGroundedRef.current = true;
          firstGroundHitRef.current = false;
          lastGroundedYRef.current = tr.y;
          fallPeakYRef.current = tr.y;
          realTimeChaPosition.set(tr.x, tr.y, tr.z);
          // console.warn("[KinematicPlayer] initial ground ray hit without distance; releasing avatar to fall", hit);
        } else {
          const groundedSpawn = {
            x: INITIAL_SPAWN.x,
            y: INITIAL_SPAWN.y - hitDistance + INITIAL_GROUND_CLEARANCE,
            z: INITIAL_SPAWN.z,
          };

          rb.setNextKinematicTranslation?.(groundedSpawn);
          rb.setTranslation?.(groundedSpawn, true);
          realTimeChaPosition.set(groundedSpawn.x, groundedSpawn.y, groundedSpawn.z);
          verticalVelocityRef.current = 0;
          lastGroundedYRef.current = groundedSpawn.y;
          fallPeakYRef.current = groundedSpawn.y;
          firstGroundHitRef.current = true;
          startupGroundedRef.current = true;
          return;
        }
      }
    }

    tmpForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    tmpForward.y = 0;
    tmpForward.normalize();
    tmpRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    tmpRight.y = 0;
    tmpRight.normalize();
    tmpMove.set(0, 0, 0);

    const pureKeyboardTurnLeft = keys.leftward && !keys.forward && !keys.backward && !keys.rightward;
    const pureKeyboardTurnRight = keys.rightward && !keys.forward && !keys.backward && !keys.leftward;

    if (keys.forward) tmpMove.add(tmpForward);
    if (keys.backward) {
      tmpMove.sub(tmpForward);
      zOffsetRef.current = cameraDistanceScaled;
    }
    if (keys.leftward && !pureKeyboardTurnLeft) tmpMove.sub(tmpRight);
    if (keys.rightward && !pureKeyboardTurnRight) tmpMove.add(tmpRight);
    if (keys.forward) {
      zOffsetRef.current = -cameraDistanceScaled;
    }

    if (joystickActive) {
      const angle = joystick.joystickAng;
      const joystickCos = Math.cos(angle);
      const joystickSin = Math.sin(angle);
      tmpMove.addScaledVector(tmpRight, joystickCos * joystick.joystickDis);
      tmpMove.addScaledVector(tmpForward, joystickSin * joystick.joystickDis);
      zOffsetRef.current = joystickSin < -0.15
        ? cameraDistanceScaled
        : -cameraDistanceScaled;
    }
    if (!zOffsetRef.current) {
      zOffsetRef.current = -cameraDistanceScaled;
    }

    const hasMove = tmpMove.lengthSq() > 0.0001;
    if (hasMove) tmpMove.normalize();
    const moveForward = hasMove ? tmpMove : tmpForward;

    const interactionPayload = interactionPayloadRef.current;
    interactionPayload.body = rb;
    interactionPayload.position = tr;
    interactionPayload.forward = moveForward;
    interactionPayload.moveDirection = tmpMove;
    interactionPayload.hasMove = hasMove;
    interactionPayload.dt = dt;
    updateInteractionRaySensors(interactionPayload);

    const baseSpeed =
      Math.max(0.45, movingSpeed * 30 * speedFactor) *
      WALK_SPEED_MULTIPLIER *
      sensorRefs.isOnRamp.current *
      (running ? RUN_MULTIPLIER : 1);
    const groundedBeforeMove = controller.computedGrounded?.() ?? false;
    const canJump = groundedBeforeMove || groundedGraceRef.current > 0;
    if (canJump && verticalVelocityRef.current < 0) verticalVelocityRef.current = 0;
    const jumpStarted = jumpPressed && !wasJumpPressedRef.current && canJump;
    if (jumpStarted) {
      verticalVelocityRef.current = JUMP_VELOCITY * (running ? 1.15 : 1);
      jumpForwardVelocityRef.current.copy(tmpMove).multiplyScalar(hasMove ? baseSpeed * JUMP_FORWARD_MULTIPLIER : 0);
      jumpAnimTimerRef.current = 0.45;
      groundedGraceRef.current = 0;
      emitData(true);
    }
    wasJumpPressedRef.current = jumpPressed;
    if (!canJump || jumpStarted || verticalVelocityRef.current > 0) {
      verticalVelocityRef.current -= GRAVITY * dt;
    } else {
      verticalVelocityRef.current = 0;
    }

    let ladderFacingDot = 0;
    const ladderObject = sensorRefs.collidedInstance.current;
    if (ladderObject?.getWorldPosition && characterModel) {
      tmpLookForward.set(0, 0, 1).applyQuaternion(characterModel.quaternion).normalize();
      tmpPlayerPosition.set(tr.x, tr.y, tr.z);
      ladderObject.getWorldPosition(tmpLadderPosition);
      tmpLadderPosition.sub(tmpPlayerPosition).normalize();
      ladderFacingDot = tmpLookForward.dot(tmpLadderPosition);
    }

    const climbingLadder =
      (sensorRefs.nearLadder.current || sensorRefs.ladderRayHit.current) &&
      (sensorRefs.ladderRayHit.current || ladderFacingDot > 0.5) &&
      (keys.forward || joystickActive);
    const fallTilePickY = lastGroundedYRef.current - FALL_TILE_PICK_DROP;
    const shouldPickDebugFallTile = !climbingLadder
      && !groundedBeforeMove
      && verticalVelocityRef.current <= 0
      && tr.y <= fallTilePickY;
    if (shouldPickDebugFallTile && !debugFallTileRef.current) {
      const fallingFromCell = getPlayerCell({ x: tr.x, y: lastGroundedYRef.current, z: tr.z }, worldMetrics);
      const platformVerticalOffset = getPlatformVerticalOffset(lastGroundedYRef.current, worldMetrics);
      const fallSceneVerticalOffset = platformVerticalOffset - worldMetrics.spanY;
      const fallSceneHorizontalOffset = {
        x: (fallingFromCell.east || 0) * worldMetrics.spanX,
        z: (fallingFromCell.north || 0) * worldMetrics.spanZ,
      };
      const pickedTile = getDeterministicFallLandingTile(
        { x: tr.x, y: tr.y - 0.5, z: tr.z },
        debugFallTileRef.current,
        {
          horizontalOffsetX: fallSceneHorizontalOffset.x,
          horizontalOffsetZ: fallSceneHorizontalOffset.z,
          verticalOffset: fallSceneVerticalOffset,
        }
      );
      if (pickedTile?.position) {
        debugFallTileRef.current = pickedTile;
        setDebugLandingTile(pickedTile);
        fallSceneCenterOverride.current = null;

      } else {
  
        fallSceneCenterOverride.current = {
          x: tr.x,
          z: tr.z,
          y: fallSceneVerticalOffset,
        };

      
      }
    }
    const debugFallTilePosition = debugFallTileRef.current?.position;

    let movement;
    let physicsGrounded;
    let controllerGrounded = false;
    let nextY;
   
    if (climbingLadder) {
      verticalVelocityRef.current = 0;
      jumpForwardVelocityRef.current.set(0, 0, 0);
      ladderClimbSpeedRef.current = Math.min(
        LADDER_CLIMB_MAX_SPEED,
        Math.max(LADDER_CLIMB_START_SPEED, ladderClimbSpeedRef.current + LADDER_CLIMB_ACCEL * dt)
      );
      const climbUpVel = tr.y + ladderClimbSpeedRef.current * dt;
      movement = ladderMovementRef.current;
      movement.x = 0;
      movement.y = climbUpVel - tr.y;
      movement.z = 0;
      nextY = climbUpVel;
      physicsGrounded = true;
      const nextTranslation = kinematicTranslationRef.current;
      nextTranslation.x = tr.x;
      nextTranslation.y = climbUpVel;
      nextTranslation.z = tr.z;
      rb.setNextKinematicTranslation(nextTranslation);
    } else {
      ladderClimbSpeedRef.current = 0;
      const desiredMove = desiredMoveRef.current;
      desiredMove.x = ((hasMove ? tmpMove.x * baseSpeed : 0) + jumpForwardVelocityRef.current.x) * dt;
      desiredMove.y = verticalVelocityRef.current * dt;
      desiredMove.z = ((hasMove ? tmpMove.z * baseSpeed : 0) + jumpForwardVelocityRef.current.z) * dt;
      if (debugFallTilePosition && !groundedBeforeMove && verticalVelocityRef.current <= 0) {
        desiredMove.x = (Number(debugFallTilePosition[0]) || tr.x) - tr.x;
        desiredMove.z = (Number(debugFallTilePosition[2]) || tr.z) - tr.z;
      }
      if (
        hasMove &&
        canJump &&
        verticalVelocityRef.current <= 0 &&
        !debugFallTilePosition &&
        slopeGroundRayRef.current &&
        slopeGroundRayOriginRef.current
      ) {
        const ray = slopeGroundRayRef.current;
        const origin = slopeGroundRayOriginRef.current;
        origin.x = tr.x + desiredMove.x;
        origin.y = tr.y + SLOPE_RAY_START_HEIGHT;
        origin.z = tr.z + desiredMove.z;

        const slopeHit = world.castRay(
          ray,
          SLOPE_RAY_LENGTH,
          true,
          QueryFilterFlags.EXCLUDE_SENSORS,
          undefined,
          undefined,
          rb
        );
        const slopeNormal = slopeHit?.collider?.castRayAndGetNormal?.(
          ray,
          SLOPE_RAY_LENGTH,
          false
        )?.normal;

        if (
          slopeNormal &&
          slopeNormal.y > SLOPE_MIN_NORMAL_Y &&
          slopeNormal.y < SLOPE_MAX_NORMAL_Y
        ) {
          const originalHorizontalLength = Math.sqrt(
            desiredMove.x * desiredMove.x +
            desiredMove.z * desiredMove.z
          );

          if (originalHorizontalLength > 0.000001) {
            tmpSlopeNormal.set(slopeNormal.x, slopeNormal.y, slopeNormal.z);
            tmpSlopeMove.set(desiredMove.x, 0, desiredMove.z);
            tmpSlopeMove.addScaledVector(tmpSlopeNormal, -tmpSlopeMove.dot(tmpSlopeNormal));

            const projectedHorizontalLength = Math.sqrt(
              tmpSlopeMove.x * tmpSlopeMove.x +
              tmpSlopeMove.z * tmpSlopeMove.z
            );

            if (projectedHorizontalLength > 0.000001) {
              tmpSlopeMove.multiplyScalar(originalHorizontalLength / projectedHorizontalLength);
              desiredMove.x = tmpSlopeMove.x;
              desiredMove.y = tmpSlopeMove.y;
              desiredMove.z = tmpSlopeMove.z;
            }
          }
        }
      }
      controller.computeColliderMovement(collider, desiredMove);
      movement = controller.computedMovement();
      controllerGrounded = controller.computedGrounded?.() ?? groundedBeforeMove;
      const fallingIntoSurface = desiredMove.y < -0.0001 && Math.abs(movement.y) < Math.abs(desiredMove.y) * 0.35;
      physicsGrounded = controllerGrounded || fallingIntoSurface;
      nextY = tr.y + movement.y;
      const nextTranslation = kinematicTranslationRef.current;
      nextTranslation.x = tr.x + movement.x;
      nextTranslation.y = nextY;
      nextTranslation.z = tr.z + movement.z;
      rb.setNextKinematicTranslation(nextTranslation);
    }

    if (debugFallTilePosition && !climbingLadder && !physicsGrounded) {
      const tileY = Number(debugFallTilePosition[1]);
      const recoveryY = Number.isFinite(tileY)
        ? tileY + FALL_TILE_RECOVERY_CLEARANCE
        : null;

      if (recoveryY !== null && nextY < tileY - FALL_TILE_RECOVERY_CLEARANCE) {
        const recoveryTranslation = kinematicTranslationRef.current;
        const targetX = Number(debugFallTilePosition[0]) || (tr.x + movement.x);
        const targetZ = Number(debugFallTilePosition[2]) || (tr.z + movement.z);

        recoveryTranslation.x = targetX;
        recoveryTranslation.y = recoveryY;
        recoveryTranslation.z = targetZ;

        movement.x = targetX - tr.x;
        movement.y = recoveryY - tr.y;
        movement.z = targetZ - tr.z;
        nextY = recoveryY;
        verticalVelocityRef.current = Math.min(verticalVelocityRef.current, -0.01);
        rb.setNextKinematicTranslation(recoveryTranslation);

      
      }
    }

    // const fallDebugHoldY = debugFallTilePosition
    //   ? (Number(debugFallTilePosition[1]) || FALL_DEBUG_HOLD_Y) + INITIAL_GROUND_CLEARANCE
    //   : FALL_DEBUG_HOLD_Y;

    // if (!climbingLadder && !physicsGrounded && nextY <= fallDebugHoldY) {
    //   const heldTranslation = kinematicTranslationRef.current;
    //   const heldX = tr.x + movement.x;
    //   const heldZ = tr.z + movement.z;

    //   heldTranslation.x = heldX;
    //   heldTranslation.y = fallDebugHoldY;
    //   heldTranslation.z = heldZ;

    //   movement.x = heldX - tr.x;
    //   movement.y = fallDebugHoldY - tr.y;
    //   movement.z = heldZ - tr.z;
    //   nextY = fallDebugHoldY;
    //   verticalVelocityRef.current = 0;
    //   physicsGrounded = true;
    //   controllerGrounded = true;
    //   rb.setNextKinematicTranslation(heldTranslation);

    //   if (!fallDebugHoldLoggedRef.current) {
    //     //fallDebugHoldLoggedRef.current = true;
    //     console.warn("[KinematicPlayer] fall debug hold at target scene tile", {
    //       avatarPosition: { x: heldX, y: fallDebugHoldY, z: heldZ },
    //       holdY: fallDebugHoldY,
    //       tile: debugFallTileRef.current,
    //     });
    //   }
    // } else if (fallDebugHoldLoggedRef.current && nextY > fallDebugHoldY + 0.05) {
    //   fallDebugHoldLoggedRef.current = false;
    // }

    const verticalSeparation = Math.abs(nextY - lastGroundedYRef.current);
    const intentionalJumpMotion = jumpAnimTimerRef.current > 0 || verticalVelocityRef.current > 0.02;
    const withinGroundForgiveness = !intentionalJumpMotion && verticalSeparation < AIRBORNE_HEIGHT_THRESHOLD;
    const animationGrounded = physicsGrounded || withinGroundForgiveness;
    if (physicsGrounded && verticalVelocityRef.current < 0) {
      verticalVelocityRef.current = 0;
    }
    const landingFallDistance = physicsGrounded
      ? Math.max(0, (fallPeakYRef.current ?? nextY) - nextY)
      : 0;
    const landedAfterFall = physicsGrounded
      && wasAirborneRef.current
      && landingFallDistance >= FALL_CAMERA_SETTLE_DISTANCE;
    if (physicsGrounded) {
      lastGroundedYRef.current = nextY;
      fallPeakYRef.current = nextY;
      jumpForwardVelocityRef.current.set(0, 0, 0);
      if (landedAfterFall) {
        cameraSpringDisabledTimerRef.current = FALL_CAMERA_SPRING_DISABLE_TIME;
        velocityYRef.current = 0;
      }
      if (debugFallTileRef.current) {
        // console.warn("[KinematicPlayer] fall tile landing released movement", {
        //   avatarPosition: { x: tr.x + movement.x, y: nextY, z: tr.z + movement.z },
        //   landingFallDistance,
        //   tile: debugFallTileRef.current,
        // });
        debugFallTileRef.current = null;
      }
    } else {
      fallPeakYRef.current = Math.max(fallPeakYRef.current ?? nextY, nextY);
      jumpForwardVelocityRef.current.multiplyScalar(Math.max(0, 1 - JUMP_FORWARD_DECAY * dt));
    }
    wasAirborneRef.current = !physicsGrounded;

    const fallDistance = (fallPeakYRef.current ?? nextY) - nextY;
    if (!climbingLadder && !physicsGrounded && fallDistance >= FALL_DEATH_DISTANCE) {
      lethalFallPendingRef.current = true;
    }
    // if (physicsGrounded && !fallDeathTriggeredRef.current && lethalFallPendingRef.current) {
    //   fallDeathTriggeredRef.current = true;
    //   lethalFallPendingRef.current = false;
    //   verticalVelocityRef.current = 0;
    //   jumpForwardVelocityRef.current.set(0, 0, 0);
    //   animationStateRef.current = failAnimationName || "fail";
    //   failAnimation();
    //   setHp(0);
    //   setHasDied(true);
    //   setTerminalMessage({ command: "", message: "You died" });
    //   emitData(false);
    //   return;
    // }

    const movedX = tr.x + movement.x;
    const movedZ = tr.z + movement.z;
    realTimeChaPosition.set(movedX, nextY, movedZ);

    if (!distancePositionInitializedRef.current) {
      previousDistancePositionRef.current.set(movedX, nextY, movedZ);
      distancePositionInitializedRef.current = true;
    } else {
      const previousPosition = previousDistancePositionRef.current;
      const dx = movedX - previousPosition.x;
      const dy = nextY - previousPosition.y;
      const dz = movedZ - previousPosition.z;
      accumulatedDistanceRef.current += Math.sqrt(dx * dx + dy * dy + dz * dz);
      previousPosition.set(movedX, nextY, movedZ);

      while (accumulatedDistanceRef.current >= DISTANCE_COUNT_STEP) {
        const nextDistanceCount = (useGame.getState().distanceCount || 0) + 1;
        setDistanceCount(nextDistanceCount);
        accumulatedDistanceRef.current -= DISTANCE_COUNT_STEP;
      }
    }

    horizontalSpeed.current = Math.sqrt(movement.x * movement.x + movement.z * movement.z) / Math.max(dt, 1e-5);
    if (
      (phase === "ready" || phase === "init") &&
      hasMove &&
      horizontalSpeed.current > MOVE_ANIMATION_SPEED_THRESHOLD
    ) {
      startInterfacePhase();
    }
    if (hasMove && horizontalSpeed.current > MOVE_ANIMATION_SPEED_THRESHOLD) {
      moveAnimationGraceRef.current = MOVE_ANIMATION_GRACE_TIME;
    } else {
      moveAnimationGraceRef.current = Math.max(0, moveAnimationGraceRef.current - dt);
    }
    walkTimeRef.current += dt;
    jumpAnimTimerRef.current = animationGrounded ? 0 : Math.max(0, jumpAnimTimerRef.current - dt);
    ungroundedTimeRef.current = animationGrounded ? 0 : ungroundedTimeRef.current + dt;
    groundedGraceRef.current = physicsGrounded ? 0.08 : Math.max(0, groundedGraceRef.current - dt);
    const stairStepDetected = hasMove && animationGrounded && movement.y > STAIR_CLIMB_Y_THRESHOLD;
    const holdingForwardForStairs =
      keys.forward ||
      (joystickActive && Math.sin(joystick.joystickAng) >= -0.15 && !keys.backward);

    if (stairStepDetected) {
      stairClimbActiveRef.current = true;
      stairClimbTimerRef.current = STAIR_CLIMB_HOLD_TIME;
      stairClimbReleaseTimerRef.current = 0;
    } else if (!holdingForwardForStairs || !animationGrounded) {
      stairClimbActiveRef.current = false;
      stairClimbTimerRef.current = 0;
      stairClimbReleaseTimerRef.current = 0;
    } else if (stairClimbActiveRef.current) {
      stairClimbTimerRef.current = Math.max(0, stairClimbTimerRef.current - dt);
      stairClimbReleaseTimerRef.current += dt;
      if (stairClimbReleaseTimerRef.current > STAIR_CLIMB_RELEASE_TIME) {
        stairClimbActiveRef.current = false;
        stairClimbTimerRef.current = 0;
        stairClimbReleaseTimerRef.current = 0;
      }
    } else {
      stairClimbTimerRef.current = Math.max(0, stairClimbTimerRef.current - dt);
    }

    if (hasMove && characterModel) {
      const yaw = Math.atan2(tmpMove.x, tmpMove.z);
      tmpEuler.set(0, yaw, 0, "XYZ");
      tmpQuat.setFromEuler(tmpEuler);
      characterModel.quaternion.slerp(tmpQuat, MOVING_TURN_LERP);
    } else if (characterModel && (pureKeyboardTurnLeft || pureKeyboardTurnRight)) {
      const turnDirection = pureKeyboardTurnLeft ? 1 : -1;
      tmpEuler.set(0, turnDirection * TURN_RATE * dt, 0, "XYZ");
      tmpQuat.setFromEuler(tmpEuler);
      characterModel.quaternion.multiply(tmpQuat).normalize();
    }
    if (characterModel) {
      tmpLookForward.set(0, 0, 1).applyQuaternion(characterModel.quaternion);
      tmpLookForward.y = 0;
      if (tmpLookForward.lengthSq() > 0.0001) {
        tmpLookForward.normalize();
        avatarFacingYawDegrees.current = THREE.MathUtils.euclideanModulo(
          THREE.MathUtils.radToDeg(Math.atan2(tmpLookForward.x, tmpLookForward.z)),
          360
        );
      }
    }

    let nextAnimation = animationSet.idle || "idle";
    let playNextAnimation = idleAnimation;

    const climbingStairs =
      hasMove &&
      animationGrounded &&
      stairClimbActiveRef.current &&
      (holdingForwardForStairs || stairClimbTimerRef.current > 0);
    const pushingForward = sensorRefs.isPushing.current && (keys.forward || joystickActive);
    if (!animationGrounded && (jumpAnimTimerRef.current > 0 || ungroundedTimeRef.current > 0.08)) {
      nextAnimation = animationSet.jump || "jump";
      playNextAnimation = jumpAnimation;
    } else if (pushingForward) {
      nextAnimation = animationSet.push || "push";
      playNextAnimation = pushAnimation;
    } else if (climbingLadder) {
      nextAnimation = animationSet.climb || "climb";
      playNextAnimation = climbAnimation;
    } else if (climbingStairs) {
      nextAnimation = animationSet.upstairs || "climbStairs";
      playNextAnimation = climbStairs;
    } else if (pureKeyboardTurnLeft) {
      nextAnimation = animationSet.left || "left";
      playNextAnimation = leftAnimation;
    } else if (pureKeyboardTurnRight) {
      nextAnimation = animationSet.right || "right";
      playNextAnimation = rightAnimation;
    } else if (hasMove && (horizontalSpeed.current > MOVE_ANIMATION_SPEED_THRESHOLD || moveAnimationGraceRef.current > 0)) {
      nextAnimation = running ? animationSet.run || "run" : animationSet.walk || "walk";
      playNextAnimation = running ? runAnimation : walkAnimation;
    }

    
    if (animationStateRef.current !== nextAnimation) {
      animationStateRef.current = nextAnimation;
      playNextAnimation();
    }
        if(physicsGrounded){
          firstGroundHitRef.current = true;
        }
   
    const orbitControls = orbitControlsRef?.current;
    if (orbitControls) {
      const nextX = movedX;
      const nextZ = movedZ;
      const yOffset = character ? 0.01 : 0.25;

      cameraForwardRef.current.copy(tmpForward);
      desiredPositionRef.current.set(nextX, nextY, nextZ);
      cameraOffsetRef.current
        .set(0, yOffset * screenScale, zOffsetRef.current)
        .applyQuaternion(characterModel?.quaternion || tmpQuat);
      desiredPositionRef.current.add(cameraOffsetRef.current);

      rayAccRef.current += dt;
      if (rayAccRef.current >= 1 / 20 && cameraRayRef.current) {
        rayAccRef.current = 0;
        camera.getWorldDirection(cameraForwardRef.current);
        cameraRayRef.current.origin.x = desiredPositionRef.current.x;
        cameraRayRef.current.origin.y = desiredPositionRef.current.y;
        cameraRayRef.current.origin.z = desiredPositionRef.current.z;
        cameraRayRef.current.dir.x = cameraForwardRef.current.x;
        cameraRayRef.current.dir.y = cameraForwardRef.current.y;
        cameraRayRef.current.dir.z = cameraForwardRef.current.z;
        cachedRayHitRef.current = world.castRay(cameraRayRef.current, Math.abs(zOffsetRef.current) * 2, true, undefined, rb);
      }

      if (cameraSpringDisabledTimerRef.current > 0) {
        cameraSpringDisabledTimerRef.current = Math.max(0, cameraSpringDisabledTimerRef.current - dt);
        cameraYRef.current = desiredPositionRef.current.y;
        velocityYRef.current = 0;
      } else {
        const dy = desiredPositionRef.current.y - cameraYRef.current;
        velocityYRef.current += (dy * 15 - velocityYRef.current * 3) * dt;
        cameraYRef.current += velocityYRef.current * dt;
      }

      cameraPosRef.current.copy(desiredPositionRef.current);
      cameraPosRef.current.y = cameraYRef.current - 0.03;
      if (hasMove) {
        cameraPosRef.current.y += Math.sin(walkTimeRef.current * 10) * 0.005;
      }

      if (characterModel) {
        tmpLookForward.set(0, 0, 1).applyQuaternion(characterModel.quaternion);
        tmpLookForward.y = 0;
        tmpLookForward.normalize();
      } else {
        tmpLookForward.copy(tmpForward);
      }

      cameraTargetRef.current.set(
        nextX + tmpLookForward.x * 0.05,
        nextY + 0.07 + playerViewAngle,
        nextZ + tmpLookForward.z * 0.05
      );
      orbitControls.target.lerp(cameraTargetRef.current, 10 * dt);
      camera.position.lerp(cameraPosRef.current, 10 * dt);
      orbitControls.update?.();
    }

    emitAccRef.current += dt;
    if (emitAccRef.current >= 1 / NET_HZ) {
      emitAccRef.current = 0;
      emitData(jumpPressed);
    }
  });

  return (
    <>
      <KinematicPlayerBody
        bodyRef={bodyRef}
        colliderRef={colliderRef}
        character={character}
        characterModel={characterModel}
        firstPerson={firstPerson}
        onCollisionEnter={sensorHandlers.onCollisionEnter}
        onCollisionExit={sensorHandlers.onCollisionExit}
        onIntersectionEnter={sensorHandlers.onIntersectionEnter}
        onIntersectionExit={sensorHandlers.onIntersectionExit}
        onHeadIntersectionEnter={sensorHandlers.onHeadIntersectionEnter}
        uName={uName}
      />
      <LandingTileDebugBorder tile={debugLandingTile} />
    </>
  );
}
