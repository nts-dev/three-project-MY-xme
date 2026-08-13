export const isValidCategoryIndex = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0;
};

export const DEFAULT_GAME_CATEGORY_INDEX = 1500;

const rememberedAssetCategories = new Map();

export const normalizeAssetCategoryKey = (...values) => values
    .map((value) => String(value ?? "").trim())
    .find(Boolean)
    ?.replace(/\.(fbx|glb|gltf)$/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase() || "";

export const rememberCategorySelectionForAsset = (assetKey, categoryIndex, templateId = null) => {
    const normalizedKey = normalizeAssetCategoryKey(assetKey);
    if (!normalizedKey || !isValidCategoryIndex(categoryIndex)) {
        return;
    }

    rememberedAssetCategories.set(normalizedKey, {
        categoryIndex,
        templateId,
    });
};

export const getRememberedCategorySelectionForAsset = (assetKey) => {
    const normalizedKey = normalizeAssetCategoryKey(assetKey);
    return normalizedKey ? rememberedAssetCategories.get(normalizedKey) : null;
};

export const requestCategorySelection = (detail = {}) => new Promise((resolve) => {
    if (typeof window === 'undefined') {
        resolve(null);
        return;
    }

    window.dispatchEvent(new CustomEvent('asset-category-selection-request', {
        detail: {
            ...detail,
            resolve,
        },
    }));
});
