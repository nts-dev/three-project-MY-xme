import { normalizeSceneAssetName } from '../../threejs/generatedAssetPaths.js';
import {
    DEFAULT_GAME_FILES_TEMPLATE_ID,
    GAME_FILES_ASSET_TEMPLATE_ID,
    GAME_FILES_CATEGORY_INDEX,
    IMAGE_EXTENSIONS,
    MODEL_EXTENSIONS,
    PUZZLE_GAME_FILES_TEMPLATE_ID,
} from './constants.js';
import { getExtension, normalizeModelPath } from './assetUtils.js';
import { objects } from '../../threejs/player/puzzle/character/Constants.jsx';

export const getApiBaseUrl = () => String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const getGameFilesTemplateId = (isPuzzleGame) => (
    isPuzzleGame ? PUZZLE_GAME_FILES_TEMPLATE_ID : DEFAULT_GAME_FILES_TEMPLATE_ID
);
export const getGameFilesCategoryIndexId = (isPuzzleGame) => (
    isPuzzleGame ? GAME_FILES_CATEGORY_INDEX : 25
);

export const getGameFilesEndpoint = (templateId) => {
    const apiBaseUrl = getApiBaseUrl();
    return apiBaseUrl
        ? `${apiBaseUrl}/getGameFilesByTemplate/${templateId}`
        : `/api/getGameFilesByTemplate/${templateId}`;
};

const getCatalogFilePath = (asset = {}) => (
    asset.design_file_name
    || asset.designFileName
    || asset.fileName
    || asset.path
    || asset.Assetname
    || asset.assetName
    || ''
);

const getCatalogAssetName = (asset = {}, fallback = '') => (
    asset.AssetName
    || asset.assetName
    || asset.asset_name
    || asset.name
    || fallback
);

const getCatalogAssetInfo = (asset = {}) => (
    asset.AssetInfo
    || asset.assetInfo
    || asset.asset_info
    || asset.info
    || ''
);

const getCatalogAssetId = (asset = {}) => (
    asset.AssetID
    || asset.assetID
    || asset.assetId
    || asset.id
    || ''
);

const normalizeCatalogImageList = (...values) => (
    values
        .flatMap((value) => {
            if (!value) return [];
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) return [];

                try {
                    const parsed = JSON.parse(trimmed);
                    return Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                    return [trimmed];
                }
            }

            return [value];
        })
        .map((image) => {
            if (typeof image === 'string') {
                return image;
            }

            return image?.url
                || image?.path
                || image?.file
                || image?.name
                || image?.image
                || image?.thumbnail
                || '';
        })
        .filter(Boolean)
        .map(normalizeModelPath)
);

const getCatalogThumbnailImages = (asset = {}) => (
    normalizeCatalogImageList(
        asset.thumbnail,
        asset.thumbnailUrl,
        asset.thumbnail_url,
        asset.preview,
        asset.previewUrl,
        asset.preview_url,
        asset.image,
        asset.imageUrl,
        asset.image_url,
        asset.images,
        asset.category_images
    )
);

const catalogGroupKey = (asset = {}) => {
    const assetId = getCatalogAssetId(asset);
    if (assetId) {
        return `id:${assetId}`;
    }

    return `name:${String(getCatalogAssetName(asset)).toLowerCase()}`;
};

export const normalizeGameFileCatalog = (responseData, templateId, isPuzzleGame) => {
    const rows = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
            ? responseData
            : [];

    const texturesByGroup = new Map();
    const imageCandidatesByGroup = new Map();

    rows.forEach((row) => {
        const raw = row?._raw || row || {};
        const filePath = normalizeModelPath(getCatalogFilePath(raw));
        const extension = getExtension(filePath);

        if (!filePath || !IMAGE_EXTENSIONS.includes(extension)) {
            return;
        }

        const groupKey = catalogGroupKey(raw);
        const textures = texturesByGroup.get(groupKey) || [];
        textures.push(filePath);
        texturesByGroup.set(groupKey, textures);

        if (/(?:^|[/_.-])(?:thumb|thumbnail|preview|cover|image|icon)(?:[/_.-]|$)/i.test(filePath)) {
            const images = imageCandidatesByGroup.get(groupKey) || [];
            images.push(filePath);
            imageCandidatesByGroup.set(groupKey, images);
        }
    });

    return rows
        .map((row) => {
            const raw = row?._raw || row || {};
            const filePath = normalizeModelPath(getCatalogFilePath(raw));
            const extension = getExtension(filePath);

            if (!filePath || !MODEL_EXTENSIONS.includes(extension)) {
                return null;
            }

            const assetName = getCatalogAssetName(raw, filePath.replace(/\.[^.]+$/, ''));
            const assetKey = normalizeSceneAssetName(filePath);
            const groupKey = catalogGroupKey(raw);
            const categoryIndex = objects[assetKey]?.categoryIndex
        

            return {
                name: filePath.split('/').pop(),
                path: filePath,
                extension,
                sourcePath: `game-files-template:${templateId}`,
                textures: texturesByGroup.get(groupKey) || [],
                thumbnailImages: [
                    ...getCatalogThumbnailImages(raw),
                    ...(imageCandidatesByGroup.get(groupKey) || []),
                ],
                assetName,
                assetInfo: getCatalogAssetInfo(raw),
                assetID: getCatalogAssetId(raw),
                categoryIndex: categoryIndex ,
                template_id: GAME_FILES_ASSET_TEMPLATE_ID,
                assetKey,
                nameKey: assetKey,
            };
        })
        .filter(Boolean);
};
