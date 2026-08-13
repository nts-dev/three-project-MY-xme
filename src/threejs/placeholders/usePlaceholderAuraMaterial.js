import { useMemo } from "react";
import * as THREE from "three";
import { AURA_FRAGMENT_SHADER, AURA_VERTEX_SHADER } from "./placeholderConstants";

export default function usePlaceholderAuraMaterial() {
  return useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color("#ffd000") },
        uIntensity: { value: 3.0 },
        uPower: { value: 2.2 },
        uOpacity: { value: 1.0 },
      },
      vertexShader: AURA_VERTEX_SHADER,
      fragmentShader: AURA_FRAGMENT_SHADER,
    });
  }, []);
}
