import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Box3, Vector3 } from "three";
import useGame from "../hooks/useGame";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import InstancePattern from "./InstancePattern";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import Rack from "./rack/Rack";
// import database from '../database';
// import { Q } from '@nozbe/watermelondb';
import DevicePath from "./scene/DevicePath";
import Dots from "./scene/Dots";
// @ts-ignore
import makeComposite from "./composite/Composite";
// @ts-ignore
import { FormMixer } from "../components/packaging/Projects";
import { animations } from "./animations/AnimationComponent";
import ToggleDims from "./scene/ToggleDims";
import { useSelector } from "react-redux";
import Materials from "./rack/Materials";
import AddLabels from "./rack/AddLabels";
import Building from "./environment/Building1";
import { AnnotationData } from "./label/AttachLabel";
import { disposeBuildingLabelSprite } from "./label/BuildingLabelSprite";
import {
    assetCommands,
    instanceMesh,
    locationData,
    locationPoints,
    objects,
    sceneAssets,
    categoryCommands,
    apiData
} from "./player/puzzle/character/Constants.jsx";
import { socket } from "../socket.js";
import { getSceneAssetDescriptor, normalizeSceneAssetName } from "./generatedAssetPaths";
import DslMorphClouds from "./DslMorphClouds";
import DroneShowMorph from "./DroneShowMorph";
import GpgpuBirdFlock from "./GpgpuBirdFlock";
import { filterMorphAssetsByPlacements, getMorphTargetPlacements, morphCategoryMatchesTarget, normalizeMorphName } from "./dslMorphUtils";
import { applySceneGridVisibility } from "../utils/gridVisibility";
import PathWalkingAvatar from "./player/PathWalkingAvatar";
import RoutePathIndicator from "./player/RoutePathIndicator";

const DSL_SCENE_COMMAND_APPLIED = "dsl-scene-command-applied";
const MIN_REMOTE_SCENE_INDICATOR_MS = 450;

const waitForSceneUpdatePaint = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
});

const PROJECT_135_ROUTE_POINTS = [
    [1100, 450, 915],
    [2000, 450, 915],
    [1674, 450, 616],
      [1375, 450, 571],
];
const PROJECT_135_ROUTE_COORDINATE_SCALE = 0.01;



const parseFloorCode = (value, fallback = 0) => {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    if (typeof value === "number" && !Number.isNaN(value)) {
        return Math.max(0, Math.trunc(value));
    }

    const normalized = String(value).trim();
    const prefixedMatch = normalized.match(/^Floor[_\s-]*(\d)/i);
    if (prefixedMatch) {
        return Math.max(0, parseInt(prefixedMatch[1], 10));
    }

    const numericMatch = normalized.match(/(\d+)/);
    if (numericMatch) {
        return Math.max(0, parseInt(numericMatch[1].charAt(0), 10));
    }

    return fallback;
};

function Project135PathAvatar() {
    const charModel = useGLTF(`${import.meta.env.VITE_FILE_URL}/Nathan_man.glb`);
    const [routeProgress, setRouteProgress] = useState({ segmentIndex: 0, directionSign: 1 });
    
    return (
        <>
            <RoutePathIndicator
                points={PROJECT_135_ROUTE_POINTS}
                coordinateScale={PROJECT_135_ROUTE_COORDINATE_SCALE}
                activeSegmentIndex={routeProgress.segmentIndex}
                directionSign={routeProgress.directionSign}
            />
            <PathWalkingAvatar
                charModel={charModel}
                points={PROJECT_135_ROUTE_POINTS}
                coordinateScale={PROJECT_135_ROUTE_COORDINATE_SCALE}
                onRouteProgress={setRouteProgress}
            />
        </>
    );
}

