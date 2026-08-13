import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const GamepadOrbitControls = ({
                                  orbitControlsRef,
                                  orbitSpeed = 0.5,
                                  zoomSpeed = 0.05,
                                  panSpeed = 0.05,
                              }) => {
    const gamepadIndex = useRef(null);
    const previousAxes = useRef([0, 0, 0, 0]); // Track previous axes to smooth input

    useEffect(() => {
        const connectHandler = (e) => {
            gamepadIndex.current = e.gamepad.index;
            console.log('Gamepad connected:', e.gamepad.id);
        };

        const disconnectHandler = () => {
            gamepadIndex.current = null;
            console.log('Gamepad disconnected');
        };

        window.addEventListener('gamepadconnected', connectHandler);
        window.removeEventListener('gamepaddisconnected', disconnectHandler);

        return () => {
            window.removeEventListener('gamepadconnected', connectHandler);
            window.removeEventListener('gamepaddisconnected', disconnectHandler);
        };
    }, []);

    useFrame(() => {
        const controls = orbitControlsRef.current;
        if (!controls || gamepadIndex.current === null) return;

        const gamepad = navigator.getGamepads()[gamepadIndex.current];
        if (!gamepad) return;

        const [lx, ly, rx, ry] = gamepad.axes;
        const zoomIn = gamepad.buttons[7]?.pressed; // Right trigger (R2) for zoom in
        const zoomOut = gamepad.buttons[6]?.pressed; // Left trigger (L2) for zoom out

        // Apply deadzone to joystick inputs
        const deadzone = 0.2;
        const applyDeadzone = (value) => (Math.abs(value) > deadzone ? value : 0);

        // Smooth joystick input by averaging with previous frame
        const smoothedAxes = [
            (applyDeadzone(lx) + previousAxes.current[0]) / 2,
            (applyDeadzone(ly) + previousAxes.current[1]) / 2,
            (applyDeadzone(rx) + previousAxes.current[2]) / 2,
            (applyDeadzone(ry) + previousAxes.current[3]) / 2,
        ];
        previousAxes.current = [lx, ly, rx, ry];

        const camera = controls.object;
        const target = controls.target;

        // Orbit (right joystick)
        if (Math.abs(smoothedAxes[2]) > 0 || Math.abs(smoothedAxes[3]) > 0) {
            // Calculate rotation angles
            const thetaDelta = -smoothedAxes[2] * orbitSpeed * 0.05; // Horizontal (azimuthal)
            const phiDelta = -smoothedAxes[3] * orbitSpeed * 0.05; // Vertical (polar)

            // Get current camera position relative to target
            const offset = camera.position.clone().sub(target);
            const radius = offset.length();

            // Convert to spherical coordinates
            const spherical = new THREE.Spherical();
            spherical.setFromVector3(offset);

            // Apply rotation
            spherical.theta += thetaDelta; // Azimuthal rotation (horizontal)
            spherical.phi = Math.max(0.001, Math.min(Math.PI - 0.001, spherical.phi + phiDelta)); // Polar rotation (vertical), clamped

            // Convert back to Cartesian coordinates
            const newPosition = new THREE.Vector3().setFromSpherical(spherical);
            camera.position.copy(target).add(newPosition);

            // Update camera to look at target
            camera.lookAt(target);
        }

        // Zoom (right trigger for zoom in, left trigger for zoom out)
        if (zoomIn) {
            controls.dollyOut(1 + zoomSpeed);
        }
        if (zoomOut) {
            controls.dollyIn(1 + zoomSpeed);
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
                .addScaledVector(right, -smoothedAxes[0] * panSpeed) // Pan left/right
                .addScaledVector(up, smoothedAxes[1] * panSpeed); // Pan up/down

            // Apply pan to both target and camera position
            controls.target.add(offset);
            camera.position.add(offset);
        }

        // Update controls to apply changes
        controls.update();
    });

    return null;
};

export default GamepadOrbitControls;