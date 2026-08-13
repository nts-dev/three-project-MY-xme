import { useEffect } from "react";
import * as THREE from "three";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";

const WIDTH = 32;
const BIRDS = WIDTH * WIDTH;
const BOUNDS = 800;
const BOUNDS_HALF = BOUNDS / 2;
const POINTER_RESET = 10000;

const POSITION_SHADER = `
uniform float time;
uniform float delta;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 tmpPos = texture2D( texturePosition, uv );
  vec3 position = tmpPos.xyz;
  vec3 velocity = texture2D( textureVelocity, uv ).xyz;

  float phase = tmpPos.w;

  phase = mod( ( phase + delta +
    length( velocity.xz ) * delta * 3. +
    max( velocity.y, 0.0 ) * delta * 6. ), 62.83 );

  gl_FragColor = vec4( position + velocity * delta * 15., phase );
}
`;

const VELOCITY_SHADER = `
uniform float time;
uniform float testing;
uniform float delta;
uniform float separationDistance;
uniform float alignmentDistance;
uniform float cohesionDistance;
uniform float freedomFactor;
uniform vec3 predator;

const float width = resolution.x;
const float height = resolution.y;

const float PI = 3.141592653589793;
const float PI_2 = PI * 2.0;

float zoneRadius = 40.0;
float zoneRadiusSquared = 1600.0;

float separationThresh = 0.45;
float alignmentThresh = 0.65;

const float UPPER_BOUNDS = BOUNDS;
const float SPEED_LIMIT = 9.0;

void main() {
  zoneRadius = separationDistance + alignmentDistance + cohesionDistance;
  separationThresh = separationDistance / zoneRadius;
  alignmentThresh = ( separationDistance + alignmentDistance ) / zoneRadius;
  zoneRadiusSquared = zoneRadius * zoneRadius;

  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 birdPosition, birdVelocity;

  vec3 selfPosition = texture2D( texturePosition, uv ).xyz;
  vec3 selfVelocity = texture2D( textureVelocity, uv ).xyz;

  float dist;
  vec3 dir;
  float distSquared;
  float f;
  float percent;

  vec3 velocity = selfVelocity;
  float limit = SPEED_LIMIT;

  dir = predator * UPPER_BOUNDS - selfPosition;
  dir.z = 0.0;
  dist = length( dir );
  distSquared = dist * dist;

  float preyRadius = 150.0;
  float preyRadiusSq = preyRadius * preyRadius;

  if ( dist < preyRadius ) {
    f = ( distSquared / preyRadiusSq - 1.0 ) * delta * 100.0;
    velocity += normalize( dir ) * f;
    limit += 5.0;
  }

  vec3 central = vec3( 0.0, 0.0, 0.0 );
  dir = selfPosition - central;
  dist = length( dir );
  dir.y *= 2.5;
  velocity -= normalize( dir ) * delta * 5.0;

  for ( float y = 0.0; y < height; y++ ) {
    for ( float x = 0.0; x < width; x++ ) {
      vec2 ref = vec2( x + 0.5, y + 0.5 ) / resolution.xy;
      birdPosition = texture2D( texturePosition, ref ).xyz;

      dir = birdPosition - selfPosition;
      dist = length( dir );

      if ( dist < 0.0001 ) continue;

      distSquared = dist * dist;
      if ( distSquared > zoneRadiusSquared ) continue;

      percent = distSquared / zoneRadiusSquared;

      if ( percent < separationThresh ) {
        f = ( separationThresh / percent - 1.0 ) * delta;
        velocity -= normalize( dir ) * f;
      } else if ( percent < alignmentThresh ) {
        float threshDelta = alignmentThresh - separationThresh;
        float adjustedPercent = ( percent - separationThresh ) / threshDelta;
        birdVelocity = texture2D( textureVelocity, ref ).xyz;
        f = ( 0.5 - cos( adjustedPercent * PI_2 ) * 0.5 + 0.5 ) * delta;
        velocity += normalize( birdVelocity ) * f;
      } else {
        float threshDelta = 1.0 - alignmentThresh;
        float adjustedPercent = threshDelta == 0.0 ? 1.0 : ( percent - alignmentThresh ) / threshDelta;
        f = ( 0.5 - ( cos( adjustedPercent * PI_2 ) * -0.5 + 0.5 ) ) * delta;
        velocity += normalize( dir ) * f;
      }
    }
  }

  if ( length( velocity ) > limit ) {
    velocity = normalize( velocity ) * limit;
  }

  gl_FragColor = vec4( velocity, 1.0 );
}
`;

