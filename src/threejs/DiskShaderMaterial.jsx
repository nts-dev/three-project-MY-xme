import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';

const DisksShaderMaterial = shaderMaterial(
    {
        uResolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        uTime: 0,
        uFrame: 0,
        uMouse: new THREE.Vector4(0, 0, 0, 0),
        uChannel0: null,
        uChannel1: null,
    },
        // Vertex Shader
        `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
        // Fragment Shader
        `
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uFrame;
    uniform vec4 uMouse;
    uniform sampler2D uChannel0;
    uniform sampler2D uChannel1;

    varying vec2 vUv;

    void main() {
      vec2 e = vec2(1.0 / uResolution.xy);
      vec2 q = vUv;

      vec4 c = texture2D(uChannel0, q);
      float p11 = c.x;

      float p10 = texture2D(uChannel1, q - vec2(e.x, 0.0)).x;
      float p01 = texture2D(uChannel1, q - vec2(0.0, e.y)).x;
      float p21 = texture2D(uChannel1, q + vec2(0.0, e.y)).x;
      float p12 = texture2D(uChannel1, q + vec2(e.x, 0.0)).x;

      float d = 0.0;

      if (uMouse.z > 0.0) {
        d = smoothstep(4.5, 0.5, length(uMouse.xy * uResolution - q * uResolution));
      } else {
        float t = uTime * 2.0;
        vec2 pos = fract(floor(t) * vec2(0.456665, 0.708618)) * uResolution;
        float amp = 1.0 - step(0.05, fract(t));
        d = -amp * smoothstep(2.5, 0.5, length(pos - q * uResolution));
      }

      d += -(p11 - 0.5) * 2.0 + (p10 + p01 + p21 + p12 - 2.0);
      d *= 0.99;
      d *= min(1.0, uFrame);
      d = d * 0.5 + 0.5;

      vec3 normal;
      normal.x = texture2D(uChannel0, q - vec2(e.x, 0.0)).x - texture2D(uChannel0, q + vec2(e.x, 0.0)).x;
      normal.y = texture2D(uChannel0, q - vec2(0.0, e.y)).x - texture2D(uChannel0, q + vec2(0.0, e.y)).x;
      normal.z = 1.0;
      normal = normalize(normal);

      vec3 lightDir = normalize(vec3(0.5, 0.5, 1.0));
      float diffuse = max(dot(normal, lightDir), 0.0);
      vec3 color = vec3(0.1, 0.5, 0.8) * (diffuse + 0.2);

      gl_FragColor = vec4(color, 0.8);
    }
  `
);

extend({ DisksShaderMaterial });



export default DisksShaderMaterial;