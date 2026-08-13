import { normalizeSceneAssetName } from '../../threejs/generatedAssetPaths.js';
import { MODEL_EXTENSIONS } from './constants.js';
import { objects } from '../../threejs/player/puzzle/character/Constants.jsx';
export const getExtension = (name = '') => {
    const cleanName = String(name).split('?')[0];
    const parts = cleanName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

export const normalizeModelPath = (path = '') => String(path).replace(/\\/g, '/');

export const getBaseProjectKey = (...values) => {
    for (const value of values) {
        const match = String(value ?? '').match(/(\d+)(?:_L\d+)?/i);
        if (match && match[1] !== '0') {
            return match[1];
        }
    }

    return '';
};

export const isAbsoluteUrl = (path = '') => /^https?:\/\//i.test(String(path));

export const toFileUrl = (path = '') => {
    const normalizedPath = normalizeModelPath(path);
    return isAbsoluteUrl(normalizedPath)
        ? normalizedPath
        : `${import.meta.env.VITE_FILE_URL}/${normalizedPath}`;
};

export const safeJsonParse = (value) => {
    if (typeof value !== 'string') {
        return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return [];
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        return trimmed;
    }
};

export const normalizeTextureList = (textures) => {
    const parsed = safeJsonParse(textures);
    const list = Array.isArray(parsed) ? parsed : [parsed];

    return list
        .flatMap((texture) => Array.isArray(texture) ? texture : [texture])
        .map((texture) => {
            if (typeof texture === 'string') {
                return texture;
            }

            return texture?.url || texture?.path || texture?.file || texture?.name || '';
        })
        .filter(Boolean)
        .map(normalizeModelPath);
};

export const collectFiles = (node, basePath = '') => {
    const currentPath = basePath ? `${basePath}/${node.name}` : node.name;

    if (node.kind === 'file') {
        return [{
            name: node.name,
            path: normalizeModelPath(currentPath),
            extension: getExtension(node.name),
        }];
    }

    return (node.files || []).flatMap(child => collectFiles(child, currentPath));
};

export const uniqueByPath = (files) => {
    const seen = new Map();
    const result = [];

    files.forEach((file) => {
        const key = normalizeModelPath(file.path).toLowerCase();

        if (seen.has(key)) {
            const existing = seen.get(key);
            if ((!existing.textures || existing.textures.length === 0) && file.textures?.length) {
                existing.textures = file.textures;
            }
            if ((!existing.thumbnailImages || existing.thumbnailImages.length === 0) && file.thumbnailImages?.length) {
                existing.thumbnailImages = file.thumbnailImages;
            }
            return;
        }

        seen.set(key, file);
        result.push(file);
    });

    return result;
};

export const getAssetSearchText = (file = {}) => (
    `${file.assetName || ''} ${file.name || ''} ${file.path || ''} ${file.assetKey || ''} ${file.nameKey || ''}`
        .toLowerCase()
);

export const isButtonAsset = (file) => (
    /\bbuttons?\b|[_-]buttons?(?:[_\-.]|$)|(?:^|[_-])buttons?[_-]/i.test(getAssetSearchText(file))
);

export const reorderAssetFiles = (files = []) => (
    files
        .map((file, index) => ({ file, index }))
        .sort((left, right) => {
            const leftRank = isButtonAsset(left.file) ? 0 : 1;
            const rightRank = isButtonAsset(right.file) ? 0 : 1;

            return leftRank - rightRank || left.index - right.index;
        })
        .map(({ file }) => file)
);

export const getRawCategory = (category) => category?._raw || category || {};

export const collectCategoryModelReferences = (categories = [], sourcePath = '') => {
    const models = [];

    (Array.isArray(categories) ? categories : []).forEach((category) => {
        const raw = getRawCategory(category);
        const assetPath = raw.fbx || raw.model || raw.assetPath || raw.file;
        const extension = getExtension(assetPath);

        if (!assetPath || !MODEL_EXTENSIONS.includes(extension)) {
            return;
        }
        
        const assets = raw.assets || {};
        const firstAsset = assets[Object.keys(assets)[0]] || {};
        const normalizedPath = normalizeModelPath(assetPath);
        const assetKey = normalizeSceneAssetName(assetPath);
        const categoryIndex = objects[assetKey]?.categoryIndex
       
        
        const assetName = raw.assetName
            || raw.asset_name
            || raw.name
            || normalizedPath.split('/').pop();

        models.push({
            name: assetName,
            path: normalizedPath,
            extension,
            sourcePath,
            textures: normalizeTextureList(raw.textures || raw.texture),
            thumbnailImages: normalizeTextureList(
                raw.thumbnailImages
                || raw.thumbnail_images
                || raw.thumbnail
                || raw.preview
                || raw.image
                || raw.images
            ),
            assetName,
            assetID: firstAsset.assetId || firstAsset.assetID || firstAsset.AssetID || '',
            categoryIndex: categoryIndex,
            template_id: raw.template_id || raw.templateId || 0,
            assetKey,
            nameKey: assetKey,
        });
    });

    return models;
};

export const collectModelReferences = (gameObjects = [], sourcePath = '') => {
    const models = [];

    const walk = (gameObject) => {
        (gameObject.components || []).forEach((component) => {
            const assetPath =
                component.assetPath ||
                component.path ||
                component.url ||
                component.file;

            const extension = getExtension(assetPath);

            if (assetPath && MODEL_EXTENSIONS.includes(extension)) {
                const normalizedPath = normalizeModelPath(assetPath);

                models.push({
                    name: normalizedPath.split('/').pop(),
                    path: normalizedPath,
                    extension,
                    sourcePath,
                    textures: normalizeTextureList(component.textures || component.texture),
                    thumbnailImages: normalizeTextureList(
                        component.thumbnailImages
                        || component.thumbnail_images
                        || component.thumbnail
                        || component.preview
                        || component.image
                        || component.images
                    ),
                });
            }
        });

        (gameObject.gameObjects || []).forEach(walk);
    };

    gameObjects.forEach(walk);
    return models;
};
