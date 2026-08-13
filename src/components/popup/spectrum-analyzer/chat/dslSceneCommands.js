import { apiData } from "../../../../threejs/player/puzzle/character/Constants.jsx";

const DSL_API_BASE = import.meta.env.VITE_DSL_API_BASE || "http://localhost:3002/api-dsl";

const normalize = (value = "") =>
    String(value).replace(/\s+/g, "").replace(/\.(fbx|glb|gltf)$/i, "").toLowerCase();

const rawCategory = (category) => category?._raw || category || {};

const rawAsset = (asset) => asset?._raw || asset || {};
const temporaryScenes = new Map();
let commandInstanceCounter = 0;

const readLookup = async () => {
    const response = await fetch(`${DSL_API_BASE}/lookup`, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Lookup failed (${response.status})`);
    }

    const payload = await response.json();
    return typeof payload === "string" ? JSON.parse(payload) : payload;
};

const findAssetMeta = (lookup, source) => {
    const sourceKey = normalize(source);
    let fallback = null;

    for (const [key, value] of Object.entries(lookup || {})) {
        if (normalize(key) === sourceKey) {
            return { key, ...value };
        }

        if (!fallback && (normalize(value?.name) === sourceKey || normalize(value?.fbx) === sourceKey)) {
            fallback = { key, ...value };
        }
    }

    if (!fallback) {
        throw new Error(`Unknown object: ${source}`);
    }

    return fallback;
};

const loadCurrentScene = async (projectId) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/project-scene/${projectId}`, {
        cache: "no-store",
    });

    if (!response.ok) {
        return { categories: [] };
    }

    const payload = await response.json();
    return typeof payload === "string" ? JSON.parse(payload) : payload;
};

const cloneSceneData = (data) => JSON.parse(JSON.stringify(data || { categories: [] }));

const hasCategories = (data) => Array.isArray(data?.categories) && data.categories.length > 0;

const mergeSceneData = (baseData, overlayData) => {
    if (!hasCategories(overlayData)) {
        return cloneSceneData(baseData);
    }

    const nextData = cloneSceneData(baseData);
    const categories = Array.isArray(nextData.categories) ? nextData.categories : [];

    for (const overlayCategory of overlayData.categories) {
        const overlayRaw = rawCategory(overlayCategory);
        let category = null;

        if (overlayRaw.commandOverlay) {
            category = categories.find((item) => {
                const raw = rawCategory(item);
                return String(raw.category_id) === String(overlayRaw.category_id)
                    || String(raw.category_index) === String(overlayRaw.category_index);
            });
        } else {
            category = findCategory(categories, overlayRaw);
        }

        if (!category) {
            categories.push(cloneSceneData(overlayCategory));
            continue;
        }

        const existingAssets = category.assets;
        const existingInstances = Array.isArray(category.instances) ? category.instances : [];
        const overlayInstances = Array.isArray(overlayCategory.instances) ? overlayCategory.instances : [];
        const mergedCategory = {
            ...rawCategory(category),
            ...overlayRaw,
            properties: {
                ...parseProperties(rawCategory(category).properties),
                ...parseProperties(overlayRaw.properties),
            },
        };

        Object.assign(category, mergedCategory);
        category.assets = existingAssets;
        category.instances = [...new Set([...existingInstances, ...overlayInstances])];

        for (const asset of listAssets(overlayCategory)) {
            const assetId = getAssetInstanceId(asset);
            const existing = findAssetByInstanceId([category], assetId);
            if (existing?.asset) {
                existing.asset.fields = {
                    ...(existing.asset.fields || {}),
                    ...(asset.fields || rawAsset(asset).fields || {}),
                };
                Object.assign(existing.asset, asset, { fields: existing.asset.fields });
            } else {
                insertAsset(category, cloneSceneData(asset));
            }
        }
    }

    nextData.categories = categories;
    return nextData;
};

const getLiveSceneData = (projectId, savedSceneData) => {
    const savedWithTemporary = mergeTemporaryScene(projectId, savedSceneData);
    if (!hasCategories(apiData.current)) {
        return savedWithTemporary;
    }

    return mergeTemporaryScene(projectId, mergeSceneData(savedWithTemporary, apiData.current));
};

