import { useAnimations } from "@react-three/drei";
import {useEffect, useMemo, useRef, useState} from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import useGame from "../../../../hooks/useGame";
import { useGame1 } from "../../../../hooks/useGame1";
import KinematicPlayer from "./KinematicPlayer";
import RemotePlayerList from "./RemotePlayerList";
import { setAvatarLoadingHudVisible } from "./avatarLoadingHudStore";

const AVATAR_MODEL_URL = `${import.meta.env.VITE_FILE_URL}/avatar.glb`;
const AVATAR_ALPHA_URL = `${import.meta.env.VITE_FILE_URL}/Opacity.jpg`;
const sharedTextureLoader = new THREE.TextureLoader();
const avatarTextureCache = new Map();
const AVATAR_FALLBACK_COLORS = {
    YL: "#f8e84b",
    BL: "#33a4ff",
    RD: "#ff6262",
    GR: "#2dff88",
    BR: "#c9854a",
    WH: "#f0f0f0",
    PU: "#7760ff",
    OR: "#f87603",
};

const animationSet = {
    idle: "Idle 1",
    walk: "Walk",
    jump: "Jump Takeoff",
    jumpDown: "Jump Down",
    levitate: "Floating",
    run: "Run",
    fail: "Backwards Dying",
    recover: "Stand Up",
    climb: "Ladder Climb",
    left: "Turn Left",
    right: "Turn Right",
    push: "Push",
    upstairs: "Running Up Stairs"
};

const loopingAnimations = new Set([animationSet.walk, animationSet.run, animationSet.upstairs]);
const oneShotAnimations = new Set([
    animationSet.jumpDown,
    animationSet.fail,
    animationSet.recover,
    animationSet.left,
    animationSet.right,
]);
const repeatInPlaceAnimations = new Set([animationSet.levitate, animationSet.climb, animationSet.push]);

const loadAvatarTexture = (fileName) => {
    const url = `${import.meta.env.VITE_FILE_URL}/${fileName}`;
    if (!avatarTextureCache.has(url)) {
        avatarTextureCache.set(
            url,
            new Promise((resolve, reject) => {
                sharedTextureLoader.load(url, resolve, undefined, reject);
            }).catch((error) => {
                avatarTextureCache.delete(url);
                throw error;
            })
        );
    }
    return avatarTextureCache.get(url);
};

const createFallbackAvatarTexture = (colorCode) => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext("2d");
    const color = AVATAR_FALLBACK_COLORS[String(colorCode || "").toUpperCase()] || "#31e5e8";

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
};

