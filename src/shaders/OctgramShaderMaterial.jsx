import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';

const OctgramShaderMaterial = shaderMaterial(
    {
        uTime: 0,
        uResolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
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
    precision highp float;

    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;

    mat2 rot(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, s, -s, c);
    }

    float sdBox(vec3 p, vec3 b) {
      vec3 q = abs(p) - b;
      return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
    }

    float box(vec3 pos, float scale) {
      pos *= scale;
      float base = sdBox(pos, vec3(0.4, 0.4, 0.1)) / 1.5;
      pos.xy *= 5.0;
      pos.y -= 3.5;
      pos.xy *= rot(0.75);
      return -base;
    }

    float box_set(vec3 pos, float tmod, float sinT) {
      vec3 pos_origin = pos;
      float scale = 2.0 - abs(sinT) * 1.5;
      float result = -9999.0;
      vec3 tempPos;

      // 4 Boxes in cross pattern
      for (int i = 0; i < 4; i++) {
        tempPos = pos_origin;
        if (i == 0) tempPos.y += sinT * 2.5;
        if (i == 1) tempPos.y -= sinT * 2.5;
        if (i == 2) tempPos.x += sinT * 2.5;
        if (i == 3) tempPos.x -= sinT * 2.5;
        tempPos.xy *= rot(0.8);
        result = max(result, box(tempPos, scale));
      }

      // Center box with rotation
      tempPos = pos_origin;
      tempPos.xy *= rot(0.8);
      result = max(result, box(tempPos, 0.5) * 6.0);

      // Additional center box without rotation
      tempPos = pos_origin;
      result = max(result, box(tempPos, 0.5) * 6.0);

      return result;
    }

    float map(vec3 pos, float tmod, float sinT) {
      return box_set(pos, tmod, sinT);
    }

    void main() {
      vec2 resSafe = max(uResolution.xy, vec2(1.0));
      vec2 fragCoord = vUv * resSafe;
      vec2 p = (fragCoord * 2.0 - resSafe) / min(resSafe.x, resSafe.y);

      vec3 ro = vec3(0.0, -0.2, uTime * 4.0);
      vec3 ray = normalize(vec3(p, 1.5));
      ray.xy = rot(sin(uTime * 0.03) * 5.0) * ray.xy;
      ray.yz = rot(sin(uTime * 0.05) * 0.2) * ray.yz;

      float t = 0.1;
      vec3 col = vec3(0.0);
      float ac = 0.0;
      float tmod;
      float sinT;
      float gTime;

      for (int i = 0; i < 70; i++) {
        vec3 pos = ro + ray * t;
        pos = mod(pos - 2.0, 4.0) - 2.0;
        gTime = uTime - float(i) * 0.01;
        tmod = gTime * 0.4;
        sinT = sin(tmod);

        float d = map(pos, tmod, sinT);
        d = max(abs(d), 0.01); // avoid zero-step
        ac += exp(-d * 23.0);
        t += d * 0.55;
      }

      col = vec3(ac * 0.02);
      col += vec3(0.0, 0.2 * abs(sin(uTime)), 0.5 + sin(uTime) * 0.2);

      gl_FragColor = vec4(col, clamp(1.0 - t * (0.02 + 0.02 * sin(uTime)), 0.0, 1.0));
    }
  `
);


export default OctgramShaderMaterial;