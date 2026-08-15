import { apiData } from "../../../../threejs/player/puzzle/character/Constants.jsx";

const FALLBACK_IMAGE = `${import.meta.env.VITE_FILE_URL}/no_image.png`;

const getAssetImageUrl = (fileName) => {
    if (String(fileName || "").startsWith("project33-")) {
        return `${import.meta.env.VITE_API_URL}/files/${encodeURIComponent(fileName)}`;
    }

    return `${import.meta.env.VITE_FILE_URL}/${fileName}`;
};

const formatText = (value, fallback = "Not available.") => {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
};

const normalizeFields = (fields) => {
    if (Array.isArray(fields)) {
        return fields;
    }

    if (fields && typeof fields === "object") {
        return Object.entries(fields).map(([key, value]) => {
            if (value && typeof value === "object") {
                return {
                    name: value.name || key,
                    ...value,
                };
            }

            return {
                name: key,
                value,
            };
        });
    }

    return [];
};

const findFieldValue = (fields, names) => {
    const targetNames = names.map((name) => name.toLowerCase());
    const field = normalizeFields(fields).find((item) => (
        targetNames.includes(String(item?.name || "").trim().toLowerCase())
    ));

    return field?.value;
};

const normalizeFieldName = (name = "") => String(name || "").trim();

const isUsefulValue = (value) => (
    value !== undefined &&
    value !== null &&
    String(value).trim() !== "" &&
    String(value).trim() !== "[]undefined"
);

const getFieldId = (field) => field?.field_id ?? field?.fieldId ?? field?.id;
const getParentId = (field) => field?.parent_id ?? field?.parentId ?? 0;
const HIDDEN_META_FIELD_NAMES = new Set([
    "id",
    "assetid",
    "asset id",
    "assetname",
    "asset name",
    "date",
    "date in",
    "angle",
    "x-pos",
    "y-pos",
    "z-pos",
    "x pos",
    "y pos",
    "z pos",
    "position",
    "rotation",
    "scale",
    "scale factor",
    "color",
    "status",
    "v-align",
    "vertical align",
    "room",
    "branch",
]);

const isHiddenMetaField = (name) => HIDDEN_META_FIELD_NAMES.has(
    normalizeFieldName(name).toLowerCase()
);

const getRawAsset = (asset) => asset?._raw || asset || {};

const getSceneAssetInstanceId = (asset, fallbackId = "") => {
    const raw = getRawAsset(asset);
    return raw.instance_id
        ?? raw.instanceId
        ?? raw.id
        ?? asset?.instance_id
        ?? asset?.instanceId
        ?? asset?.id
        ?? fallbackId;
};

const getSceneCategories = () => (
    Array.isArray(apiData.current?.categories)
        ? apiData.current.categories
        : []
);

const getSceneAssetEntries = (assets) => {
    if (Array.isArray(assets)) {
        return assets.map((asset) => [getSceneAssetInstanceId(asset), asset]);
    }

    if (assets && typeof assets === "object") {
        return Object.entries(assets);
    }

    return [];
};

const findSceneAssetByInstanceId = (instanceId) => {
    if (!instanceId) {
        return null;
    }

    const targetId = String(instanceId);
    for (const category of getSceneCategories()) {
        const rawCategory = category?._raw || category || {};
        const assets = category?.assets || rawCategory.assets;

        for (const [assetKey, asset] of getSceneAssetEntries(assets)) {
            const assetId = getSceneAssetInstanceId(asset, assetKey);
            if (assetId !== undefined && assetId !== null && String(assetId) === targetId) {
                return {
                    asset,
                    category,
                    assetKey,
                };
            }
        }
    }

    return null;
};

const getSceneAssetFields = (sceneAsset) => {
    const raw = getRawAsset(sceneAsset);
    return sceneAsset?.fields || raw.fields || {};
};

const getSceneAssetCategoryIndex = (sceneMatch) => {
    const rawAsset = getRawAsset(sceneMatch?.asset);
    const rawCategory = sceneMatch?.category?._raw || sceneMatch?.category || {};
    return rawAsset.category
        ?? rawAsset.categoryIndex
        ?? rawCategory.category
        ?? rawCategory.id
        ?? rawCategory.categoryIndex;
};

const getSceneAssetId = (sceneMatch) => {
    const rawAsset = getRawAsset(sceneMatch?.asset);
    return rawAsset.assetID
        ?? rawAsset.assetId
        ?? rawAsset.asset_id
        ?? findFieldValue(rawAsset.fields, ["AssetID", "assetID", "Asset Id"]);
};

const getFieldDedupeKey = (field, index) => {
    const id = getFieldId(field);
    if (id !== undefined && id !== null) {
        return `id:${id}`;
    }

    const name = normalizeFieldName(field?.name);
    return name ? `name:${name.toLowerCase()}` : `index:${index}`;
};

const dedupeFields = (fields) => {
    const deduped = new Map();

    fields.forEach((field, index) => {
        if (!field) return;

        const key = getFieldDedupeKey(field, index);
        const existing = deduped.get(key);

        if (!existing || (!isUsefulValue(existing.value) && isUsefulValue(field.value))) {
            deduped.set(key, field);
        }
    });

    return Array.from(deduped.values());
};

