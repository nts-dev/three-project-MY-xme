/* eslint-disable */

import {useKeyboardControls} from "@react-three/drei";
import {useFrame, useThree} from "@react-three/fiber";
import {CapsuleCollider, quat, RapierRigidBody, RigidBody, RigidBodyProps, useRapier,} from "@react-three/rapier";
import * as React from "react";
import {forwardRef, ReactNode, RefObject, useEffect, useMemo, useRef, useState} from "react";
import * as THREE from "three";
import {Vector3} from "three";
import {useGame1} from "../../hooks/useGame1";
import useGame from "../../hooks/useGame";
import {useJoystickControls} from "../../hooks/useJoystickControls";
import type {Vector} from "@dimforge/rapier3d-compat";
import {emitSocketEvent} from "../../socket";
import useInterface from "../../hooks/stores/useInterface";
import PlayerLabel from "./PlayerLabel";
// import {useFollowCam} from "../../hooks/useFollowCam";

const PROJECT_153_L1_RUN_SPEED_MULTIPLIER = 3;
const HORIZONTAL_MOVE_ACCELERATION = 14;
const HORIZONTAL_MOVE_DECELERATION = 20;
const HORIZONTAL_MOVE_MAX_ACCEL = 24;
const JOYSTICK_FORWARD_ANGLE = Math.PI / 2;
const JOYSTICK_STRAIGHT_CONE = THREE.MathUtils.degToRad(18);
const JOYSTICK_TURN_ONLY_SIDE_THRESHOLD = 0.68;
const JOYSTICK_TURN_ONLY_FORWARD_LIMIT = 0.45;
const TURN_RESPONSE_MULTIPLIER = 1.4;
const TURN_GESTURE_YAW = THREE.MathUtils.degToRad(15);
const TURN_GESTURE_SMOOTHING = 10;
const MAX_PLAYER_VIEW_TARGET_OFFSET = 0.55;
const EXTRA_PLAYER_VIEW_CAMERA_DISTANCE_SCALE = 2.5;

