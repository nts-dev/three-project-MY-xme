import * as THREE from "three";
import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";

const SHAPE_POINTS = [5, 10, 6, 8, 4];
const ORBIT_RADIUS = [2, 3, 4, 5, 6];
const ORBIT_SPEED = [4, 6, 7, 3, 5];
const COLORS = ["yellow", "green", "blue", "red", "pink"];
const BASE_Y = 13;

export default function OrbitingShape() {
    const instanceCount = SHAPE_POINTS.length;
    const instancedRef = useRef();

    // ----------------------------
    // PREBUILD SHAPE GEOMETRY ONCE
    // ----------------------------
    const geometry = useMemo(() => {
        const shape = new THREE.Shape();
        const points = SHAPE_POINTS[0];

        const outerRadius = 0.08;
        const innerRadius = 0.04;

        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i / (points * 2)) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) shape.moveTo(x, y);
            else shape.lineTo(x, y);
        }
        shape.closePath();

        return new THREE.ShapeGeometry(shape);
    }, []);

    // ----------------------------
    // PREALLOCATED TRANSFORMS
    // ----------------------------
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const tmpColor = useMemo(() => new THREE.Color(), []);

    // ----------------------------
    // INITIAL SETUP
    // ----------------------------
    useEffect(() => {
        const mesh = instancedRef.current;
        if (!mesh) return;

        // Setup per-instance colors ONCE
        for (let i = 0; i < instanceCount; i++) {
            tmpColor.set(COLORS[i]);
            mesh.setColorAt(i, tmpColor);
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    }, [instanceCount, tmpColor]);

    // ----------------------------
    // TIMERS (no gsap)
    // ----------------------------
    const tRef = useRef(0);

    // ----------------------------
    // FRAME LOOP
    // ----------------------------
    useFrame((_, delta) => {
        const mesh = instancedRef.current;
        if (!mesh) return;
        const t = (tRef.current += delta)/5;

        for (let i = 0; i < instanceCount; i++) {
            const angle = (t * ORBIT_SPEED[i]) % (Math.PI * 2);
            dummy.position.set(
                Math.cos(angle) * ORBIT_RADIUS[i],
                BASE_Y,
                Math.sin(angle) * ORBIT_RADIUS[i]
            );
            dummy.updateMatrix();

            mesh.setMatrixAt(i, dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh
            ref={instancedRef}
            args={[geometry, null, instanceCount]}
            name={'OrbitingShape'}
        >
            <meshBasicMaterial side={THREE.DoubleSide} />
        </instancedMesh>
    );
}
