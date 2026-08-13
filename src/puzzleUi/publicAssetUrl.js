const normalizeBasePath = (basePath) => {
    if (!basePath || basePath === "./") {
        return "/";
    }

    return basePath.endsWith("/") ? basePath : `${basePath}/`;
};

export const publicAssetUrl = (assetName) => {
    const encodedName = encodeURIComponent(assetName);

    if (import.meta.env.PROD) {
        return new URL(encodedName, import.meta.url).href;
    }

    const basePath = normalizeBasePath(import.meta.env.BASE_URL);
    return `${window.location.origin}${basePath}assets/${encodedName}`;
};

export const publicAssetCssUrl = (assetName) => `url("${publicAssetUrl(assetName)}")`;
