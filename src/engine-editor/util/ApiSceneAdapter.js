const getRawCategory = (category) => category?._raw || category || {};

const listAssets = (category) => {
    const assets = category?.assets || getRawCategory(category)?.assets || [];
    return Array.isArray(assets) ? assets : Object.values(assets || {});
};

const fieldValue = (asset, ...names) => {
    const fields = asset?.fields || {};

    for (const name of names) {
        const field = fields[name];
        const value = field?.value ?? field;
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }

    return undefined;
};

const asNumber = (value, fallback = 0) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
};

const toSceneUnit = (value, fallback = 0) => asNumber(value, fallback) / 100;

const degreesToRadians = (value) => asNumber(value, 0) * Math.PI / 180;

const getAssetName = (asset) => {
    return fieldValue(asset, 'AssetName', 'Description', 'Model', 'SKU') ||
        asset?.description?.[0] ||
        `Asset ${asset?.instanceId || asset?.instance_id || ''}`.trim();
};

const getModelPath = (category) => {
    const raw = getRawCategory(category);
    return raw.fbx || raw.model || raw.name || 'model.fbx';
};

const apiAssetToGameObject = (asset, category) => {
    const instanceId = asset?.instanceId || asset?.instance_id || asset?._raw?.instance_id;
    const categoryRaw = getRawCategory(category);

    return {
        name: String(getAssetName(asset)),
        position: {
            x: toSceneUnit(fieldValue(asset, 'X-pos', 'X')),
            y: toSceneUnit(fieldValue(asset, 'Y-pos', 'Y')),
            z: toSceneUnit(fieldValue(asset, 'Z-pos', 'Z')),
        },
        scale: {
            x: 1,
            y: 1,
            z: 1,
        },
        rotation: {
            x: 0,
            y: degreesToRadians(fieldValue(asset, 'Angle', 'Rotation')),
            z: 0,
        },
        components: [
            {
                type: 'model',
                assetPath: getModelPath(category),
            }
        ],
        source: {
            instanceId,
            category: asset?.category || categoryRaw.id || categoryRaw.category_id,
            projectId: asset?.projectId || asset?.project_id || categoryRaw.projectId || categoryRaw.project_id,
            fields: asset?.fields || {},
        }
    };
};

export const buildApiSceneProject = (sceneKey, data) => {
    const categories = Array.isArray(data?.categories) ? data.categories : [];
    const scenePath = `scenes/${sceneKey}.json`;
    const gameObjects = categories.flatMap((category) =>
        listAssets(category)
            .filter(Boolean)
            .map((asset) => apiAssetToGameObject(asset, category))
    );

    return {
        projectFiles: {
            kind: 'directory',
            name: `API Scene ${sceneKey}`,
            files: [
                {
                    kind: 'file',
                    name: 'game.json',
                },
                {
                    kind: 'directory',
                    name: 'scenes',
                    files: [
                        {
                            kind: 'file',
                            name: `${sceneKey}.json`,
                        }
                    ]
                }
            ]
        },
        files: [
            {
                path: 'game.json',
                data: {
                    initialScene: sceneKey,
                    scenes: {
                        [sceneKey]: scenePath,
                    },
                    gameObjectTypes: {},
                },
                metaData: {
                    type: 'apiGameJSON',
                    source: 'api',
                    sceneKey,
                }
            },
            {
                path: scenePath,
                data: {
                    source: {
                        type: 'api',
                        sceneKey,
                    },
                    gameObjects,
                },
                metaData: {
                    type: 'apiSceneJSON',
                    source: 'api',
                    sceneKey,
                    originalData: data,
                }
            }
        ]
    };
};
