// Asset photos shared by the sidebar gallery (PlayAssetInfoFrame.jsx) and the building label popup
// (PlayAssetInfoHud.jsx), so both show the same picture from one cache.

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
    const imageList = allImages?.images?.length ? allImages.images : allImages?.category_images;
    const nextImages = imageObject(imageList);
    setGalleryCache(cacheKey, instanceId, nextImages);
    return nextImages;
}

/** First real (non-placeholder) photo URL of a gallery image list, or "". */
export const firstRealPhotoUrl = (images) => (images || []).find((image) => !isPlaceholderImage(image))?.itemImageSrc || "";
