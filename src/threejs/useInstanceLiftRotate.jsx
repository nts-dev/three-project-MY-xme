import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import useGame from "../hooks/useGame";


const dummyToken = new THREE.Object3D();
const mat4 = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scl = new THREE.Vector3();
const tmpEuler = new THREE.Euler(0, 0, 0, "YXZ");
const tmpQuat = new THREE.Quaternion();

export function useInstanceLiftRotate(meshRef) {
  const animRef = useRef(null);
  const setItemsDictionary = useGame((s) => s.setItemsDictionary);
  const itemsDictionary = useGame((s) => s.itemsDictionary);
  const setRemovedObject = useGame((s) => s.setRemovedObject);
  const setNotification = useGame((s) => s.setNotification);

  // Add to inventory dictionary
  const addItemToDictionary = (meshName, id) => {
    if (!meshName || !id) return; // safety

    const name = "yellow_key";
    const image = `${name}.png`;

    setItemsDictionary({
      ...itemsDictionary,
      [id]: {
        id,
        name,
        color: null,
        attributes: { attack: 1 },
        image: `${import.meta.env.VITE_VIDEO_URL}/assets/treasure/${image}`,
        stackable: true,
        type: name,
        count: 1,
        active: true,
        alphabet: true,
      },
    });

    setRemovedObject({ name: meshName, id });
  };

  const startAnim = (index, lift = 0.1, spinTurns = 1, duration = 5, meshName, id) => {
    const mesh = meshRef.current;
    if (!mesh || index == null) return;

    mesh.getMatrixAt(index, mat4);
    mat4.decompose(pos, quat, scl);

    tmpEuler.setFromQuaternion(quat);
    const yaw0 = tmpEuler.y;

    animRef.current = {
      index,
      t: 0,
      dur: duration,
      x: pos.x,
      z: pos.z,
      y0: pos.y,
      y1: pos.y + lift,
      yaw0,
      yaw1: yaw0 + spinTurns * Math.PI * 2,
      scale: scl.clone(),
      fadeStart: null,
      meshName,   // ← store here so it's available in useFrame
      id,         // ← store here
    };
  };

  useFrame((_, delta) => {
    const a = animRef.current;
    const mesh = meshRef.current;
    if (!a || !mesh) return;

    // ─── Lifting / spinning phase ───────────────────────────────────────
    if (a.t < 1) {
      a.t = Math.min(a.t + delta / a.dur, 1);
      const s = THREE.MathUtils.smoothstep(a.t, 0, 1);

      const y = THREE.MathUtils.lerp(a.y0, a.y1, s);
      const yaw = THREE.MathUtils.lerp(a.yaw0, a.yaw1, s);

      dummyToken.position.set(a.x, y, a.z);

      tmpEuler.set(-Math.PI / 2, yaw, 0);
      tmpQuat.setFromEuler(tmpEuler);
      dummyToken.quaternion.copy(tmpQuat);

      dummyToken.scale.copy(a.scale);
      dummyToken.updateMatrix();

      mesh.setMatrixAt(a.index, dummyToken.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }

    // ─── Fade-out phase (1 second after reaching top) ────────────────────
    if (a.t >= 1) {
      if (!a.fadeStart) {
        a.fadeStart = performance.now(); // start 1-second fade timer
      }

      const fadeElapsed = performance.now() - a.fadeStart;
      const fadeT = Math.min(fadeElapsed / 1000, 1); // 1 second

      // Scale down to zero (disappears visually)
      const fadeScale = THREE.MathUtils.lerp(1, 0, fadeT);
      dummyToken.scale.set(fadeScale, fadeScale, fadeScale);
      dummyToken.position.set(a.x, a.y1, a.z); // stay at top
      dummyToken.updateMatrix();

      mesh.setMatrixAt(a.index, dummyToken.matrix);
      mesh.instanceMatrix.needsUpdate = true;

      // ─── Unload / cleanup when fade complete ───────────────────────────
      if (fadeT >= 1) {
        // Add to inventory using stored meshName and id
        if (a.meshName && a.id) {
          addItemToDictionary(a.meshName, a.id);

            setNotification({
                header: 'Key Unlocked!',
                text: `New key Unlocked in added you your Inventory!`,
                htmlCode: '&#9432;',
                position: 'center',
                id: a.id,
                timeout: 5000
            });
        } else {
           
          console.warn("Missing meshName or id for placeholder", a.index);
        }

        // Clear animation — instance is now "unloaded"
        animRef.current = null;
      }
    }
  });

  return { startAnim };
}