export default function CharacterAnimation({ orbitControlsRef, client }) {
    const character = useGame((state) => state.firstPerson);
    const [loadedModel, setLoadedModel] = useState(null);
    const [characterModel, setCharacterModel] = useState(null);
    const resetAnimation = useGame1((state) => state.reset);
    const initializeAnimationSet = useGame1((state) => state.initializeAnimationSet);
    const curAnimation = useGame1((state) => state.curAnimation);
    const movingSpeed = useGame((state) => state.movingSpeed);
    const setAvatarColors = useGame((state) => state.setAvatarColors);
    const avatarColor = useGame((state) => state.avatarColor);
    const firstPerson = useGame((state) => state.character)
    const buttonMode = useGame((state) => state.buttonMode)
    const prevAnimationRef = useRef(null);
    const materialRef = useRef(null);
    const selectedMaterialReadyRef = useRef(false);
    const activeActionRef = useRef(null);
    const activeBaseTimeScaleRef = useRef(1);
    const activeClockLockedRef = useRef(false);
    const activeClockStartRef = useRef(0);
    const activeTimeOffsetRef = useRef(0);
    const loopTimeByAnimationRef = useRef({});
    // --- Load GLB once ---
    const gltf = useLoader(GLTFLoader, AVATAR_MODEL_URL);
    const charModel = useMemo(() => gltf, [gltf]);

    // --- Alpha texture (static, load once) ---
    const alphaTexture = useLoader(
        THREE.TextureLoader,
        AVATAR_ALPHA_URL
    );
    useEffect(() => {
        alphaTexture.colorSpace = THREE.NoColorSpace;
        alphaTexture.wrapS = alphaTexture.wrapT = THREE.RepeatWrapping;
        alphaTexture.needsUpdate = true;
    }, [alphaTexture]);

    // --- Color texture (dynamic, depends on avatarColor) ---
    const [colorTexture, setColorTexture] = useState(null);

    useEffect(() => {
        if (!avatarColor) return; // wait until a color is set
        let cancelled = false;
        selectedMaterialReadyRef.current = false;
        setCharacterModel(null);
        setColorTexture(null);

        loadAvatarTexture(avatarColor)
            .then((tex) => {
                if (cancelled) return;
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.needsUpdate = true;

                setColorTexture(tex);
            })
            .catch((error) => {
                if (cancelled) return;
                console.warn("Failed to load avatar texture, using generated fallback:", error);
                setColorTexture(createFallbackAvatarTexture(avatarColor));
            });

        return () => {
            cancelled = true;
        };
    }, [avatarColor]);

    // --- Apply material when model or textures ready ---
    useEffect(() => {
        if (!loadedModel || !colorTexture || !alphaTexture) return;
        if (!colorTexture.image || !alphaTexture.image) return;

        // Reuse or create material
        if (!materialRef.current) {
            materialRef.current = new THREE.MeshStandardMaterial({
                map: colorTexture,
                emissiveMap: colorTexture,
                emissive: new THREE.Color(0xffffff),
                emissiveIntensity: 1.2,
                alphaMap: alphaTexture,
                alphaTest: 0.5,
            });
        } else {
            materialRef.current.map = colorTexture;
            materialRef.current.emissiveMap = colorTexture;
            materialRef.current.alphaMap = alphaTexture;
            materialRef.current.needsUpdate = true;
        }

        loadedModel.traverse((child) => {
            if (child.isMesh && child.name !== "OrbitingShape") {
                if (!child.geometry.attributes.uv) {
                    console.warn(`Mesh ${child.name} has no UVs, skipping material assign`);
                    return;
                }

                const oldMat = child.material;
                child.material = materialRef.current;

                // Safely dispose old material after render
                if (oldMat && oldMat !== materialRef.current && oldMat.dispose) {
                    requestAnimationFrame(() => {
                        try { oldMat.dispose(); } catch(e) {
                            console.error("Failed to dispose old material:", e);
                        }
                    });
                }
            }
        });

        selectedMaterialReadyRef.current = true;
        setCharacterModel(loadedModel);

    }, [loadedModel, colorTexture, alphaTexture]);

    // --- Animations ---
    const { animations } = charModel;
    const { actions } = useAnimations(animations, characterModel);

    useEffect(() => {
        initializeAnimationSet(animationSet);
    }, []);

    useEffect(() => {
        resetAnimation();
    }, []);

    useEffect(() => {
        if (!actions || !curAnimation) return;
        if (prevAnimationRef.current === curAnimation) return; // ✅ no re-trigger on same state

        const speed = 1 + (40 * movingSpeed) * 0.8;
        const action = actions[curAnimation ?? animationSet.idle];
        if (!action) return;

        let fadeDuration = 0.1;
        const prev = prevAnimationRef.current;
        const prevAction = prev ? actions[prev] : null;

        if (
            (prev === animationSet.idle && curAnimation === animationSet.walk) ||
            (prev === animationSet.walk && curAnimation === animationSet.idle)
        ) fadeDuration = 0.5;
        else if (
            (prev === animationSet.walk && curAnimation === animationSet.run) ||
            (prev === animationSet.run && curAnimation === animationSet.walk)
        ) fadeDuration = 0.2;

        if (prevAction && loopingAnimations.has(prev)) {
            const clipDuration = prevAction.getClip?.()?.duration || 0;
            loopTimeByAnimationRef.current[prev] = clipDuration > 0
                ? prevAction.time % clipDuration
                : prevAction.time;
        }

        if (prevAction && prevAction !== action) {
            prevAction.clampWhenFinished = false;
            prevAction.fadeOut(fadeDuration);
        }

        action.enabled = true;
        action.clampWhenFinished = false;
        activeActionRef.current = action;
        activeBaseTimeScaleRef.current = 1;
        activeClockLockedRef.current = false;
        activeClockStartRef.current = performance.now() / 1000;
        activeTimeOffsetRef.current = 0;
        action.timeScale = 1;

        // --- configure and play ---
        if (curAnimation === animationSet.jump) {
            action.reset()
                .fadeIn(fadeDuration)
                .setLoop(THREE.LoopOnce, 1)
                .play();
            activeBaseTimeScaleRef.current = speed / 0.8;
            action.timeScale = activeBaseTimeScaleRef.current;
            action.clampWhenFinished = true;
        } else if (curAnimation === animationSet.idle) {
            action.reset().fadeIn(fadeDuration).setLoop(THREE.LoopRepeat).play();
        } else if (oneShotAnimations.has(curAnimation)) {
            action.reset().fadeIn(fadeDuration).setLoop(THREE.LoopOnce, 1).play();
            action.clampWhenFinished = true;
        } else if (curAnimation === animationSet.walk || curAnimation === animationSet.run) {
            const clipDuration = action.getClip?.()?.duration || 0;
            const restoredTime = loopTimeByAnimationRef.current[curAnimation] || 0;
            action.reset().fadeIn(fadeDuration).setLoop(THREE.LoopRepeat).play();
            if (clipDuration > 0) {
                action.time = restoredTime % clipDuration;
                activeTimeOffsetRef.current = action.time;
            }
            activeBaseTimeScaleRef.current = speed;
            activeClockLockedRef.current = true;
            activeClockStartRef.current = performance.now() / 1000;
            action.timeScale = activeBaseTimeScaleRef.current;
        } else if (repeatInPlaceAnimations.has(curAnimation)) {
            action.reset().fadeIn(0.1).setLoop(THREE.LoopRepeat).play();
        } else if (curAnimation === animationSet.upstairs) {
            const clipDuration = action.getClip?.()?.duration || 0;
            const restoredTime = loopTimeByAnimationRef.current[curAnimation] || 0;
            action.reset().fadeIn(0.1).setLoop(THREE.LoopRepeat).play();
            if (clipDuration > 0) {
                action.time = restoredTime % clipDuration;
                activeTimeOffsetRef.current = action.time;
            }
            activeBaseTimeScaleRef.current = speed;
            activeClockLockedRef.current = true;
            activeClockStartRef.current = performance.now() / 1000;
            action.timeScale = activeBaseTimeScaleRef.current;
        }
        else {
            action.reset().fadeIn(fadeDuration).setLoop(THREE.LoopOnce, 1).play();
        }

        prevAnimationRef.current = curAnimation;

        // ✅ delayed cleanup avoids same-frame freeze
    }, [curAnimation, actions]);

    useEffect(() => {
        const action = activeActionRef.current;
        if (!action) return;

        const speed = 1 + (40 * movingSpeed) * 0.8;
        if (curAnimation === animationSet.jump) {
            activeBaseTimeScaleRef.current = speed / 0.8;
        } else if (loopingAnimations.has(curAnimation)) {
            const clipDuration = action.getClip?.()?.duration || 0;
            if (activeClockLockedRef.current && clipDuration > 0) {
                activeTimeOffsetRef.current = action.time % clipDuration;
                activeClockStartRef.current = performance.now() / 1000;
            }
            activeBaseTimeScaleRef.current = speed;
        } else {
            activeBaseTimeScaleRef.current = 1;
        }
        action.timeScale = activeBaseTimeScaleRef.current;
    }, [curAnimation, movingSpeed]);

    useFrame(() => {
        const action = activeActionRef.current;
        if (!activeClockLockedRef.current || !action) return;

        const clipDuration = action.getClip?.()?.duration || 0;
        if (clipDuration <= 0) return;

        const elapsed = performance.now() / 1000 - activeClockStartRef.current;
        action.time = (activeTimeOffsetRef.current + elapsed * activeBaseTimeScaleRef.current) % clipDuration;
        action.getMixer?.().update(0);
    });




    // --- Setup model ---
    useEffect(() => {
        const model = charModel.scene;

        model.scale.set(0.01, 0.01, 0.01);

        const textures = model.children[0]?.userData?.Textures;
        if (textures) {
            const parsedTextures = JSON.parse(textures)[0];
            const colors = [];
            for (const i in parsedTextures) {
                colors.push({ name: i, code: parsedTextures[i] });
            }
            setAvatarColors(colors);
        }
        setLoadedModel(model);

    }, [charModel]);

    // --- Layer visibility (firstPerson toggle) ---
    useEffect(() => {
        if (characterModel) {
            characterModel.traverse((child) => {
                if (child.isMesh) {
                    child.layers.mask = character || buttonMode==='Edit Mode' ? 0 : 1;
                }
            });
        }
    }, [character, characterModel, buttonMode]);

    const isAvatarLoading = Boolean(avatarColor && (!characterModel || !selectedMaterialReadyRef.current));

    useEffect(() => {
        setAvatarLoadingHudVisible(isAvatarLoading);
        return () => {
            setAvatarLoadingHudVisible(false);
        };
    }, [isAvatarLoading]);

    if (!characterModel || !selectedMaterialReadyRef.current) {
        return null;
    }

    return (
        <>
            <KinematicPlayer
                orbitControlsRef={orbitControlsRef}
                characterModel={characterModel}
                clientId={client}
            />
            {(character || firstPerson) && <RemotePlayerList playerObject={charModel} />}
        </>
    );
}
