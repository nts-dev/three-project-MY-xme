import { useRapier, RigidBody, CapsuleCollider, CuboidCollider } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useMemo, useCallback, memo, useState } from 'react';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import useGame from '../../../../hooks/useGame';
import { useJoystickControls } from '../../../../hooks/useJoystickControls';
import { useGame1 } from '../../../../hooks/useGame1';
import { emitSocketEvent } from '../../../../socket';

import useInterface from "../../../../hooks/stores/useInterface.jsx";
import useGrounded from "./useGrounded.jsx";
import OrbitingShape from "./OrbitingShape.jsx";

import {
    horizontalSpeed,
    realTimeChaPosition,
    enPc,
} from "./Constants.jsx";
import Status from "./Status.jsx";

// Jump constants (tweak these)
const BASE_JUMP_HEIGHT = 0.04;          // meters — main tuning value
const RUN_JUMP_MULTIPLIER = 1;      // ~45% higher when running
const MOBILE_JUMP_BOOST = 5;        // slight mobile compensation
const FORWARD_BOOST_SPEED = 1.1;
const JUMP_BOOST_SPEED = 5;          // horizontal boost m/s
const BOOST_DURATION_MS = 480;         // how long boost is applied
const GRAVITY = 19.62;
const MIN_SCENE_CAMERA_NEAR = 0.05;

