import React, { useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
    varying vec3 v_world_position;

    void main() {
        vec4 world_position = modelMatrix * vec4(position, 1.0);
        v_world_position = world_position.xyz;
        gl_Position = projectionMatrix * viewMatrix * world_position;
    }
`;

const fragmentShader = `
    uniform sampler2D u_texture;
    uniform vec3 u_camera_position;
    uniform float u_alpha;
    uniform float u_grid_scale;
    varying vec3 v_world_position;

    void main() {
        vec3 pos = v_world_position;
        vec2 f = vec2(1.0 / 64.0, -1.0 / 64.0);
        vec2 grid_pos = pos.xz / u_grid_scale;

        float brightness = texture2D(u_texture, grid_pos + f).x * 0.6;
        brightness += texture2D(u_texture, grid_pos * 0.1 + f).x * 0.3;
        brightness += texture2D(u_texture, grid_pos * 0.01 + f).x * 0.2;
        brightness /= max(1.0, 0.001 * length(u_camera_position.xz - pos.xz));

        vec4 color = vec4(vec3(0.18), brightness * u_alpha);
        float axis_width_x = max(fwidth(pos.x) * 1.5, 0.001);
        float axis_width_z = max(fwidth(pos.z) * 1.5, 0.001);
        if (abs(pos.x) < axis_width_x) {
            color = mix(vec4(0.4, 0.4, 1.0, 0.42), color, smoothstep(0.0, axis_width_x, abs(pos.x)));
        }
        if (abs(pos.z) < axis_width_z) {
            color = mix(vec4(1.0, 0.4, 0.4, 0.42), color, smoothstep(0.0, axis_width_z, abs(pos.z)));
        }

        gl_FragColor = color;
    }
`;

export default function WebGLStudioGrid() {
    const meshRef = useRef(null);
    const materialRef = useRef(null);
    const lastCameraPositionRef = useRef(new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN));
    const texture = useLoader(THREE.TextureLoader, `${import.meta.env.BASE_URL}textures/webglstudio-grid.png`);

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.colorSpace = THREE.NoColorSpace;

    const uniforms = useMemo(() => ({
        u_texture: { value: texture },
        u_camera_position: { value: new THREE.Vector3() },
        u_alpha: { value: 1.5 },
        u_grid_scale: { value: 0.01 },
    }), [texture]);

    useFrame(({ camera }) => {
        if (lastCameraPositionRef.current.equals(camera.position)) {
            return;
        }

        lastCameraPositionRef.current.copy(camera.position);

        if (meshRef.current) {
            meshRef.current.position.x = camera.position.x;
            meshRef.current.position.z = camera.position.z;
        }

        if (materialRef.current) {
            materialRef.current.uniforms.u_camera_position.value.copy(camera.position);
        }
    });

    return (
        <mesh ref={meshRef} rotation-x={-Math.PI / 2} position-y={-0.02} renderOrder={-1000} frustumCulled={false}>
            <planeGeometry args={[20000, 20000, 1, 1]} />
            <shaderMaterial
                ref={materialRef}
                uniforms={uniforms}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                transparent
                depthWrite={false}
                depthTest
                polygonOffset
                polygonOffsetFactor={1}
                polygonOffsetUnits={1}
                side={THREE.FrontSide}
            />
        </mesh>
    );
}