const Ecctrl = forwardRef<RapierRigidBody, EcctrlProps>(({
                                                             children,
                                                             debug = true,
                                                             capsuleHalfHeight = 0.25,
                                                             capsuleRadius = 0.3,
                                                             floatHeight = 0.3,
                                                             characterInitDir = 0, // in rad
                                                             followLight = false,
                                                             disableFollowCam = true,
                                                             disableFollowCamPos = {x: 0, y: 0, z: 0},
                                                             disableFollowCamTarget = {x: 0, y: 0, z: 0},
                                                             // Follow camera setups
                                                             camInitDis = -5,
                                                             camMaxDis = -50,
                                                             camMinDis = -5,
                                                             camInitDir = {x: 0, y: -Math.PI, z: 0}, // in rad
                                                             camTargetPos = {x: 0, y: 0, z: 0},
                                                             camMoveSpeed = 1,
                                                             camZoomSpeed = 1,
                                                             camCollision = true,
                                                             camCollisionOffset = 0.7,
                                                             // Follow light setups
                                                             followLightPos = {x: 20, y: 30, z: 10},
                                                             // Base control setups
                                                             maxVelLimit = 0.5,
                                                             turnVelMultiplier = 1,
                                                             turnSpeed = 0.05,
                                                             speedRot = 50,
                                                             sprintMult = 2,
                                                             jumpVel = 6,
                                                             jumpForceToGroundMult = 5,
                                                             slopJumpMult = 0.25,
                                                             sprintJumpMult = 1.2,
                                                             airDragMultiplier = 0.2,
                                                             dragDampingC = 0.15,
                                                             accDeltaTime = 50,
                                                             rejectVelMult = 4,
                                                             moveImpulsePointY = 0.5,
                                                             camFollowMult = 11,
                                                             fallingGravityScale = 1.5,
                                                             fallingMaxVel = -20,
                                                             wakeUpDelay = 200,
                                                             // Floating Ray setups
                                                             rayOriginOffest = {x: 0, y: -capsuleHalfHeight, z: 0},
                                                             rayHitForgiveness = 0.1,
                                                             rayLength = capsuleRadius + 2,
                                                             rayDir = {x: 0, y: -1, z: 0},
                                                             floatingDis = 0,
                                                             springK = 1.2,
                                                             dampingC = 0.08,
                                                             // Slope Ray setups
                                                             showSlopeRayOrigin = false,
                                                             slopeMaxAngle = 1.2, // in rad
                                                             slopeRayOriginOffest = capsuleRadius,
                                                             slopeRayLength = capsuleRadius + 3,
                                                             slopeRayDir = {x: 0, y: -1, z: 0},
                                                             slopeUpExtraForce = 0.1,
                                                             slopeDownExtraForce = 0.2,
                                                             // AutoBalance Force setups
                                                             autoBalance = false,
                                                             autoBalanceSpringK = 0.3,
                                                             autoBalanceDampingC = 0.03,
                                                             autoBalanceSpringOnY = 0.5,
                                                             autoBalanceDampingOnY = 0.015,
                                                             // Animation temporary setups
                                                             animated = false,
                                                             // Mode setups
                                                             mode = '',
                                                             // Controller setups
                                                             controllerKeys = {
                                                                 forward: 12,
                                                                 backward: 13,
                                                                 leftward: 14,
                                                                 rightward: 15,
                                                                 jump: 2,
                                                                 action1: 11,
                                                                 action2: 3,
                                                                 action3: 1,
                                                                 action4: 0
                                                             },
                                                             client = '',
                                                             orbitControls = null,
                                                             // Other rigibody props from parent
                                                             ...props
                                                         }: EcctrlProps, ref) => {
    const characterRef = ref as RefObject<any> || useRef<RapierRigidBody>(null)
    const characterModelRef: any = useRef(null);
    const characterVisualGestureRef: any = useRef(null);
    const isTurnInputActiveRef = useRef(false);
    const emitAccumulatorRef = useRef(0);
    const playerMovePayloadRef = useRef<any>({
        mType: "player",
        position: { x: 0, y: 0, z: 0 },
    });
    const lastAnimationCommandRef = useRef("");
    const lastGamepadButtonActionRef = useRef("");
    const lastGamepadJoystickRef = useRef({ active: false, dis: 0, ang: 0, run: false });
    const jumpPressedRef = useRef(false);
    const jumpLockoutRef = useRef(0);
    const slopeSampleAccumulatorRef = useRef(0);
    const controllerIndexRef = useRef<number | null>(null);
    const gamepadKeysRef = useRef({forward: false, backward: false, leftward: false, rightward: false});
    const speedRotMult = THREE.MathUtils.clamp(speedRot, 1, 100) / 100;
    const excludeSensorCollider = useMemo(() => (collider: any) => !collider.isSensor(), []);
    const playerSpeed = useGame((state: any) => state.playerSpeed)
    const characterModelIndicator = useMemo(() => new THREE.Object3D(), [])
    const defaultControllerKeys = {
        forward: 12,
        backward: 13,
        leftward: 14,
        rightward: 15,
        jump: 2,
        action1: 11,
        action2: 3,
        action3: 1,
        action4: 0
    }

    /**
     * Mode setup
     */
    let isModePointToMove = false
    const setCameraBased = useGame1((state) => state.setCameraBased);
    const isCameraBasedMovement = useGame1((state) => state.isCameraBased);
    if (mode) {
        if (mode === "PointToMove") isModePointToMove = true
        if (mode === "CameraBasedMovement") setCameraBased(true)
    }

    /**
     * Body collider setup
     */
    const modelFacingVec = useMemo(() => new THREE.Vector3(), []);
    const bodyFacingVec = useMemo(() => new THREE.Vector3(), []);
    const bodyBalanceVec = useMemo(() => new THREE.Vector3(), []);
    const bodyBalanceVecOnX = useMemo(() => new THREE.Vector3(), []);
    const bodyFacingVecOnY = useMemo(() => new THREE.Vector3(), []);
    const bodyBalanceVecOnZ = useMemo(() => new THREE.Vector3(), []);
    const vectorY = useMemo(() => new THREE.Vector3(0, 1, 0), []);
    const vectorZ = useMemo(() => new THREE.Vector3(0, 0, 1), []);
    const bodyContactForce = useMemo(() => new THREE.Vector3(), []);
    const crossVecOnX = useMemo(() => new THREE.Vector3(), []);
    const crossVecOnY = useMemo(() => new THREE.Vector3(), []);
    const crossVecOnZ = useMemo(() => new THREE.Vector3(), []);

    // Animation change functions
    const idleAnimation = !animated ? null : useGame1((state) => state.idle);
    const walkAnimation = !animated ? null : useGame1((state) => state.walk);
    const runAnimation = !animated ? null : useGame1((state) => state.run);
    const jumpAnimation = !animated ? null : useGame1((state) => state.jump);
    const climbAnimation = !animated ? null : useGame1((state) => state.climb);
    const recover = !animated ? null : useGame1((state) => state.recover);
    const fail = !animated ? null : useGame1((state) => state.fail);
    const isRecovering = useGame((state: any) => state.isRecovering);
    const jumpIdleAnimation = !animated
        ? null
        : useGame1((state) => state.jumpIdle);

    const [prevAnimation, setPrevAnimation] = useState("Idle")
    const userData = useGame((state: any) => state.userData);
    const center: any = useGame((state: any) => state.searchCenter);
    const setHasDied: any = useGame((state: any) => state.setHasDied);
    const hasDied: any = useGame((state: any) => state.hasDied);
    const start = useInterface((state) => state.start)
    const ready = useInterface((state) => state.ready)
    const end = useInterface((state) => state.end)
    const setSoundUrl: any = useGame((state: any) => state.setSoundUrl)
    const jumpSpeed = useGame((state:any)  => state.jumpSpeed)


    /**
     * Debug settings
     */

    if (debug) {

        // Apply debug values
        maxVelLimit = (playerSpeed > 0 ? playerSpeed / 15 : 0.5) * 1.8//characterControlsDebug.maxVelLimit;
        turnVelMultiplier = 1//characterControlsDebug.turnVelMultiplier;
        turnSpeed = 2//characterControlsDebug.turnSpeed;
        sprintMult = 2//characterControlsDebug.sprintMult;
        jumpForceToGroundMult = 0// characterControlsDebug.jumpForceToGroundMult;
        airDragMultiplier = 0.2// characterControlsDebug.airDragMultiplier;
        dragDampingC = 0.15// characterControlsDebug.dragDampingC;
        accDeltaTime = 50//characterControlsDebug.accDeltaTime;
        rejectVelMult = 4// characterControlsDebug.rejectVelMult;
        moveImpulsePointY = 0.8//characterControlsDebug.moveImpulsePointY;

        // Apply debug values
        rayOriginOffest = {
            x: 0,
            y: 0,
            z: 0,
        };//floatingRayDebug.rayOriginOffest;
        rayHitForgiveness = 1// floatingRayDebug.rayHitForgiveness;
        rayLength = 2.3//floatingRayDebug.rayLength;
        rayDir = {
            x: 0,
            y: -1,
            z: 0,
        }//floatingRayDebug.rayDir;
        floatingDis = 0.6//floatingRayDebug.floatingDis;
        springK = 0//floatingRayDebug.springK;
        dampingC = 0// floatingRayDebug.dampingC;


        // Apply debug values
        showSlopeRayOrigin = false//slopeRayDebug.showSlopeRayOrigin;
        slopeMaxAngle = 1.2//slopeRayDebug.slopeMaxAngle;
        slopeRayLength = 3.3//slopeRayDebug.slopeRayLength;
        slopeRayDir = {
            x: 0,
            y: -1,
            z: 0
        }//slopeRayDebug.slopeRayDir;
        slopeUpExtraForce = 0.12//slopeRayDebug.slopeUpExtraForce;
        slopeDownExtraForce = 0.05// slopeRayDebug.slopeDownExtraForce;


        // Apply debug values
        autoBalance = false// autoBalanceForceDebug.autoBalance;
        autoBalanceSpringK = 0.3//autoBalanceForceDebug.autoBalanceSpringK;
        autoBalanceDampingC = 0.03//autoBalanceForceDebug.autoBalanceDampingC;
        autoBalanceSpringOnY = 0.5//autoBalanceForceDebug.autoBalanceSpringOnY;
        autoBalanceDampingOnY = 0.01//autoBalanceForceDebug.autoBalanceDampingOnY;
    }

    /**
     * Check if inside keyboardcontrols
     */
    function useIsInsideKeyboardControls() {
        try {
            return !!useKeyboardControls()
        } catch {
            return false
        }
    }

    const isInsideKeyboardControls = useIsInsideKeyboardControls();
    /**
     * keyboard controls setup
     */
    const [subscribeKeys, getKeys] = isInsideKeyboardControls ? useKeyboardControls() : [null];
    const presetKeys = {forward: false, backward: false, leftward: false, rightward: false, jump: false, run: false};
    const {rapier, world} = useRapier();
    /**
     * Joystick controls setup
     */
    const getJoystickValues = useJoystickControls(state => state.getJoystickValues)
    const pressButton1 = useJoystickControls((state) => state.pressButton1)
    const pressButton2 = useJoystickControls((state) => state.pressButton2)
    const pressButton3 = useJoystickControls((state) => state.pressButton3)
    const pressButton4 = useJoystickControls((state) => state.pressButton4)
    const pressButton5 = useJoystickControls((state) => state.pressButton5)
    const releaseAllButtons = useJoystickControls((state) => state.releaseAllButtons)
    const setJoystick = useJoystickControls((state) => state.setJoystick)
    const resetJoystick = useJoystickControls((state) => state.resetJoystick)
    const pLabel = useGame((state: any) => state.pLabel);
    const personColor = useGame((state: any) => state.personColor);
    const setNoOfCoins = useGame((state: any) => state.setNoOfCoins);
    const noOfCoins = useGame((state: any) => state.noOfCoins);
    const gameInstances = useGame((state: any) => state.gameInstances);
    const forwardOnly = useGame((state: any) => state.forwardOnly);
    const timeout = useInterface((state) => state.timeout)
    const noOfLivesRemaining = useGame((state: any) => state.noOfLivesRemaining);

    /**
     * Gamepad controls setup
     */
    const gamepadJoystickVec2 = useMemo(() => new THREE.Vector2(), [])
    let gamepadJoystickDis: number = 0
    let gamepadJoystickAng: number = 0
    const gamepadConnect = (e: any) => {
        controllerIndexRef.current = e.gamepad.index
    }
    const gamepadDisconnect = () => {
        controllerIndexRef.current = null
        gamepadKeysRef.current.forward = false;
        gamepadKeysRef.current.backward = false;
        gamepadKeysRef.current.leftward = false;
        gamepadKeysRef.current.rightward = false;
    }
    const mergedKeys = useMemo(() => Object.assign({}, defaultControllerKeys, controllerKeys), [controllerKeys])

    const handleButtons = (buttons: readonly GamepadButton[]) => {
        const gamepadKeys = gamepadKeysRef.current;
        gamepadKeys.forward = buttons[mergedKeys.forward].pressed
        gamepadKeys.backward = buttons[mergedKeys.backward].pressed
        gamepadKeys.leftward = buttons[mergedKeys.leftward].pressed
        gamepadKeys.rightward = buttons[mergedKeys.rightward].pressed

        let nextAction = "";
        if (buttons[mergedKeys.action4].pressed) {
            nextAction = "action4";
        } else if (buttons[mergedKeys.action3].pressed) {
            nextAction = "action3";
        } else if (buttons[mergedKeys.jump].pressed) {
            nextAction = "jump";
        } else if (buttons[mergedKeys.action2].pressed) {
            nextAction = "action2";
        } else if (buttons[mergedKeys.action1].pressed) {
            nextAction = "action1";
        }

        if (lastGamepadButtonActionRef.current === nextAction) {
            return;
        }
        lastGamepadButtonActionRef.current = nextAction;

        // Gamepad trigger the EcctrlJoystick buttons to play animations
        if (nextAction === "action4") pressButton2()
        else if (nextAction === "action3") pressButton4()
        else if (nextAction === "jump") pressButton1()
        else if (nextAction === "action2") pressButton3()
        else if (nextAction === "action1") pressButton5()
        else releaseAllButtons()
    }

    const getMovingDirection = (forward: boolean,
                                backward: boolean,
                                leftward: boolean,
                                rightward: boolean,
                                pivot: any,
                                target: any,
                                playerSpeed: number)
        : number => {

        if (!forward && !backward && !leftward && !rightward) return 0;
        if (!pivot) return 0;
        if (!pivot.rotation) return 0;
        if (pivot.rotation.y === undefined || pivot.rotation.y === null) return 0;
        if (!target?.getAzimuthalAngle) return 0;
        const rot = pivot.rotation.y + target.getAzimuthalAngle()

        if (forward && leftward) return rot + Math.PI / 4;
        if (forward && rightward) return rot - Math.PI / 4;
        if (backward && leftward) return rot + Math.PI * 0.75;
        if (backward && rightward) return rot - Math.PI * 0.75;
        if (backward) return rot + Math.PI;
        if (leftward) return rot + Math.PI / 2;
        if (rightward) return rot - Math.PI / 2;

        // if (forward && leftward) return rot + Math.PI / 4;
        // if (forward && rightward) return rot - Math.PI / 4;
        // if (backward && leftward) return rot - Math.PI / 4 + Math.PI;
        // if (backward && rightward) return rot + Math.PI / 4 + Math.PI;
        // if (backward) return rot + Math.PI;
        // if (leftward) return rot + Math.PI / 2;
        // if (rightward) return rot - Math.PI / 2;
        if (forward) return rot;
        return 0
    };

    const handleSticks = (axes: readonly number[]) => {

        // Gamepad first joystick trigger the EcctrlJoystick event to move the character
        if (Math.abs(axes[0]) > 0 || Math.abs(axes[1]) > 0) {
            gamepadJoystickVec2.set(axes[0], -axes[1])
            gamepadJoystickDis = Math.min(Math.sqrt(gamepadJoystickVec2.x * gamepadJoystickVec2.x + gamepadJoystickVec2.y * gamepadJoystickVec2.y), 1)
            gamepadJoystickAng = gamepadJoystickVec2.angle()
            const runState = gamepadJoystickDis > 0.7
            const last = lastGamepadJoystickRef.current;
            if (
                !last.active ||
                Math.abs(last.dis - gamepadJoystickDis) > 0.01 ||
                Math.abs(last.ang - gamepadJoystickAng) > 0.01 ||
                last.run !== runState
            ) {
                lastGamepadJoystickRef.current = {
                    active: true,
                    dis: gamepadJoystickDis,
                    ang: gamepadJoystickAng,
                    run: runState,
                };
                setJoystick(gamepadJoystickDis, gamepadJoystickAng, runState)
            }
        } else {
            if (lastGamepadJoystickRef.current.active) {
                lastGamepadJoystickRef.current = { active: false, dis: 0, ang: 0, run: false };
                resetJoystick()
            }
        }

    }

    // can jump setup
    let canJump = false;
    let isFalling = false;
    const initialGravityScale: number = useMemo(() => props.gravityScale || 1, [])

    // on moving object state
    let massRatio = 1;
    let isOnMovingObject = false;
    const standingForcePoint = useMemo(() => new THREE.Vector3(), []);
    const movingObjectDragForce = useMemo(() => new THREE.Vector3(), []);
    const movingObjectVelocity = useMemo(() => new THREE.Vector3(), []);
    const movingObjectVelocityInCharacterDir = useMemo(() => new THREE.Vector3(), []);
    const distanceFromCharacterToObject = useMemo(() => new THREE.Vector3(), []);
    const objectAngvelToLinvel = useMemo(() => new THREE.Vector3(), []);
    const velocityDiff = useMemo(() => new THREE.Vector3(), []);


    /**
     * Load camera pivot and character move preset
     */

        // const pivotPosition = useMemo(() => new THREE.Vector3(), []);
    const modelEuler = useMemo(() => new THREE.Euler(), []);
    const modelQuat = useMemo(() => new THREE.Quaternion(), []);
    const moveImpulse = useMemo(() => new THREE.Vector3(), []);
    const movingDirection = useMemo(() => new THREE.Vector3(), []);
    const moveAccNeeded = useMemo(() => new THREE.Vector3(), []);
    const currentVel = useMemo(() => new THREE.Vector3(), []);
    const currentPos = useMemo(() => new THREE.Vector3(), []);
    const dragForce = useMemo(() => new THREE.Vector3(), []);
    const dragAngForce = useMemo(() => new THREE.Vector3(), []);
    const wantToMoveVel = useMemo(() => new THREE.Vector3(), []);
    const rejectVel = useMemo(() => new THREE.Vector3(), []);
    const pivot = useMemo(() => new THREE.Object3D(), []);


    /**
     * Floating Ray setup
     */
    let floatingForce = null;
    const springDirVec = useMemo(() => new THREE.Vector3(), []);
    const characterMassForce = useMemo(() => new THREE.Vector3(), []);
    const rayOrigin = useMemo(() => new THREE.Vector3(), []);
    const rayCast = new rapier.Ray(rayOrigin, rayDir as Vector);
    let rayHit: any = null;

    /**Test shape ray */
    // const shape = new rapier.Capsule(0.2,0.1)

    /**
     * Slope detection ray setup
     */
    let slopeAngle: number = 0;
    let actualSlopeNormal: any = null;
    let actualSlopeAngle: number = 0;
    const actualSlopeNormalVec = useMemo(() => new THREE.Vector3(), []);
    const floorNormal = useMemo(() => new THREE.Vector3(0, 1, 0), []);
    const slopeRayOriginRef: any = useRef(null);
    const slopeRayorigin = useMemo(() => new THREE.Vector3(), []);
    const slopeRayCast = new rapier.Ray(slopeRayorigin, slopeRayDir as Vector);
    let slopeRayHit: any = null;

    /**
     * Point to move setup
     */
    let isBodyHitWall = false;
    let isPointMoving = false;
    const crossVector = useMemo(() => new THREE.Vector3(), []);
    const pointToPoint = useMemo(() => new THREE.Vector3(), []);
    const prevPosition = useMemo(() => new THREE.Vector3(), []);
    const targetMoveVelocity = useMemo(() => new THREE.Vector3(), []);
    const smoothedMoveVelocity = useMemo(() => new THREE.Vector3(), []);
    const desiredMoveAccel = useMemo(() => new THREE.Vector3(), []);
    const finalMoveVelocity = useMemo(() => new THREE.Vector3(), []);
    const horizontalMoveVelocity = useMemo(() => new THREE.Vector3(), []);
    const idleMoveVelocity = useMemo(() => new THREE.Vector3(), []);
    const targetModelQuaternion = useMemo(() => new THREE.Quaternion(), []);
    const slopeForceVec = useMemo(() => new THREE.Vector3(), []);
    const followForwardVec = useMemo(() => new THREE.Vector3(), []);
    const followOffsetVec = useMemo(() => new THREE.Vector3(), []);
    const followCameraPosVec = useMemo(() => new THREE.Vector3(), []);
    const resetPositionVec = useMemo(() => new THREE.Vector3(), []);
    const turnGestureYawRef = useRef(0);


    const getMoveToPoint = useGame1((state) => state.getMoveToPoint);
    const curAnimation = useGame1((state) => state.curAnimation);

    const character: any = useGame((state: any) => state.character)
    const firstPerson: any = useGame((state: any) => state.firstPerson)
    const {camera} = useThree()
    const setCharacterRef = useGame((state: any) => state.setCharacterRef)
    const floorHeight = useGame((state: any) => state.floorHeight)
    const playerViewAngle = useGame((state: any) => state.playerViewAngle)
    const projectID = useGame((state: any) => state.projectID)
    const {clientId, dateTime} = client ? JSON.parse(client) : {clientId: "custom_person", dateTime: 'now'}
    const setCharacterIsInWater: any = useGame((state: any) => state.setCharacterIsInWater)
    const characterIsInWater: boolean = useGame((state: any) => state.characterIsInWater)
    const ladderList = useGame((state: any) => state.ladderList);
    const [currentLadder, setCurrentLadder] = useState<any>();
    const [climbing, setClimbing] = useState(false);
    const [hasJumpedOff, setHasJumpedOff] = useState(false)
    const setNotification: any = useGame((state: any) => state.setNotification);

    // const { pivot, followCam, cameraCollisionDetect, joystickCamMove } = useFollowCam();

    useEffect(() => {

        if (curAnimation === 'Walk' && !characterIsInWater) {
            setSoundUrl('running.mp3')
        } else if (curAnimation === 'Walk' && characterIsInWater) {
            setSoundUrl('walking-in-the-water.mp3')
        } else if (curAnimation === 'Idle') {
            setSoundUrl('')
        } else if (curAnimation === 'Jump') {
            setSoundUrl('jump.mp3')
        } else if (curAnimation === 'Fail') {
            setSoundUrl('die.mp3')
        } else if (curAnimation === 'Recover') {
            setSoundUrl('recover.mp3')
        } else {
            setSoundUrl('')
        }


    }, [curAnimation]);


    useEffect(() => {
        if (!currentLadder || !characterRef.current || !subscribeKeys) return;

        const {start, end} = currentLadder;
        const direction = new Vector3().copy(end).sub(start).normalize();
        const character = characterRef.current;
        // Prevent multiple impulse applications

        const unsubscribeKeys = subscribeKeys(() => {
            const {climb} = isInsideKeyboardControls && getKeys ? getKeys() : presetKeys;
            setClimbing(climb);

            if (climb) {
                // Apply velocity for climbing
                character.setLinvel(
                    {
                        x: direction.x * 2.5,
                        y: direction.y,
                        z: direction.z * 2.5,
                    },
                    true
                );
            }

            const charPos = character.translation();

            // Stop movement when reaching 'end'
            if (charPos.y >= end.y - 0.3) {
                // Apply impulse once to push character off ladder
                if (!hasJumpedOff) {
                    character.applyImpulse({
                        x: direction.x * 0.1,
                        y: 0,
                        z: direction.z * 0.1,

                    }, true); // Push upward slightly
                    setHasJumpedOff(true)
                    setCurrentLadder(null)
                    setClimbing(false);
                    const header = 'Climb Up Ladder!'
                    const text = `Hurray! You are top again`
                    const htmlCode = `&#9635;`
                    const notification = {
                        header: header,
                        text: text,
                        htmlCode: htmlCode,
                        position: 'center',
                        timeout: 3000
                    }
                    setNotification(notification)
                }

            }
        });

        return () => unsubscribeKeys();
    }, [currentLadder, getKeys, subscribeKeys, hasJumpedOff]);


    useEffect(() => {

        if (!currentLadder || !characterRef.current) return;
        const character = characterRef.current;

        const {start, direction} = currentLadder;

        const charPos = character.translation()

        if ((Math.abs(charPos.x - start.x) > 0.1 || Math.abs(charPos.z - start.z) > 0.1) && climbing) {
            setHasJumpedOff(false)
            character.setTranslation({x: start.x, y: charPos.y, z: start.z}, true);
            character.setLinvel({x: 0, y: 0, z: 0}, true); // Reset any previous movement
            character.setAngvel({x: 0, y: 0, z: 0}, true); // Reset angular velocity
        }
        modelEuler.y = ((dir) => {
            if (!dir) return modelEuler.y; // Keep the existing rotation if no direction
            // Compute yaw (rotation around Y-axis)
            return Math.atan2(dir.x, dir.z);
        })(direction);



        const text = climbing ? ` Going Up...` : 'Press Key L to Locate Ladder and go up'

        const header = 'Climb Up Ladder!'

        const htmlCode = `&#9635;`
        const notification = {
            header: header,
            text: text,
            htmlCode: htmlCode,
            position: 'center',
            timeout: climbing ? 5000 : 10000
        }

        setNotification(notification)


    }, [currentLadder, climbing, hasJumpedOff]);


    useEffect(() => {
        if (currentPos && orbitControls.current) {

            if (characterModelRef.current) {
                characterModelRef.current.visible = character;
            }
            // Set zoom based on first-person view mode
            // orbitControls.current.enableZoom = !firstPerson;
        }
    }, [firstPerson, character, camera, orbitControls]);

    const emitData = (buttonPressed = false) => {
        const player = playerMovePayloadRef.current;
        player.projectID = projectID;
        player.clientId = clientId;
        player.position.x = currentPos.x;
        player.position.y = currentPos.y;
        player.position.z = currentPos.z;
        player.currentAnimation = curAnimation;
        player.angle = THREE.MathUtils.radToDeg(modelEuler.y);
        player.prevAnimation = prevAnimation;
        player.direction = modelEuler.y;
        player.speed = playerSpeed;
        player.dateTime = dateTime;
        player.userName = userData.fullname;
        player.personColor = personColor;
        player.noOfLivesRemaining = noOfLivesRemaining;
        player.jump = buttonPressed || !canJump;
        emitSocketEvent("playerMove", player, { volatile: true });
    }


    const handleOnCharacterIntersectionEnter = (event: any) => {
        const collidedInstance = event.rigidBodyObject; // Get the collided instance
        if (!collidedInstance || !collidedInstance.userData) return;
        const colliderName = collidedInstance.userData.name
        const colliderKey = collidedInstance.userData.instance_id

        if (colliderName == 'ocean') {
            setCharacterIsInWater(true)
            const nearestLadder = getNearestLadder(currentPos, ladderList);

            if (nearestLadder) {
                setCurrentLadder(nearestLadder); // Store the current ladder for climbing
            }


        }

        if (colliderName.includes("coin") && noOfCoins < 10) {

            const collider = gameInstances[colliderName]

            for (const i of collider) {
                if (i.userData.instance_id === colliderKey) {
                    i.setTranslation({x: -1, y: 0.2, z: -0.20}, true);
                    setNoOfCoins(noOfCoins + 1);
                    setSoundUrl('coin.mp3')
                    if (noOfCoins == 9) {
                        end(); // End game when 10 coins are collected
                        return;
                    }

                }
            }
        }

        const isTouchAndDie = collidedInstance.userData.Properties['Touch and die']?.value

        if (isTouchAndDie == '1') {

            setHasDied(true)

        }


    }

    const handleOnCharacterIntersectionExit = (event: any) => {
        const collidedInstance = event.rigidBodyObject; // Get the collided instance
        if (!collidedInstance || !collidedInstance.userData) return;
        const colliderName = collidedInstance.userData.name

        if (colliderName == 'ocean') {
            setCharacterIsInWater(false)
        }

        bodyContactForce.set(0, 0, 0)
    }
    /**
     * Character moving function
     */
    const moveCharacter = (
        delta: number,
        run: boolean,
        slopeAngle: number,
        movingObjectVelocity: THREE.Vector3,
        forwardPressed = false
    ) => {
        const characterBody = characterRef.current;
        if (!characterBody) return;
        if (forwardOnly && !forwardPressed) {
            horizontalMoveVelocity.set(0, 0, 0);
            characterBody.setLinvel({ x: 0, y: currentVel.y, z: 0 }, true);
            return;
        }

        const levelRunSpeedMultiplier = String(projectID) === "153_L1" || String(projectID) === "33_L0" ? PROJECT_153_L1_RUN_SPEED_MULTIPLIER : 1;
        const speedMult = run ? sprintMult * levelRunSpeedMultiplier : 1;
        const targetSpeed = maxVelLimit * speedMult;
        const rotationSmoothing = 3.5 * TURN_RESPONSE_MULTIPLIER * speedRotMult;
        const safeDelta = Math.max(delta, 1 / 240);
        const velocityAlpha = 1 - Math.exp(-HORIZONTAL_MOVE_ACCELERATION * safeDelta);
        const rotationAlpha = 1 - Math.exp(-rotationSmoothing * safeDelta);

        // --- Determine movement direction ---
        if (
            actualSlopeAngle < slopeMaxAngle &&
            Math.abs(slopeAngle) > 0.2 &&
            Math.abs(slopeAngle) < slopeMaxAngle
        ) {
            movingDirection.set(0, Math.sin(slopeAngle), Math.cos(slopeAngle));
        } else if (actualSlopeAngle >= slopeMaxAngle) {
            movingDirection.set(
                0,
                Math.sin(slopeAngle) > 0 ? 0 : Math.sin(slopeAngle),
                Math.sin(slopeAngle) > 0 ? 0.1 : 1
            );
        } else {
            movingDirection.set(0, 0, 1);
        }

        // Apply character's rotation to direction
        movingDirection.applyQuaternion(characterModelIndicator.quaternion);

        // --- Smoothly rotate toward intended model rotation only while turning ---
        if (isTurnInputActiveRef.current) {
            targetModelQuaternion.setFromEuler(modelEuler);
            characterModelIndicator.quaternion.slerp(targetModelQuaternion, rotationAlpha);
        }

        // --- Calculate target velocity ---
        targetMoveVelocity.set(
            movingDirection.x * targetSpeed + movingObjectVelocity.x,
            0,
            movingDirection.z * targetSpeed + movingObjectVelocity.z
        );

        // --- Smooth horizontal velocity using an internal value ---
        // Live rigid-body velocity can fluctuate around contacts; feeding it directly
        // back into the movement target causes visible forward stutter.
        smoothedMoveVelocity.set(
            THREE.MathUtils.lerp(horizontalMoveVelocity.x, targetMoveVelocity.x, velocityAlpha),
            0,
            THREE.MathUtils.lerp(horizontalMoveVelocity.z, targetMoveVelocity.z, velocityAlpha)
        );

        // --- Clamp acceleration to avoid large jumps ---
        desiredMoveAccel.subVectors(smoothedMoveVelocity, horizontalMoveVelocity).divideScalar(safeDelta);
        desiredMoveAccel.clampLength(0, HORIZONTAL_MOVE_MAX_ACCEL);

        // --- Final velocity after applying smoothed acceleration ---
        finalMoveVelocity.addVectors(
            horizontalMoveVelocity,
            desiredMoveAccel.multiplyScalar(safeDelta)
        );
        horizontalMoveVelocity.copy(finalMoveVelocity);

        // --- Apply the final velocity ---
        characterBody.setLinvel(
            {
                x: finalMoveVelocity.x,
                y: currentVel.y,
                z: finalMoveVelocity.z,
            },
            true
        );

        // --- Optionally apply a tiny impulse for slope up/down (not every frame) ---
        if (slopeAngle && Math.abs(slopeAngle) > 0.2 && canJump) {
            slopeForceVec.set(
                0,
                movingDirection.y *
                (movingDirection.y > 0 ? slopeUpExtraForce : slopeDownExtraForce) *
                speedMult,
                0
            );
            characterBody.applyImpulse(slopeForceVec, true);
        }

        // --- Update previous position ---
        prevPosition.copy(currentPos);
    };



    /**
     * Character auto balance function
     */
    const autoBalanceCharacter = () => {
        if (!characterRef.current) {
            return;
        }

        // Match body component to character model rotation on Y
        bodyFacingVec.set(0, 0, 1).applyQuaternion(quat(characterRef.current.rotation()))
        bodyBalanceVec.set(0, 1, 0).applyQuaternion(quat(characterRef.current.rotation()))

        bodyBalanceVecOnX.set(0, bodyBalanceVec.y, bodyBalanceVec.z)
        bodyFacingVecOnY.set(bodyFacingVec.x, 0, bodyFacingVec.z)
        bodyBalanceVecOnZ.set(bodyBalanceVec.x, bodyBalanceVec.y, 0)

        // Check if is camera based movement
        if (isCameraBasedMovement) {
            modelEuler.y = pivot.rotation.y
            pivot.getWorldDirection(modelFacingVec)
        } else {
            characterModelIndicator.getWorldDirection(modelFacingVec)
        }
        crossVecOnX.crossVectors(vectorY, bodyBalanceVecOnX);
        crossVecOnY.crossVectors(modelFacingVec, bodyFacingVecOnY);
        crossVecOnZ.crossVectors(vectorY, bodyBalanceVecOnZ);

        dragAngForce.set(
            (crossVecOnX.x < 0 ? 1 : -1) *
            autoBalanceSpringK * (bodyBalanceVecOnX.angleTo(vectorY))
            - characterRef.current.angvel().x * autoBalanceDampingC,
            (crossVecOnY.y < 0 ? 1 : -1) *
            autoBalanceSpringOnY * (modelFacingVec.angleTo(bodyFacingVecOnY))
            - characterRef.current.angvel().y * autoBalanceDampingOnY,
            (crossVecOnZ.z < 0 ? 1 : -1) *
            autoBalanceSpringK * (bodyBalanceVecOnZ.angleTo(vectorY))
            - characterRef.current.angvel().z * autoBalanceDampingC,
        );

        // Apply balance torque impulse
        characterRef.current.applyTorqueImpulse(dragAngForce, true)
    };

    /**
     * Character sleep function
     */
    const sleepCharacter = () => {
        if (characterRef.current) {
            if (document.visibilityState === "hidden") {
                characterRef.current.sleep()
            } else {
                setTimeout(() => {
                    if (characterRef.current) {
                        characterRef.current.wakeUp()
                    }
                }, wakeUpDelay)
            }
        }
    }

    /**
     * Point-to-move function
     */
    const pointToMove = (delta: number, slopeAngle: number, movingObjectVelocity: THREE.Vector3) => {
        const moveToPoint = getMoveToPoint().moveToPoint;
        if (moveToPoint) {
            pointToPoint.set(moveToPoint.x - currentPos.x, 0, moveToPoint.z - currentPos.z)
            crossVector.crossVectors(pointToPoint, vectorZ)
            // Rotate character to moving direction
            modelEuler.y = (crossVector.y > 0 ? -1 : 1) * pointToPoint.angleTo(vectorZ);
            if (characterRef.current) {
                if (pointToPoint.length() > 0.3 && !isBodyHitWall) {
                    moveCharacter(delta, false, slopeAngle, movingObjectVelocity, false)
                    isPointMoving = true
                } else {
                    isPointMoving = false
                }
            }
        }
    }


    useEffect(() => {
        // Lock character rotations at Y axis
        characterRef.current ? characterRef.current.setEnabledRotations(
            !!autoBalance,
            !!autoBalance,
            !!autoBalance,
            false
        ) : false

        // Reset character quaternion
        return (() => {
            if (characterRef.current && characterModelRef.current) {
                characterRef.current.removeFromParent?.();
                setCharacterRef(null)
                // characterModelRef.current.quaternion.set(0, 0, 0, 1);
                // characterRef.current.setRotation({x: 0, y: 0, z: 0, w: 1}, false);
            }
        })
    }, [autoBalance]);


    useEffect(() => {

        if (characterRef.current) {
            setCharacterRef(characterRef.current)
        }
        return (() => {
            if (characterRef.current) {
                setCharacterRef(null)
            }
        })
    }, [characterRef.current]);

    useEffect(() => {
        // Initialize character facing direction
        modelEuler.y = characterInitDir
        // Initialize camera facing direction
        pivot.rotation.x = camInitDir.x
        pivot.rotation.y = camInitDir.y
        pivot.rotation.z = camInitDir.z

        window.addEventListener("visibilitychange", sleepCharacter);
        window.addEventListener("gamepadconnected", gamepadConnect);
        window.addEventListener("gamepaddisconnected", gamepadDisconnect);

        return () => {
            window.removeEventListener("visibilitychange", sleepCharacter);
            window.removeEventListener("gamepadconnected", gamepadConnect);
            window.removeEventListener("gamepaddisconnected", gamepadDisconnect);
        }
    }, [])


    const followCam = (state: any, delta: number, curAnimation: string) => {
        if (orbitControls.current && characterModelRef.current) {
            // Get character forward direction
            followForwardVec.set(0, 0, -1).applyQuaternion(characterModelRef.current.quaternion).normalize();
            // Offset the camera: behind and above
            const viewAngleOffset = Math.min(playerViewAngle, MAX_PLAYER_VIEW_TARGET_OFFSET);
            const extraCameraDistance = Math.max(0, playerViewAngle - MAX_PLAYER_VIEW_TARGET_OFFSET) * EXTRA_PLAYER_VIEW_CAMERA_DISTANCE_SCALE;
            const distanceBehind = 2.25 + Math.max(0, viewAngleOffset) * 2.2 + extraCameraDistance;
            const heightAbove = 1.2;
            followOffsetVec.copy(followForwardVec).multiplyScalar(distanceBehind);
            followOffsetVec.y = heightAbove;
            followCameraPosVec.copy(currentPos).add(followOffsetVec);
            state.camera.position.copy(followCameraPosVec);
            orbitControls.current.target.copy(currentPos);
            orbitControls.current.target.y += (String(projectID).includes('137') ? 0.65 : 0.55) + viewAngleOffset;
            orbitControls.current.update();
        }
    };




    const distanceToLine = (point: Vector3, ladder: any): number | undefined => {
        const {start, end} = ladder;

        if (!start || !end || !point) return undefined;

        const lineDirection = new Vector3().subVectors(end, start).normalize();
        const pointToStart = new Vector3().subVectors(point, start);
        const projectionLength = pointToStart.dot(lineDirection);

        // Compute the closest point on the line
        const closestPoint = new Vector3(start.x, start.y, start.z).add(lineDirection.multiplyScalar(projectionLength));

        // Clamp to segment
        const lineLength = start.distanceTo(end);

        if (projectionLength < 0) {
            closestPoint.copy(start);

        } else if (projectionLength > lineLength) {
            closestPoint.copy(end);
        }

        return point.distanceTo(closestPoint);
    };

    const getNearestLadder = (characterPosition: Vector3, ladders: Record<string, any>) => {
        let nearestLadder = null;
        let minDistance = Infinity;

        Object.values(ladders).forEach((ladder) => {
            if (!ladder) return;

            const distance = distanceToLine(characterPosition, ladder);

            if (distance !== undefined && distance < minDistance) {
                minDistance = distance;
                nearestLadder = ladder;
            }
        });

        return nearestLadder;
    };


    const playAnimationCommand = (name: string, play?: (() => void) | null) => {
        if (!play || lastAnimationCommandRef.current === name) return;
        lastAnimationCommandRef.current = name;
        play();
    };

    const getSteeredJoystickAngle = (angle: number) => {
        const offsetFromForward = Math.atan2(
            Math.sin(angle - JOYSTICK_FORWARD_ANGLE),
            Math.cos(angle - JOYSTICK_FORWARD_ANGLE)
        );

        if (Math.abs(offsetFromForward) <= JOYSTICK_STRAIGHT_CONE) {
            return JOYSTICK_FORWARD_ANGLE;
        }

        const steeredOffset = Math.sign(offsetFromForward) * (Math.abs(offsetFromForward) - JOYSTICK_STRAIGHT_CONE);
        return JOYSTICK_FORWARD_ANGLE + steeredOffset;
    };

    const isJoystickTurnOnly = (angle: number) => {
        const sideAmount = Math.abs(Math.cos(angle));
        const forwardAmount = Math.abs(Math.sin(angle));
        return sideAmount >= JOYSTICK_TURN_ONLY_SIDE_THRESHOLD && forwardAmount <= JOYSTICK_TURN_ONLY_FORWARD_LIMIT;
    };

    useFrame((state, delta) => {

        /**
         * Getting all the useful keys from useKeyboardControls
         */
        const {
            forward,
            backward,
            leftward,
            rightward,
            jump,
            run,
            climb
        } = isInsideKeyboardControls && getKeys ? getKeys() : presetKeys;
        const characterBody = characterRef.current;
        if (!characterBody) return;

        // Character current position
        currentPos.copy(characterBody.translation() as THREE.Vector3);
        (characterBody.userData as userDataType).canJump = canJump
        currentVel.copy(characterBody.linvel() as THREE.Vector3);


        /**
         * Getting all gamepad control values
         */
        const controllerIndex = controllerIndexRef.current;
        const gamepadKeys = gamepadKeysRef.current;
        if (controllerIndex !== null) {
            const gamepad: any = navigator.getGamepads()[controllerIndex]
            if (gamepad) {
                handleButtons(gamepad.buttons)
                handleSticks(gamepad.axes)
            }

            const nextGamepadDirection = getMovingDirection(gamepadKeys.forward, gamepadKeys.backward, gamepadKeys.leftward, gamepadKeys.rightward, pivot, orbitControls.current,playerSpeed);
            if (nextGamepadDirection !== null) {
                modelEuler.y = nextGamepadDirection;
            }
        }

        /**
         * Getting all joystick control values
         */
        const joystickState = useJoystickControls.getState();
        const joystickDis = joystickState.curJoystickDis;
        const joystickAng = joystickState.curJoystickAng;
        const runState = joystickState.curRunState;
        const button1Pressed = joystickState.curButton1Pressed;
        const hasKeyboardTurnInput = leftward || rightward;
        const hasGamepadTurnInput = gamepadKeys.leftward || gamepadKeys.rightward;
        const hasJoystickTurnInput = joystickDis > 0.05;
        const joystickTurnOnly = hasJoystickTurnInput && isJoystickTurnOnly(joystickAng);
        isTurnInputActiveRef.current = hasKeyboardTurnInput || hasGamepadTurnInput || hasJoystickTurnInput;
        let turnGestureDirection = 0;
        if ((leftward || gamepadKeys.leftward) && !(rightward || gamepadKeys.rightward)) {
            turnGestureDirection = 1;
        } else if ((rightward || gamepadKeys.rightward) && !(leftward || gamepadKeys.leftward)) {
            turnGestureDirection = -1;
        }

        // Move character to the moving direction (joystick controls)
        if (joystickDis > 0.05 && pivot.rotation && orbitControls.current?.getAzimuthalAngle) {
            const steeredJoystickAng = getSteeredJoystickAngle(joystickAng);
            const turnOnly = joystickTurnOnly;
            modelEuler.y = pivot.rotation.y + orbitControls.current.getAzimuthalAngle() + (turnOnly ? joystickAng : steeredJoystickAng) - Math.PI / 2;
            const joystickOffsetFromForward = Math.atan2(
                Math.sin(joystickAng - JOYSTICK_FORWARD_ANGLE),
                Math.cos(joystickAng - JOYSTICK_FORWARD_ANGLE)
            );
            if (Math.abs(joystickOffsetFromForward) > JOYSTICK_STRAIGHT_CONE) {
                turnGestureDirection = Math.sign(joystickOffsetFromForward);
            }

            if (turnOnly) {
                const idleAlpha = 1 - Math.exp(-HORIZONTAL_MOVE_DECELERATION * Math.max(delta, 1 / 240));
                const idleTarget = isOnMovingObject
                    ? idleMoveVelocity.set(movingObjectVelocity.x, 0, movingObjectVelocity.z)
                    : idleMoveVelocity.set(0, 0, 0);

                horizontalMoveVelocity.lerp(idleTarget, idleAlpha);
                characterBody.setLinvel({
                    x: THREE.MathUtils.lerp(currentVel.x, idleTarget.x, idleAlpha),
                    y: currentVel.y,
                    z: THREE.MathUtils.lerp(currentVel.z, idleTarget.z, idleAlpha),
                }, true);
            } else {
                moveCharacter(delta, runState, slopeAngle, movingObjectVelocity, forward);
            }
        }

        const nextKeyboardDirection = getMovingDirection(forward, backward, leftward, rightward, pivot, orbitControls.current,playerSpeed);
        if (nextKeyboardDirection !== 0) {
            modelEuler.y = nextKeyboardDirection;
        }

        // Move character to the moving direction
        const hasKeyboardMoveInput = forward || backward || leftward || rightward;
        const hasGamepadMoveInput = gamepadKeys.forward || gamepadKeys.backward || gamepadKeys.leftward || gamepadKeys.rightward;
        if (hasKeyboardMoveInput || hasGamepadMoveInput) {
            moveCharacter(delta, run, slopeAngle, movingObjectVelocity, forward);
            // followCam(state, delta, curAnimation)
        }

        followCam(state, delta, curAnimation)





        const jumpInputActive = jump || button1Pressed;
        const shouldStartJump = jumpInputActive && !jumpPressedRef.current;
        jumpPressedRef.current = jumpInputActive;
        jumpLockoutRef.current = Math.max(0, jumpLockoutRef.current - delta);

        if (shouldStartJump && canJump) {
            setSoundUrl('jump.mp3')
            canJump = false
            jumpLockoutRef.current = 0.18;
            const jumpVelocity = Math.max(jumpVel, jumpSpeed / 100) * 0.7;
            characterBody.setLinvel(
                {
                    x: currentVel.x,
                    y: jumpVelocity,
                    z: currentVel.z,
                },
                true
            );
            if (animated && jumpAnimation && !hasDied && !isRecovering) {
                playAnimationCommand("Jump", jumpAnimation);
            }

        }
        const velocity = characterBody.linvel();
        if (velocity.y > 8) {
            characterBody.setLinvel({x: velocity.x, y: 8, z: velocity.z}, true);
        }
        emitAccumulatorRef.current += delta;
        const shouldEmitPlayerMove =
            emitAccumulatorRef.current >= 1 / 15 ||
            shouldStartJump;
        if (shouldEmitPlayerMove) {
            emitAccumulatorRef.current = 0;
            emitData(jumpInputActive);
        }
        // Rotate character Indicator
        if (isTurnInputActiveRef.current) {
            modelQuat.setFromEuler(modelEuler);
            characterModelIndicator.quaternion.rotateTowards(
                modelQuat,
                0.004 * TURN_RESPONSE_MULTIPLIER * speedRotMult
            );
        }

        // If autobalance is off, rotate character model itself
        if (!autoBalance && characterModelRef.current) {
            if (isCameraBasedMovement) {
                characterModelRef.current.quaternion.copy(pivot.quaternion)
            } else {
                characterModelRef.current.quaternion.copy(characterModelIndicator.quaternion)
            }
            const targetTurnGestureYaw = turnGestureDirection * TURN_GESTURE_YAW;
            const turnGestureAlpha = 1 - Math.exp(-TURN_GESTURE_SMOOTHING * Math.max(delta, 1 / 240));
            turnGestureYawRef.current = THREE.MathUtils.lerp(turnGestureYawRef.current, targetTurnGestureYaw, turnGestureAlpha);
            if (characterVisualGestureRef.current) {
                characterVisualGestureRef.current.rotation.y = turnGestureYawRef.current;
            }
        }

        /**
         *  Camera movement
         */


        /**
         * Ray casting detect if on ground
         */
        rayOrigin.addVectors(currentPos, rayOriginOffest as THREE.Vector3);


        // Perform the raycast
        rayHit = rayLength
            ? world.castRay(
                rayCast,
                rayLength,
                true,
                undefined,
                undefined,
                characterBody, // Ensure type casting is correct
                characterBody,
                excludeSensorCollider
            )
            : false;


        /**Test shape ray */


        if (rayHit && rayHit.timeOfImpact < floatingDis + rayHitForgiveness) {

            if (slopeRayHit && actualSlopeAngle < slopeMaxAngle && jumpLockoutRef.current <= 0) {
                canJump = true;
            }
        } else {
            canJump = false;
        }

        /**
         * Ray detect if on rigid body or dynamic platform, then apply the linear velocity and angular velocity to character
         */
        if (rayHit && canJump && !climb) {
            const rayHitParent = rayHit.collider.parent();
            if (rayHitParent) {
                // Getting the standing force apply point
                standingForcePoint.set(
                    rayOrigin.x,
                    rayOrigin.y - rayHit.timeOfImpact,
                    rayOrigin.z
                );
                const rayHitObjectBodyType = rayHitParent.bodyType();
                const rayHitObjectBodyMass = rayHitParent.mass();

                massRatio = characterBody.mass() / rayHitObjectBodyMass;
                // Body type 0 is rigid body, body type 1 is fixed body, body type 2 is kinematic body
                if (rayHitObjectBodyType === 0 || rayHitObjectBodyType === 2) {
                    isOnMovingObject = true;
                    // Calculate distance between character and moving object
                    distanceFromCharacterToObject
                        .copy(currentPos)
                        .sub(rayHitParent.translation() as THREE.Vector3);
                    // Moving object linear velocity
                    const movingObjectLinvel = rayHitParent.linvel() as THREE.Vector3;
                    // Moving object angular velocity
                    const movingObjectAngvel = rayHitParent.angvel() as THREE.Vector3;
                    // Combine object linear velocity and angular velocity to movingObjectVelocity
                    objectAngvelToLinvel.crossVectors(
                        movingObjectAngvel,
                        distanceFromCharacterToObject
                    );
                    movingObjectVelocity.set(
                        movingObjectLinvel.x + objectAngvelToLinvel.x,
                        movingObjectLinvel.y,
                        movingObjectLinvel.z + objectAngvelToLinvel.z
                    ).multiplyScalar(Math.min(1, 1 / massRatio));
                    // If the velocity diff is too high (> 30), ignore movingObjectVelocity
                    velocityDiff.subVectors(movingObjectVelocity, currentVel);
                    const velocityDiffLengthSq = velocityDiff.lengthSq();
                    if (velocityDiffLengthSq > 900) movingObjectVelocity.multiplyScalar(1 / Math.sqrt(velocityDiffLengthSq));

                    // Apply opposite drage force to the stading rigid body, body type 0
                    // Character moving and unmoving should provide different drag force to the platform
                    if (rayHitObjectBodyType === 0) {
                        if (
                            !forward && !backward && !leftward && !rightward &&
                            canJump &&
                            joystickDis === 0 &&
                            !isPointMoving &&
                            !gamepadKeys.forward && !gamepadKeys.backward && !gamepadKeys.leftward && !gamepadKeys.rightward
                        ) {
                            movingObjectDragForce.copy(bodyContactForce)
                                .multiplyScalar(delta)
                                .multiplyScalar(Math.min(1, 1 / massRatio)) // Scale up/down base on different masses ratio
                                .negate()
                            bodyContactForce.set(0, 0, 0);
                        } else {
                            movingObjectDragForce.copy(moveImpulse)
                                .multiplyScalar(Math.min(1, 1 / massRatio)) // Scale up/down base on different masses ratio
                                .negate();
                        }
                        rayHitParent.applyImpulseAtPoint(
                            movingObjectDragForce,
                            standingForcePoint,
                            true
                        );
                    }
                } else { // on fixed body
                    massRatio = 1;
                    isOnMovingObject = false;
                    bodyContactForce.set(0, 0, 0);
                    movingObjectVelocity.set(0, 0, 0);
                }
            }
        } else { // in the air
            massRatio = 1;
            isOnMovingObject = false;
            bodyContactForce.set(0, 0, 0);
            movingObjectVelocity.set(0, 0, 0);
        }


        /**
         * Slope ray casting detect if on slope
         */
        slopeSampleAccumulatorRef.current += delta;
        const shouldSampleSlope = slopeSampleAccumulatorRef.current >= 1 / 30 || !canJump;
        if (shouldSampleSlope) {
            slopeSampleAccumulatorRef.current = 0;
            slopeRayOriginRef.current && slopeRayOriginRef.current.getWorldPosition ? slopeRayOriginRef.current.getWorldPosition(slopeRayorigin) : false
            slopeRayorigin.y = rayOrigin.y;
            // console.log(slopeRayorigin)
            slopeRayHit = slopeRayLength ? world.castRay(
                slopeRayCast,
                slopeRayLength,
                true,
                undefined,
                undefined,
                // Still no idea
                characterBody,
                characterBody,
                // this exclude with sensor collider
                excludeSensorCollider
            ) : false;

            // Calculate slope angle
            if (slopeRayHit) {
                actualSlopeNormal = slopeRayHit.collider.castRayAndGetNormal(
                    slopeRayCast,
                    slopeRayLength,
                    false
                )?.normal;
                if (actualSlopeNormal) {
                    actualSlopeNormalVec?.set(
                        actualSlopeNormal.x,
                        actualSlopeNormal.y,
                        actualSlopeNormal.z
                    );
                    actualSlopeAngle = actualSlopeNormalVec?.angleTo(floorNormal);
                }
            }
            if (slopeRayHit && rayHit && slopeRayHit.timeOfImpact < floatingDis + 0.5) {

                if (canJump) {
                    // Round the slope angle to 2 decimal places
                    slopeAngle = Number(
                        Math.atan(
                            (rayHit.timeOfImpact - slopeRayHit.timeOfImpact) / slopeRayOriginOffest
                        ).toFixed(2)
                    );
                } else {
                    slopeAngle = 0;
                }
            } else {
                slopeAngle = 0;
            }
        } else if (!rayHit) {
            slopeAngle = 0;
        }

        /**
         * Apply floating force
         */
        // if (rayHit != null && characterRef.current) {
        //     if (canJump && rayHit.collider.parent()) {
        //         floatingForce =
        //             springK * (floatingDis - rayHit.timeOfImpact) -
        //             characterRef.current.linvel().y * dampingC;
        //         characterRef.current.applyImpulse(
        //             springDirVec.set(0, floatingForce, 0),
        //             false
        //         );
        //
        //         // Apply opposite force to standing object (gravity g in rapier is 0.11 ?_?)
        //         // characterMassForce.set(0, floatingForce > 0 ? -floatingForce : 0, 0);
        //
        //         // rayHit.collider
        //         //     .parent()
        //         //     ?.applyImpulseAtPoint(characterMassForce, standingForcePoint, true);
        //     }
        // }

        /**
         * Apply drag force if it's not moving
         */
        if (
            !forward && !backward && !leftward && !rightward &&
            canJump &&
            joystickDis === 0 &&
            !isPointMoving &&
            !gamepadKeys.forward && !gamepadKeys.backward && !gamepadKeys.leftward && !gamepadKeys.rightward &&
            characterBody
        ) {
            const idleAlpha = 1 - Math.exp(-HORIZONTAL_MOVE_DECELERATION * Math.max(delta, 1 / 240));
            // not on a moving object
            if (!isOnMovingObject) {
                horizontalMoveVelocity.lerp(idleMoveVelocity.set(0, 0, 0), idleAlpha);

                dragForce.set(
                    -currentVel.x * dragDampingC,
                    0,
                    -currentVel.z * dragDampingC
                );

                characterBody.applyImpulse(dragForce, false);
            }
            // on a moving object
            else {
                horizontalMoveVelocity.lerp(idleMoveVelocity.set(movingObjectVelocity.x, 0, movingObjectVelocity.z), idleAlpha);

                dragForce.set(
                    (movingObjectVelocity.x - currentVel.x) * dragDampingC,
                    0,
                    (movingObjectVelocity.z - currentVel.z) * dragDampingC
                );

                characterBody.applyImpulse(dragForce, true);
            }
        }

        /**
         * Detect character falling state
         */
        isFalling = (currentVel.y < 0 && !canJump)


        /**
         * Apply larger gravity when falling
         */
        if (characterBody) {

            if (currentVel.y < fallingMaxVel && characterBody.gravityScale() !== 0) {
                characterBody.setGravityScale(0, true)

            } else if (isFalling && characterBody.gravityScale() !== fallingGravityScale) {
                // characterBody.setGravityScale(fallingGravityScale, true)
                // emitData()

            } else if (!isFalling && characterBody.gravityScale() !== initialGravityScale) {
                // characterBody.setGravityScale(initialGravityScale, true)
                floatingDis = 0.5//floatingRayDebug.floatingDis;
                springK = 0.05
            }


            if (currentPos.y < floorHeight || currentPos.y < -1) {

                const initPosition = characterBody.translation()

                resetPositionVec.set(initPosition.x, 5, initPosition.z);
                characterBody.setTranslation(resetPositionVec, true);

            }
        }

        /**
         * Apply auto balance force to the character
         */
        if (autoBalance) autoBalanceCharacter();

        /**
         * Camera collision detect
         */
        // camCollision && cameraCollisionDetect(delta);

        /**
         * Point to move feature
         */
        isModePointToMove && pointToMove(delta, slopeAngle, movingObjectVelocity)

        /**
         * Apply all the animations
         */


        if (animated) {

            if (climbing && climbAnimation) {

                playAnimationCommand("Climb", climbAnimation)
                return;
            }

            if (curAnimation === "Jump" && jumpAnimation && !hasDied && !isRecovering) {
                playAnimationCommand("Jump", jumpAnimation);
                return;
            }

            if (!forward && !backward && !leftward && !rightward && !jump &&
                !button1Pressed && (joystickDis === 0 || joystickTurnOnly) &&
                !isPointMoving &&
                !gamepadKeys.forward   &&
                canJump &&
                idleAnimation && !hasDied && !isRecovering
            ) {
                playAnimationCommand("Idle", idleAnimation);
            } else if (recover && isRecovering) {

                playAnimationCommand("Recover", recover)
            } else if ((jump || button1Pressed) && !canJump && jumpAnimation && !hasDied && !isRecovering) {
                playAnimationCommand("Jump", jumpAnimation);
            } else if (canJump &&
                (
                    forward  ||
                    // backward||
                    // leftward||
                    // rightward||

                    (joystickDis > 0.05 && !joystickTurnOnly)  ||
                     isPointMoving ||

                    gamepadKeys.forward
                ) && walkAnimation && !hasDied && !isRecovering) {

                (run || runState) && runAnimation
                    ? playAnimationCommand("Run", runAnimation)
                    : playAnimationCommand("Walk", walkAnimation);
            } else if (hasDied && fail && !isRecovering) {
                playAnimationCommand("Fail", fail)
            }


        }
    });

    useEffect(() => {
        if (hasDied && timeout) {
            timeout()
        }
    }, [hasDied]);

    const reset = () => {

        characterRef.current?.setTranslation(center, true);
    }


    useEffect(() => {
        ready()
        // Subscribe to interface phase changes
        const unsubscribeReset = useInterface.subscribe(
            (state) => state.phase,
            (value) => {
                if (value === 'ready' && !hasDied) {
                    reset();
                }
            }
        );

        // Ensure required dependencies exist
        if (!subscribeKeys || !getJoystickValues) {
            return () => {
                unsubscribeReset(); // Clean up if dependencies are missing
            };
        }

        // Check initial joystick values
        const {joystickDis, joystickAng, runState, button1Pressed} = getJoystickValues();
        if (joystickDis || joystickAng || runState || button1Pressed) {

            start();
        }

        // Subscribe to keyboard events
        const unsubscribeKeys = subscribeKeys(() => {
            start();

        });

        // Cleanup subscriptions on unmount
        return () => {
            unsubscribeReset();
            unsubscribeKeys();
        };
    }, [getJoystickValues, subscribeKeys]); // Add dependencies here

if(!firstPerson && !character) return null
    // @ts-ignore
    return (

        <RigidBody
            colliders={false}
            ref={characterRef}
            key={userData.fullname}
            friction={props.friction || -0.5}
            onContactForce={(e: any) => bodyContactForce.set(e.totalForce.x, e.totalForce.y, e.totalForce.z)}
            onCollisionExit={handleOnCharacterIntersectionExit}
            onCollisionEnter={handleOnCharacterIntersectionEnter}
            userData={{canJump: false, name: 'avatar'}}
            position={[center?.x, center?.y, center?.z]}
            {...props}
        >
            <PlayerLabel
                key={clientId}
                characterRef={characterRef}
                userName={userData.fullname}
                playerSpeed={playerSpeed}
                noOfLivesRemaining={noOfLivesRemaining}
                angle={modelEuler.y}
                isLocal={true}
                remotePosition={center}
            />
            {/*<Trail*/}
            {/*    width={0.5}*/}
            {/*    color={'red'}*/}
            {/*    length={0.7}*/}
            {/*    decay={0.9}*/}
            {/*    attenuation={(width) => width}*/}
            {/*>*/}
            <CapsuleCollider
                name="character-capsule-collider"
                args={[capsuleHalfHeight, capsuleRadius]}
                // Example userData
            />


            <group ref={characterModelRef} userData={{camExcludeCollision: true}}>
                <mesh
                    position={[
                        rayOriginOffest.x,
                        rayOriginOffest.y,
                        rayOriginOffest.z + slopeRayOriginOffest,
                    ]}
                    ref={slopeRayOriginRef}
                    visible={showSlopeRayOrigin}
                    userData={{camExcludeCollision: true}}
                >
                    <boxGeometry args={[0.15, 0.15, 0.15]}/>
                </mesh>
                <group ref={characterVisualGestureRef}>
                    {children}
                </group>
            </group>
            {/*</Trail>*/}
        </RigidBody>

    );
})

