import {useEffect, useRef} from "react";
import * as THREE from "three";
import {extend,useFrame} from "@react-three/fiber";
import * as React from "react";
import {useTexture} from "@react-three/drei";
import {Water} from "three/examples/jsm/objects/Water";

extend({Water});
export default function Waters() {
    const waterRef = useRef();
    const waterNormals = useTexture(`${import.meta.env.VITE_FILE_URL}/waternormals.jpg`
    );
    waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;

    // Create water geometry
    const waterGeometry = new THREE.PlaneGeometry(2000, 2000);

    // Create water material
    const water = new Water(waterGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals,
        sunDirection: new THREE.Vector3(1, 1, 1),
        sunColor: 0xffffff,
        waterColor: 0x1e88e5,
        distortionScale: 0.01,
        fog: false,
    });

    useFrame((_, delta) => {
        if (waterRef.current && waterRef.current.material && waterRef.current.material.uniforms && waterRef.current.material.uniforms.time) {
            waterRef.current.material.uniforms.time.value += delta;
        }
    });

    return <primitive object={water} ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}/>;
}