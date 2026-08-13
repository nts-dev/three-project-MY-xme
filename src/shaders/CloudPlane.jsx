// CloudPlane.js
import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import CloudTenShaderMaterial from './CloudTenShaderMaterial';

export default function CloudPlane({ size = [1, 1] }) {
    const materialRef = useRef();
    const noiseTexture = useLoader(THREE.TextureLoader, `${import.meta.env.VITE_ASSET_URL}/assets/noise.png`); // you need to provide a grayscale noise texture


    useFrame(({ pointer,clock  }) => {
        materialRef.current.uniforms.uTime.value = clock.getElapsedTime()*5;

        materialRef.current.uniforms.uMouse.value.set(
            (pointer.x * 0.5 + 0.5) * window.innerWidth,
            (pointer.y * 0.5 + 0.5) * window.innerHeight
        );
    });

    return (
        <mesh
            position={[1.5,0.5, 0]}
        >
            <planeGeometry args={size} />
            <cloudTenShaderMaterial
                ref={materialRef}
                uTime={0}
                iChannel0={noiseTexture}
                uResolution={new THREE.Vector2(window.innerWidth, window.innerHeight)}
                uMouse={new THREE.Vector2(0.5, 0.5)}
                transparent={false}
            />
        </mesh>
    );
}