export default function InstanceExperience() {

    // const categoriesCollection = database.collections.get('categories');
    // const assetsCollection = database.collections.get('assets');
    // const fieldsCollection = database.collections.get('fields');
    // const BranchCollection = database.collections.get('branches');
    // const RoomsCollection = database.collections.get('rooms');
    const setCheckedItems = useGame((state) => state.setCheckedItems);
    const location = useGame((state) => state.location);

    const projectId = useGame((state) => state.projectID)
    const selectedLevel = useGame((state) => state.selectedLevel)
    const setLazy = useGame((state) => state.setLazy)
    const setLazyMsg = useGame((state) => state.setLazyMsg)
    const checkReload = useGame((state) => state.checkReload);
    const reload = useGame((state) => state.reload);
    const setBranch = useGame((state) => state.setBranch);
    const materialsMap = useMemo(() => new Map(), []);
    const { scene, camera } = useThree()
    const sceneObject = useRef(null)
    const setPackageControl = useGame((state) => state.setPackageControl);
    const showBdims = useGame((state) => state.showBdims);
    const showFdims = useGame((state) => state.showFdims);
    const showOdims = useGame((state) => state.showOdims);

    const packageControl = useGame((state) => state.packageControl);
    const pause = useGame((state) => state.pause);
    const setPause = useGame((state) => state.setPause);
    const playBackward = useGame((state) => state.playBackward);
    const labelRenderer = useGame((state) => state.labelRenderer);
    const anims = useSelector((state) => state.menu.anims);
    const setShowBdims = useGame((state) => state.setShowBdims);
    const setShowFdims = useGame((state) => state.setShowFdims);
    const setShowOdims = useGame((state) => state.setShowOdims);
    const setLocationList = useGame((state) => state.setLocationList);
    const setSearchList = useGame((state) => state.setSearchList);
    const textureLoader = useMemo(() => new THREE.TextureLoader(), []);
    const setColliders = useGame((state) => state.setColliders)
    const [box, setBox] = useState()
    const [sceneMorphs, setSceneMorphs] = useState([]);
    const [morphCategories, setMorphCategories] = useState([]);
 
    const setEditPopup = useGame((state) => state.setEditPopup);
    const setWallsOpacity = useGame((state) => state.setWallsOpacity)
    const setFloors = useGame((state) => state.setFloors);
    const setSelectedFloors = useGame((state) => state.setSelectedFloors);
    const setCategory = useGame((state) => state.setCategory);
    const setForwardOnly = useGame((state) => state.setForwardOnly)
    const setAnnotations = useGame((state) => state.setAnnotations)
    const annotations = useGame((state) => state.annotations);
    const setLabel = useGame((state) => state.setLabel)
    // const label = useGame((state) => state.label)
    const setEmployees = useGame((state) => state.setEmployees)
    // const setDefaultInstanceId = useGame((state) => state.setDefaultInstanceId);
    // const defaultInstanceId = useGame((state) => state.defaultInstanceId);
    const dslSceneCommand = useGame((state) => state.dslSceneCommand);
    const dslSceneCommandTick = useGame((state) => state.dslSceneCommandTick);
    const clearDslSceneCommand = useGame((state) => state.clearDslSceneCommand);
    const setTerminalMessage = useGame((state) => state.setTerminalMessage);
    const setGrid = useGame((state) => state.setGrid);
    const setProjectSceneData = useGame((state) => state.setProjectSceneData);
    const sceneSignatureRef = useRef("");

    const reloadSceneUpdatePendingRef = useRef(false);
    const projectIdRef = useRef(projectId);
    const categorySignatureRef = useRef(new Map());
    const categoryCommandMapRef = useRef(new Map());
    const categoryAssetsRef = useRef(new Map());
    const categoryCollidersRef = useRef(new Map());
    const categoryMeshKeysRef = useRef(new Map());
    const modelCacheRef = useRef(new Map());
    const modelDimensionsCacheRef = useRef(new WeakMap());
    const bagModelPromiseRef = useRef(null);
    const loadTokenRef = useRef(0);
    const loadStateRef = useRef({
        hasLoadedProject: false,
        projectId,
        selectedLevelKey: "",
        checkReload,
        reload,
    });
    const lastAppliedDslCommandRef = useRef("");
    const collidersSignatureRef = useRef("");
    const fbxLoader = useMemo(() => new FBXLoader(), []);
    const gltfLoader = useMemo(() => new GLTFLoader(), []);

    // const lights = useMemo(()=>new THREE.Group(),[]);
    // extend(THREE)

    const [boxWidth, setBoxWidth] = useState(0)
    const [boxHeight, setBoxHeight] = useState(0)

    const bProjectId = useMemo(() => parseInt(String(projectId || "").split("_")[0], 10), [projectId]);
    const showProject135PathAvatar = String(projectId).includes("135");
    const getSceneProjectBaseId = (sceneProjectId = projectId) => String(sceneProjectId ?? '').trim().replace(/_L\d+$/i, '');

    const getSelectedLevelKey = (level = selectedLevel) =>
        String(level?.code ?? level?.id ?? level?.name ?? level ?? "");

    const buildProjectSceneRequestKeys = (sceneProjectId = projectId) => {
        const raw = String(sceneProjectId ?? '').trim();
        if (!raw) {
            return [];
        }

        const levelMatch = /^(.*)_L(\d+)$/i.exec(raw);
        if (levelMatch) {
            const levelCode = parseInt(levelMatch[2], 10);
            return levelCode === 0 ? [ `${levelMatch[1]}_L0`] : [`${levelMatch[1]}_L${levelCode}`];
        }

        const selectedLevelCode = Number.parseInt(String(selectedLevel?.code ?? ''), 10);
        const levelCode = Number.isFinite(selectedLevelCode) ? Math.max(0, selectedLevelCode) : 0;
        if (levelCode === 0) {
            return /^\d+$/.test(raw) ? [ `${raw}_L0`] : [raw];
        }
        const baseKey = /^\d+$/.test(raw) ? [`${raw}_L${levelCode}`] : [raw];
        
        return baseKey;
    };

    const filterMorphTargetCategories = (categories, morphs) => {
        const builtInTargets = new Set(["plane", "sphere", "helix"]);
        const categoryList = Array.isArray(categories) ? categories : [];
        const presetMorphs = (Array.isArray(morphs) ? morphs : []).filter((morph) =>
            morph?.preset === "droneShow" && Array.isArray(morph?.targets)
        );

        if (!presetMorphs.length) {
            return categories;
        }

        return categoryList.map((category) => {
            const originalAssets = Array.isArray(category?.assets) ? category.assets : [];
            let filteredAssets = originalAssets;

            presetMorphs.forEach((morph) => {
                morph.targets.forEach((target) => {
                    const normalized = normalizeMorphName(target);
                    if (!normalized || builtInTargets.has(normalized) || !morphCategoryMatchesTarget(category, target)) {
                        return;
                    }

                    const targetPlacements = getMorphTargetPlacements(morph, target);
                    if (!targetPlacements.length) {
                        return;
                    }

                    const matchedAssets = filterMorphAssetsByPlacements(filteredAssets, targetPlacements, { fallbackToAll: false });
                    if (!matchedAssets.length) {
                        return;
                    }

                    const matchedSet = new Set(matchedAssets);
                    filteredAssets = filteredAssets.filter((asset) => !matchedSet.has(asset));
                });
            });

            return filteredAssets === originalAssets ? category : { ...category, assets: filteredAssets };
        });
    };

    const stripCategoryInstanceSuffix = (categoryId, categoryIndex) => {
        if (categoryId === undefined || categoryId === null) {
            return categoryId;
        }

        const id = String(categoryId).trim();
        const index = String(categoryIndex ?? "").trim();
        return index && id.endsWith(`-${index}`) ? id.slice(0, -(index.length + 1)) : id;
    };

    const getCategoryRaw = (category) => category?._raw ? category._raw : category;

    const normalizeSceneCategory = (category) => {
        const raw = getCategoryRaw(category) || {};
        const assets = normalizeCategoryAssets(category?.assets || raw?.assets || [])
            .map(normalizeAssetTransforms);
        const categoryIndex = raw?.category_index || raw?.category || raw?.id;
        const categoryId = stripCategoryInstanceSuffix(
            raw?.category_id || raw?.asset_id || raw?.id || raw?.name,
            categoryIndex
        );
        const normalizedRaw = {
            ...raw,
            category_id: categoryId,
            source_category_id: raw?.category_id,
            category_index: categoryIndex,
            assets,
        };

        return {
            ...category,
            _raw: normalizedRaw,
            category_id: categoryId,
            source_category_id: raw?.category_id,
            category_index: categoryIndex,
            template_id: raw?.template_id || raw?.templateId || raw?.templateID || category?.template_id,
            fbx: raw?.fbx || category?.fbx,
            name: raw?.name || category?.name,
            properties: raw?.properties || category?.properties,
            textures: raw?.textures || category?.textures,
            branch: category?.branch || raw?.branch,
            assets,
        };
    };

    const normalizeSceneCategories = (categories) =>
        (Array.isArray(categories) ? categories : []).filter(Boolean).map(normalizeSceneCategory);


    const getModelDimensions = (model) => {
        if (!model) {
            return { halfWidth: 0, halfLength: 0, halfHeight: 0 };
        }

        const cached = modelDimensionsCacheRef.current.get(model);
        if (cached) {
            return cached;
        }

        const boxDims = new Box3().setFromObject(model);
        const dimensions = {
            halfWidth: (boxDims.max.x - boxDims.min.x) / 2,
            halfLength: (boxDims.max.z - boxDims.min.z) / 2,
            halfHeight: (boxDims.max.y - boxDims.min.y) / 2,
        };
        modelDimensionsCacheRef.current.set(model, dimensions);
        return dimensions;
    }
    const getLength = (model) => getModelDimensions(model).halfLength;
    const getWidth = (model) => getModelDimensions(model).halfWidth;
    const getHeight = (model) => getModelDimensions(model).halfHeight;

    const safeJsonParse = (input) => {
        if (typeof input === "string") {
            try {
                return JSON.parse(input);
            } catch (error) {
                console.error("Invalid JSON string:", error);
                return []; // Return null or a default value if parsing fails
            }
        }
        return input; // Return the original input if it's not a string
    }

    const isFoliageMaterial = (material, mesh) => {
        const materialName = String(material?.name || "").toLowerCase();
        const meshName = String(mesh?.name || "").toLowerCase();
        return /leaf|leaves|foliage|pine|needle|branch/.test(`${materialName} ${meshName}`);
    };

    const prepareMaterialTexture = (texture) => {
        if (!texture) {
            return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
    };

const configureOriginalMeshMaterial = (material, mesh) => {
    if (!material) {
        return material;
    }

    const forceCutout = isFoliageMaterial(material, mesh);

    const hasCutoutAlpha =
        forceCutout ||
        Boolean(material.alphaMap) ||
        material.alphaTest > 0;

    prepareMaterialTexture(material.map);
    prepareMaterialTexture(material.alphaMap);

    material.side = THREE.DoubleSide;

    // Reduce reflections
    if ("roughness" in material) {
        material.roughness = 0.85;
    }

    if ("metalness" in material) {
        material.metalness = 0;
    }

    // Make facade texture more visible
    if (material.emissive) {
        material.emissive.set(0xffffff);
        material.emissiveIntensity = 0.2;

        if (material.map) {
            material.emissiveMap = material.map;
        }
    }

    if (hasCutoutAlpha) {
        material.transparent = false;

        material.alphaTest = Math.max(
            material.alphaTest,
            forceCutout ? 0.02 : 0.25
        );

        if (material.specular?.set) {
            material.specular.set(0x000000);
        }
    }

    material.needsUpdate = true;

    return material;
};

    const normalizeMaterialDepthState = (material, mesh) => {
        if (!material) {
            return;
        }

        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((mat) => {
            if (!mat) {
                return;
            }

            const hasCutoutAlpha =
                isFoliageMaterial(mat, mesh) ||
                Boolean(mat.alphaMap) ||
                mat.alphaTest > 0;

            // if (hasCutoutAlpha) {
            //     configureOriginalMeshMaterial(mat, mesh);
            //     return;
            // }

            // const isActuallyTranslucent =
            //     mat.opacity < 0.999 ||
            //     Boolean(mat.transmission && mat.transmission > 0);

            // if (isActuallyTranslucent) {
            //     mat.transparent = true;
            //     mat.depthTest = true;
            //     mat.depthWrite = false;
            //     mat.needsUpdate = true;
            //     return;
            // }

            // mat.transparent = false;
            // mat.opacity = 1;
            // mat.depthTest = true;
            // mat.depthWrite = true;
            // mat.alphaTest = hasCutoutAlpha ? Math.max(mat.alphaTest || 0, 0.35) : 0;
            // mat.forceSinglePass = false;
            // mat.needsUpdate = true;
        });
    };

    const makeOriginalMaterialDoubleSided = (material, mesh) => {
        const makeDoubleSided = (mat) => {
            if (!mat) {
                return mat;
            }

            const nextMaterial = mat.clone ? mat.clone() : mat;

            return configureOriginalMeshMaterial(nextMaterial, mesh);
        };

        return Array.isArray(material)
            ? material.map(makeDoubleSided)
            : makeDoubleSided(material);
    };

    const applyTextures = (child, texturesObj) => {
        const textures = safeJsonParse(texturesObj);

        // Helper to apply translucency if needed
        const getFinalMaterial = (material) => {
            return material;
        };

        // If textures exist and are a valid array
        if (Array.isArray(textures) && textures.length > 0) {
            textures.forEach((textureUrl, i) => {
                if (!textureUrl) return;

                let material = materialsMap.get(textureUrl);

                if (!material) {
                    const texture = textureLoader.load(`${import.meta.env.VITE_FILE_URL}/${textureUrl}`);
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;

                    material = new THREE.MeshStandardMaterial({
                        map: texture,
                        side: THREE.DoubleSide,
                        transparent: false,
                        alphaTest: 0.35,
                        depthTest: true,
                        depthWrite: true,
                        forceSinglePass: false,
                        // reflectivity: 5.0,
                    });

                    materialsMap.set(textureUrl, material);
                }

                const finalMaterial = getFinalMaterial(material);
                finalMaterial.side = THREE.DoubleSide;
                finalMaterial.transparent = false;
                finalMaterial.alphaTest = Math.max(finalMaterial.alphaTest || 0, 0.35);
                finalMaterial.depthTest = true;
                finalMaterial.depthWrite = true;
                finalMaterial.forceSinglePass = false;
                finalMaterial.needsUpdate = true;

                if (Array.isArray(child.material)) {
                    child.material[i] = finalMaterial;
                } else {
                    child.material = finalMaterial;
                }
            });
        } else {
            // No textures provided – just update the existing material
            // if (Array.isArray(child.material)) {
            //     child.material = child.material.map((mat) => getFinalMaterial(mat));
            // } else if (child.material) {
            //     child.material = getFinalMaterial(child.material);
            // }
        }

        // normalizeMaterialDepthState(child.material);
    };

    const normalizeCategoryAssets = (assets) => {
        const list = Array.isArray(assets)
            ? assets
            : Object.values(assets || {});

        return list
            .filter(Boolean)
            .sort((left, right) => {
                const leftId = String(getAssetInstanceId(left));
                const rightId = String(getAssetInstanceId(right));
                return leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: "base" });
            });
    };

    const getCategoryKey = (category) => {
        const raw = getCategoryRaw(category);
        const fbx = raw?.fbx || raw?.name || "";
        const normalizedFbx = fbx.replace(/\s+/g, "").replace(/\.(fbx|glb|gltf)$/i, "").toLowerCase();
        const categoryIndex = raw?.category_index || raw?.category || raw?.id;
        const categoryId = categoryIndex
            || stripCategoryInstanceSuffix(raw?.category_id || raw?.asset_id || raw?.name, categoryIndex)
            || normalizedFbx;
        return `${String(categoryId).trim().toLowerCase()}::${normalizedFbx}`;
    };

    const getAssetInstanceId = (asset) =>
        asset?._raw?.instance_id || asset?.instanceId || asset?.instance_id || "";

    const parseTransformPayload = (value) => {
        if (!value) {
            return null;
        }

        if (typeof value === "string") {
            try {
                return JSON.parse(value);
            } catch (error) {
                return null;
            }
        }

        return typeof value === "object" ? value : null;
    };

    const getTransformValue = (...values) => {
        for (const value of values) {
            if (value !== undefined && value !== null && value !== "") {
                return value;
            }
        }

        return undefined;
    };

    const coerceFieldValue = (value) => {
        if (value === undefined || value === null) {
            return undefined;
        }

        if (typeof value === "object") {
            return JSON.stringify(value);
        }

        return String(value);
    };

    const withPatchedField = (fields, fieldName, nextValue) => {
        if (nextValue === undefined) {
            return fields;
        }

        const patchedFields = { ...fields };
        const existingField = patchedFields[fieldName] || { name: fieldName };
        patchedFields[fieldName] = {
            ...existingField,
            value: coerceFieldValue(nextValue),
        };
        return patchedFields;
    };

    const normalizeAssetTransforms = (asset) => {
        if (!asset) {
            return asset;
        }

        const transform =
            parseTransformPayload(asset?.transformation) ||
            parseTransformPayload(asset?.transform) ||
            parseTransformPayload(asset?.transfrm) ||
            parseTransformPayload(asset?._raw?.transformation) ||
            parseTransformPayload(asset?._raw?.transform) ||
            parseTransformPayload(asset?._raw?.transfrm);

        if (!transform) {
            return asset;
        }

        const position = transform.position || transform.translation || {};
        const rotation = transform.rotation || transform.angle || {};
        const dimensions = transform.dimensions || transform.size || {};

        let fields = { ...(asset.fields || {}) };

        fields = withPatchedField(
            fields,
            "X-pos",
            getTransformValue(position.x, position.posX, position.left, transform.x, transform.posX)
        );
        fields = withPatchedField(
            fields,
            "Y-pos",
            getTransformValue(position.z, position.posZ, position.depth, transform.z, transform.posZ)
        );
        fields = withPatchedField(
            fields,
            "Z-pos",
            getTransformValue(position.y, position.posY, position.height, transform.y, transform.posY)
        );
        fields = withPatchedField(
            fields,
            "Angle",
            getTransformValue(
                typeof rotation === "number" || typeof rotation === "string" ? rotation : undefined,
                rotation.y,
                rotation.z,
                transform.angle,
                transform.rotationY
            )
        );
        fields = withPatchedField(
            fields,
            "Width",
            getTransformValue(dimensions.width, transform.width, transform.scaleX)
        );
        fields = withPatchedField(
            fields,
            "Length",
            getTransformValue(dimensions.length, transform.length, transform.scaleY)
        );
        fields = withPatchedField(
            fields,
            "Height",
            getTransformValue(dimensions.height, transform.height, transform.scaleZ)
        );

        return {
            ...asset,
            fields,
        };
    };

    const buildAssetsSignature = (assets = []) => {
        const parts = [];
        for (const asset of normalizeCategoryAssets(assets).map(normalizeAssetTransforms)) {
            const fields = asset?.fields || {};
            parts.push(
                `${getAssetInstanceId(asset)}:${fields["X-pos"]?.value ?? ""}:${fields["Y-pos"]?.value ?? ""}:${fields["Z-pos"]?.value ?? ""}:${fields["Angle"]?.value ?? ""}:${fields["Color"]?.value ?? ""}:${fields["Width"]?.value ?? ""}:${fields["Height"]?.value ?? ""}:${fields["Length"]?.value ?? ""}:${fields["v-align"]?.value ?? ""}:${fields["Status"]?.value ?? ""}:${fields["Floor"]?.value ?? ""}`
            );
        }
        return parts.join("|");
    };

    const buildSceneSignature = (categories = []) =>
        categories
            .map((category) => {
                const raw = getCategoryRaw(category);
                const serializedProperties = JSON.stringify(raw?.properties || {});
                return `${getCategoryKey(category)}:${buildAssetsSignature(category?.assets || raw?.assets || [])}:${serializedProperties}`;
            })
            .sort()
            .join("||");

    const buildCategorySignature = (category) => {
        const raw = getCategoryRaw(category);
        const serializedProperties = JSON.stringify(raw?.properties || {});
        return `${buildAssetsSignature(category?.assets || raw?.assets || [])}:${serializedProperties}`;
    };

    const listSceneAssets = (category) => {
        const assets = category?.assets || getCategoryRaw(category)?.assets || [];
        return Array.isArray(assets) ? assets : Object.values(assets || {});
    };

    const insertSceneAsset = (category, asset) => {
        if (Array.isArray(category.assets)) {
            category.assets = [...category.assets, asset];
        } else {
            category.assets = { ...(category.assets || {}), [getAssetInstanceId(asset)]: asset };
        }

        const instances = Array.isArray(category.instances) ? category.instances : [];
        const instanceId = getAssetInstanceId(asset);
        category.instances = instanceId ? [...new Set([...instances, instanceId])] : instances;
    };

    const mergeSceneData = (baseData, overlayData) => {
        if (!Array.isArray(overlayData?.categories) || !overlayData.categories.length) {
            return baseData || { categories: [] };
        }

        const nextData = { ...(baseData || { categories: [] }) };
        const categories = Array.isArray(nextData.categories) ? [...nextData.categories] : [];
        const categoryIndexByKey = new Map(
            categories.map((category, index) => [getCategoryKey(category), index])
        );

        overlayData.categories.forEach((overlayCategory) => {
            const overlayRaw = getCategoryRaw(overlayCategory);
            const overlayKey = getCategoryKey(overlayRaw);
            const categoryIndex = categoryIndexByKey.get(overlayKey);

            if (categoryIndex === undefined) {
                categories.push(JSON.parse(JSON.stringify(overlayCategory)));
                categoryIndexByKey.set(overlayKey, categories.length - 1);
                return;
            }

            const category = { ...categories[categoryIndex] };
            category.properties = {
                ...(getCategoryRaw(category).properties || {}),
                ...(overlayRaw.properties || {}),
            };

            const assetsAreArray = Array.isArray(category.assets);
            const currentAssets = listSceneAssets(category);
            const assetIndexById = new Map(
                currentAssets.map((asset, index) => [getAssetInstanceId(asset), index])
            );
            const nextAssets = assetsAreArray ? [...currentAssets] : { ...(category.assets || {}) };

            listSceneAssets(overlayCategory).forEach((asset) => {
                const assetId = getAssetInstanceId(asset);
                const existingIndex = assetIndexById.get(assetId);
                if (existingIndex !== undefined) {
                    const existing = currentAssets[existingIndex];
                    const mergedFields = { ...(existing.fields || {}), ...(asset.fields || {}) };
                    const mergedAsset = { ...existing, ...asset, fields: mergedFields };
                    if (assetsAreArray) {
                        nextAssets[existingIndex] = mergedAsset;
                    } else {
                        nextAssets[assetId] = mergedAsset;
                    }
                } else {
                    const clonedAsset = JSON.parse(JSON.stringify(asset));
                    if (assetsAreArray) {
                        nextAssets.push(clonedAsset);
                    } else {
                        nextAssets[assetId] = clonedAsset;
                    }
                }
            });

            category.assets = nextAssets;
            const instances = Array.isArray(category.instances) ? category.instances : [];
            const overlayInstances = Array.isArray(overlayCategory.instances) ? overlayCategory.instances : [];
            category.instances = [...new Set([...instances, ...overlayInstances])];
            categories[categoryIndex] = category;
        });

        nextData.categories = categories;
        return nextData;
    };

    const mergeDbAndDslCategories = (dbCategories, dslCategories) => {
        const baseData = {
            categories: normalizeSceneCategories(dbCategories),
        };
        const overlayData = {
            categories: normalizeSceneCategories(dslCategories),
        };

        const mergedData = mergeSceneData(baseData, overlayData);
        return normalizeSceneCategories(mergedData?.categories || []);
    };

    const getTransientSceneOverlay = (data) => {
        const categories = [];

        (Array.isArray(data?.categories) ? data.categories : []).forEach((category) => {
            const localAssets = listSceneAssets(category).filter((asset) => asset?.localOnly || getCategoryRaw(asset)?.localOnly);
            if (!localAssets.length) {
                return;
            }

            categories.push({
                ...getCategoryRaw(category),
                assets: localAssets,
                instances: localAssets.map(getAssetInstanceId).filter(Boolean),
            });
        });

        return { categories };
    };



    const buildAssetCommandsString = () => {
        const lines = Array.from(categoryCommandMapRef.current.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([, commandText]) => commandText || "")
            .join("");
        return `project ${projectId}\n${lines}`;
    };

    const rebuildAssetCommands = () => {
        assetCommands.current = buildAssetCommandsString();
        return assetCommands.current;
    };

    const buildFloorsFromCategories = (categories = []) => {
        const floorsMap = new Map();

        for (const category of categories) {
            for (const asset of normalizeCategoryAssets(category?.assets || [])) {
                const floorValue = asset?.fields?.["Floor"]?.value;
                const floorCode = parseFloorCode(
                    floorValue,
                    projectId == 125 ? 1 : 0
                );

                if (!Number.isNaN(floorCode) && !floorsMap.has(floorCode)) {
                    floorsMap.set(floorCode, { name: `Floor ${floorCode}`, code: floorCode });
                }
            }
        }

        return Array.from(floorsMap.values()).sort((a, b) => a.code - b.code);
    };

    const ensureSceneObject = () => {
        let currentSceneObject = scene.getObjectByName("sceneObj");
        if (!currentSceneObject) {
            currentSceneObject = new THREE.Object3D();
            currentSceneObject.name = "sceneObj";
            scene.add(currentSceneObject);
        }
        sceneObject.current = currentSceneObject;
        return currentSceneObject;
    };

    const removeCategoryFromGlobals = (categoryKey, categoryName) => {
        const assetIds = categoryAssetsRef.current.get(categoryKey) || [];
        for (const assetId of assetIds) {
            const sceneAsset = sceneAssets[assetId];
            if (sceneAsset?.buildingLabel) {
                sceneAsset.buildingLabel.parent?.remove?.(sceneAsset.buildingLabel);
                disposeBuildingLabelSprite(sceneAsset.buildingLabel);
            }
            delete sceneAssets[assetId];
        }

        const trackedMeshKeys = categoryMeshKeysRef.current.get(categoryKey) || [];
        categoryAssetsRef.current.delete(categoryKey);
        categoryCollidersRef.current.delete(categoryKey);
        categoryMeshKeysRef.current.delete(categoryKey);
        categorySignatureRef.current.delete(categoryKey);
        categoryCommandMapRef.current.delete(categoryKey);

        const globalKeys = new Set([
            categoryName,
            String(categoryName || "").split("::")[0],
            ...trackedMeshKeys,
        ]);
        const normalizedGlobalKey = normalizeSceneAssetName(String(categoryName || "").split("::")[0]).toLowerCase();

        Object.keys(instanceMesh).forEach((key) => {
            if (normalizeSceneAssetName(key).toLowerCase() === normalizedGlobalKey) {
                globalKeys.add(key);
            }
        });

        Object.keys(objects).forEach((key) => {
            if (normalizeSceneAssetName(key).toLowerCase() === normalizedGlobalKey) {
                globalKeys.add(key);
            }
        });

        for (const key of globalKeys) {
            if (!key) {
                continue;
            }

            if (!instanceMesh[key]) {
                delete objects[key];
                continue;
            }

            const mesh = instanceMesh[key];
            mesh.parent?.remove(mesh);
            delete instanceMesh[key];
            delete objects[key];
        }

        if (categoryName.includes("location")) {
            locationData.splice(0, locationData.length);
            locationPoints.splice(0, locationPoints.length);
        }
    };

    const clearCategoryScene = (sceneObj, categoryKey, categoryName) => {
        const group = sceneObj.getObjectByName(`category:${categoryKey}`);
        if (group) {
            disposeScene(group);
            group.removeFromParent();
        }
        removeCategoryFromGlobals(categoryKey, categoryName);
    };

    const resetSceneState = () => {
        categorySignatureRef.current.clear();
        categoryCommandMapRef.current.clear();
        categoryAssetsRef.current.clear();
        categoryCollidersRef.current.clear();
        categoryMeshKeysRef.current.clear();
        sceneSignatureRef.current = "";
        collidersSignatureRef.current = "";

        while (locationData.length > 0) {
            const entry = locationData.pop();
            entry?.mixer?.stopAllAction?.();
            entry?.pin?.parent?.remove?.(entry.pin);
            entry?.text?.parent?.remove?.(entry.text);
        }

        while (AnnotationData.length > 0) {
            const entry = AnnotationData.pop();
            entry?.text?.parent?.remove?.(entry.text);
        }

        while (animations.length > 0) {
            const entry = animations.pop();
            entry?.action?.stop?.();
            entry?.mixer?.stopAllAction?.();
            entry?.objectClone?.parent?.remove?.(entry.objectClone);
        }

        locationPoints.splice(0, locationPoints.length);

        for (const material of materialsMap.values()) {
            material?.map?.dispose?.();
            material?.dispose?.();
        }
        materialsMap.clear();
        modelCacheRef.current.clear();
        modelDimensionsCacheRef.current = new WeakMap();
        bagModelPromiseRef.current = null;

        Object.keys(sceneAssets).forEach((key) => {
            const sceneAsset = sceneAssets[key];
            if (sceneAsset?.buildingLabel) {
                sceneAsset.buildingLabel.parent?.remove?.(sceneAsset.buildingLabel);
                disposeBuildingLabelSprite(sceneAsset.buildingLabel);
            }
            delete sceneAssets[key];
        });
        Object.keys(objects).forEach((key) => delete objects[key]);
        Object.keys(instanceMesh).forEach((key) => delete instanceMesh[key]);

        rebuildAssetCommands();
    };

    const cloneLoadedModel = (loaded) => {
        const source = loaded?.scene || loaded;
        const clone = source.clone(true);
        clone.animations = loaded?.animations || source?.animations || [];
        return clone;
    };

    const loadModelClone = async (file, properties) => {
        const descriptor = getSceneAssetDescriptor(file, properties);
        if (!modelCacheRef.current.has(descriptor.cacheKey)) {
            const loaderPromise = ["glb", "gltf"].includes(descriptor.extension)
                ? gltfLoader.loadAsync(descriptor.url)
                : fbxLoader.loadAsync(descriptor.url);
            modelCacheRef.current.set(descriptor.cacheKey, loaderPromise);
        }

        const model = await modelCacheRef.current.get(descriptor.cacheKey);
        return cloneLoadedModel(model);
    };

    const loadBagModel = async () => {
        if (!bagModelPromiseRef.current) {
            bagModelPromiseRef.current = fbxLoader.loadAsync(
                `${import.meta.env.VITE_FILE_URL}/Pink Ant Static Bags.FBX`
            );
        }

        const bagModel = await bagModelPromiseRef.current;
        return bagModel.clone(true);
    };


    const loadFiles = async (category, sceneObj, arrayOfObjects, obj, branchName) => {
       
        const { textures, fbx, category_id, category_index, name, properties,id } = category;
            
               

        if (!fbx || fbx.length == 0) {
            return { commandText: "" };
        }

        const object = await loadModelClone(fbx, properties);

        object.traverse((child) => {
            if (fbx == "Location.FBX" && child instanceof THREE.Mesh) {
                child.material = new THREE.MeshPhongMaterial({
                    color: "red",
                    reflectivity: 5.0,
                });
            }
           
            if (child instanceof THREE.Mesh) {
                const textureList = safeJsonParse(textures);
                const hasTextureImages = Array.isArray(textureList) && textureList.some(Boolean);
                if (hasTextureImages) {
                    applyTextures(child, textureList);
                } else {
                    child.material = makeOriginalMaterialDoubleSided(child.material, child);
                    // normalizeMaterialDepthState(child.material, child);
                }
            }
        });

       
        const namefbx = normalizeSceneAssetName(fbx || name || "");
        
        const { halfWidth, halfLength, halfHeight } = getModelDimensions(object);
        const dimensions = { halfWidth, halfLength, halfHeight };
        const size = { Width: halfWidth*2, Length:halfLength*2, Height: halfHeight*2 };

           const categoryData = {
                    category_id: category_id,
                    category_index,
                    asset_id: category_id,
                    name,
                    fbx,
                    textures,
                    size
                }

       
            // ✅ use computed key
            const categoryStructure = [{
                [namefbx]: categoryData
            }];

         categoryCommands.current.push(categoryStructure)

        return (await InstancePattern(
            object,
            arrayOfObjects,
            namefbx,
            sceneObj,
            branchName,
            projectId,
            obj,
            [],
            dimensions,
            fbx,
            properties,
            category_index || id
        )) || { commandText: "" };
    };

    useEffect(() => {
        projectIdRef.current = projectId;
        // console.log(projectId)
    }, [projectId, selectedLevel]);

    useEffect(() => {

        const updateSceneRemotely = async ({ data, dslProjectId }) => {
            const acceptedKeys = buildProjectSceneRequestKeys(projectIdRef.current);
            const incomingKey = String(dslProjectId || "");
            const incomingBaseKey = incomingKey.replace(/_L\d+$/i, "");
            if (!acceptedKeys.includes(incomingKey) && !acceptedKeys.includes(incomingBaseKey)) {
                return
            }


   

        
            await waitForSceneUpdatePaint();


            try {
                const mergedRunData = mergeSceneData(apiData.current, data);
                const liveData = mergeSceneData(mergedRunData, getTransientSceneOverlay(apiData.current));
                if (data?.runtimeSettings) {
                    liveData.runtimeSettings = {
                        ...(liveData.runtimeSettings || {}),
                        ...data.runtimeSettings,
                    };
                }
                applySceneGridVisibility(data, setGrid);
                const nextData = normalizeSceneCategories(liveData?.categories || []);
                const nextMorphs = Array.isArray(data?.dslMorphs) ? data.dslMorphs : [];
                const visibleData = filterMorphTargetCategories(nextData, nextMorphs);
             
                const nextSignature = buildSceneSignature(nextData);
                apiData.current = liveData;

                if (nextSignature === sceneSignatureRef.current) {
           
                    setSceneMorphs(nextMorphs);
                    setMorphCategories(nextData);
                    setLazy(false);
                    return;
                }

                sceneSignatureRef.current = nextSignature;
                setSceneMorphs(nextMorphs);
                setMorphCategories(nextData);
             
                await waitForSceneUpdatePaint();

                const commandString = await syncCategoriesToScene(visibleData, { forceReload: false });
                assetCommands.current = commandString;
              
                setLazy(false);
          
            } catch (error) {
                console.error("Failed to apply remote scene update:", error);
            
            } finally {
                reloadSceneUpdatePendingRef.current = false;
      
            }

        }

        socket.on('updateScene', updateSceneRemotely)

        return () => {

            socket.off('updateScene', updateSceneRemotely);
        }
    }, []);


    // const loadDbData = async () => {
    //     try {
    //         // setLazy(true);
    //         const projectIdInt = parseInt(projectId.toString());

    //         // Fetch rooms and parentId
    //         const roomsPromise = RoomsCollection.query(Q.where('room_id', projectIdInt)).fetch();
    //         const rooms = await roomsPromise;
    //         if (!rooms.length) return [null, []];

    //         const parentId = parseInt(rooms[0]?._raw?.parent);

    //         // Fetch branches and categories in parallel
    //         const [branches, categories] = await Promise.all([
    //             BranchCollection.query(Q.where('branch_id', parentId)).fetch(),
    //             categoriesCollection.query(Q.where('project_id', projectIdInt)).fetch()
    //         ]);

    //         const branchName = branches[0]?._raw?.name || '';

    //         setBranch(branchName)

    //         const categoryData = await Promise.all(
    //             categories.map(async (category) => {

    //                 const instances = category._raw.instances ? JSON.parse(category._raw.instances) : []

    //                 const assets = await assetsCollection.query(Q.where('instance_id', Q.oneOf(instances))).fetch();


    //                 // Fetch fields in parallel for all assets
    //                 const assetData = await Promise.all(
    //                     assets.map(async (asset) => {

    //                         if (!defaultInstanceId && asset.category.includes('platform')) {
    //                             setDefaultInstanceId(asset.instanceId)
    //                         }

    //                         const fields = await fieldsCollection.query(Q.where('instance_id', parseInt(asset.instanceId))).fetch();
    //                         asset.fields = {};
    //                         asset.annotationText = [];

    //                         for (const field of fields) {
    //                             const annotationObj = { name: field.name, value: field.value };
    //                             if (field.showExtra) asset.annotationText.push(annotationObj);
    //                             asset.fields[field.name] = field;
    //                         }

    //                         return normalizeAssetTransforms(asset);
    //                     })
    //                 );

    //                 return { ...category, assets: assetData, branch: branchName };
    //             })
    //         );

    //         return categoryData;
    //     } catch (error) {
    //         console.error('Error loading DB data:', error);
    //         return [null, []];
    //     }
    // };

    const loadProjectSceneData = async (sceneProjectId = projectId) => {
        const requestKeys = buildProjectSceneRequestKeys(sceneProjectId);

        for (const requestKey of requestKeys) {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/project-scene/${requestKey}`, {
                cache: "no-store",
            });

            if (!response.ok) {
                continue;
            }

            const data = await response.json();
            if (data) {
                setProjectSceneData(data, requestKey);
                applySceneGridVisibility(data, setGrid);
                return data;
            }
        }

        return null;
    };


    // const addLight = ( hexColor, power = 10, distance = 3 ) => {
    //
    //     const light = new THREE.PointLight( hexColor, 1, distance );
    //     light.position.set( Math.random() * 300 - 150, 0, Math.random() * 300 - 150 );
    //     light.power = power;
    //     light.userData.fixedPosition = light.position.clone();
    //     lights.add( light );
    //
    //     return light;
    //
    // };
    //
    // useEffect(() => {
    //
    //
    //     for ( let i = 0; i < 100; i ++ ) {
    //
    //         const hex = ( Math.random() * 0xffffff ) + 0x666666;
    //
    //         // lightDummy.setColorAt( i, color.setHex( hex ) );
    //
    //         addLight( hex );
    //
    //     }
    //     // const lightAmbient = new THREE.AmbientLight( '#a70d0d', 5 );
    //     // scene.add( lightAmbient );
    //     console.log(lights)
    //     scene.add(lights)
    //
    // }, []);

    const debugSceneAdd = (debugLabel, message, detail = {}) => {
        if (!debugLabel || import.meta.env.VITE_DEBUG_SCENE_COMMANDS !== "true") {
            return;
        }

        const line = `[${debugLabel}] ${message}`;
        console.info(line, detail);
    };

    const syncCategoriesToScene = async (categories, { forceReload = false, debugLabel = "", pruneMissing = true } = {}) => {

        const sceneObj = ensureSceneObject();
        const nextCategoryKeys = new Set();
        const nextFloorsMap = new Map();
        const orderedCategories = [...(Array.isArray(categories) ? categories : [])].sort((left, right) => {
            const leftRaw = getCategoryRaw(left) || {};
            const rightRaw = getCategoryRaw(right) || {};
            const leftIndex = Number.parseInt(leftRaw.category_index ?? leftRaw.category ?? leftRaw.id ?? "", 10);
            const rightIndex = Number.parseInt(rightRaw.category_index ?? rightRaw.category ?? rightRaw.id ?? "", 10);

            if (!Number.isNaN(leftIndex) && !Number.isNaN(rightIndex) && leftIndex !== rightIndex) {
                return rightIndex - leftIndex;
            }

            const leftName = String(leftRaw.name || leftRaw.fbx || "").toLowerCase();
            const rightName = String(rightRaw.name || rightRaw.fbx || "").toLowerCase();
            return rightName.localeCompare(leftName, undefined, { numeric: true, sensitivity: "base" });
        });

        debugSceneAdd(debugLabel, "sync started", {
            categories: Array.isArray(categories) ? categories.length : 0,
            forceReload,
            pruneMissing,
        });

        const addFloorsToMap = (floors = []) => {
            floors.forEach((floor) => {
                if (floor?.code === undefined || floor?.code === null) {
                    return;
                }

                nextFloorsMap.set(floor.code, {
                    name: floor.name || `Floor ${floor.code}`,
                    code: floor.code,
                });
            });
        };

        addFloorsToMap(buildFloorsFromCategories(orderedCategories));
        const usedAssetIds = new Set();
     
    
        for (const category of orderedCategories) {
           
            const rawCategory = getCategoryRaw(category);
        
            if (!rawCategory?.fbx) {
                continue;
            }

            const { name, fbx } = rawCategory;
            const branch = category?.branch || "";
            const categoryKey = getCategoryKey(rawCategory);
            const assets = normalizeCategoryAssets(category?.assets || []).filter((asset) => {
                const assetId = String(getAssetInstanceId(asset) || "");
                if (!assetId) {
                    return false;
                }

                if (usedAssetIds.has(assetId)) {
                    debugSceneAdd(debugLabel, "skipped duplicate asset id", {
                        fbx,
                        categoryKey,
                        assetId,
                    });
                    return false;
                }

                usedAssetIds.add(assetId);
                return true;
            });
            const renderName = normalizeSceneAssetName(fbx).toLowerCase();
            const categoryName = `${renderName}::${categoryKey}`;

          const assetIds = assets
           .map((asset) => String(getAssetInstanceId(asset)))
           .filter(Boolean);

            const nextSignature = buildCategorySignature(category);

            nextCategoryKeys.add(categoryKey);

            if (!forceReload && categorySignatureRef.current.get(categoryKey) === nextSignature) {
                debugSceneAdd(debugLabel, "skipped unchanged category", {
                    fbx,
                    categoryKey,
                    assets: assets.length,
                    assetIds,
                });
                continue;
            }

            debugSceneAdd(debugLabel, "adding category to scene", {
                fbx,
                categoryKey,
                assets: assets.length,
                assetIds,
            });

            clearCategoryScene(sceneObj, categoryKey, categoryName);

            const categoryGroup = new THREE.Group();
            categoryGroup.name = `category:${categoryKey}`;
            categoryGroup.userData.categoryName = categoryName;
            sceneObj.add(categoryGroup);
            debugSceneAdd(debugLabel, "created scene group", {
                fbx,
                categoryKey,
                sceneChildren: sceneObj.children.length,
            });

            const arrayOfObjects = assets.map((value, index) => ({ key: String(getAssetInstanceId(value) || index), ...value }));

            if (fbx.includes("Racks Horizontal")) {
                const [wPallet, boxModel] = await Promise.all([
                    loadModelClone("Wood palette.FBX"),
                    loadModelClone("Carton Box 1.FBX"),
                ]);

                setBox(boxModel);
                setBoxWidth(getWidth(boxModel));
                setBoxHeight(getHeight(boxModel));
                if (boxModel.children[0]) {
                    boxModel.children[0].material = Materials("Cardboard.jpg");
                }

                const rackColliders = arrayOfObjects.map((obj) =>
                    Rack(categoryGroup, obj, wPallet, getLength(wPallet), getWidth(wPallet), projectId)
                );
                categoryCollidersRef.current.set(categoryKey, rackColliders.flat());
                categoryCommandMapRef.current.set(categoryKey, "");
                categoryAssetsRef.current.set(categoryKey, assetIds);
                categorySignatureRef.current.set(categoryKey, nextSignature);
                continue;
            }

            if (name === "composite" && fbx.length > 0) {
                const cFbx = JSON.parse(fbx);
                const [wPallet, model] = await Promise.all([
                    loadModelClone(cFbx.composite[0].fbx),
                    loadModelClone(cFbx.compositetop[0].fbx),
                ]);

                const halfLength =  getLength(model)
                const halfWidth =  getWidth(model)
                const halfHeight =  getLength(model)

                wPallet.scale.multiplyScalar(0.01);

                arrayOfObjects.forEach((asset) => {
                    makeComposite(
                        asset,
                        model,
                        wPallet,
                        halfLength,
                        halfWidth,
                        halfHeight,
                        getLength(wPallet),
                        getWidth(wPallet),
                        getHeight(wPallet),
                        categoryGroup,
                        camera,
                        scene
                    );
                });

                categoryCommandMapRef.current.set(categoryKey, "");
                categoryAssetsRef.current.set(categoryKey, assetIds);
                categoryCollidersRef.current.set(categoryKey, []);
                categorySignatureRef.current.set(categoryKey, nextSignature);
                continue;
            }

            if (
                [
                    "Racks Horizontal",
                    "Coffee Machine",
                    "Server Cabinet",
                    "Aloe",
                    "TradeStar",
                    "Bed",
                    "Small Fridge Door Animated",
                ].some((item) => fbx.includes(item))
            ) {
                categoryCommandMapRef.current.set(categoryKey, "");
                categoryAssetsRef.current.set(categoryKey, assetIds);
                categoryCollidersRef.current.set(categoryKey, []);
                categorySignatureRef.current.set(categoryKey, nextSignature);
                continue;
            }

            try {
                const bagModel = await loadBagModel();
                 
                const result = await loadFiles(rawCategory, categoryGroup, arrayOfObjects, bagModel, branch);

               
                addFloorsToMap(result?.floors || []);
                categoryCommandMapRef.current.set(categoryKey, result?.commandText || "");
                categoryAssetsRef.current.set(categoryKey, assetIds);
                categoryMeshKeysRef.current.set(categoryKey, result?.meshKeys || []);
                categoryCollidersRef.current.set(categoryKey, result?.colliders || []);
                categorySignatureRef.current.set(categoryKey, nextSignature);
                debugSceneAdd(debugLabel, "category added successfully", {
                    fbx,
                    categoryKey,
                    groupChildren: categoryGroup.children.length,
                    assets: assets.length,
                    assetIds,
                });

                //    const rawCategory = getCategoryRaw(category);
            const cleanKey = (rawCategory?.fbx || "").replace(/\s+/g, "").replace(/\.fbx$/i, "");



           


         


            } catch (error) {
                console.error(`[InstanceExperience] failed to sync category ${categoryKey}`, error);
                if (debugLabel) {
                    setTerminalMessage({
                        command: debugLabel,
                        message: `Could not show ${name || fbx}: ${error?.message || "scene load failed"}`,
                    });
                }
                // debugSceneAdd(debugLabel, `failed to add category: ${error?.message || "unknown error"}`, {
                //     fbx,
                //     categoryKey,
                //     assets: assets.length,
                //     assetIds,
                // });
                categoryCommandMapRef.current.set(categoryKey, "");
                categoryAssetsRef.current.set(categoryKey, assetIds);
                categoryCollidersRef.current.set(categoryKey, []);
                categorySignatureRef.current.set(categoryKey, nextSignature);

                const failedGroup = sceneObj.getObjectByName(`category:${categoryKey}`);
                if (failedGroup) {
                    disposeScene(failedGroup);
                    failedGroup.removeFromParent();
                }
            }
        }


        //console.log("[InstanceExperience] commands",  categoryCommandMapRef.current);  
         

        if (pruneMissing) {
            for (const [categoryKey] of categorySignatureRef.current) {
                if (nextCategoryKeys.has(categoryKey)) {
                    continue;
                }

                const group = sceneObj.getObjectByName(`category:${categoryKey}`);
                const categoryName = group?.userData?.categoryName || categoryKey;
                clearCategoryScene(sceneObj, categoryKey, categoryName);
            }
        }
        const commandString = rebuildAssetCommands();
        const nextCollidersSignature = Array.from(categoryCollidersRef.current.entries())
            .map(([key, value]) => `${key}:${Array.isArray(value) ? value.length : 0}`)
            .sort()
            .join("|");
        if (nextCollidersSignature !== collidersSignatureRef.current) {
            collidersSignatureRef.current = nextCollidersSignature;
            setColliders(Array.from(categoryCollidersRef.current.values()).flat());
        }
        if (pruneMissing) {
            const nextFloors = Array.from(nextFloorsMap.values()).sort((a, b) => a.code - b.code);
            setFloors(nextFloors);
            setSelectedFloors(nextFloors);
            setCheckedItems(
                orderedCategories
                    .map((category) => parseInt(getCategoryRaw(category)?.category_index, 10))
                    .filter((value) => !Number.isNaN(value))
            );
        }
        useGLTF.preload(`${import.meta.env.VITE_FILE_URL}/Nathan_man.glb`);
        return commandString;
    };

    const applyDslSceneCommand = async (command, triggerSource = "store") => {
        if (!command?.data && !command?.delta?.category) {
            return;
        }

        const debugLabel = "placeobject";
        const commandId = command.commandId || `${command.projectId}:${command.assetId || ""}:${command.createdAt || ""}`;
        if (commandId && lastAppliedDslCommandRef.current === commandId) {
            debugSceneAdd(debugLabel, `duplicate trigger ignored from ${triggerSource}`, {
                commandId,
                projectId: command.projectId,
                assetId: command.assetId,
            });
            return;
        }

        lastAppliedDslCommandRef.current = commandId;

        const acceptedKeys = buildProjectSceneRequestKeys(projectIdRef.current);
            const incomingKey = String(command.projectId || "");
            const incomingBaseKey = incomingKey.replace(/_L\d+$/i, "");

            debugSceneAdd(debugLabel, `renderer trigger fired from ${triggerSource}`, {
                activeProjectId: projectIdRef.current,
                incomingProjectId: incomingKey,
                acceptedKeys,
                assetId: command.assetId,
                source: command.source,
            });

            if (!acceptedKeys.includes(incomingKey) && !acceptedKeys.includes(incomingBaseKey)) {
                debugSceneAdd(debugLabel, "ignored command for different project", {
                    activeProjectId: projectIdRef.current,
                    incomingProjectId: incomingKey,
                    acceptedKeys,
                });
                clearDslSceneCommand?.();
                return;
            }

            const hasDeltaCategory = Boolean(command.delta?.category);
            const commandData = command.data || (hasDeltaCategory ? { categories: [command.delta.category] } : { categories: [] });
            const data = command.saved === false
                ? mergeSceneData(apiData.current, commandData)
                : hasDeltaCategory
                    ? mergeSceneData(apiData.current, { ...commandData, categories: [command.delta.category] })
                    : commandData;
            const nextMorphs = Array.isArray(data?.dslMorphs) ? data.dslMorphs : [];
            const shouldRefreshMorphData = !hasDeltaCategory || nextMorphs.length > 0;
            const nextData = shouldRefreshMorphData ? normalizeSceneCategories(data?.categories || []) : [];
            const deltaData = hasDeltaCategory ? normalizeSceneCategories([command.delta.category]) : nextData;
            const visibleData = filterMorphTargetCategories(deltaData, nextMorphs);
            const nextSignature = hasDeltaCategory ? sceneSignatureRef.current : buildSceneSignature(nextData);

            debugSceneAdd(debugLabel, "scene command received", {
                projectId: command.projectId,
                assetId: command.assetId,
                source: command.source,
                categories: visibleData.length,
            });

            apiData.current = data;
            sceneSignatureRef.current = nextSignature;
            if (shouldRefreshMorphData) {
                setSceneMorphs(nextMorphs);
                setMorphCategories(nextData);
            }

            const commandString = await syncCategoriesToScene(visibleData, {
                forceReload: false,
                debugLabel,
                pruneMissing: !hasDeltaCategory,
            });
            
            assetCommands.current = commandString;
            setLazy(false);
            debugSceneAdd(debugLabel, "scene command completed", {
                projectId: command.projectId,
                assetId: command.assetId,
            });
            clearDslSceneCommand?.();
    };

    useEffect(() => {
        if (!dslSceneCommand?.data) {
            return;
        }

        let cancelled = false;

        const applyDslCommand = async () => {
            await applyDslSceneCommand(dslSceneCommand, "store");
            if (cancelled) {
                return;
            }
        };

        applyDslCommand().catch((error) => {
            console.error("Failed to apply DSL scene command:", error);
            clearDslSceneCommand?.();
        });

        return () => {
            cancelled = true;
        };
    }, [dslSceneCommandTick]);

    useEffect(() => {
        const handleDslSceneCommand = (event) => {
            console.warn("[placeobject] InstanceExperience received window trigger", event.detail);
            applyDslSceneCommand(event.detail, "window").catch((error) => {
                console.error("Failed to apply DSL scene command from window event:", error);
                clearDslSceneCommand?.();
            });
        };

        window.addEventListener(DSL_SCENE_COMMAND_APPLIED, handleDslSceneCommand);
        return () => window.removeEventListener(DSL_SCENE_COMMAND_APPLIED, handleDslSceneCommand);
    }, []);

    useEffect(() => {
        const handleRemoteSceneCommand = (message) => {
            if (!message?.transientSceneCommand || !message?.sceneCommand?.data) {
                return;
            }

            applyDslSceneCommand(message.sceneCommand, "socket-message").catch((error) => {
                console.error("Failed to apply transient DSL scene command from socket message:", error);
                clearDslSceneCommand?.();
            });
        };

        socket.on("terminalMessage", handleRemoteSceneCommand);
        return () => socket.off("terminalMessage", handleRemoteSceneCommand);
    }, []);


    const disposeMaterial = (material) => {
        if (!material) {
            return;
        }

        material.map?.dispose?.();
        material.alphaMap?.dispose?.();
        material.dispose?.();
    };

    const disposeScene = (SceneObj) => {
        // Traverse the existing SceneObj to dispose of its resources
        SceneObj.traverse((object) => {
            // Dispose geometry
            if (object.geometry) {
                object.geometry.dispose();
            }

            // Dispose materials
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(disposeMaterial);
                } else {
                    disposeMaterial(object.material);
                }
            }

            // Dispose textures
            if (object.texture) {
                object.texture.dispose();
            }
        });

        // Remove all child meshes from the SceneObj before clearing the object
        while (SceneObj.children.length > 0) {
            const child = SceneObj.children[0];
            SceneObj.remove(child);
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
                child.material.forEach(disposeMaterial);
            } else {
                disposeMaterial(child.material);
            }
            child.texture?.dispose();
        }


    }

    useEffect(() => {
        getEmployees()
    }, []);

    useEffect(() => {
        return () => {
            const localSceneObject = scene?.getObjectByName("sceneObj");
            if (localSceneObject) {
                scene.remove(localSceneObject);
                disposeScene(localSceneObject);
                localSceneObject.clear();
            }
            sceneObject.current = null;
            resetSceneState();
        };
    }, [scene]);

    const getEmployees = async () => {

        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/getEmployees`
            );
            const result = await response.json();
            setEmployees(result)

        } catch (error) {
            console.error("Error deleting asset:", error);
        }
    }




    useEffect(() => {
        const resetUIStates = () => {
            setShowBdims(false);
            setShowOdims(false);
            setShowFdims(false);
            setPackageControl(false);
            setEditPopup(false);
            setWallsOpacity(30);
            setCategory(false);
            setAnnotations(false);
            setLabel(false);
            categoryCommands.current = [];
        };

        setForwardOnly(false);
        resetUIStates();

        const token = ++loadTokenRef.current;
        const selectedLevelKey = getSelectedLevelKey(selectedLevel);

        const finishCurrentLoad = () => {
            loadStateRef.current = {
                hasLoadedProject: projectId > 0,
                projectId,
                selectedLevelKey,
                checkReload: loadStateRef.current.checkReload,
                reload: loadStateRef.current.reload,
            };
        };

                
        if (projectId) {
            const loadScene = async () => {
                const sceneObj = ensureSceneObject();
                assetCommands.current = `project ${projectId}\n`;

                disposeScene(sceneObj);
                sceneObj.clear();
                resetSceneState();
                setSceneMorphs([]);
                setMorphCategories([]);

                const dslScene = await loadProjectSceneData(projectId);
             

                if (token !== loadTokenRef.current) {
                    return;
                }

                const nextMorphs = Array.isArray(dslScene?.dslMorphs) ? dslScene.dslMorphs : [];
                const dslCategories = Array.isArray(dslScene?.categories) ? dslScene.categories : [];
                // const dbCategories = await loadDbData();
   
              
                if (dslCategories.length) {
                    const nextData = dslCategories// mergeDbAndDslCategories(dbCategories, dslCategories);
                    const visibleData = filterMorphTargetCategories(nextData, nextMorphs);
                      
                    apiData.current = { ...(dslScene || {}), categories: nextData };
                    sceneSignatureRef.current = buildSceneSignature(nextData);
                    setSceneMorphs(nextMorphs);
                    setMorphCategories(nextData);
                 
                    await syncCategoriesToScene(visibleData, { forceReload: true });
                    finishCurrentLoad();
                    return;
                }

                // const nextData = normalizeSceneCategories(dbCategories);
                // apiData.current = { categories: nextData };
                // sceneSignatureRef.current = buildSceneSignature(nextData);
                // setSceneMorphs([]);
                // setMorphCategories([]);
                // await syncCategoriesToScene(nextData, { forceReload: true });

      


   
    
     
    //  const response =  await fetch(`${import.meta.env.VITE_API_URL}/save-project-scene`, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ projectId,
    //         data: apiData.current, 
    //         assetName: null,
    //         commands:commandString,  
    //         localFields: null,
    //         level: 0,
    //         categoryStructure: categoryCommands.current
    //     }),
    //     });
        // console.log(categoryCommands.current)
                //  console.log("[InstanceExperience] commands", commandString);
                finishCurrentLoad();
            };

            loadScene().catch((error) => {
                console.error("Failed to load scene data:", error);
                if (token !== loadTokenRef.current) {
                    return;
                }
                finishCurrentLoad();
            });
        } else {
            const sceneObj = scene.getObjectByName("sceneObj");
            if (sceneObj) {
                scene.remove(sceneObj);
                disposeScene(sceneObj);
                sceneObj.clear();
                sceneObject.current = null;
            }
            resetSceneState();
            loadStateRef.current = {
                hasLoadedProject: false,
                projectId,
                selectedLevelKey,
                checkReload: loadStateRef.current.checkReload,
                reload: loadStateRef.current.reload,
            };
        }

        return () => {
            resetUIStates();
        };

    }, [projectId, selectedLevel]);



    useEffect(() => {

        setSearchList([])
        if (box && String(projectId).includes("132")) {
            const sceneObject = scene.getObjectByName('sceneObj');
            AddLabels(projectId, 5, sceneObject, boxWidth, boxHeight, box).then((locationObj) => {
                setSearchList(locationObj.searchList)
                setLocationList(locationObj.locationList)
            })
        }
    }, [box, projectId]);

    useEffect(() => {

        locationData.forEach((locationData) => {
            locationData.pin.children[0].layers.mask = location ? 1 : 0
            if (locationData.text.children.length > 0)
                locationData.text.children[0].layers.mask = location ? 1 : 0

        });
    }, [location]);




    useEffect(() => {

        const dims = document.getElementById('dims')

        if (dims && !packageControl) {

            document.body.removeChild(dims);
            return;
        }
        if (!showBdims && !showFdims && !showOdims && dims) {
            document.body.removeChild(dims);


        } else if ((showBdims || showFdims || showOdims) && labelRenderer && labelRenderer.domElement) {
            if (dims) {
                document.body.removeChild(dims);
            }
            document.body.appendChild(labelRenderer.domElement);
        }
        ToggleDims(showBdims, showFdims, showOdims, scene)

        return () => {
            const dimsNode = document.getElementById('dims');
            if (dimsNode?.parentNode) {
                dimsNode.parentNode.removeChild(dimsNode);
            }
        };

    }, [showBdims, showFdims, showOdims, projectId, packageControl]);

    useEffect(() => {
        // @ts-ignore
        if (FormMixer) {
            const action = FormMixer.action;
            const onFinished = () => {
                setPause(true);
            };

            // Handle pause state
            action.paused = pause;

            if (!pause) {
                // Handle backward or forward animation playback
                if (playBackward) {
                    // Play backward by setting a negative timeScale
                    action.timeScale = -1 / 2.6; // This makes the animation play in reverse at normal speed
                    action.play();
                } else {
                    // Play forward with a positive timeScale
                    action.timeScale = 1 / 2.6; // Forward animation at normal speed
                    action.reset().fadeIn(0.2).play(); // Reset ensures it starts fresh when playing forward
                }

                action.loop = THREE.LoopOnce; // Ensure the animation plays only once
                action.clampWhenFinished = true;
                action._mixer.addEventListener("finished", onFinished);
            }

            return () => {
                action?._mixer?.removeEventListener?.("finished", onFinished);
            };
        }
    }, [playBackward, pause]);

    useEffect(() => {
        if (animations) {
            animations.forEach((mixerObj) => {
                const contAnimation = mixerObj.contAnimation;
                const action = mixerObj.action;
                const name = mixerObj.name;

                if (anims) {
                    if (name == 'Ceiling Fan Animated.FBX') {
                        return
                    }
                    if (contAnimation == 1) {
                        // Check if the action is already running to prevent resetting it repeatedly
                        action
                            .reset()
                            .fadeIn(0.2)
                            .setDuration(action.getClip().duration / 10)
                            .play();
                        action.loop = THREE.LoopRepeat;

                    } else {
                        action
                            .reset()
                            .fadeIn(0.2)
                            .setDuration(action.getClip().duration)
                            .play();
                        action.clampWhenFinished = true;
                    }
                } else {
                    action.loop = THREE.LoopOnce;
                    action.timeScale = -1;
                    action.clampWhenFinished = true;
                    action.play();
                }

            });

        }


    }, [anims]);

    useFrame(({ camera }, delta) => {
        if (anims && animations?.length) {
            for (const mixerObj of animations) {
                if (mixerObj.name === "Ceiling Fan Animated.FBX") {
                    mixerObj.objectClone.rotation.y += delta * 10;
                } else {
                    mixerObj.mixer.update(delta);
                }
            }
        }

        // @ts-ignore
        if (FormMixer?.mixer) {

            FormMixer.mixer.update(delta);
        }

        if (location && locationData?.length) {
            for (const loc of locationData) {
                loc?.mixer.update(delta);
                loc.text.lookAt(camera.position);
            }
        }
        if (annotations && AnnotationData?.length) {
            const cameraPosition = camera.position;
            for (const annot of AnnotationData) {
                annot.text.lookAt(cameraPosition);
            }
        }

        if (showBdims || showFdims || showOdims) {
            labelRenderer?.render(scene, camera);
        }
    });


    // return null
    return (
        <Suspense fallback={null}>
         
            <Dots sceneObject={sceneObject.current} />
            <DevicePath sceneObject={sceneObject.current} />
            {showProject135PathAvatar && <Project135PathAvatar />}
            {bProjectId > 0 && (bProjectId != 147 && bProjectId != 148) && <Building bProjectId={bProjectId} />}
            {/* <DroneShowMorph morphs={sceneMorphs} categories={morphCategories} /> */}
            <DslMorphClouds morphs={sceneMorphs} categories={morphCategories} />

        </Suspense>
    )

}






