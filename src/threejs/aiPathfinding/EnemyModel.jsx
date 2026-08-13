import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

export const ENEMY_MODEL_URL = `${import.meta.env.VITE_FILE_URL}/Humanoid_Enemy.glb`;
export const ENEMY_ANIMATIONS = {
  jump: "Humanoid_Jump",
  running: "Humanoid_Running",
  turnLeft: "Humanoid_Turn_Left",
  turnRight: "Humanoid_Turn_Right",
  walking: "Humanoid_Walking",
  idle: "Humanoid_Enemy.002",
};
const ENEMY_Y_OFFSET = -0.01;

function isPositionTrack(track) {
  return track.ValueTypeName === "vector" && track.name.endsWith(".position");
}

function getTrackObject(track, scene) {
  const targetName = track.name.slice(0, track.name.lastIndexOf("."));
  if (targetName === scene.name) return scene;
  return scene.getObjectByName(targetName);
}

function isRootMotionObject(object, scene) {
  if (!object) return false;
  if (object === scene || object.parent === scene) return true;
  if (object.isBone && !object.parent?.isBone) return true;
  return /(^|[:_\-.])(root|hips|pelvis|armature)([:_\-.]|$)/i.test(object.name);
}

function makeInPlaceClip(clip, scene) {
  const tracks = clip.tracks.flatMap((track) => {
    if (clip.name === ENEMY_ANIMATIONS.jump && isPositionTrack(track)) return [];

    const object = getTrackObject(track, scene);
    if (!isPositionTrack(track) || !isRootMotionObject(object, scene)) return track;

    const nextTrack = track.clone();
    for (let index = 0; index < nextTrack.values.length; index += 3) {
      nextTrack.values[index] = object?.position.x || 0;
      nextTrack.values[index + 2] = object?.position.z || 0;
    }
    return [nextTrack];
  });

  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

function applyWorldTransform(object, worldPosition, rotationYRef) {
  if (!object || !worldPosition) return;

  object.position.copy(worldPosition);
  object.position.y += ENEMY_Y_OFFSET;
 
  if (rotationYRef) {
    object.rotation.y = rotationYRef.current;
  }
}

export default function EnemyModel(
  {
    animationName,
    animationIndex = 0,
    animationSpeed = 1,
    loop = true,
    worldPosition,
    rotationYRef,
    onAnimationsLoaded,
    ...props
  }
) {
  const modelRef = useRef(null);
  const previousAnimationRef = useRef(null);
  const gltf = useGLTF(ENEMY_MODEL_URL);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const animations = useMemo(
    () => (gltf.animations || []).map((clip) => makeInPlaceClip(clip, scene)),
    [gltf.animations, scene]
  );
  const { actions, names } = useAnimations(animations, modelRef);

  useEffect(() => {
    onAnimationsLoaded?.({ actions, names, animations });
  }, [actions, animations, names, onAnimationsLoaded]);

  useEffect(() => {
    const clipName = animationName || names[animationIndex] || names[0];
    const action = clipName ? actions[clipName] : null;
    if (!action) return undefined;
    if (previousAnimationRef.current === clipName && action.isRunning()) return undefined;

    Object.values(actions).forEach((otherAction) => {
      if (otherAction !== action) otherAction.fadeOut(0.2);
    });
    action.reset();
    action.timeScale = animationSpeed;
    action.clampWhenFinished = !loop;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.fadeIn(0.2).play();
    applyWorldTransform(modelRef.current, worldPosition, rotationYRef);
    previousAnimationRef.current = clipName;

    return () => {
      action.fadeOut(0.2);
    };
  }, [actions, animationIndex, animationName, animationSpeed, loop, names, rotationYRef, worldPosition]);

  useFrame(() => {
    applyWorldTransform(modelRef.current, worldPosition, rotationYRef);
  });

  return (
    <group ref={modelRef} dispose={null} {...props}  scale={0.015}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(ENEMY_MODEL_URL);
