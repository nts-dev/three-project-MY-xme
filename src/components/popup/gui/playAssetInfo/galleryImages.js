// Asset photos shared by the sidebar gallery (PlayAssetInfoFrame.jsx) and the building label popup
// (PlayAssetInfoHud.jsx), so both show the same picture from one cache.

import { sceneAssets } from "../../../../threejs/player/puzzle/character/Constants.jsx";

export const GALLERY_UPDATED_EVENT = "play-asset-info-gallery-updated";

/** Gallery images per `${instanceId}:${assetID}` (see getGalleryCacheKey). */
export const mediaCache = new Map();

const isFaultyImageFileName = (fileName) => {
    const normalized = String(fileName || "").trim().toLowerCase();
    return !normalized || normalized === "no_image.png" || normalized === "image1.jpeg" || normalized === "image1.jpg";
};

export const getImageHostUrl = (fileName) => {
    const text = String(fileName || "").trim();
    const cleanFileName = text.includes("/files/")
        ? text.split("/files/").pop()
        : text.replace(/^\.\.\/files\//i, "").replace(/^\/?files\//i, "");

    return `${import.meta.env.VITE_IMAGE_URL}/${String(cleanFileName || "no_image.png").split("/").map(encodeURIComponent).join("/")}`;
};

export const getAssetImageUrl = (fileName) => getImageHostUrl(fileName);

const placeholderImages = () => {
    const url = getImageHostUrl("no_image.png");
    return [{ itemImageSrc: url, thumbnailImageSrc: url, alt: "No image available" }];
};

/** API image list -> gallery images; the no_image placeholder when there are none. */
export const imageObject = (imageList) => {
    const validImages = (imageList || []).filter((image) => !isFaultyImageFileName(image?.name));
    if (!validImages.length) return placeholderImages();

    return validImages.map((image, index) => {
        const url = getAssetImageUrl(image.name);
        return {
            id: image.id,
            itemImageSrc: url,
            thumbnailImageSrc: url,
            alt: `Asset image ${index + 1}`,
        };
    });
};

export const isPlaceholderImage = (image) => /\/no_image\.png(?:$|\?)/i.test(String(image?.itemImageSrc || image || ""));

export const getGalleryCacheKey = (instanceId, assetID) => `${instanceId}:${assetID || instanceId}`;

/** Stores gallery images and tells other views (the popup) about the change. */
export const setGalleryCache = (cacheKey, instanceId, images) => {
    mediaCache.set(cacheKey, images);
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(GALLERY_UPDATED_EVENT, { detail: { cacheKey, instanceId, images } }));
    }
};

/**
 * Photos of an asset as shown in the sidebar gallery: cached result, else the asset info's own
 * images, else the /getImages API (uploaded images, then category images), else the placeholder.
 */
export async function loadAssetGalleryImages({ instanceId, assetID, apiImages = [], force = false }) {
    const cacheKey = getGalleryCacheKey(instanceId, assetID);
    const realApiImages = apiImages.filter((image) => !isPlaceholderImage(image));
    if (!force && mediaCache.has(cacheKey)) return mediaCache.get(cacheKey);
    if (!force && realApiImages.length) {
        setGalleryCache(cacheKey, instanceId, realApiImages);
        return realApiImages;
    }
    const response = await fetch(`${import.meta.env.VITE_API_URL}/getImages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetID: assetID || instanceId, id: instanceId }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const allImages = await response.json();
    // The asset's own uploads first; else Google Maps photos of the business; else category images.
    let nextImages = imageObject(allImages?.images);
    if (nextImages.every(isPlaceholderImage)) {
        const googlePhotos = await loadGooglePlacePhotos(instanceId);
        nextImages = googlePhotos.length ? googlePhotos : imageObject(allImages?.category_images);
    }
    setGalleryCache(cacheKey, instanceId, nextImages);
    return nextImages;
}

const sceneFieldValue = (fields, name) => {
    const field = fields?.[name] ?? Object.values(fields || {}).find((item) => String(item?.name || "").toLowerCase() === name.toLowerCase());
    const value = field?.value ?? (typeof field === "string" ? field : "");
    return String(value || "").trim();
};

/**
 * Google Maps photos of the asset's business (Company Name + Cordinates fields), through the
 * backend's /place-photos (no API key in the browser). Each image carries its attribution, which
 * must be shown with it. [] when the asset has no business or Google has no photos.
 */
export async function loadGooglePlacePhotos(instanceId, max = 6) {
    const fields = sceneAssets?.[instanceId]?.instanceData?.assetObject?.fields;
    const companyName = sceneFieldValue(fields, "Company Name");
    const coordinates = sceneFieldValue(fields, "Cordinates") || sceneFieldValue(fields, "Coordinates");
    if (!companyName || /^n\/?a$/i.test(companyName) || !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(coordinates)) return [];
    try {
        const url = `${import.meta.env.VITE_API_URL}/place-photos?cordinates=${encodeURIComponent(coordinates.replace(/\s+/g, ""))}&companyName=${encodeURIComponent(companyName)}&max=${max}`;
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return (data?.photos || []).filter((photo) => photo?.url).map((photo, index) => ({
            itemImageSrc: photo.url,
            thumbnailImageSrc: photo.url,
            alt: `${companyName} photo ${index + 1} (Google Maps)`,
            source: "google",
            attributions: photo.attributions || [],
        }));
    } catch (error) {
        console.warn("Google place photos failed:", error);
        return [];
    }
}

/** "Photo: Name · Google Maps" credit for a Google photo, or "" for the project's own photos. */
export const photoCredit = (image) => (image?.source === "google"
    ? `Photo: ${(image.attributions || []).map((a) => a.displayName).filter(Boolean).join(", ") || "Google user"} · Google Maps`
    : "");

/** First real (non-placeholder) photo URL of a gallery image list, or "". */
export const firstRealPhotoUrl = (images) => (images || []).find((image) => !isPlaceholderImage(image))?.itemImageSrc || "";