const CharacterController = ({ orbitControlsRef, characterModel, clientId }) => {
    // const {clientId, dateTime} = client ? JSON.parse(client) : {clientId: 'custom_person', dateTime: 'now'};
    const [subscribeKeys, getKeys] = useKeyboardControls();
    const bodyRef = useRef();
    const keys = getKeys()
    const { rapier, world } = useRapier();
    const walkTime = useRef(0);
    const isActuallyMoving = useRef(false);
    const rotationInProgress = useRef(false);
    const searchCenter = useGame((state) => state.searchCenter);
    const currentVelocity = useRef(new THREE.Vector3());
    const character = useGame((state) => state.firstPerson);
    const setCharacter = useGame((state) => state.setCharacter);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const firstPerson = useGame((state) => state.character);
    const buttonMode = useGame((state) => state.buttonMode);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const getJoystickValues = useJoystickControls((state) => state.getJoystickValues);
    const curButton2Pressed = useJoystickControls((state) => state.curButton2Pressed)
    const idleAnimation = useGame1((state) => state.idle);
    const jumpAnimation = useGame1((state) => state.jump);
    const runAnimation = useGame1((state) => state.run);
    const walkAnimation = useGame1((state) => state.walk);
    const leftAnimation = useGame1((state) => state.left);
    const rightAnimation = useGame1((state) => state.right);
    const climbAnimation = useGame1((state) => state.climb);
    const push = useGame1((state) => state.push);

    // const jumpDown = useGame1((state) => state.jumpDown);
    const recover = useGame1((state) => state.recover);

    const restart = useGame((state) => state.restart);
    const projectID = useGame((state) => state.projectID);
    const curAnimation = useGame1((state) => state.curAnimation);
    const uName = useGame((state) => state.uName);
    const uColor = useGame((state) => state.uColor);
    const stateMovingSpeed = useGame((state) => state.movingSpeed);
    const movingSpeed = useRef(stateMovingSpeed);
    const isMobile = useGame((state) => state.isMobile);
    const setShowInventory = useGame((state) => state.setShowInventory);
    const setHasDied = useGame((state) => state.setHasDied);
    const hasDied = useGame((state) => state.hasDied);
    const removedObject = useRef({});
    const fail = useGame1((state) => state.fail);
    const nearLadder = useRef(false);
    const isJumping = useRef(false);
    const cameraRef = useGame((state) => state.cameraRef);

    const setHitPoint = useGame((state) => state.setHitPoint);
    const setGameCharacterRef = useGame((state) => state.setGameCharacterRef);
    const atTop = useGame((s) => s.atTop);
    const screenFactor = useMemo(() => {
        if (isMobile) {
            return Math.min(window.innerWidth, window.innerHeight)
        }
        return Math.max(900, Math.min(window.innerWidth, window.innerHeight))
    }, [isMobile]);
    const turningSpeed = useRef(0.05);
    const isOnRamp = useRef(1);
    const cameraY = useRef(0);
    const velocityY = useRef(0);
    const movingOnTile = useRef(false);
    const setTerminalMessage = useGame((state) => state.setTerminalMessage);
    const noOfLivesRemaining = useGame((state) => state.noOfLivesRemaining);

    const setNoOfLivesRemaining = useGame((state) => state.setNoOfLivesRemaining);
    const pauseGame = useGame((state) => state.pauseGame);
    const distanceCount = useGame((state) => state.distanceCount);
    const setDistanceCount = useGame((state) => state.setDistanceCount);
    const invisible = useGame((state) => state.invisible);
    const setConfirmationObj = useGame((state) => state.setConfirmationObj);
    const setRestart = useGame((state) => state.setRestart);
    const avatarColor = useGame((state) => state.avatarColor);
    const setHp = useGame((state) => state.setHp);
    const hp = useGame((state) => state.hp);
    const tokenCode = useGame((state) => state.tokenCode);
    const speedFactor = useGame((state) => state.speedFactor);
    const setHeadHit = useGame((state) => state.setHeadHit);

    const wasJumpPressed = useRef(false);
    const peakY = useRef(0);
    const zOffset = useRef(0);
    const collidedInstance = useRef(null);
    const climbingRamp = useRef(false);

    const start = useInterface((state) => state.start)
    const ready = useInterface((state) => state.ready)
    const isClimbing = useGame((s) => s.isClimbing);
    const setHasJumped = useGame((s) => s.setHasJumped);
    const isMobileTurning = useRef(false)
    const { isOnGround } = useGrounded(bodyRef, characterModel, 0, 0.05);
    const desiredPosition = useRef(new THREE.Vector3());
    const offset = useRef(new THREE.Vector3());
    const wDir = useRef(new THREE.Vector3());
    const targetVelocity = useRef(new THREE.Vector3());
    const moveDir = useRef(new THREE.Vector3());
    const moveQuart = useRef(new THREE.Vector3());
    const yawDir = useRef(new THREE.Vector3(0, 1, 0))
    const cameraRay = useRef(new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }));
    const accelFactor = useRef(0); // 0 → 1 buildup over time
    const accelDuration = 1.2; // seconds to reach full speed
    const colliderName = useRef('')
    const climbing = useRef(false)
    const isJoyStickController = useRef(false)
    const previousPosition = useRef(new THREE.Vector3()); // Store previous position
    const accumulatedDistance = useRef(0); // Track accumulated distance
    const gravityTimer = useRef(null);

    const climbingPrev = useRef(false);
    const gravityOff = useRef(false);
    const gravityScaleRef = useRef(1);
    const climbVel = new THREE.Vector3(); // reused vector
    const fadeStartTime = useRef(0); // when gravity fade starts
    const isTurningRight = useRef(false); // when gravity fade starts
    const isTurningLeft = useRef(false); // when gravity fade starts
    const jumpEmitTimer = useRef(0);
    const requiredJumpVelocityRef = useRef(0);
    const jumpInProgress = useRef(false);
    const fadeDuration = 1000; // ms (1 second fade)

    // ---- temps / caches (no per-frame allocations)
    const vTmp1 = useRef(new THREE.Vector3()).current;
    const vTmp2 = useRef(new THREE.Vector3()).current;
    const vTmp3 = useRef(new THREE.Vector3()).current;
    const forwardTmp = useRef(new THREE.Vector3()).current;
    const ladderPosTmp = useRef(new THREE.Vector3()).current;
    const charPosTmp = useRef(new THREE.Vector3()).current;
    const qTmp = useRef(new THREE.Quaternion()).current;
    const wTmp = useRef(new THREE.Quaternion()).current;
    const jumpRequest = useRef(false);                        // small hysteresis to avoid flickering
    const isInStrafeMode = useRef(false);
    const totalAngle = useRef(0);
    const lDir = useRef(new THREE.Vector3())
    const [isStrife, setIsStrife] = useState(false)
    const { joystickDis, joystickAng, runState, button1Pressed } = getJoystickValues();
   const setSoundName = useGame((state) => state.setSoundName);
    // ---- timers / accumulators
    const emitAcc = useRef(0);      // networking throttle
    const rayAcc = useRef(0);      // raycast throttle
    const animAcc = useRef(0);      // animation throttle
    const isMovingOnMobile = useRef(false);      // animation throttle
    // ---- cached results
    const cachedRayHit = useRef(null);
    const isPushing = useRef(false);


    // ---- tunables (Hz)
    const NET_HZ = 15;        // emitData max rate
    const RAY_HZ = 20;        // raycasts max rate

 

    const vectorFromAngle = useCallback((deg) => {
        const rad = THREE.MathUtils.degToRad(deg);
        return new THREE.Vector3(Math.sin(rad), 0, Math.cos(rad)).normalize();
    }, []);

    const getCameraAngle = useCallback((camera) => {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();
        return THREE.MathUtils.radToDeg(Math.atan2(direction.x, direction.z));
    }, []);

    const getJoystickDirection = (angleRad) => {
        const angleDeg = THREE.MathUtils.radToDeg(angleRad);
        if (angleDeg >= 135 && angleDeg <= 225) return 'left';
        if (angleDeg <= 45 || angleDeg >= 315) return 'right';
        if (angleDeg > 45 && angleDeg < 135) return 'forward';
        if (angleDeg > 225 && angleDeg < 315) return 'backward';
        return null;
    };

    const handleKeyboardInput = useCallback(
        (moveDir, camDir) => {
            const keys = getKeys();
            if (!keys) return null;
            isJoyStickController.current = false;

            // Handle movement direction
            if (keys.forward || (keys.forward && keys.leftward) || (keys.forward && keys.rightward)) {
                moveDir.add(camDir);


                // isMobileTurning.current = false
            }
            if (keys.backward && !(keys.forward || keys.backward)) {
                // isMobileTurning.current = false

                moveDir.sub(camDir);

            }
            // Animation for left/right
            if (keys.leftward && !(keys.forward || keys.backward)) {
                // isMobileTurning.current = true
                isTurningLeft.current = true
                isTurningRight.current = false



            } else {
                isTurningLeft.current = false

            }
            if (keys.rightward && !(keys.forward || keys.backward)) {
                // isMobileTurning.current = true

                isTurningRight.current = true
                isTurningLeft.current = false
            } else {
                isTurningRight.current = false

            }

            // Return rotation input only for left/right
            if ((keys.leftward || keys.rightward) && !(keys.forward || keys.backward)) {

                return keys.leftward ? 90 : -90
            }
            if ((keys.forward && keys.leftward)) {
                //  const rotationAngle = keys.leftward ? 90 : -90;
                return 45
            }
            if ((keys.forward && keys.rightward)) {
                return -45
            }
            // return (keys.leftward || keys.rightward) &&  !(keys.forward || keys.backward) ? { left: keys.leftward, right: keys.rightward } : null;
        },
        [getKeys, character, firstPerson]
    );

    const handleJoyStick = useCallback(
        (moveDir, camDir) => {
            const { joystickDis, joystickAng } = getJoystickValues();
            if (joystickDis > 0.1) {
                const adjustedAngle = (joystickAng + 2 * Math.PI) % (2 * Math.PI);

                isJoyStickController.current = true
                // Determine direction
                const direction = getJoystickDirection(adjustedAngle);

                if (direction === 'backward') {
                    zOffset.current = (character ? 0.1 : 0.4) / (screenFactor / 600);
                    turningSpeed.current = 0.01;
                    moveDir.sub(camDir)
                    isMobileTurning.current = false
                    isMovingOnMobile.current = true

                }

                if (direction === 'forward') {
                    turningSpeed.current = 1;
                    zOffset.current = (character ? 0.1 : 0.4) / (screenFactor / (600 * -1));
                    moveDir.add(camDir)
                    isMobileTurning.current = false
                    isMovingOnMobile.current = true

                }

                if (direction === 'left' || direction === 'right') {
                    turningSpeed.current = 0.01;
                    isMobileTurning.current = true
                    isMovingOnMobile.current = false
                }
                if (direction === 'left') {
                    isTurningLeft.current = true
                    isTurningRight.current = false
                } else {
                    isTurningLeft.current = false

                }
                if (direction === 'right') {
                    isTurningRight.current = true
                    isTurningLeft.current = false
                } else {
                    isTurningRight.current = false
                }

                return direction === 'left' ? 90 : -90;


            }
            else {

                isMovingOnMobile.current = false
            }


        },
        [getJoystickValues, character, screenFactor]
    );


    const emitData = useCallback(
        (angle, jump, quaternion, removedObject = null) => {
            if ((!firstPerson && !character) || clientId === 'offline') return;
            const position = bodyRef.current.translation();
            const player = {
                mType: 'player',
                projectID,
                clientId,
                position,
                currentAnimation: curAnimation,
                angle: angle ? THREE.MathUtils.radToDeg(angle) : undefined,
                prevAnimation: 'Idle 1',
                direction: angle,
                quaternion,
                speed: 1,
                dateTime: '',
                userName: uName,
                personColor: '',
                noOfLivesRemaining,
                jump,
                removedObject,
                movingSpeed: movingSpeed.current,
                hpPct: hp,
                enPct: enPc.current,
                invisible,
                uColor,
                avatarColor,
                tokenCode: tokenCode.codeValue
            };
            emitSocketEvent('playerMove', player, { volatile: true });

        },
        [projectID, curAnimation, clientId, uName, noOfLivesRemaining, firstPerson, character, invisible, avatarColor, tokenCode]
    );

    useEffect(() => {
        if (buttonMode === 'Play mode') setCharacter(true);
        else {
            setCharacter(false);
            setFirstPerson(false);
        }
    }, [buttonMode, setCharacter, setFirstPerson]);

    useEffect(() => {
        if (hasDied) {
            const obj = {
                visible: true,
                message: 'Do you want to continue',
                response: restart,
                setResponse: setRestart
            }
            setConfirmationObj(obj)

            setNoOfLivesRemaining(noOfLivesRemaining - 1)
            fail();

            // zOffset.current  = (character ? 0.1 : 0.3) / (screenFactor / 600 * -1);
            setTimeout(() => {
                setCharacter(false);
                setFirstPerson(false);
            }, 1000)
            setTerminalMessage({ command: "", message: "You died" });
        } else {
            recover();
            setTerminalMessage({ command: "", message: "You Recovered" });
        }
    }, [hasDied]);

    useEffect(() => {
        const camera = cameraRef.current;
        if (!camera) return;

        if ((character || firstPerson)) {
            camera.near = MIN_SCENE_CAMERA_NEAR;
            camera.updateProjectionMatrix();
            setButtonMode('Play mode');
            setShowInventory(true);
            setGameCharacterRef(bodyRef.current);
            setTerminalMessage({ command: "", message: "Switched to Play mode" });


        } else {
            setTerminalMessage({ command: "", message: "Switched to free camera mode" });
        }
    }, [character, firstPerson, cameraRef, setButtonMode, setShowInventory, setGameCharacterRef]);

    useEffect(() => {
        if (!bodyRef.current || noOfLivesRemaining === 0) return;
        const position = bodyRef.current.translation();

        if (hasDied) {
            setCharacter(true)

            bodyRef.current.setTranslation({ x: position.x, y: position.y + 0.1, z: position.z }, true);
        } else {

            setTimeout(() => {

                const euler = new THREE.Euler(0, Math.PI, 0, "XYZ"); // 180° on Y
                const quat = new THREE.Quaternion().setFromEuler(euler);
                characterModel.quaternion.copy(quat);
                if (!isNaN(projectID)) {
                    projectID === 150 ? bodyRef.current.setTranslation({ x: 6.2, y: 7.3, z: 6.8 }, true) : null

                } else if (searchCenter) {

                    bodyRef.current.setTranslation({ x: searchCenter.x, y: 0.12, z: searchCenter.z }, true)
                }

            }, 1000);
        }
        setNoOfLivesRemaining(3)
        setHp(100);
        setHasDied(false);
        enPc.current = 100;

    }, [restart, projectID, searchCenter]);



    useEffect(() => {
        zOffset.current = (character ? 0.1 : 0.4) / (screenFactor / 600 * -1);

        const { joystickDis, joystickAng, runState, button1Pressed } = getJoystickValues();
        if (joystickDis || joystickAng || runState || button1Pressed) {

            start();
        }

        movingSpeed.current = curButton2Pressed && enPc.current > 0 ? 0.018 : 0.006;

        let unsubscribeKeys = null

        if (subscribeKeys) {

            unsubscribeKeys = subscribeKeys(() => {
                start();
                const { run, backward, forward, leftward, rightward } = getKeys();

                movingSpeed.current = run && enPc.current > 0 ? 0.018 : 0.006;

                if (backward) {
                    zOffset.current = (character ? 0.1 : 0.4) / (screenFactor / 600);
                    turningSpeed.current = 0.01;
                    movingSpeed.current = movingSpeed.current * 0.5
                }
                if (forward || (forward && leftward) || (forward && rightward)) {
                    turningSpeed.current = 1;
                    zOffset.current = (character ? 0.1 : 0.4) / (screenFactor / 600 * -1);
                }
                if (leftward || rightward) {
                    turningSpeed.current = 0.01;
                }
            });
        }
        ready()

        movingSpeed.current = movingSpeed.current * speedFactor


        // Cleanup subscriptions on unmount
        return () => {

            if (unsubscribeKeys) {
                unsubscribeKeys()
            }


        };

    }, [subscribeKeys, speedFactor, curButton2Pressed]);




    useEffect(() => {
        if (!characterModel || !(firstPerson || character)) return;
        const quaternion = characterModel.quaternion.clone();
        const keys = getKeys();

        emitData(null, keys.jump, quaternion, removedObject.current);
    }, [curAnimation, characterModel, emitData, getKeys, firstPerson, character, avatarColor, tokenCode]);


    const calcFallDamagePct = (u) => {
        // 1–3u → 0%
        return Math.min(100, 10 + 5 * (u - 0.4));        // 4u → 10%, 5u → 15%, ...
        // If you prefer discrete steps per full unit:
        // return Math.min(100, 10 + 5 * Math.floor(u - 4));
    };

    useEffect(() => {
        if (isStrife) {
            qTmp.setFromAxisAngle(yawDir.current, THREE.MathUtils.degToRad(totalAngle.current));
            wTmp.copy(qTmp)
        }


    }, [isStrife])

    // Pre-calculate jump velocity once (when constants change)
    useEffect(() => {

        const unsubscribe = subscribeKeys?.((keys) => {
            let height = BASE_JUMP_HEIGHT;
            requiredJumpVelocityRef.current = Math.sqrt(2 * GRAVITY * height);
        });

        //   // Initial calculation
        const initialKeys = getKeys();
        let height = BASE_JUMP_HEIGHT;
        requiredJumpVelocityRef.current = Math.sqrt(2 * GRAVITY * height);

        return () => {
            unsubscribe?.();
        };
    }, [subscribeKeys, isMobile, getKeys]);

   useFrame((_, delta) => {    // early outs
    const camera = cameraRef.current;
    const rb = bodyRef.current;
    const oc = orbitControlsRef.current;
    const isActive =
        rb &&
        getKeys &&
        camera &&
        buttonMode === 'Play mode' &&
        !pauseGame &&
        (firstPerson || character || oc);
    if (!isActive) return;
    const tr = rb.translation();
    const lv = rb.linvel();
    const cm = characterModel; // alias

    if (!isStrife) {
        lDir.current = camera.getWorldDirection(wDir.current);
    }
    const dt = Math.min(delta, 0.0167)
    walkTime.current += dt;

    // throttle accumulators
    emitAcc.current += dt;
    rayAcc.current += dt;
    animAcc.current += dt;

    // read inputs once
    const keys = getKeys();
    const { button1Pressed, joystickDis, joystickAng } = getJoystickValues();
    // update real-time pos once
    realTimeChaPosition.set(tr.x, tr.y, tr.z);

    // jump emit window (max 2s)
    if (jumpEmitTimer.current > 0) {
        jumpEmitTimer.current -= dt;
        if (jumpEmitTimer.current > 0 && emitAcc.current >= 1 / NET_HZ && cm) {
            emitAcc.current = 0;
            emitData(null, true, cm.quaternion);
        }
    } else {
        jumpEmitTimer.current = 0;
    }

    // keep above ground
    if (projectID === 148 && tr.y < -0.1) {
        rb.setTranslation({ x: tr.x, y: 0.1, z: tr.z }, true)
    }
    else if (projectID === 150 && tr.y < 6.5) {
        rb.setTranslation({ x: 6.2, y: 7.28, z: 6.8 }, true);
    }

    // grounded & peak tracking
    const isGrounded = isOnGround.current;
    const currentY = tr.y;
    const verticalVelocity = lv.y;

    if (verticalVelocity >= 0 || isGrounded) {
        peakY.current = Math.max(peakY.current, currentY);
    }

    // fall damage (edge when landing)
    const fallDistance = peakY.current - currentY;

    if (isGrounded && fallDistance > 0.39 && !hasDied) {
        const u = Math.ceil(fallDistance);
        const dmg = calcFallDamagePct(u);
        setHp(Math.max(0, hp - dmg));
        setHasDied(true);
    }
    if (isGrounded) peakY.current = currentY;

    // movement dir from inputs (no allocs)
    const angle = getCameraAngle(camera);
    const camDirection = vectorFromAngle(angle); // returns a Vector3 you manage — ensure it reuses memory internally
    moveDir.current.set(0, 0, 0);
    const rotationAngle = handleKeyboardInput(moveDir.current, camDirection) || handleJoyStick(moveDir.current, camDirection);
    isInStrafeMode.current = Math.abs(rotationAngle) === 45 ? true : false
    // if (isInStrafeMode.current && !isStrife) {
    //     setIsStrife(true)
    // }
    // else if (!isInStrafeMode.current && isStrife) {

    setIsStrife(false)
    // }
    if (!hasDied && cm) {

        totalAngle.current = angle + rotationAngle;

        if (rotationAngle) {
            if (!isInStrafeMode.current) {
                qTmp.setFromAxisAngle(yawDir.current, THREE.MathUtils.degToRad(totalAngle.current));
                wTmp.slerp(qTmp, turningSpeed.current)
            }
            cm.quaternion.copy(wTmp)
        }
        // Throttled emit (unchanged)
        if (emitAcc.current >= 1 / NET_HZ) {
            emitAcc.current = 0;
            emitData(null, keys.jump || button1Pressed, cm.quaternion);
        }
    }
    // distance accumulator (no new vectors)
    vTmp1.set(tr.x, tr.y, tr.z);
    const distThis = vTmp1.distanceTo(previousPosition.current);
    accumulatedDistance.current += distThis;
    previousPosition.current.copy(vTmp1);

    // increment distanceCount per 2m using functional set
    while (accumulatedDistance.current >= 2) {
        setDistanceCount((distanceCount + 1));
        accumulatedDistance.current -= 2;
    }

    // horizontal velocity control
    const wantMove = !climbing.current && moveDir.current.lengthSq() > 0;
    if (wantMove) {
        moveDir.current.normalize();
        // accel
        accelFactor.current = Math.min(accelFactor.current + (dt / accelDuration), 1);
        const baseVelocity =
            movingSpeed.current * 30 * (screenFactor / 600) * isOnRamp.current * (isJoyStickController.current ? 2 : 1);
        const velPS = baseVelocity * accelFactor.current;
        targetVelocity.current.set(moveDir.current.x * velPS, lv.y, moveDir.current.z * velPS);

        // dt-independent exponential smoothing
        const smoothing = 1 - Math.exp(-5 * dt);
        currentVelocity.current.lerp(targetVelocity.current, smoothing);

        rb.setLinvel(currentVelocity.current, true);

        if (emitAcc.current >= 1 / NET_HZ && cm) {
            emitAcc.current = 0;
            emitData(null, keys.jump, cm.quaternion);
        }
    } else if (!hasDied && !keys.leftward && !keys.rightward && joystickDis === 0 && joystickAng === 0 && !climbing.current) {
        // decel
        accelFactor.current = Math.max(accelFactor.current - (dt / accelDuration), 0);
        moveQuart.current.set(0, lv.y, 0);
        currentVelocity.current.lerp(moveQuart.current, 5 * dt);
        rb.setLinvel(currentVelocity.current, true);
        rotationInProgress.current = false;
    }

    const vx = currentVelocity.current.x;
    const vz = currentVelocity.current.z;
    horizontalSpeed.current = Math.sqrt(vx * vx + vz * vz);
    const jumpFactor = keys.run ? 4 : curButton2Pressed ? 5.2 : 1;
    const isMobileFactor = isMobile ? jumpFactor * 1.05 : jumpFactor * 1
    // jumping (edge)
    const desiredJumpHeight = 0.008 * jumpFactor * isMobileFactor
    const gravityStrength = 9.81;
    // Jump input logic
    const isJumpPressed = (keys.jump || button1Pressed) && !keys.leftward && !keys.rightward;
    const justPressedJump = isJumpPressed && !wasJumpPressed.current;

    if (justPressedJump && isGrounded && !hasDied) {
        setHasJumped(true);
   
        // 1. Preserve current horizontal velocity (important!)
        const currentVel = rb.linvel();

        // 2. Reset only vertical velocity (prevents collision adding height)
        rb.setLinvel({ x: currentVel.x, y: 0, z: currentVel.z }, true);

        requiredJumpVelocityRef.current = (keys.run || curButton2Pressed) ? requiredJumpVelocityRef.current*=2 : requiredJumpVelocityRef.current
        // 3. Apply fixed upward velocity
        rb.setLinvel(
            {
                x: currentVel.x,
                y: requiredJumpVelocityRef.current,
                z: currentVel.z,
            },
            true
        );

        // 4. Temporarily disable gravity (gives floaty apex)
        rb.setGravityScale(0);

        // 5. Calculate small forward boost in facing direction
        let boost = FORWARD_BOOST_SPEED;

        // Reduce boost if pressing left/right (less forward curve when strafing)
        if (keys.leftward || keys.rightward) {
            boost *= SIDE_BOOST_REDUCTION;
        }

        // Get forward direction from character model
        let fx = 0, fz = -boost;
        if (cm) {
            const q = cm.quaternion;
            fx = 2 * (q.x * q.z + q.w * q.y);
            fz = 1 - 2 * (q.x * q.x + q.y * q.y);
            const len = Math.hypot(fx, fz) || 1;
            fx = (fx / len) * boost;
            fz = (fz / len) * boost;
        }

        // 6. Apply short forward boost burst
        setTimeout(() => {
            if (!cm) return;
             
            const velNow = rb.linvel();
            rb.setLinvel(
                {
                    x: velNow.x + fx,
                    y: velNow.y,           // never touch y again!
                    z: velNow.z + fz,
                },
                true
            );

            // Restore gravity
            rb.setGravityScale(1);
        }, BOOST_DURATION_MS);

        // Network & timer
        jumpEmitTimer.current = 1.0;
        if (cm) emitData(null, true, cm.quaternion);
        jumpRequest.current = true;
    }

    isJumping.current = jumpEmitTimer.current > 0.3;
    wasJumpPressed.current = isJumpPressed;
    // ladder facing dot (only when needed)
    let facingDot = 0;
    if (collidedInstance.current) {
        forwardTmp.set(0, 0, 1).applyQuaternion(cm.quaternion).normalize();
        collidedInstance.current.getWorldPosition(ladderPosTmp);
        charPosTmp.set(tr.x, tr.y, tr.z);
        vTmp2.copy(ladderPosTmp).sub(charPosTmp).normalize();
        facingDot = forwardTmp.dot(vTmp2);
    }

    // climbing logic (unchanged but lighter)
    const isClimbingNow = nearLadder.current && (keys.forward || joystickDis > 0);
    if (isClimbingNow && facingDot > 0.5) {
        climbing.current = true;
        if (!gravityOff.current) {
            rb.setGravityScale(0);
            gravityOff.current = true;
            gravityScaleRef.current = 0;
        }
        climbVel.set(0, currentVelocity.current.y + 0.1, 0);
        rb.setLinvel(climbVel, true);

        if (emitAcc.current >= 1 / NET_HZ && cm) {
            emitAcc.current = 0;
            emitData(null, keys.jump || button1Pressed, cm.quaternion);
        }
        if (gravityTimer.current) {
            clearTimeout(gravityTimer.current);
            gravityTimer.current = null;
        }
    } else if (climbingPrev.current && !isClimbingNow) {
        climbing.current = false;
        if (!gravityTimer.current) {
            gravityTimer.current = setTimeout(() => {
                if (!climbing.current && gravityOff.current) {
                    fadeStartTime.current = performance.now();
                    gravityTimer.current = null;
                }
            }, 50);
        }
    }

    // smooth gravity fade (0 → 1)
    if (gravityOff.current && !climbing.current && fadeStartTime.current && !jumpInProgress.current) {
        const elapsed = performance.now() - fadeStartTime.current;
        const t = Math.min(elapsed / fadeDuration, 1);
        const newScale = THREE.MathUtils.lerp(0, 1, t);
        if (Math.abs(newScale - gravityScaleRef.current) > 0.01) {
            gravityScaleRef.current = newScale;
            rb.setGravityScale(newScale);
        }
        if (t >= 1) {
            gravityOff.current = false;
            fadeStartTime.current = 0;
        }
    }
    climbingPrev.current = isClimbingNow;

    // CAMERA — do a single raycast at most RAY_HZ
    const yOffset = !hasDied
        ? (character ? 0.01 : 0.25) / (screenFactor / 600)
        : (character ? 0.01 : 0.1) / (screenFactor / 600);

    const climbOffset = isClimbing ? 0.08 : 0.02;

    const baseOffset = new THREE.Vector3(0, yOffset - climbOffset, zOffset.current);

    offset.current.copy(baseOffset).applyQuaternion(wTmp);

    desiredPosition.current.set(tr.x, tr.y, tr.z).add(offset.current);

    // throttle raycast
    if (rayAcc.current >= 1 / RAY_HZ) {
        rayAcc.current = 0;

        // const dir = camera.getWorldDirection(wDir.current).normalize();
        const dir = camera.getWorldDirection(wDir.current);

        cameraRay.current.origin.x = desiredPosition.current.x;
        cameraRay.current.origin.y = desiredPosition.current.y;
        cameraRay.current.origin.z = desiredPosition.current.z;
        cameraRay.current.dir.x = dir.x;
        cameraRay.current.dir.y = dir.y;
        cameraRay.current.dir.z = dir.z;
        cachedRayHit.current = world.castRay(cameraRay.current, zOffset.current * 2, true, undefined, rb);
    }
    // vertical spring
    const springStiffness = 15;
    const springDamping = 3;
    const dy = desiredPosition.current.y - cameraY.current;
    velocityY.current += (dy * springStiffness - velocityY.current * springDamping) * dt;
    cameraY.current += velocityY.current * dt;

    // final camera position

    vTmp3.y = cameraY.current - 0.03;

    if (isActuallyMoving.current) {
        vTmp3.y += Math.sin(walkTime.current * 10) * 0.005;
    }
    vTmp3.copy(desiredPosition.current);

    const lookAhead = 0.05;
    const tx = tr.x + lDir.current.x * lookAhead;
    const ty = tr.y + 0.07;
    const tz = tr.z + lDir.current.z * lookAhead;

    vTmp1.set(tx, ty, tz);

    oc.target.lerp(vTmp1, 10 * dt);

    camera.position.lerp(vTmp3, 10 * dt);
    //animation set up
    if (isPushing.current && keys.forward) {
        push();
    } else
    if (isTurningLeft.current && isGrounded) {
        leftAnimation()
    } else if (isTurningRight.current && isGrounded) {
        rightAnimation()
    } else if (climbing.current && (keys.forward || isMovingOnMobile.current)) {
        climbAnimation()
    } else if (!keys.forward && !keys.backward && !keys.leftward && !keys.rightward &&
        joystickDis === 0 && !isJumping.current &&
        isGrounded && !hasDied && currentVelocity.current.y < 0.001
    ) {
        idleAnimation();

    } else if ((justPressedJump && isJumping.current) && !hasDied) {
        jumpAnimation();

    } else if (isGrounded && !hasDied &&
        (
            keys.forward || keys.backward || isMovingOnMobile.current

        )) {

        if (movingSpeed.current > 0.006) {
            runAnimation();
        } else {
            walkAnimation();
        }
    }
    // else if (!isGrounded && !hasDied) {
    //       levitate()
    // }
    else if (hasDied) {
        fail && fail();
    }
    wasJumpPressed.current = isJumpPressed;
});




    const handleCollisionEnter = useCallback((event) => {
        const instance = event.rigidBodyObject;
        const name = instance?.parent?.name?.toLowerCase();
            

            if(name ==='game_box_pushliftblocks' && !isClimbing){
                isPushing.current = true
            }

        if (name === 'floor cube') setHitPoint(true);
        if (instance?.name.includes('Moving Tile')) movingOnTile.current = true;
        if (name?.includes('escalator') || name?.includes('ramp')) {
            climbingRamp.current = true;
            isOnRamp.current = 1.2;
        }
        colliderName.current = name;

        if (name?.includes('ladder')) {
            nearLadder.current = true;
            collidedInstance.current = instance;
        }
    }, []);

    const handleCollisionExit = useCallback((event) => {
        const instance = event.rigidBodyObject;
        const name = instance?.parent?.name?.toLowerCase();

        if(name ==='game_box_pushliftblocks'){
                isPushing.current = false
            }
        if (name === 'floor cube') setHitPoint(false);
        if (instance?.name.includes('Moving Tile')) movingOnTile.current = false;
        if (name?.includes('escalator') || name?.includes('ramp')) {
            climbingRamp.current = false;
            isOnRamp.current = 1;
        }


        if (name?.includes('ladder')) {
            nearLadder.current = false;
            collidedInstance.current = null;
        }
    }, []);


    return (
        <RigidBody
            ref={bodyRef}
            name="character"
            key={'person'}
            position={[1, 0.12, 0]}
            mass={0.5}
            type="dynamic"
            friction={1}
            restitution={0.1}
            enabledRotations={[false, false, false]}
            // onIntersectionEnter={handleIntesectionEnter}
            onCollisionEnter={handleCollisionEnter}
            onCollisionExit={handleCollisionExit}
            colliders={false}
            ccd
        >
            <CapsuleCollider args={[0.01, 0.0178]} />

            {/* Head sensor – stops lift when this hits ceiling/obstacle above */}
            <CuboidCollider
                args={[0.008, 0.004, 0.008]}
                position={[0, 0.12, 0]}
                sensor={true}
                onIntersectionEnter={(payload) => {
                    const other = payload.other.rigidBodyObject;
                    if (!other || other.name === "character" || atTop) return;
                    setHeadHit(true)

                }}

            />
            <primitive object={characterModel} position={[0, -0.026, 0]}>
                <OrbitingShape />
            </primitive>

            {/* --- Bars (Html) -------------------------------------------------- */}
            {(firstPerson || character) && <Status userName={uName} characterModel={characterModel} bodyRef={bodyRef} />}

        </RigidBody>

    );
};
export default memo(CharacterController)


