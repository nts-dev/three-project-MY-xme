import {useFrame, useThree} from "@react-three/fiber";
import {useEffect, useRef} from "react";
import * as THREE from 'three'
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass";

const TexturePostProcessing = () => {
    const { gl, scene, camera } = useThree();
    const composer = useRef<EffectComposer>(null);

    useEffect(() => {
        if (!composer.current) {
            composer.current = new EffectComposer(gl);
            const renderPass = new RenderPass(scene, camera);
            composer.current.addPass(renderPass);

            const texture = new THREE.TextureLoader().load(`${import.meta.env.VITE_FILE_URL}/scratches.jpg`);

            const customShader = {
                uniforms: {
                    tDiffuse: { value: null },
                    uTexture: { value: texture },
                },
                vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
                fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform sampler2D uTexture;
          varying vec2 vUv;
          void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            vec4 textureColor = texture2D(uTexture, vUv);
            gl_FragColor = mix(color, textureColor, 0.5);
          }
        `,
            };

            const shaderPass = new ShaderPass(customShader);
            composer.current.addPass(shaderPass);
        }
    }, [gl, scene, camera]);

    useFrame(() => {
        if (composer.current) {
            composer.current.render();
        }
    }, 1);

    return null;
};
export default TexturePostProcessing
