export const AURA_SCALE = 1.10;
export const SNAP_DURATION = 0.8;

export const AURA_VERTEX_SHADER = `
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const AURA_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  uniform float uOpacity;

  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    float fresnel = pow(1.0 - max(dot(normalize(vNormalW), viewDir), 0.0), uPower);

    float pulse = 0.85 + 0.15 * sin(uTime * 6.0);

    float alpha = fresnel * uIntensity * pulse * uOpacity;

    float fill = 0.10 + 0.10 * sin(uTime * 2.5);
    alpha += fill * 0.25;

    gl_FragColor = vec4(uColor, alpha);
  }
`;
