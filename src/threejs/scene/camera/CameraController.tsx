import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import useGame from "../../../hooks/useGame";
import { wheelDollyStep } from "./navigationMath.js";

const MIN_DOLLY_TARGET_DISTANCE = 1.2;
const WHEEL_DOLLY_STEP = 0.9;
const MAX_WHEEL_DOLLY_STEP = 10;
const MAX_CAMERA_DISTANCE = 80000000;
const PINCH_DOLLY_SPEED_SCALE = 0.3;
const MIN_CAMERA_Y = 0.15;
const MIN_TARGET_Y = 0;
const MAX_POLAR_ANGLE = Math.PI / 2 - 0.03;
// How quickly queued wheel/pinch zoom is applied (higher = snappier).
const DOLLY_SMOOTHING = 14;
const MIN_PENDING_DOLLY = 0.0005;

export default function CameraController(props: any) {
    const { orbitControls, gl } = props;
    const gamepadIndex = useRef<number | null>(null);
    const previousAxes = useRef([0, 0, 0, 0]); // Track previous axes for smoothing
    const pinchDistanceRef = useRef(0);
    const pinchCenterRef = useRef(new THREE.Vector2());
    const isClampingControlsRef = useRef(false);
    // Signed distance still to dolly: positive = in, negative = out.
    const pendingDollyRef = useRef(0);
    const projectId = useGame((state: any) => state.projectID);
    const scratch = useMemo(() => ({
        forward: new THREE.Vector3(),
        offset: new THREE.Vector3(),
        spherical: new THREE.Spherical(),
    }), []);

    const settings = useMemo(() => {
        return {
            zoomSpeed: 2,
            panFactor: 2,
        };
    }, [projectId]);

    const getCameraForward = (camera: THREE.Camera) => {
        const forward = scratch.forward;
        camera.getWorldDirection(forward);
        if (forward.lengthSq() === 0) {
            forward.set(0, 0, -1);
        }
        return forward.normalize();
    };

    const clampCameraToScene = () => {
        const controls = orbitControls.current;
        if (!controls || !controls.object || isClampingControlsRef.current) return;

        const camera = controls.object;
        const target = controls.target;
        let didClamp = false;

        if (target.y < MIN_TARGET_Y) {
            const lift = MIN_TARGET_Y - target.y;
            target.y += lift;
            camera.position.y += lift;
            didClamp = true;
        }

        if (camera.position.y < MIN_CAMERA_Y) {
            camera.position.y = MIN_CAMERA_Y;
            didClamp = true;
        }

        const offset = scratch.offset.copy(camera.position).sub(target);
        const spherical = scratch.spherical.setFromVector3(offset);

        if (spherical.phi > MAX_POLAR_ANGLE) {
            spherical.phi = MAX_POLAR_ANGLE;
            camera.position.copy(target).add(offset.setFromSpherical(spherical));
            didClamp = true;
        }

        if (didClamp) {
            isClampingControlsRef.current = true;
            camera.lookAt(target);
            camera.updateMatrixWorld();
            controls.update();
            isClampingControlsRef.current = false;
        }
    };

    const dollyCamera = (direction: "in" | "out", step = WHEEL_DOLLY_STEP) => {
        if (!orbitControls.current || !orbitControls.current.object) return;

        const camera = orbitControls.current.object;
        const target = orbitControls.current.target;
        const distanceToTarget = camera.position.distanceTo(target);
        const forward = getCameraForward(camera);

        if (direction === "in") {
            const availableDistance = Math.max(0, distanceToTarget - MIN_DOLLY_TARGET_DISTANCE);
            const cameraStep = Math.min(step, availableDistance);
            const passThroughStep = Math.max(0, step - availableDistance);

            camera.position.addScaledVector(forward, cameraStep);
            if (passThroughStep > 0) {
                camera.position.addScaledVector(forward, passThroughStep);
                target.addScaledVector(forward, passThroughStep);
            }
        } else {
            camera.position.addScaledVector(forward, -step);
        }

        // MapControls already calls update() every frame; calling it again here
        // would apply damping twice and make rotation lurch while zooming.
        camera.updateMatrixWorld();
        clampCameraToScene();
    };

    const queueDolly = (direction: "in" | "out", step: number) => {
        const signedStep = direction === "in" ? step : -step;
        // Reversing direction cancels the leftover zoom instead of fighting it.
        if (Math.sign(signedStep) !== Math.sign(pendingDollyRef.current)) {
            pendingDollyRef.current = 0;
        }
        // Bound the backlog so a burst of wheel events cannot cause a long glide.
        pendingDollyRef.current = THREE.MathUtils.clamp(
            pendingDollyRef.current + signedStep, -MAX_WHEEL_DOLLY_STEP * 2, MAX_WHEEL_DOLLY_STEP * 2
        );
    };

    useFrame((_state, delta) => {
        const pending = pendingDollyRef.current;
        if (pending === 0) return;

        const portion = Math.abs(pending) < MIN_PENDING_DOLLY
            ? pending
            : pending * (1 - Math.exp(-DOLLY_SMOOTHING * Math.min(delta, 0.1)));

        pendingDollyRef.current = pending - portion;
        dollyCamera(portion > 0 ? "in" : "out", Math.abs(portion));
    });

    const getWheelDollyStep = (event: WheelEvent) => {
        const controls = orbitControls.current;
        if (!controls || !controls.object) return WHEEL_DOLLY_STEP;

        const distanceToTarget = controls.object.position.distanceTo(controls.target);
        return wheelDollyStep(event.deltaY, event.deltaMode,
            gl.current?.domElement?.clientHeight || 800, distanceToTarget, settings.zoomSpeed);
    };

    const getTouchDistance = (event: TouchEvent) => {
        if (event.touches.length < 2) return 0;

        const firstTouch = event.touches[0];
        const secondTouch = event.touches[1];
        return Math.hypot(
            firstTouch.clientX - secondTouch.clientX,
            firstTouch.clientY - secondTouch.clientY
        );
    };

    const getTouchCenter = (event: TouchEvent) => {
        const firstTouch = event.touches[0];
        const secondTouch = event.touches[1];

        return pinchCenterRef.current.set(
            (firstTouch.clientX + secondTouch.clientX) / 2,
            (firstTouch.clientY + secondTouch.clientY) / 2
        );
    };

    const getPinchDollyStep = (previousDistance: number, nextDistance: number) => {
        const controls = orbitControls.current;
        if (!controls || !controls.object) return WHEEL_DOLLY_STEP;

        const distanceToTarget = controls.object.position.distanceTo(controls.target);
        const deltaDistance = nextDistance - previousDistance;
        const pinchRatio = previousDistance > 0 ? Math.abs(deltaDistance / previousDistance) : 0;
        const step = pinchRatio * Math.max(distanceToTarget, settings.zoomSpeed);
        return Math.min(step, MAX_WHEEL_DOLLY_STEP) * PINCH_DOLLY_SPEED_SCALE;
    };

    // Gamepad event handling
    useEffect(() => {
        const connectHandler = (e: GamepadEvent) => {
            gamepadIndex.current = e.gamepad.index;
            console.log("Gamepad connected:", e.gamepad.id);
        };

        const disconnectHandler = () => {
            gamepadIndex.current = null;
            console.log("Gamepad disconnected");
        };

        window.addEventListener("gamepadconnected", connectHandler);
        window.addEventListener("gamepaddisconnected", disconnectHandler);

        return () => {
            window.removeEventListener("gamepadconnected", connectHandler);
            window.removeEventListener("gamepaddisconnected", disconnectHandler);
        };
    }, []);

    // Gamepad input processing
    useFrame((_state, delta) => {
        const controls = orbitControls.current;
        if (!controls || gamepadIndex.current === null) return;

        const gamepad = navigator.getGamepads()[gamepadIndex.current];
        if (!gamepad) return;

        const [lx, ly, rx, ry] = gamepad.axes;
        const zoomIn = gamepad.buttons[7]?.pressed; // Right trigger (R2) for zoom in
        const zoomOut = gamepad.buttons[6]?.pressed; // Left trigger (L2) for zoom out

        // Apply deadzone to joystick inputs
        const deadzone = 0.2;
        const applyDeadzone = (value: number) => (Math.abs(value) > deadzone ? value : 0);

        // Smooth joystick input by averaging with previous frame
        const smoothedAxes = [
            (applyDeadzone(lx) + previousAxes.current[0]) / 2,
            (applyDeadzone(ly) + previousAxes.current[1]) / 2,
            (applyDeadzone(rx) + previousAxes.current[2]) / 2,
            (applyDeadzone(ry) + previousAxes.current[3]) / 2,
        ];
        previousAxes.current = [lx, ly, rx, ry].map(applyDeadzone);

        if (!zoomIn && !zoomOut && smoothedAxes.every(axis => axis === 0)) return;
        const frameScale = Math.min(delta, 0.1) * 60;

        const camera = controls.object;
        const target = controls.target;

        // Orbit (right joystick)
        if (Math.abs(smoothedAxes[2]) > 0 || Math.abs(smoothedAxes[3]) > 0) {
            const orbitSpeed = settings.zoomSpeed * 0.05 * frameScale;
            const thetaDelta = -smoothedAxes[2] * orbitSpeed; // Horizontal (azimuthal)
            const phiDelta = -smoothedAxes[3] * orbitSpeed; // Vertical (polar)

            // Get current camera position relative to target
            const offset = camera.position.clone().sub(target);

            // Convert to spherical coordinates
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(offset);

            // Apply rotation
            spherical.theta += thetaDelta; // Azimuthal rotation (horizontal)
            spherical.phi = Math.max(
                0.001,
                Math.min(MAX_POLAR_ANGLE, spherical.phi + phiDelta)
            ); // Polar rotation (vertical), clamped

            // Convert back to Cartesian coordinates
            const newPosition = new THREE.Vector3().setFromSpherical(spherical);
            camera.position.copy(target).add(newPosition);

            // Update camera to look at target
            camera.lookAt(target);
        }

        // Zoom (right trigger for zoom in, left trigger for zoom out)
        if (zoomIn || zoomOut) {
            if (zoomIn) {
                dollyCamera("in", settings.zoomSpeed * 0.03 * frameScale);
            }
            if (zoomOut) {
                dollyCamera("out", settings.zoomSpeed * 0.03 * frameScale);
            }
        }

        // Pan (left joystick)
        if (Math.abs(smoothedAxes[0]) > 0 || Math.abs(smoothedAxes[1]) > 0) {
            const offset = new THREE.Vector3();

            // Get camera's right and up vectors in world space
            const right = new THREE.Vector3();
            const up = new THREE.Vector3();
            right.setFromMatrixColumn(camera.matrix, 0); // X-axis (right)
            up.setFromMatrixColumn(camera.matrix, 1); // Y-axis (up)

            // Calculate pan offset
            offset
                .set(0, 0, 0)
                .addScaledVector(right, -smoothedAxes[0] * settings.panFactor * 0.05 * frameScale)
                .addScaledVector(up, smoothedAxes[1] * settings.panFactor * 0.05 * frameScale);

            // Apply pan to both target and camera position
            controls.target.add(offset);
            camera.position.add(offset);
        }

        // MapControls applies damping once at the start of the next frame.
        camera.updateMatrixWorld();
        clampCameraToScene();
    });

    const onControlsChange = () => {
        if (!orbitControls.current) return;
        orbitControls.current.panSpeed = settings.panFactor;
        orbitControls.current.zoomSpeed = settings.zoomSpeed;
    };

    useEffect(() => {
        
        const domElement = gl?.current?.domElement;

        if (!domElement || !orbitControls.current) return;
        const controls = orbitControls.current;
        pendingDollyRef.current = 0;

        // Configure MapControls
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.enablePan = true;
        controls.screenSpacePanning = false;
        const previousMaxPolarAngle = controls.maxPolarAngle;
        
        controls.maxPolarAngle = MAX_POLAR_ANGLE;
        controls.minDistance = 0.00001;
        controls.maxDistance = MAX_CAMERA_DISTANCE;

        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
        };
        const previousTouches = controls.touches;
        controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
        };

        onControlsChange();
        controls.update();
        clampCameraToScene();

        const previousTouchAction = domElement.style.touchAction;
        domElement.style.touchAction = "none";

        const handleWheel = (event: WheelEvent) => {
            if (event.deltaY === 0) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const direction = event.deltaY < 0 ? "in" : "out";
            queueDolly(direction, getWheelDollyStep(event));
        };

        const handleTouchStart = (event: TouchEvent) => {
            if (event.touches.length !== 2) {
                pinchDistanceRef.current = 0;
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            pinchDistanceRef.current = getTouchDistance(event);
            getTouchCenter(event);
        };

        const handleTouchMove = (event: TouchEvent) => {
            if (event.touches.length !== 2) {
                pinchDistanceRef.current = 0;
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const nextDistance = getTouchDistance(event);
            const previousDistance = pinchDistanceRef.current || nextDistance;
            const deltaDistance = nextDistance - previousDistance;

            if (Math.abs(deltaDistance) > 0.25) {
                const direction = deltaDistance > 0 ? "in" : "out";
                queueDolly(direction, getPinchDollyStep(previousDistance, nextDistance));
            }

            pinchDistanceRef.current = nextDistance;
            getTouchCenter(event);
        };

        const handleTouchEnd = (event: TouchEvent) => {
            if (event.touches.length < 2) {
                pinchDistanceRef.current = 0;
            }
        };

        domElement.addEventListener("wheel", handleWheel, { capture: true, passive: false });
        domElement.addEventListener("touchstart", handleTouchStart, { capture: true, passive: false });
        domElement.addEventListener("touchmove", handleTouchMove, { capture: true, passive: false });
        domElement.addEventListener("touchend", handleTouchEnd, { capture: true, passive: false });
        domElement.addEventListener("touchcancel", handleTouchEnd, { capture: true, passive: false });
        controls.addEventListener("change", clampCameraToScene);

        // Cleanup
        return () => {
            pendingDollyRef.current = 0;
            domElement.removeEventListener("wheel", handleWheel, { capture: true });
            domElement.removeEventListener("touchstart", handleTouchStart, { capture: true });
            domElement.removeEventListener("touchmove", handleTouchMove, { capture: true });
            domElement.removeEventListener("touchend", handleTouchEnd, { capture: true });
            domElement.removeEventListener("touchcancel", handleTouchEnd, { capture: true });
            controls.removeEventListener("change", clampCameraToScene);
            domElement.style.touchAction = previousTouchAction;
            controls.touches = previousTouches;
            controls.maxPolarAngle = previousMaxPolarAngle;
        };
    }, [projectId, settings, gl, orbitControls]);

    return null;
}
