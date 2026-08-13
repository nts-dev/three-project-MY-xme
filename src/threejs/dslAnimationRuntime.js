import { animate as motionAnimate } from "motion";
import * as THREE from "three";

const VALUE_SCALE = 0.01;
const ACTIVE = new Map();

export function readDslAnimations(properties) {
  const source = typeof properties === "string" ? safeParse(properties) : properties;
  return Array.isArray(source?.dslAnimations) ? source.dslAnimations : [];
}

export function applyDslAnimations(key, entries, getInitialState, onUpdate) {
  clearDslAnimations(key);
  if (!Array.isArray(entries) || !entries.length) {
    return () => clearDslAnimations(key);
  }

  const animations = [];
  entries.forEach((entry) => {
    if (String(entry?.engine || "").toLowerCase() === "motion") {
      animations.push(...startMotionAnimations(entry, onUpdate));
      return;
    }

    const target = {};
    if (Array.isArray(entry?.targetInstanceIds)) {
      target.targetInstanceIds = entry.targetInstanceIds.map(String);
    }

    const sequence = startMotionSequence(entry, target, onUpdate);
    animations.push(sequence);
  });

  ACTIVE.set(key, animations);
  return () => clearDslAnimations(key);
}

function startMotionSequence(entry, target, onUpdate) {
  const controls = [];
  let stopped = false;
  let timer = null;

  const steps = Array.isArray(entry?.steps) ? entry.steps : [];
  if (!steps.length) {
    return {
      stop() {},
      kill() {
        this.stop();
      },
    };
  }

  const entryRepeat = Number.isFinite(Number(entry?.repeat)) ? Number(entry.repeat) : 0;
  let repeatCount = 0;
  let stepIndex = 0;

  const cleanupTimer = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const runNext = () => {
    if (stopped) return;
    const step = steps[stepIndex];
    if (!step) {
      if (entryRepeat < 0 || repeatCount < entryRepeat) {
        repeatCount += 1;
        stepIndex = 0;
        runNext();
      }
      return;
    }

    stepIndex += 1;

    if (step.type === "wait") {
      timer = setTimeout(runNext, (Number(step.duration) || 0) * 1000);
      return;
    }

    const propertyInfo = resolveProperty(step.property);
    if (!propertyInfo) {
      runNext();
      return;
    }

    if (propertyInfo.type === "curve") {
      controls.push(startCurveMotion(target, step, onUpdate, runNext));
      return;
    }

    if (propertyInfo.type === "color") {
      controls.push(startColorMotion(target, step, onUpdate, runNext));
      return;
    }

    if (step.from !== undefined) {
      Object.assign(target, convertAnimationValue(propertyInfo, step.from));
      onUpdate(target);
    }

    controls.push(motionAnimate(target, convertAnimationValue(propertyInfo, step.to ?? step.from ?? 0), {
      duration: Number(step.duration) || 0,
      ease: normalizeMotionEase(step.ease),
      repeat: Number.isFinite(Number(step.repeat)) ? Number(step.repeat) : 0,
      repeatType: step.yoyo ? "reverse" : "loop",
      onUpdate: () => onUpdate(target),
      onComplete: runNext,
    }));
  };

  runNext();

  return {
    stop() {
      stopped = true;
      cleanupTimer();
      controls.forEach((control) => control?.stop?.());
    },
    kill() {
      this.stop();
    },
  };
}

function startCurveMotion(target, step, onUpdate, onComplete) {
  const from = toVector(step.from);
  const via = toVector(step.via ?? step.from);
  const to = toVector(step.to ?? step.from);
  const progressState = { progress: 0 };

  applyCurvePoint(target, from, via, to, 0);
  onUpdate(target);

  return motionAnimate(progressState, { progress: 1 }, {
    duration: Number(step.duration) || 0,
    ease: normalizeMotionEase(step.ease),
    repeat: Number.isFinite(Number(step.repeat)) ? Number(step.repeat) : 0,
    repeatType: step.yoyo ? "reverse" : "loop",
    onUpdate: () => {
      applyCurvePoint(target, from, via, to, progressState.progress);
      onUpdate(target);
    },
    onComplete,
  });
}

