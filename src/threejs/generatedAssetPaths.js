export const GENERATED_ASSET_PREFIX = "generated://";

export const parseSceneAssetProperties = (value) => {
    if (!value) {
        return {};
    }

    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch (error) {
            return {};
        }
    }

    return typeof value === "object" ? value : {};
};

export const isGeneratedAssetReference = (value) =>
    typeof value === "string" && value.startsWith(GENERATED_ASSET_PREFIX);

export const normalizeSceneAssetName = (value) =>
    String(value || "")
        .replace(GENERATED_ASSET_PREFIX, "")
        .replace(/^.*[\\/]/, "")
        .replace(/\.(fbx|glb|gltf)$/i, "")
        .replace(/\s+/g, "")
        .trim();

export const getSceneAssetDescriptor = (file, properties) => {
    const normalizedFile = String(file || "").trim();
    const parsedProperties = parseSceneAssetProperties(properties);
    const sourcePath = isGeneratedAssetReference(normalizedFile)
        ? String(parsedProperties.generatedAssetPath || "").trim()
        : normalizedFile;

    if (!sourcePath) {
        throw new Error(`Missing asset source for "${normalizedFile}".`);
    }

    const normalizedPath = sourcePath.replace(/\\/g, "/");
    const extMatch = normalizedPath.match(/\.([^.\/]+)$/);
    const extension = (extMatch?.[1] || "fbx").toLowerCase();
    const revision = String(parsedProperties.generatedAssetHash || "").trim();
    const url = isGeneratedAssetReference(normalizedFile)
        ? `/@fs/${normalizedPath}`
        : `${import.meta.env.VITE_FILE_URL}/${normalizedFile}${revision ? `?v=${revision}` : ""}`;

    return {
        extension,
        isGenerated: isGeneratedAssetReference(normalizedFile),
        cacheKey: `${normalizedFile}::${normalizedPath}::${revision}`,
        url,
    };
};
