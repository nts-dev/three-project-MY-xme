const FALLBACK_IMAGE = `${import.meta.env.VITE_FILE_URL}/no_image.png`;

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
        return Object.values(fields);
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

const buildSpecGroups = ({ instanceId, assetName, rawFields, apiFields }) => {
    const allFields = [
        ...normalizeFields(apiFields),
        ...normalizeFields(rawFields),
    ];
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

    getGroup("Specifications").rows.push(
        { label: "ID", value: instanceId },
        { label: "AssetName", value: assetName || "Not Defined" },
        { label: "Date In", value: findFieldValue(allFields, ["Date In", "Date"]) || "Not Defined" }
    );

    allFields.forEach((field) => {
        const name = normalizeFieldName(field?.name);
        const value = field?.value;
        if (!name || name === "ID" || name === "AssetName" || name === "Date In" || !isUsefulValue(value)) {
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

        getGroup(groupTitle).rows.push({
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

    return `${import.meta.env.VITE_FILE_URL}/${image.name}`;
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

export const loadPlayAssetInfo = async ({ instanceId, fallbackName = "" }) => {
    if (!instanceId) {
        return null;
    }

    const assetData = await fetchAssetData(instanceId);
    const rawFields = assetData?.extraFields || {};
    const apiFields = assetData?.fields || {};
    const assetInfo = findFieldValue(rawFields, ["AssetInfo", "Asset Info"]);
    const assetDescription = findFieldValue(rawFields, ["Asset Description", "AssetDescription"]);
    const assetName = findFieldValue(apiFields, ["AssetName", "Asset Name"]) ||
        findFieldValue(rawFields, ["AssetName", "Asset Name"]) ||
        fallbackName ||
        "Not Defined";
    const imageItems = getImageItems(assetData);

    return {
        instanceId,
        title: assetName,
        categoryIndex: assetData?.assetObject?.categoryIndex || assetData?.categoryIndex,
        assetID: assetData?.assetID || assetData?.assetId || assetData?.assetObject?.assetID,
        imageUrl: imageItems[0]?.itemImageSrc,
        images: imageItems,
        specGroups: buildSpecGroups({
            instanceId,
            assetName,
            rawFields,
            apiFields,
        }),
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