function startColorMotion(target, step, onUpdate, onComplete) {
  const from = toColorRange(step.from);
  const to = toColorRange(step.to ?? step.from);

  if (!step.random) {
    Object.assign(target, from);
    onUpdate(target);
    return motionAnimate(target, to, {
      duration: Number(step.duration) || 0,
      ease: normalizeMotionEase(step.ease),
      repeat: Number.isFinite(Number(step.repeat)) ? Number(step.repeat) : 0,
      repeatType: step.yoyo ? "reverse" : "loop",
      onUpdate: () => onUpdate(target),
      onComplete,
    });
  }

  const state = { progress: 0 };
  const applyRandomColor = () => {
    Object.assign(target, randomColorBetween(from, to));
    onUpdate(target);
  };
  applyRandomColor();

  return motionAnimate(state, { progress: 1 }, {
    duration: Number(step.duration) || 0,
    ease: normalizeMotionEase(step.ease),
    repeat: Number.isFinite(Number(step.repeat)) ? Number(step.repeat) : 0,
    repeatType: step.yoyo ? "reverse" : "loop",
    onRepeat: applyRandomColor,
    onUpdate: () => onUpdate(target),
    onComplete,
  });
}

export function animationTargetToTransform(target) {
  return {
    position: new THREE.Vector3(target.x, target.y, target.z),
    rotation: new THREE.Euler(target.rx, target.ry, target.rz),
    color: new THREE.Color(
      clampColorChannel(target.cr ?? 255) / 255,
      clampColorChannel(target.cg ?? 255) / 255,
      clampColorChannel(target.cb ?? 255) / 255
    )
  };
}

export function clearDslAnimations(key) {
  const animations = ACTIVE.get(key);
  animations?.forEach((animation) => {
    if (typeof animation?.kill === "function") {
      animation.kill();
      return;
    }
    animation?.stop?.();
  });
  ACTIVE.delete(key);
}

function startMotionAnimations(entry, onUpdate) {
  const controls = [];

  entry.steps?.forEach((step) => {
    if (step.type === "wait") {
      return;
    }

    const propertyInfo = resolveMotionProperty(step);
    if (!propertyInfo || propertyInfo.type === "curve") {
      return;
    }

    const target = {};
    if (Array.isArray(entry?.targetInstanceIds)) {
      target.targetInstanceIds = entry.targetInstanceIds.map(String);
    }
    const fromValue = convertAnimationValue(propertyInfo, step.from ?? 0);
    const toValue = convertAnimationValue(propertyInfo, step.to ?? step.from ?? 0);
    const keyframes = Object.keys({ ...fromValue, ...toValue }).reduce((acc, key) => {
      acc[key] = [fromValue[key] ?? 0, toValue[key] ?? fromValue[key] ?? 0];
      return acc;
    }, {});

    Object.assign(target, fromValue);
    if (propertyInfo.absolutePosition) {
      target.__absolutePosition = true;
    }
    onUpdate(target);

    controls.push(motionAnimate(target, keyframes, {
      duration: Number(step.duration) || 0,
      ease: normalizeMotionEase(step.ease),
      repeat: normalizeMotionRepeat(step.repeat ?? entry.repeat),
      repeatType: step.yoyo ? "reverse" : "loop",
      onUpdate: () => onUpdate(target)
    }));
  });

  return controls;
}

function resolveMotionProperty(step) {
  const propertyInfo = resolveProperty(step.property);
  if (!propertyInfo) {
    return null;
  }

  const property = String(step.property || "").toLowerCase();
  const hasVectorPosition = property.startsWith("move") && (Array.isArray(step.from) || Array.isArray(step.to));
  if (!hasVectorPosition || propertyInfo.type || property === "move") {
    return property === "move" && hasVectorPosition
      ? { ...propertyInfo, absolutePosition: true }
      : propertyInfo;
  }

  return { keys: ["x", "y", "z"], absolutePosition: true };
}

function normalizeMotionRepeat(value) {
  const repeat = Number(value);
  if (!Number.isFinite(repeat) || repeat === 0) {
    return 0;
  }
  return repeat < 0 ? Infinity : repeat;
}

function normalizeMotionEase(value) {
  const ease = String(value || "linear").trim();
  const aliases = {
    none: "linear",
    "sine.inout": "easeInOut",
    "power1.inout": "easeInOut",
    "power2.out": "easeOut",
    "expo.out": "easeOut"
  };
  return aliases[ease.toLowerCase()] || ease;
}

