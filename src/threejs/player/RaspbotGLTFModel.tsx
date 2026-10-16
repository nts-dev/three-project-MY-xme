// Loads the Claude-generated Raspbot V2 GLB (public/dataFiles/Raspbot_V2.glb).
// Measured directly from the file before wiring this up (GLTFLoader.parse() run
// standalone in Node against the actual .glb):
//  - already scaled to real-world meters — overall bounding box ~0.199 x 0.152 x
//    0.210m (W,H,D) — no extra scale factor needed here, unlike the sibling FBX
//    export (which ignores glTF unit metadata and needs a manual x0.01).
//  - the model's own origin sits at floor level (min Y ~= 0.0002m), matching
//    RobotTrackReplay's floor-level position convention — no Y offset needed.
//  - local forward is +Z: Camera_Pan/Ultrasonic_Sensor/Line_Tracker all sit at
//    positive Z, Control_Case (the rear electronics box) sits at negative Z, and
//    the front wheel pair (Wheel_FL/Wheel_FR) is at +Z vs the rear pair at -Z.
//    This matches RaspbotModel.tsx's MODEL_FORWARD_YAW_OFFSET = 0 in
//    RobotTrackReplay.tsx, so the existing heading math needs no change.
//  - each Wheel_FL/RL/FR/RR node's own local X axis is already its rolling/axle
//    axis (its local-space bounding box is thin along X, wide across Y/Z) — unlike
//    the procedural model, this GLB needs no extra lay-flat rotation wrapper:
//    spin is applied directly to the wheel node's own rotation.x.
import { useLoader, useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Object3D } from "three";

const MODEL_URL = "/dataFiles/Raspbot_V2.glb";
const WHEEL_NODE_NAMES = ["Wheel_FL", "Wheel_RL", "Wheel_FR", "Wheel_RR"];
// Fallback only used if a wheel node can't be found by name (model re-exported
// with different naming) — measured average of the 4 wheels at inspection time.
const FALLBACK_WHEEL_RADIUS = 0.0375;

// Lens tip of the camera pan/tilt mount, for RobotFirstPersonCamera.tsx. Measured
// directly from the GLB's JSON chunk (Node, no GLTFLoader needed): Camera_Pan's
// local translation is [0,10,5.6], its child Camera_Tilt adds a further local
// [0,2.7,0], and the root "Raspbot_V2" node carries scale=[0.01,0.01,0.01] that
// both inherit — so the lens tip sits at ([0,10,5.6]+[0,2.7,0]) * 0.01 in this
// model's local meters space, along the local +Z forward axis documented above.
export const CAMERA_MOUNT_OFFSET = new THREE.Vector3(0, 0.127, 0.056);

type NumberRef = { current: number };

type RaspbotGLTFModelProps = {
    // Same contract as RaspbotModel.tsx's wheelDistanceRef: signed distance
    // traveled in meters, converted to a spin angle using this model's own
    // measured wheel radius (which differs from the procedural model's).
    wheelDistanceRef?: NumberRef;
};

export default function RaspbotGLTFModel({ wheelDistanceRef }: RaspbotGLTFModelProps) {
    const gltf = useLoader(GLTFLoader, MODEL_URL);

    // No skeleton/armature in this model (plain static mesh hierarchy), so a
    // shallow Object3D clone is enough — meshes still share their source
    // geometry/material, only the transform nodes (incl. the wheel axles we
    // rotate per-frame) are duplicated, so multiple robot instances won't fight
    // over the same cached scene graph from useLoader.
    const clonedScene = useMemo(() => gltf.scene.clone(true), [gltf]);

    const { wheelRefs, wheelRadius } = useMemo(() => {
        clonedScene.updateMatrixWorld(true);
        const refs = WHEEL_NODE_NAMES.map((name) => clonedScene.getObjectByName(name) as Object3D | undefined);

        const box = new THREE.Box3();
        const size = new THREE.Vector3();
        const radii: number[] = [];
        for (const wheel of refs) {
            if (!wheel) continue;
            box.setFromObject(wheel);
            box.getSize(size);
            // The wheel disc's two "wide" axes (Y and Z, given local X is the axle
            // axis) both equal roughly one wheel diameter.
            radii.push((size.y + size.z) / 4);
        }

        const radius = radii.length > 0 ? radii.reduce((sum, r) => sum + r, 0) / radii.length : FALLBACK_WHEEL_RADIUS;
        return { wheelRefs: refs, wheelRadius: radius };
    }, [clonedScene]);

    useFrame(() => {
        if (!wheelDistanceRef || wheelRadius <= 0) return;
        const angle = (wheelDistanceRef.current / wheelRadius) % (Math.PI * 2);
        for (const wheel of wheelRefs) {
            if (wheel) wheel.rotation.x = angle;
        }
    });

    return <primitive object={clonedScene} />;
}
