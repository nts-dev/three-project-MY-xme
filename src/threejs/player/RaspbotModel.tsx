// Raspbot V2 procedural geometry, visually referenced against the manufacturer
// photo provided on 2026-10-15 (mecanum wheels, two-tier chassis plate + brass
// standoffs with a Pi/PCB sandwiched between, twin-eye ultrasonic sensor box,
// mast-mounted camera, small pinned driver board at the front).
// Proportions are matched by eye to that photo only — NOT derived from verified
// physical measurements. Built from Three.js primitives (no Blender available on
// this machine) to keep the model lightweight.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Vector3 } from "three";
import type { Group } from "three";

type NumberRef = { current: number };

const FRAME_COLOR = "#17181b";
const STANDOFF_COLOR = "#c9a227";
const PCB_COLOR = "#1f7a3d";
const DRIVER_BOARD_COLOR = "#2a8f4f";
const PIN_COLOR = "#d4af37";
const SENSOR_BODY_COLOR = "#101114";
const SENSOR_EYE_COLOR = "#e8ecef";
const CAMERA_BODY_COLOR = "#0c0c0d";
const LENS_COLOR = "#2b2f33";
const WHEEL_HUB_COLOR = "#141414";
const WHEEL_TIRE_COLOR = "#f4c430";
const ROLLER_COLOR = "#1a1a1a";
const TAG_COLOR = "#ff5a1f";

const BOTTOM_PLATE_SIZE: [number, number, number] = [0.17, 0.01, 0.12];
const TOP_PLATE_SIZE: [number, number, number] = [0.14, 0.01, 0.1];
const PLATE_GAP = 0.055;
const STANDOFF_RADIUS = 0.004;

export const WHEEL_RADIUS = 0.05;
const WHEEL_WIDTH = 0.03;
const WHEEL_OFFSET_X = BOTTOM_PLATE_SIZE[0] / 2 + WHEEL_WIDTH * 0.35;
const WHEEL_OFFSET_Z = BOTTOM_PLATE_SIZE[2] / 2 - 0.006;
const ROLLER_COUNT = 9;

const BOTTOM_PLATE_Y = WHEEL_RADIUS;
const TOP_PLATE_Y = WHEEL_RADIUS + PLATE_GAP;

// Lens tip of the mast-mounted camera block below, for RobotFirstPersonCamera.tsx
// — the natural "eye point" when this procedural model is the active one (i.e.
// USE_GLB_MODEL = false in RobotTrackReplay.tsx). Matches the lens mesh position:
// [0, BOTTOM_PLATE_Y + 0.082, BOTTOM_PLATE_SIZE[2] / 2 + 0.021].
export const CAMERA_MOUNT_OFFSET = new Vector3(0, BOTTOM_PLATE_Y + 0.082, BOTTOM_PLATE_SIZE[2] / 2 + 0.021);

// The angled rollers around the rim are the visual signature of a mecanum wheel;
// diagonal direction alternates corner-to-corner, matching the "X" pattern in the photo.
//
// Two nested groups, deliberately kept separate:
//  - `axleRef` (outer) is the only thing RobotTrackReplay's per-frame spin touches —
//    rotating it around local X spins the wheel around its true axle axis.
//  - the inner group holds the fixed [0,0,PI/2] lay-flat orientation that turns the
//    cylinder/torus geometry (authored along the default Y axis) into a wheel whose
//    rolling axis lines up with the outer group's local X. Driving the spin on a
//    separate outer group means the static mount math never has to be re-derived.
function MecanumWheel({ mirrored, axleRef }: { mirrored: boolean; axleRef: (el: Group | null) => void }) {
    const rollers = useMemo(() => {
        const tilt = mirrored ? -Math.PI / 4 : Math.PI / 4;
        return Array.from({ length: ROLLER_COUNT }, (_, index) => ({
            angle: (index / ROLLER_COUNT) * Math.PI * 2,
            tilt,
        }));
    }, [mirrored]);

    return (
        <group ref={axleRef}>
            <group rotation={[0, 0, Math.PI / 2]}>
                <mesh>
                    <cylinderGeometry args={[WHEEL_RADIUS * 0.4, WHEEL_RADIUS * 0.4, WHEEL_WIDTH * 1.02, 12]} />
                    <meshStandardMaterial color={WHEEL_HUB_COLOR} roughness={0.5} metalness={0.3} />
                </mesh>
                <mesh>
                    <torusGeometry args={[WHEEL_RADIUS * 0.78, WHEEL_WIDTH * 0.42, 8, 20]} />
                    <meshStandardMaterial color={WHEEL_TIRE_COLOR} roughness={0.7} />
                </mesh>
                {rollers.map(({ angle, tilt }, index) => (
                    <group key={index} rotation={[0, 0, angle]}>
                        <mesh position={[WHEEL_RADIUS * 0.78, 0, 0]} rotation={[tilt, 0, 0]}>
                            <cylinderGeometry args={[WHEEL_WIDTH * 0.26, WHEEL_WIDTH * 0.26, WHEEL_RADIUS * 0.46, 8]} />
                            <meshStandardMaterial color={ROLLER_COLOR} roughness={0.8} />
                        </mesh>
                    </group>
                ))}
            </group>
        </group>
    );
}