function mapProperty(property) {
  switch (String(property || "").toLowerCase()) {
    case "movex": return { keys: ["x"], pointIndex: 0 };
    case "movey": return { keys: ["y"], pointIndex: 1 };
    case "movez": return { keys: ["z"], pointIndex: 2 };
    case "move": return { keys: ["x", "y", "z"] };
    case "movecurve":
    case "trajectory":
    case "curve": return { type: "curve", keys: ["x", "y", "z"] };
    case "rotatex": return { keys: ["rx"], pointIndex: 0 };
    case "rotatey": return { keys: ["ry"], pointIndex: 1 };
    case "rotatez": return { keys: ["rz"], pointIndex: 2 };
    case "rotate": return { keys: ["rx", "ry", "rz"] };
    case "color": return { type: "color", keys: ["cr", "cg", "cb"] };
    default: return null;
  }
}

function resolveProperty(property) {
  return mapProperty(property);
}

function convertAnimationValue(propertyInfo, value) {
  if (Array.isArray(value)) {
    if (propertyInfo.keys.length === 1) {
      const key = propertyInfo.keys[0];
      const sourceValue = value[propertyInfo.pointIndex] ?? 0;
      return { [key]: convertValue(key, sourceValue) };
    }

    return propertyInfo.keys.reduce((acc, key, index) => {
      acc[key] = convertValue(key, value[index] ?? 0);
      return acc;
    }, {});
  }

  if (propertyInfo.keys.length === 1) {
    const key = propertyInfo.keys[0];
    return { [key]: convertValue(key, value) };
  }

  return propertyInfo.keys.reduce((acc, key) => {
    acc[key] = convertValue(key, value);
    return acc;
  }, {});
}

function convertValue(propertyKey, value) {
  const numeric = Number(value) || 0;
  if (propertyKey.startsWith("r")) {
    return THREE.MathUtils.degToRad(numeric);
  }
  if (propertyKey.startsWith("c")) {
    return clampColorChannel(numeric);
  }
  return numeric * VALUE_SCALE;
}

function toVector(value) {
  if (Array.isArray(value)) {
    return {
      x: (Number(value[0]) || 0) * VALUE_SCALE,
      y: (Number(value[1]) || 0) * VALUE_SCALE,
      z: (Number(value[2]) || 0) * VALUE_SCALE
    };
  }

  const numeric = (Number(value) || 0) * VALUE_SCALE;
  return { x: numeric, y: numeric, z: numeric };
}

function applyCurvePoint(target, from, via, to, progress) {
  const inv = 1 - progress;
  target.x = inv * inv * from.x + 2 * inv * progress * via.x + progress * progress * to.x;
  target.y = inv * inv * from.y + 2 * inv * progress * via.y + progress * progress * to.y;
  target.z = inv * inv * from.z + 2 * inv * progress * via.z + progress * progress * to.z;
}

function toColorRange(value) {
  if (typeof value === "string") {
    return parseHexColorRange(value);
  }

  if (Array.isArray(value)) {
    return {
      cr: clampColorChannel(value[0]),
      cg: clampColorChannel(value[1]),
      cb: clampColorChannel(value[2])
    };
  }

  const channel = clampColorChannel(value);
  return { cr: channel, cg: channel, cb: channel };
}

function parseHexColorRange(value) {
  const normalized = String(value || "").trim().replace(/^#/, "");

  if (![3, 4, 6, 8].includes(normalized.length)) {
    return { cr: 255, cg: 255, cb: 255 };
  }

  const expanded = normalized.length <= 4
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;

  return {
    cr: clampColorChannel(Number.parseInt(expanded.slice(0, 2), 16)),
    cg: clampColorChannel(Number.parseInt(expanded.slice(2, 4), 16)),
    cb: clampColorChannel(Number.parseInt(expanded.slice(4, 6), 16))
  };
}

function randomColorBetween(from, to) {
  return {
    cr: randomBetween(from.cr, to.cr),
    cg: randomBetween(from.cg, to.cg),
    cb: randomBetween(from.cb, to.cb)
  };
}

function randomBetween(left, right) {
  const min = Math.min(clampColorChannel(left), clampColorChannel(right));
  const max = Math.max(clampColorChannel(left), clampColorChannel(right));
  return Math.round(min + Math.random() * (max - min));
}

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, Number(value) || 0));
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
