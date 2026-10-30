import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, float, fwidth, length, max, mix, positionWorld, smoothstep, sRGBTransferEOTF, texture as textureNode, uniform, vec2, vec3, vec4 } from 'three/tsl';

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

// TSL port of the GLSL shader above, for WebGPURenderer (which cannot run ShaderMaterial).
function createGridNodeMaterial(texture, cameraPosition) {
    const pos = positionWorld;
    const gridPos = pos.xz.div(0.01);
    const f = vec2(1.0 / 64.0, -1.0 / 64.0);

    const brightness = textureNode(texture, gridPos.add(f)).x.mul(0.6)
        .add(textureNode(texture, gridPos.mul(0.1).add(f)).x.mul(0.3))
        .add(textureNode(texture, gridPos.mul(0.01).add(f)).x.mul(0.2))
        .div(max(1.0, length(cameraPosition.xz.sub(pos.xz)).mul(0.001)));

    // The GLSL `if (abs < width) color = mix(axis, color, smoothstep(...))` equals an unconditional mix,
    // since smoothstep is 1 outside the axis width.
    const axisWidthX = max(fwidth(pos.x).mul(1.5), 0.001);
    const axisWidthZ = max(fwidth(pos.z).mul(1.5), 0.001);
    let color = vec4(vec3(0.18), brightness.mul(1.5));
    color = mix(vec4(0.4, 0.4, 1.0, 0.42), color, smoothstep(float(0), axisWidthX, abs(pos.x)));
    color = mix(vec4(1.0, 0.4, 0.4, 0.42), color, smoothstep(float(0), axisWidthZ, abs(pos.z)));

    const material = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        side: THREE.FrontSide,
    });
    // The GLSL shader writes raw values; node materials sRGB-encode on output, so linearise to match.
    material.colorNode = sRGBTransferEOTF(color.rgb);
    material.opacityNode = color.a;
    material.toneMapped = false;
    return material;
}

export default function WebGLStudioGrid() {
    const isWebGPU = useThree((state) => Boolean(state.gl.isWebGPURenderer));
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

    // Shares the u_camera_position Vector3, so the useFrame copy below drives both paths.
    const nodeMaterial = useMemo(
        () => (isWebGPU ? createGridNodeMaterial(texture, uniform(uniforms.u_camera_position.value)) : null),
        [isWebGPU, texture, uniforms]
    );
    useEffect(() => () => nodeMaterial?.dispose(), [nodeMaterial]);

    useFrame(({ camera }) => {
        if (lastCameraPositionRef.current.equals(camera.position)) {
            return;
        }

        lastCameraPositionRef.current.copy(camera.position);

        if (meshRef.current) {
            meshRef.current.position.x = camera.position.x;
            meshRef.current.position.z = camera.position.z;
        }

        uniforms.u_camera_position.value.copy(camera.position);
    });

    return (
        <mesh ref={meshRef} rotation-x={-Math.PI / 2} position-y={-0.02} renderOrder={-1000} frustumCulled={false}>
            <planeGeometry args={[20000, 20000, 1, 1]} />
            {nodeMaterial ? <primitive object={nodeMaterial} attach="material" /> : <shaderMaterial
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
            />}
        </mesh>
    );
}