const mergeTemporaryScene = (projectId, data) => {
    const temporary = temporaryScenes.get(String(projectId));
    if (!temporary?.categories?.length) {
        return data;
    }

    const nextData = cloneSceneData(data);
    const categories = Array.isArray(nextData.categories) ? nextData.categories : [];

    for (const tempCategory of temporary.categories) {
        const tempRaw = rawCategory(tempCategory);
        let category = findCategory(categories, tempRaw);
        if (!category) {
            category = { ...tempCategory, assets: [], instances: [] };
            categories.push(category);
        }

        for (const asset of listAssets(tempCategory)) {
            if (!findAssetByInstanceId(categories, getAssetInstanceId(asset))) {
                insertAsset(category, asset);
            }
        }
    }

    nextData.categories = categories;
    return nextData;
};

const rememberTemporaryAsset = (projectId, category, asset) => {
    const key = String(projectId);
    const temporary = temporaryScenes.get(key) || { categories: [] };
    let tempCategory = findCategory(temporary.categories, rawCategory(category));

    if (!tempCategory) {
        const raw = rawCategory(category);
        tempCategory = {
            ...raw,
            assets: Array.isArray(category.assets) ? [] : {},
            instances: [],
        };
        temporary.categories.push(tempCategory);
    }

    const tempAsset = { ...asset, localOnly: true };
    const existing = findAssetByInstanceId([tempCategory], getAssetInstanceId(tempAsset));
    if (existing?.asset) {
        existing.asset.fields = tempAsset.fields;
        existing.asset.localOnly = true;
    } else {
        insertAsset(tempCategory, tempAsset);
    }

    temporaryScenes.set(key, temporary);
};

const getCategoryId = (meta) => String(meta.category_id || meta.asset_id || meta.key);

const getCategoryIndex = (meta) => Number(meta.category_index || meta.category_id || meta.asset_id || 0);

const findCategory = (categories, meta) => {
    const categoryId = getCategoryId(meta);
    const fbxKey = normalize(meta.fbx || meta.name || meta.key);
    const nameKey = normalize(meta.name || meta.key);
    let fbxMatch = null;
    let nameMatch = null;

    for (const category of categories) {
        const raw = rawCategory(category);
        if (raw.commandOverlay) {
            continue;
        }

        if (String(raw.category_id) === categoryId || String(raw.asset_id) === categoryId) {
            return category;
        }

        if (!fbxMatch && normalize(raw.fbx) === fbxKey) {
            fbxMatch = category;
        }
        if (!nameMatch && normalize(raw.name) === nameKey) {
            nameMatch = category;
        }
    }

    return fbxMatch || nameMatch;
};

const listAssets = (category) => {
    const assets = category?.assets || rawCategory(category)?.assets || [];
    return Array.isArray(assets) ? assets : Object.values(assets);
};

const nextInstanceId = (categories) => {
    let maxId = 0;

    for (const category of categories) {
        for (const asset of listAssets(category)) {
            const id = Number(rawAsset(asset).instance_id || rawAsset(asset).instanceId || 0);
            if (Number.isFinite(id) && id > maxId) {
                maxId = id;
            }
        }
    }

    return maxId + 1;
};

const nextCommandInstanceId = (categories) => {
    commandInstanceCounter = (commandInstanceCounter + 1) % 1000;
    const timeId = 100000000 + ((Date.now() % 800000000) * 1000) + commandInstanceCounter;
    return Math.max(nextInstanceId(categories), timeId);
};

const field = (instanceId, name, value) => ({
    instance_id: instanceId,
    name,
    value: String(value),
});

const buildFields = (instanceId, position, assetId) => ({
    "X-pos": field(instanceId, "X-pos", position.x),
    "Y-pos": field(instanceId, "Y-pos", position.z),
    "Z-pos": field(instanceId, "Z-pos", position.y),
    Angle: field(instanceId, "Angle", JSON.stringify({ x: 0, y: 0, z: 0 })),
    AssetID: field(instanceId, "AssetID", assetId),
    assetID: field(instanceId, "assetID", assetId),
    Status: field(instanceId, "Status", "In Use"),
    "v-align": field(instanceId, "v-align", "bottom"),
    Color: field(instanceId, "Color", "#ffffff"),
});

const createAsset = (instanceId, meta, position) => {
    const assetId = meta.asset_id || meta.category_id || instanceId;
    const fields = buildFields(instanceId, position, assetId);

    return {
        id: instanceId,
        instance_id: instanceId,
        instanceId,
        asset_id: Number(meta.asset_id || meta.category_id || instanceId),
        category: getCategoryId(meta),
        category_index: getCategoryIndex(meta),
        description: [],
        images: [],
        category_images: [],
        fields,
    };
};

