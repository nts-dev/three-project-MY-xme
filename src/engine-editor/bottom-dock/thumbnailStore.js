import { getApiBaseUrl } from './apiCatalog.js';
import { normalizeModelPath, normalizeTextureList, toFileUrl } from './assetUtils.js';

const normalizeThumbnailList = (file = {}) => (
    normalizeTextureList(
        file.thumbnailImages
        || file.thumbnail_images
        || file.thumbnails
        || file.thumbnail
        || file.thumbnailUrl
        || file.thumbnail_url
        || file.preview
        || file.previewUrl
        || file.preview_url
        || file.image
        || file.imageUrl
        || file.image_url
        || file.images
        || []
    )
);

const hashString = (value = '') => {
    let hash = 5381;
    const text = String(value);

    for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
    }

    return (hash >>> 0).toString(36);
};

export const getThumbnailFileName = (file) => {
    const path = normalizeModelPath(file.path);
    const name = file.name || path.split('/').pop() || 'asset';
    const baseName = name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]/g, '_');
    const signature = JSON.stringify({
        path,
        textures: normalizeTextureList(file.textures),
    });

    return `${baseName}-${hashString(signature)}.png`;
};

export const thumbnailCandidates = (file) => {
    const apiBaseUrl = getApiBaseUrl();
    const persistedFileName = getThumbnailFileName(file);
    const explicitThumbnails = normalizeThumbnailList(file).map(toFileUrl);

    return [
        ...explicitThumbnails,
        `${apiBaseUrl}/thumbnails/${encodeURIComponent(persistedFileName)}`,
    ].filter(Boolean).filter((candidate, index, candidates) => (
        candidates.indexOf(candidate) === index
    ));
};

export const persistGeneratedThumbnail = async (file, imageUrl) => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl || !imageUrl?.startsWith('data:image/png;base64,')) {
        return;
    }

    try {
        const response = await fetch(`${apiBaseUrl}/thumbnails`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: getThumbnailFileName(file),
                contentBase64: imageUrl.replace(/^data:image\/png;base64,/, ''),
                sourcePath: file.path,
                textures: normalizeTextureList(file.textures),
            }),
        });

        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            console.warn(
                `Failed to persist generated thumbnail: HTTP ${response.status}`,
                file.path,
                responseText
            );
        }
    } catch (error) {
        console.warn('Failed to persist generated thumbnail:', file.path, error);
    }
};
