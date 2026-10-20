import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";

// A local point one unit ahead of the mount, along the robot's local +Z forward
// axis (see RaspbotGLTFModel.tsx / RaspbotModel.tsx). Transforming both this and
// the mount offset into world space and feeding them to Matrix4.lookAt mirrors
// CameraPathReplay's RTLS camera-follow pattern — it sidesteps manually composing
// a quaternion offset to account for the camera's default -Z forward vs. the
// robot's +Z, the same way CameraPathReplay avoids it for the path-following camera.
const LOCAL_FORWARD = new THREE.Vector3(0, 0, 1);

// This is a simulated first-person camera driven by RobotTrackReplay's recorded-
// trajectory playback — not a live video feed from the physical Raspbot's camera.
export default function RobotFirstPersonCamera() {
    const { camera } = useThree();
    const robotFirstPerson = useGame((state: any) => state.robotFirstPerson);
    const robotGroupRef = useGame((state: any) => state.robotGroupRef);
    const robotCameraOffset = useGame((state: any) => state.robotCameraOffset);
    const orbitControlsRef = useGame((state: any) => state.orbitControlsRef);

    const active = robotFirstPerson && Boolean(robotGroupRef);

    const eyeWorldRef = useRef(new THREE.Vector3());
    const forwardWorldRef = useRef(new THREE.Vector3());
    const rotationMatrixRef = useRef(new THREE.Matrix4());

    // Same disable/restore pattern CameraPathReplay uses for its RTLS camera route,
    // so OrbitControls doesn't fight this component for camera.position each frame.
    useEffect(() => {
        const controls = orbitControlsRef?.current;
        if (!active || !controls) return undefined;

        const previousEnabled = controls.enabled;
        controls.enabled = false;

        return () => {
            controls.enabled = previousEnabled;
        };
    }, [active, orbitControlsRef]);

    // RobotTrackReplay runs at priority -1. Copy its already-interpolated heading
    // at priority 0 so camera view shares the same stop/turn/resume timing.
    useFrame(() => {
        const group = robotGroupRef?.current as THREE.Object3D | undefined;
        if (!active || !group || !robotCameraOffset) return;

        group.updateWorldMatrix(true, false);
        eyeWorldRef.current.copy(robotCameraOffset).applyMatrix4(group.matrixWorld);
        forwardWorldRef.current.copy(robotCameraOffset).add(LOCAL_FORWARD).applyMatrix4(group.matrixWorld);

        camera.position.copy(eyeWorldRef.current);
        rotationMatrixRef.current.lookAt(eyeWorldRef.current, forwardWorldRef.current, camera.up);
        camera.quaternion.setFromRotationMatrix(rotationMatrixRef.current);
        camera.updateMatrixWorld();
    }, 0);

    return null;
}