const createCategory = (meta, projectId) => ({
    category_id: getCategoryId(meta),
    category_index: getCategoryIndex(meta),
    asset_id: Number(meta.asset_id || meta.category_id || 0),
    name: meta.name || meta.key,
    fbx: meta.fbx,
    project_id: projectId,
    textures: meta.textures || [],
    properties: meta.properties || {},
    assets: [],
    instances: [],
});

const parseProperties = (value) => {
    if (!value) {
        return {};
    }
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }
    return typeof value === "object" ? value : {};
};

const insertAsset = (category, asset) => {
    if (Array.isArray(category.assets)) {
        category.assets = [...category.assets, asset];
    } else {
        category.assets = { ...(category.assets || {}), [asset.instance_id]: asset };
    }

    const instances = Array.isArray(category.instances) ? category.instances : [];
    category.instances = [...new Set([...instances, asset.instance_id])];
};

const categoryDeltaForAsset = (category, asset) => {
    const assetId = getAssetInstanceId(asset);
    const raw = cloneSceneData(rawCategory(category));
    const overlayCategoryId = Number(assetId) + 900000000;
    const properties = parseProperties(raw.properties);
    delete properties.dslAnimations;

    return {
        ...raw,
        category_id: overlayCategoryId,
        category_index: overlayCategoryId,
        commandOverlay: true,
        source_category_id: raw.category_id,
        source_category_index: raw.category_index,
        properties,
        assets: [cloneSceneData(asset)],
        instances: [assetId].filter(Boolean),
    };
};

const getAssetInstanceId = (asset) => String(rawAsset(asset).instance_id || rawAsset(asset).instanceId || rawAsset(asset).id || "");

const findAssetByInstanceId = (categories, instanceId) => {
    if (!instanceId) {
        return null;
    }

    const targetId = String(instanceId);
    for (const category of categories) {
        const assets = category?.assets || rawCategory(category)?.assets || [];
        if (Array.isArray(assets)) {
            for (const asset of assets) {
                if (getAssetInstanceId(asset) === targetId) {
                    return { category, asset };
                }
            }
        } else if (assets[targetId]) {
            return { category, asset: assets[targetId] };
        } else {
            for (const asset of Object.values(assets)) {
                if (getAssetInstanceId(asset) === targetId) {
                    return { category, asset };
                }
            }
        }
    }

    return null;
};

const mergePositionFields = (asset, position) => {
    const raw = rawAsset(asset);
    const assetId = raw.asset_id || raw.assetId || raw.assetID || raw.id;
    const instanceId = raw.instance_id || raw.instanceId || raw.id;
    asset.fields = {
        ...(asset.fields || {}),
        "X-pos": field(instanceId, "X-pos", position.x),
        "Y-pos": field(instanceId, "Y-pos", position.z),
        "Z-pos": field(instanceId, "Z-pos", position.y),
    };
    raw.fields = asset.fields;
    return asset;
};

const readAssetCommandPosition = (asset) => {
    const fields = rawAsset(asset).fields || asset?.fields || {};
    const x = Number(fields["X-pos"]?.value);
    const y = Number(fields["Z-pos"]?.value);
    const z = Number(fields["Y-pos"]?.value);
    return [x, y, z];
};

const samePoint = (left = [], right = []) =>
    left.length === right.length && left.every((value, index) => Math.abs(Number(value) - Number(right[index])) < 0.001);

const createAnimationTargetAsset = (meta, from, categories) => {
    const [x = 0, y = 0, z = 0] = from;
    const asset = createAsset(nextCommandInstanceId(categories), meta, { x, y, z });
    asset.localOnly = true;
    return asset;
};

const categoryStructureFor = (meta) => {
    const cleanKey = normalize(meta.fbx || meta.name || meta.key);
    return [{ [cleanKey]: {
        category_id: getCategoryId(meta),
        category_index: getCategoryIndex(meta),
        asset_id: Number(meta.asset_id || meta.category_id || 0),
        name: meta.name || meta.key,
        fbx: meta.fbx,
    }}];
};