const BIRD_VERTEX_SHADER = `
attribute vec2 reference;
attribute float birdVertex;
attribute vec3 birdColor;

uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
uniform float time;

varying vec4 vColor;
varying float z;

void main() {
  vec4 tmpPos = texture2D( texturePosition, reference );
  vec3 pos = tmpPos.xyz;
  vec3 velocity = normalize( texture2D( textureVelocity, reference ).xyz );

  vec3 newPosition = position;

  if ( birdVertex == 4.0 || birdVertex == 7.0 ) {
    newPosition.y = sin( tmpPos.w ) * 5.0;
  }

  newPosition = mat3( modelMatrix ) * newPosition;

  velocity.z *= -1.0;
  float xz = length( velocity.xz );
  float xyz = 1.0;
  float x = sqrt( max( 0.0, 1.0 - velocity.y * velocity.y ) );

  float cosry = velocity.x / max( 0.0001, xz );
  float sinry = velocity.z / max( 0.0001, xz );

  float cosrz = x / xyz;
  float sinrz = velocity.y / xyz;

  mat3 maty = mat3(
    cosry, 0.0, -sinry,
    0.0, 1.0, 0.0,
    sinry, 0.0, cosry
  );

  mat3 matz = mat3(
    cosrz, sinrz, 0.0,
    -sinrz, cosrz, 0.0,
    0.0, 0.0, 1.0
  );

  newPosition = maty * matz * newPosition;
  newPosition += pos;

  z = newPosition.z;
  vColor = vec4( birdColor, 1.0 );
  gl_Position = projectionMatrix * viewMatrix * vec4( newPosition, 1.0 );
}
`;

const BIRD_FRAGMENT_SHADER = `
varying vec4 vColor;
varying float z;

uniform vec3 color;

void main() {
  float z2 = 0.2 + ( 1000.0 - z ) / 1000.0 * vColor.x;
  gl_FragColor = vec4( z2, z2, z2, 1.0 );
}
`;

class BirdGeometry extends THREE.BufferGeometry {
  constructor() {
    super();

    const trianglesPerBird = 3;
    const triangles = BIRDS * trianglesPerBird;
    const points = triangles * 3;

    const vertices = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
    const birdColors = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
    const references = new THREE.BufferAttribute(new Float32Array(points * 2), 2);
    const birdVertex = new THREE.BufferAttribute(new Float32Array(points), 1);

    this.setAttribute("position", vertices);
    this.setAttribute("birdColor", birdColors);
    this.setAttribute("reference", references);
    this.setAttribute("birdVertex", birdVertex);

    let v = 0;
    const pushVertices = (...values) => {
      values.forEach((value) => {
        vertices.array[v] = value;
        v += 1;
      });
    };

    const wingsSpan = 20;
    for (let f = 0; f < BIRDS; f += 1) {
      pushVertices(0, 0, -20, 0, 4, -20, 0, 0, 30);
      pushVertices(0, 0, -15, -wingsSpan, 0, 0, 0, 0, 15);
      pushVertices(0, 0, 15, wingsSpan, 0, 0, 0, 0, -15);
    }

    for (let i = 0; i < triangles * 3; i += 1) {
      const triangleIndex = Math.floor(i / 3);
      const birdIndex = Math.floor(triangleIndex / trianglesPerBird);
      const x = (birdIndex % WIDTH) / WIDTH;
      const y = Math.floor(birdIndex / WIDTH) / WIDTH;
      const color = new THREE.Color(0x666666 + (Math.floor(i / 9) / BIRDS) * 0x666666);

      birdColors.array[i * 3] = color.r;
      birdColors.array[i * 3 + 1] = color.g;
      birdColors.array[i * 3 + 2] = color.b;
      references.array[i * 2] = x;
      references.array[i * 2 + 1] = y;
      birdVertex.array[i] = i % 9;
    }

    this.scale(0.2, 0.2, 0.2);
  }
}

function fillPositionTexture(texture) {
  const data = texture.image.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.random() * BOUNDS - BOUNDS_HALF;
    data[i + 1] = Math.random() * BOUNDS - BOUNDS_HALF;
    data[i + 2] = Math.random() * BOUNDS - BOUNDS_HALF;
    data[i + 3] = 1;
  }
}

function fillVelocityTexture(texture) {
  const data = texture.image.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (Math.random() - 0.5) * 10;
    data[i + 1] = (Math.random() - 0.5) * 10;
    data[i + 2] = (Math.random() - 0.5) * 10;
    data[i + 3] = 1;
  }
}