export default Ecctrl

export interface EcctrlProps extends RigidBodyProps {
    children?: ReactNode;
    debug?: boolean;
    capsuleHalfHeight?: number;
    capsuleRadius?: number;
    floatHeight?: number;
    characterInitDir?: number;
    followLight?: boolean;
    disableFollowCam?: boolean;
    disableFollowCamPos?: { x: number, y: number, z: number };
    disableFollowCamTarget?: { x: number, y: number, z: number };
    // Follow camera setups
    camInitDis?: number;
    camMaxDis?: number;
    camMinDis?: number;
    camInitDir?: { x: number, y: number, z: number };
    camTargetPos?: { x: number, y: number, z: number };
    camMoveSpeed?: number;
    camZoomSpeed?: number;
    camCollision?: boolean;
    camCollisionOffset?: number;
    // Follow light setups
    followLightPos?: { x: number, y: number, z: number };
    // Base control setups
    maxVelLimit?: number;
    turnVelMultiplier?: number;
    turnSpeed?: number;
    speedRot?: number;
    sprintMult?: number;
    jumpVel?: number;
    jumpForceToGroundMult?: number;
    slopJumpMult?: number;
    sprintJumpMult?: number;
    airDragMultiplier?: number;
    dragDampingC?: number;
    accDeltaTime?: number;
    rejectVelMult?: number;
    moveImpulsePointY?: number;
    camFollowMult?: number;
    fallingGravityScale?: number;
    fallingMaxVel?: number;
    wakeUpDelay?: number;
    // Floating Ray setups
    rayOriginOffest?: { x: number; y: number; z: number };
    rayHitForgiveness?: number;
    rayLength?: number;
    rayDir?: { x: number; y: number; z: number };
    floatingDis?: number;
    springK?: number;
    dampingC?: number;
    // Slope Ray setups
    showSlopeRayOrigin?: boolean;
    slopeMaxAngle?: number;
    slopeRayOriginOffest?: number;
    slopeRayLength?: number;
    slopeRayDir?: { x: number; y: number; z: number };
    slopeUpExtraForce?: number;
    slopeDownExtraForce?: number;
    // Head Ray setups
    showHeadRayOrigin?: boolean;
    headRayOriginOffest?: number;
    headRayLength?: number;
    headRayDir?: { x: number; y: number; z: number };
    // AutoBalance Force setups
    autoBalance?: boolean;
    autoBalanceSpringK?: number;
    autoBalanceDampingC?: number;
    autoBalanceSpringOnY?: number;
    autoBalanceDampingOnY?: number;
    client?: string;
    orbitControls?: any
    // Animation temporary setups
    animated?: boolean;
    // Mode setups
    mode?: string;
    // Controller setups
    controllerKeys?: {
        forward?: number,
        backward?: number,
        leftward?: number,
        rightward?: number,
        jump?: number,
        action1?: number,
        action2?: number,
        action3?: number,
        action4?: number
    }
    // Other rigibody props from parent
    props?: RigidBodyProps;
};

export interface userDataType {
    canJump?: boolean
}