const saveScene = async ({ projectId, data, meta, asset, categoryStructure, commandText }) => {
    const level = String(projectId).split("_")[1] || "0";
    const isCommandOnly = Boolean(commandText);
    const response = await fetch(`${import.meta.env.VITE_API_URL}/save-project-scene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            projectId,
            data,
            assetName: isCommandOnly ? null : meta.name || meta.key,
            localFields: isCommandOnly ? null : asset.fields,
            level,
            categoryStructure,
            commands: commandText,
        }),
    });

    if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
    }

    return response.json();
};

const buildMotionAnimation = ({ target, property, from, to, duration, ease, yoyo, repeat, targetInstanceIds }) => ({
    id: `command:${normalize(target)}:${normalize(property)}:${(targetInstanceIds || []).join("-")}`,
    target,
    targetInstanceIds,
    engine: "motion",
    repeat,
    steps: [{
        type: "tween",
        property,
        from,
        to,
        duration,
        ease,
        yoyo,
        repeat,
    }],
});

const upsertDslAnimation = (category, animation) => {
    const raw = rawCategory(category);
    const properties = parseProperties(raw.properties);
    const animations = raw.commandOverlay
        ? []
        : Array.isArray(properties.dslAnimations) ? properties.dslAnimations : [];
    const nextAnimations = animations.filter((entry) => entry?.id !== animation.id);
    raw.properties = {
        ...properties,
        dslAnimations: [...nextAnimations, animation],
    };
    category.properties = raw.properties;
};

export async function placeObjectFromDsl({ projectId, source, position, instanceId, save = false }) {
    const [lookup, sceneData] = await Promise.all([
        readLookup(),
        loadCurrentScene(projectId),
    ]);
    const meta = findAssetMeta(lookup, source);
    const workingSceneData = save ? sceneData : getLiveSceneData(projectId, sceneData);
    const categories = Array.isArray(workingSceneData.categories) ? [...workingSceneData.categories] : [];
    const existing = findAssetByInstanceId(categories, instanceId);
    let category = existing?.category || findCategory(categories, meta);

    if (!category) {
        category = createCategory(meta, projectId);
        categories.push(category);
    }

    const asset = existing?.asset
        ? mergePositionFields(existing.asset, position)
        : createAsset(nextInstanceId(categories), meta, position);

    if (!existing?.asset) {
        insertAsset(category, asset);
    }

    const nextData = { ...workingSceneData, categories };
    let savePromise = null;

    if (save) {
        apiData.current = nextData;
        savePromise = saveScene({
            projectId,
            data: nextData,
            meta,
            asset,
            categoryStructure: categoryStructureFor(meta),
        });
    } else {
        asset.localOnly = true;
        rememberTemporaryAsset(projectId, category, asset);
    }

    const renderData = save ? getLiveSceneData(projectId, nextData) : nextData;
    apiData.current = renderData;

    return {
        asset,
        meta,
        data: renderData,
        projectId,
        saved: save,
        savePromise,
        delta: {
            type: "placeobject",
            category: categoryDeltaForAsset(category, asset),
            asset: cloneSceneData(asset),
        },
    };
}

export async function animateMotionFromDsl({ projectId, target, property, from, to, duration, ease, yoyo, repeat }) {
    const [lookup, sceneData] = await Promise.all([
        readLookup(),
        loadCurrentScene(projectId),
    ]);
    const meta = findAssetMeta(lookup, target);
    const workingSceneData = getLiveSceneData(projectId, sceneData);
    const categories = Array.isArray(workingSceneData.categories) ? [...workingSceneData.categories] : [];
    let category = findCategory(categories, meta);

    if (!category) {
        category = createCategory(meta, projectId);
        categories.push(category);
    }

    const targetAsset = createAnimationTargetAsset(meta, from, categories);
    const targetInstanceIds = [String(targetAsset.instance_id || targetAsset.instanceId || targetAsset.id)];
    const animation = buildMotionAnimation({ target, property, from, to, duration, ease, yoyo, repeat, targetInstanceIds });
    const overlayCategory = categoryDeltaForAsset(category, targetAsset);
    upsertDslAnimation(overlayCategory, animation);
    console.log("[animateMotion overlay]", {
        target,
        property,
        targetInstanceIds,
        from,
        to,
        overlayCategoryId: overlayCategory.category_id,
    });

    const renderData = mergeSceneData(workingSceneData, { categories: [overlayCategory] });
    apiData.current = renderData;

    const savePromise = saveScene({
        projectId,
        data: sceneData,
        meta,
        asset: { fields: {} },
        categoryStructure: categoryStructureFor(meta),
        commandText: `animateMotion ${target} ${property} from(${from.join(",")}) to(${to.join(",")}) duration(${duration}) ease(${ease}) yoyo(${yoyo}) repeat(${repeat})`,
    });

    return {
        animation,
        meta,
        data: renderData,
        projectId,
        savePromise,
        delta: {
            type: "animateMotion",
            category: overlayCategory,
            asset: cloneSceneData(targetAsset),
            animation: cloneSceneData(animation),
        },
    };
}