type RaspbotModelProps = {
    scale?: number;
    // Signed, unbounded distance-traveled accumulator in meters (NOT pre-divided by
    // wheel radius — this model converts distance to spin angle itself using its own
    // WHEEL_RADIUS, so this same prop shape can be shared with RaspbotGLTFModel.tsx,
    // whose measured wheel radius differs). A ref rather than a number prop so
    // RobotTrackReplay can update it every frame via useFrame without ever
    // triggering a React re-render here (see the "Avoid unnecessary React state
    // updates" requirement). Omit it to render a stationary robot (e.g. a preview).
    wheelDistanceRef?: NumberRef;
};

export default function RaspbotModel({ scale = 1, wheelDistanceRef }: RaspbotModelProps) {
    const wheelAxleRefs = useRef<(Group | null)[]>([null, null, null, null]);

    const wheelLayout = useMemo<{ position: [number, number, number]; mirrored: boolean }[]>(
        () => [
            { position: [-WHEEL_OFFSET_X, WHEEL_RADIUS, -WHEEL_OFFSET_Z], mirrored: false },
            { position: [-WHEEL_OFFSET_X, WHEEL_RADIUS, WHEEL_OFFSET_Z], mirrored: true },
            { position: [WHEEL_OFFSET_X, WHEEL_RADIUS, -WHEEL_OFFSET_Z], mirrored: true },
            { position: [WHEEL_OFFSET_X, WHEEL_RADIUS, WHEEL_OFFSET_Z], mirrored: false },
        ],
        []
    );

    // Single shared subscription spins all 4 axles from one accumulator — simplified
    // forward-driving motion (all wheels at the same rate), not real mecanum per-wheel
    // kinematics, since no per-wheel speed/motor-command data is available.
    useFrame(() => {
        if (!wheelDistanceRef) return;
        const angle = (wheelDistanceRef.current / WHEEL_RADIUS) % (Math.PI * 2);
        for (const axle of wheelAxleRefs.current) {
            if (axle) axle.rotation.x = angle;
        }
    });

    const standoffPositions = useMemo<[number, number, number][]>(() => {
        const x = BOTTOM_PLATE_SIZE[0] / 2 - 0.015;
        const z = BOTTOM_PLATE_SIZE[2] / 2 - 0.012;
        const y = BOTTOM_PLATE_Y + PLATE_GAP / 2;
        return [
            [-x, y, -z],
            [-x, y, z],
            [x, y, -z],
            [x, y, z],
        ];
    }, []);

    return (
        <group name="RaspbotV2" scale={scale}>
            {/* Bottom chassis plate (motors mount underneath, out of view) */}
            <mesh position={[0, BOTTOM_PLATE_Y, 0]}>
                <boxGeometry args={BOTTOM_PLATE_SIZE} />
                <meshStandardMaterial color={FRAME_COLOR} roughness={0.5} metalness={0.4} />
            </mesh>

            {/* Top chassis plate */}
            <mesh position={[0, TOP_PLATE_Y, -0.01]}>
                <boxGeometry args={TOP_PLATE_SIZE} />
                <meshStandardMaterial color={FRAME_COLOR} roughness={0.5} metalness={0.4} />
            </mesh>

            {/* Brass standoffs joining the two plates */}
            {standoffPositions.map((position, index) => (
                <mesh key={index} position={position}>
                    <cylinderGeometry args={[STANDOFF_RADIUS, STANDOFF_RADIUS, PLATE_GAP, 8]} />
                    <meshStandardMaterial color={STANDOFF_COLOR} roughness={0.3} metalness={0.8} />
                </mesh>
            ))}

            {/* Raspberry Pi / PCB stack sandwiched between the plates */}
            <mesh position={[0, BOTTOM_PLATE_Y + PLATE_GAP / 2, 0.015]}>
                <boxGeometry args={[0.1, PLATE_GAP * 0.92, 0.002]} />
                <meshStandardMaterial color={PCB_COLOR} roughness={0.6} />
            </mesh>

            {/* Front ultrasonic sensor module with its two "eyes" */}
            <mesh position={[0, BOTTOM_PLATE_Y + 0.025, BOTTOM_PLATE_SIZE[2] / 2 + 0.015]}>
                <boxGeometry args={[0.065, 0.05, 0.03]} />
                <meshStandardMaterial color={SENSOR_BODY_COLOR} roughness={0.5} />
            </mesh>
            {[-0.016, 0.016].map((x, index) => (
                <mesh
                    key={index}
                    position={[x, BOTTOM_PLATE_Y + 0.025, BOTTOM_PLATE_SIZE[2] / 2 + 0.031]}
                    rotation={[Math.PI / 2, 0, 0]}
                >
                    <cylinderGeometry args={[0.009, 0.009, 0.006, 16]} />
                    <meshStandardMaterial color={SENSOR_EYE_COLOR} roughness={0.2} metalness={0.3} />
                </mesh>
            ))}

            {/* Camera on a raised mast above the sensor module */}
            <mesh position={[0, BOTTOM_PLATE_Y + 0.06, BOTTOM_PLATE_SIZE[2] / 2 - 0.005]}>
                <boxGeometry args={[0.02, 0.05, 0.02]} />
                <meshStandardMaterial color={CAMERA_BODY_COLOR} roughness={0.4} metalness={0.3} />
            </mesh>
            <mesh position={[0, BOTTOM_PLATE_Y + 0.082, BOTTOM_PLATE_SIZE[2] / 2 + 0.005]}>
                <boxGeometry args={[0.036, 0.03, 0.03]} />
                <meshStandardMaterial color={CAMERA_BODY_COLOR} roughness={0.4} metalness={0.3} />
            </mesh>
            <mesh
                position={[0, BOTTOM_PLATE_Y + 0.082, BOTTOM_PLATE_SIZE[2] / 2 + 0.021]}
                rotation={[Math.PI / 2, 0, 0]}
            >
                <cylinderGeometry args={[0.009, 0.009, 0.014, 16]} />
                <meshStandardMaterial color={LENS_COLOR} roughness={0.2} metalness={0.6} />
            </mesh>

            {/* Driver / expansion board hanging at the front-bottom, with header pins */}
            <mesh position={[0, BOTTOM_PLATE_Y - 0.012, BOTTOM_PLATE_SIZE[2] / 2 - 0.01]}>
                <boxGeometry args={[0.07, 0.002, 0.03]} />
                <meshStandardMaterial color={DRIVER_BOARD_COLOR} roughness={0.6} />
            </mesh>
            {[-0.025, -0.012, 0.001, 0.014, 0.027].map((x, index) => (
                <mesh key={index} position={[x, BOTTOM_PLATE_Y - 0.017, BOTTOM_PLATE_SIZE[2] / 2 + 0.002]}>
                    <cylinderGeometry args={[0.0015, 0.0015, 0.008, 6]} />
                    <meshStandardMaterial color={PIN_COLOR} roughness={0.3} metalness={0.8} />
                </mesh>
            ))}

            {/* RTLS tag mount on the rear deck */}
            <mesh position={[0, TOP_PLATE_Y + 0.012, -TOP_PLATE_SIZE[2] / 2 + 0.012]}>
                <boxGeometry args={[0.025, 0.014, 0.025]} />
                <meshStandardMaterial color={TAG_COLOR} roughness={0.4} metalness={0.1} />
            </mesh>

            {/* Mecanum wheels */}
            {wheelLayout.map(({ position, mirrored }, index) => (
                <group key={index} position={position}>
                    <MecanumWheel
                        mirrored={mirrored}
                        axleRef={(el) => {
                            wheelAxleRefs.current[index] = el;
                        }}
                    />
                </group>
            ))}
        </group>
    );
}
