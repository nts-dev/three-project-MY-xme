import React, { memo, useEffect, useState } from "react";
import { animate } from "motion";
import * as THREE from "three";
import { sceneAssets } from "./player/puzzle/character/Constants.jsx";

const MOTION_OFFSET = new THREE.Vector3(0.65, 0, 0);
const FALLBACK_QUATERNION = new THREE.Quaternion();
const SOURCE_LOOKUP_DELAY_MS = 150;
const MAX_SOURCE_LOOKUP_ATTEMPTS = 8;

function findAnimatableSceneAsset() {
    return Object.values(sceneAssets).find((entry) => entry?.object && entry?.position && entry?.scale);
}

function cloneSceneAssetForMotion(asset) {
    const clone = asset.object.clone(true);
    clone.position.copy(asset.position).add(MOTION_OFFSET);
    clone.quaternion.copy(asset.quarternion || asset.quart || FALLBACK_QUATERNION);
    clone.scale.copy(asset.scale);
    clone.userData.motionLevelAccent = true;
    return clone;
}

function LevelThreeMotionAccent({ enabled, sceneVersion }) {
    const [accentObject, setAccentObject] = useState(null);

    useEffect(() => {
        if (!enabled) {
            setAccentObject(null);
            return undefined;
        }

        let cancelled = false;
        let timer = null;
        let attempts = 0;

        const loadAccentObject = () => {
            if (cancelled) {
                return;
            }

            const sourceAsset = findAnimatableSceneAsset();
            if (sourceAsset) {
                setAccentObject(cloneSceneAssetForMotion(sourceAsset));
                return;
            }

            attempts += 1;
            if (attempts < MAX_SOURCE_LOOKUP_ATTEMPTS) {
                timer = setTimeout(loadAccentObject, SOURCE_LOOKUP_DELAY_MS);
            } else {
                setAccentObject(null);
            }
        };

        timer = setTimeout(loadAccentObject, SOURCE_LOOKUP_DELAY_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [enabled, sceneVersion]);

    useEffect(() => {
        if (!accentObject) {
            return undefined;
        }

        const baseY = accentObject.position.y;
        const rotationControls = animate(
            accentObject.rotation,
            { y: accentObject.rotation.y + Math.PI * 2 },
            { duration: 4, repeat: Infinity, ease: "linear" }
        );
        const bobControls = animate(
            accentObject.position,
            { y: [baseY, baseY + 0.18, baseY] },
            { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
        );

        return () => {
            rotationControls.stop();
            bobControls.stop();
            accentObject.position.y = baseY;
        };
    }, [accentObject]);

    if (!enabled || !accentObject) {
        return null;
    }

    return <primitive object={accentObject} />;
}

export default memo(LevelThreeMotionAccent);
