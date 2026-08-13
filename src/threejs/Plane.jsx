import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import WaterShaderMaterial from './WaterShaderMaterial';
import * as THREE from 'three';
export default function Plane({ size = [1, 1] }) {
    const materialRef = useRef();
    const meshRef = useRef();
    // Store up to 5 click ripples
    const [clicks, setClicks] = useState([]);

    useFrame(({ clock }) => {
        if (materialRef.current) {
            materialRef.current.uTime = clock.getElapsedTime();

            // Update click ripple positions
            const clickVecs = Array.from({ length: 5 }, (_, i) =>
                clicks[i] ? clicks[i] : new THREE.Vector2(-1, -1)
            );
            materialRef.current.uClicks = clickVecs;
        }
    });

    // Convert world position to UV
    const getUV = (event) => {
        const uv = event.uv;
        return uv ? new THREE.Vector2(uv.x, uv.y) : new THREE.Vector2(-1, -1);
    };

    const handleClick = (e) => {
        const newUV = getUV(e);
        setClicks((prev) => {
            const updated = [...prev, newUV];
            return updated.slice(-5); // Only keep last 5
        });
    };

    const handleHover = (e) => {
        const hoverUV = getUV(e);
        if (materialRef.current) {
            materialRef.current.uHover = hoverUV;
        }
    };

    const clearHover = () => {
        if (materialRef.current) {
            materialRef.current.uHover = new THREE.Vector2(-1, -1);
        }
    };

    return (
        <mesh
            ref={meshRef}
            onClick={handleClick}
            onPointerMove={handleHover}
            onPointerOut={clearHover}
            position={[0.5, 0.5, 0]}
            // rotation={[-Math.PI / 2, 0, 0]} // flat plane
        >
            <planeGeometry args={size} />
            <waterShaderMaterial ref={materialRef} />
        </mesh>
    );
}