const buildSpecGroups = ({ instanceId, assetName, rawFields, apiFields, sceneFields }) => {
    const allFields = dedupeFields([
        ...normalizeFields(sceneFields),
        ...normalizeFields(apiFields),
        ...normalizeFields(rawFields),
    ]);
    const fieldsById = new Map();
    allFields.forEach((field) => {
        const id = getFieldId(field);
        if (id !== undefined && id !== null) {
            fieldsById.set(String(id), field);
        }
    });

    const groups = new Map();
    const getGroup = (title) => {
        const key = normalizeFieldName(title) || "Details";
        if (!groups.has(key)) {
            groups.set(key, { title: key, rows: [] });
        }
        return groups.get(key);
    };

    allFields.forEach((field) => {
        const name = normalizeFieldName(field?.name);
        const value = field?.value;
        if (!name || isHiddenMetaField(name) || !isUsefulValue(value)) {
            return;
        }

        const parent = fieldsById.get(String(getParentId(field)));
        const groupTitle = parent?.type === "label" || parent?.name
            ? parent?.name
            : field?.group || field?.category || "Details";

        if (field?.type === "label") {
            getGroup(name);
            return;
        }

        getGroup(groupTitle === "Specifications" ? "Meta" : groupTitle).rows.push({
            label: name,
            value,
        });
    });

    return Array.from(groups.values()).filter((group) => group.rows.length);
};

const getImageUrl = (image) => {
    if (!image?.name || image.name === "no_image.png") {
        return "";
    }

    return getAssetImageUrl(image.name);
};

const getImageItems = (assetData) => {
    const imageList = assetData?.images?.length ? assetData.images : assetData?.categoryImages;
    const validImages = Array.isArray(imageList)
        ? imageList.map(getImageUrl).filter(Boolean)
        : [];

    if (!validImages.length) {
        return [{
            itemImageSrc: FALLBACK_IMAGE,
            thumbnailImageSrc: FALLBACK_IMAGE,
            alt: "No image available",
            title: "No image available",
        }];
    }

    return validImages.map((url, index) => ({
        itemImageSrc: url,
        thumbnailImageSrc: url,
        alt: `Asset image ${index + 1}`,
        title: `Image ${index + 1}`,
    }));
};

const fetchAssetData = async (instanceId) => {
    try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/asset/${instanceId}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.warn("Play asset info API load failed:", error);
    }

    return null;
};

export const hasPlaySceneMetadata = (instanceId) => {
    const sceneMatch = findSceneAssetByInstanceId(instanceId);
    const sceneFields = getSceneAssetFields(sceneMatch?.asset);
    const groups = buildSpecGroups({
        instanceId,
        assetName: "",
        rawFields: {},
        apiFields: {},
        sceneFields,
    });

    return groups.some((group) => group.rows?.length);
};

export const loadPlayAssetInfo = async ({ instanceId, fallbackName = "" }) => {
    if (!instanceId) {
        return null;
    }

    const sceneMatch = findSceneAssetByInstanceId(instanceId);
    const sceneAsset = sceneMatch?.asset;
    const sceneFields = getSceneAssetFields(sceneAsset);
    const hasSceneFields = normalizeFields(sceneFields).some((field) => (
        normalizeFieldName(field?.name) && isUsefulValue(field?.value)
    ));
    const assetData = await fetchAssetData(instanceId);
    const rawFields = assetData?.extraFields || {};
    const apiFields = assetData?.fields || {};
    const assetInfo = findFieldValue(sceneFields, ["AssetInfo", "Asset Info"]) ||
        findFieldValue(rawFields, ["AssetInfo", "Asset Info"]);
    const assetDescription = findFieldValue(sceneFields, ["Asset Description", "AssetDescription", "Business Description"]) ||
        findFieldValue(rawFields, ["Asset Description", "AssetDescription"]);
    const assetName = findFieldValue(sceneFields, ["Company Name", "AssetName", "Asset Name"]) ||
        findFieldValue(apiFields, ["AssetName", "Asset Name"]) ||
        findFieldValue(rawFields, ["AssetName", "Asset Name"]) ||
        fallbackName ||
        "Not Defined";
    const imageItems = getImageItems(assetData);
    const specGroups = buildSpecGroups({
        instanceId,
        assetName,
        rawFields,
        apiFields,
        sceneFields,
    });

    if (!specGroups.some((group) => group.rows?.length)) {
        return null;
    }

    return {
        instanceId,
        title: assetName,
        categoryIndex: assetData?.assetObject?.categoryIndex || assetData?.categoryIndex || getSceneAssetCategoryIndex(sceneMatch),
        assetID: assetData?.assetID || assetData?.assetId || assetData?.assetObject?.assetID || getSceneAssetId(sceneMatch),
        imageUrl: imageItems[0]?.itemImageSrc,
        images: imageItems,
        hasSceneFields,
        specGroups,
        infoSections: [
            {
                title: "Asset Info",
                content: formatText(assetInfo),
            },
            {
                title: "Asset Description",
                content: formatText(assetDescription),
            },
        ],
    };
};
