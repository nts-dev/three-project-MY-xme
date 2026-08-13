// objectPool.js
import * as THREE from 'three';

/* --------------------------------------------------------------
   1. RE-USABLE POOL (outside the component – only once)
   -------------------------------------------------------------- */
const POOL = {
    vec3: () => new THREE.Vector3(),
    quat: () => new THREE.Quaternion(),
    ray:  () => new THREE.Ray(),
};

/* generic reuse / recycle helpers */
const reuse = (factory, pool = []) => {
    return pool.pop() ?? factory();
};

const recycle = (obj, pool = []) => {
    // Reset Vector3 → (0,0,0), Quaternion → identity (0,0,0,1)
    if ('w' in obj) {
        obj.set(0, 0, 0, 1);
    } else {
        obj.set(0, 0, 0);
    }
    pool.push(obj);
};

/* --------------------------------------------------------------
   2. PRE-ALLOCATE EVERYTHING YOU WILL EVER NEED
   -------------------------------------------------------------- */
export const V = Array.from({ length: 30 }, POOL.vec3);   // increase if needed
export const Q = Array.from({ length: 8 },  POOL.quat);
export const R = [POOL.ray()];                           // only one ray

/* indices – mutated every frame */
export let vIdx = 0;
export let qIdx = 0;
export let rIdx = 0;

/* getters */
export const nextV = () => V[vIdx++];
export const nextQ = () => Q[qIdx++];
export const nextR = () => R[rIdx];

/* call at the very start of useFrame */
export const resetPoolIndices = () => {
    vIdx = 0;
    qIdx = 0;
    rIdx = 0;
};