export default function GpgpuBirdFlock({ visible = true }) {
  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const host = document.querySelector(".canvas-element") || document.body;
    if (!host) {
      return undefined;
    }

    const overlay = document.createElement("div");
    overlay.className = "birds-overlay";
    Object.assign(overlay.style, {
      position: host === document.body ? "fixed" : "absolute",
      inset: "0",
      pointerEvents: "none",
      zIndex: "2",
      overflow: "hidden",
      background: "transparent",
    });

    if (host !== document.body) {
      const currentPosition = window.getComputedStyle(host).position;
      if (!currentPosition || currentPosition === "static") {
        host.style.position = "relative";
      }
    }

    host.appendChild(overlay);

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0xffffff, 100, 1000);

    const camera = new THREE.PerspectiveCamera(75, 1, 1, 3000);
    camera.position.z = 350;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.pointerEvents = "none";
    overlay.appendChild(renderer.domElement);

    const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
    const dtPosition = gpuCompute.createTexture();
    const dtVelocity = gpuCompute.createTexture();
    fillPositionTexture(dtPosition);
    fillVelocityTexture(dtVelocity);

    const velocityVariable = gpuCompute.addVariable("textureVelocity", VELOCITY_SHADER, dtVelocity);
    const positionVariable = gpuCompute.addVariable("texturePosition", POSITION_SHADER, dtPosition);

    gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);
    gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);

    const positionUniforms = positionVariable.material.uniforms;
    const velocityUniforms = velocityVariable.material.uniforms;

    positionUniforms.time = { value: 0 };
    positionUniforms.delta = { value: 0 };
    velocityUniforms.time = { value: 1 };
    velocityUniforms.delta = { value: 0 };
    velocityUniforms.testing = { value: 1 };
    velocityUniforms.separationDistance = { value: 20 };
    velocityUniforms.alignmentDistance = { value: 20 };
    velocityUniforms.cohesionDistance = { value: 20 };
    velocityUniforms.freedomFactor = { value: 0.75 };
    velocityUniforms.predator = { value: new THREE.Vector3() };
    velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed(2);
    velocityVariable.wrapS = THREE.RepeatWrapping;
    velocityVariable.wrapT = THREE.RepeatWrapping;
    positionVariable.wrapS = THREE.RepeatWrapping;
    positionVariable.wrapT = THREE.RepeatWrapping;

    const error = gpuCompute.init();
    if (error) {
      console.error(error);
      overlay.remove();
      renderer.dispose();
      return undefined;
    }

    const birdUniforms = {
      color: { value: new THREE.Color(0xff2200) },
      texturePosition: { value: null },
      textureVelocity: { value: null },
      time: { value: 1 },
      delta: { value: 0 },
    };

    const birdMesh = new THREE.Mesh(
      new BirdGeometry(),
      new THREE.ShaderMaterial({
        uniforms: birdUniforms,
        vertexShader: BIRD_VERTEX_SHADER,
        fragmentShader: BIRD_FRAGMENT_SHADER,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    );
    birdMesh.rotation.y = Math.PI / 2;
    birdMesh.matrixAutoUpdate = false;
    birdMesh.updateMatrix();
    scene.add(birdMesh);

    let mouseX = POINTER_RESET;
    let mouseY = POINTER_RESET;
    let windowHalfX = 1;
    let windowHalfY = 1;
    let last = performance.now();
    let rafId = 0;

    const resize = () => {
      const rect = overlay.getBoundingClientRect();
      const width = Math.max(1, rect.width || window.innerWidth);
      const height = Math.max(1, rect.height || window.innerHeight);
      windowHalfX = width / 2;
      windowHalfY = height / 2;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const onPointerMove = (event) => {
      mouseX = event.clientX - window.innerWidth / 2;
      mouseY = event.clientY - window.innerHeight / 2;
    };

    const render = () => {
      const now = performance.now();
      let delta = (now - last) / 1000;
      if (delta > 1) delta = 1;
      last = now;

      positionUniforms.time.value = now;
      positionUniforms.delta.value = delta;
      velocityUniforms.time.value = now;
      velocityUniforms.delta.value = delta;
      birdUniforms.time.value = now;
      birdUniforms.delta.value = delta;

      velocityUniforms.predator.value.set(0.5 * mouseX / windowHalfX, -0.5 * mouseY / windowHalfY, 0);
      mouseX = POINTER_RESET;
      mouseY = POINTER_RESET;

      gpuCompute.compute();
      birdUniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
      birdUniforms.textureVelocity.value = gpuCompute.getCurrentRenderTarget(velocityVariable).texture;

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    rafId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      birdMesh.geometry.dispose();
      birdMesh.material.dispose();
      renderer.dispose();
      overlay.remove();
    };
  }, [visible]);

  return null;
}




