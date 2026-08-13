import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaChevronRight, FaCube, FaLayerGroup, FaSearch } from 'react-icons/fa';
import { getFile } from '../../Redux/FileDataSlice.js';
import { getSelectedItem, selectItem } from '../../Redux/SelectedItemSlice.js';
import useGame from '../../../hooks/useGame';
import { sceneAssets } from '../../../threejs/player/puzzle/character/Constants.jsx';

const GAME_PROJECT_CATEGORY_TEMPLATE_ID = 1630;
const DEFAULT_GROUP = 'Ungrouped';
const DEFAULT_SUBCATEGORY = 'Default';
const GAME_ASSET_CATEGORY_LABEL = 'Puzzle Game Assets';
const OBJECT_TREE_ID = 'object-hierarchy';
const EMPTY_ARRAY = [];

const arraysEqual = (left = [], right = []) => {
    if (left === right) {
        return true;
    }

    if (left.length !== right.length) {
        return false;
    }

    return left.every((value, index) => value === right[index]);
};

const fieldValue = (fields = {}, ...names) => {
    for (const name of names) {
        const field = fields[name];
        const value = field?.value ?? field;
        if (value !== undefined && value !== null && value !== '') {
            return String(value);
        }
    }

    return null;
};

const apiValue = (item = {}, ...names) => {
    for (const name of names) {
        const value = item?.[name];
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }

    return undefined;
};

const toNumber = (value, fallback = 0) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
};

const degreesToRadians = (value) => toNumber(value, 0) * Math.PI / 180;

const toSerializableSelectionValue = (value, seen = new WeakSet()) => {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value !== 'object') {
        return typeof value === 'function' ? undefined : value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (seen.has(value)) {
        return undefined;
    }

    seen.add(value);

    if (value._raw && typeof value._raw === 'object') {
        return toSerializableSelectionValue(value._raw, seen);
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => toSerializableSelectionValue(item, seen))
            .filter((item) => item !== undefined);
    }

    return Object.fromEntries(
        Object.entries(value)
            .map(([key, entry]) => [key, toSerializableSelectionValue(entry, seen)])
            .filter(([, entry]) => entry !== undefined)
    );
};

const apiItemToGameObject = (item, meta) => {
    const fields = Object.fromEntries(
        Object.entries(item || {}).map(([name, value]) => [name, { name, value }])
    );

    return {
        name: meta.assetName,
        position: {
            x: toNumber(apiValue(item, 'x', 'X', 'X-pos', 'X_pos'), 0),
            y: toNumber(apiValue(item, 'y', 'Y', 'Y-pos', 'Y_pos'), 0),
            z: toNumber(apiValue(item, 'z', 'Z', 'Z-pos', 'Z_pos'), 0),
        },
        scale: {
            x: toNumber(apiValue(item, 'scaleX', 'ScaleX', 'scale_x'), 1),
            y: toNumber(apiValue(item, 'scaleY', 'ScaleY', 'scale_y'), 1),
            z: toNumber(apiValue(item, 'scaleZ', 'ScaleZ', 'scale_z'), 1),
        },
        rotation: {
            x: degreesToRadians(apiValue(item, 'rotationX', 'RotationX', 'RotX')),
            y: degreesToRadians(apiValue(item, 'Angle', 'angle', 'rotationY', 'RotationY', 'RotY')),
            z: degreesToRadians(apiValue(item, 'rotationZ', 'RotationZ', 'RotZ')),
        },
        components: [
            {
                type: 'model',
                assetPath: meta.assetName,
            }
        ],
        source: {
            instanceId: meta.objectId,
            category: meta.subcategory,
            fields,
            apiObject: item,
        },
    };
};

const getObjectMeta = (gameObject, objectIndex) => {
    const source = gameObject?.source || {};
    const fields = source.fields || {};
    const assetId = fieldValue(fields, 'AssetID', 'Unreal AssetID', 'AssetId') || source.instanceId || objectIndex + 1;
    const objectId = source.instanceId || gameObject?.id || objectIndex + 1;

    return {
        group: fieldValue(fields, 'Group') || gameObject?.group || DEFAULT_GROUP,
        category: fieldValue(fields, 'Category') || source.category || gameObject?.category || 'General',
        subcategory: fieldValue(fields, 'Subcategory', 'Branch', 'Room') || gameObject?.subcategory || DEFAULT_SUBCATEGORY,
        assetName: fieldValue(fields, 'AssetName', 'Description', 'Model') || gameObject?.name || 'Object',
        assetId,
        objectId,
    };
};

const getGameObjectInstanceId = (gameObject, fallback) => (
    gameObject?.source?.instanceId
    || gameObject?.source?.instance_id
    || gameObject?.id
    || fallback
);

const getGameObjectCategoryId = (gameObject) => (
    gameObject?.source?.category
    || gameObject?.source?.categoryIndex
    || gameObject?.source?.category_id
    || gameObject?.category
    || gameObject?.categoryIndex
);

const ensureFolder = (items, parentId, id, name, depth) => {
    if (!items[id]) {
        items[id] = {
            index: id,
            isFolder: true,
            children: [],
            data: { name, depth },
        };
        items[parentId].children.push(id);
    }

    return id;
};

const getBaseProjectId = (projectId) => {
    const raw = String(projectId ?? '').trim();
    if (!raw || raw === '0') {
        return null;
    }

    const base = raw.split('_')[0];
    return /^\d+$/.test(base) ? base : null;
};

const getExpectedSceneKey = (projectId, selectedLevel) => {
    const raw = String(projectId ?? '').trim();
    if (!raw || raw === '0') {
        return null;
    }

    const levelMatch = /^(.*)_L(\d+)$/i.exec(raw);
    if (levelMatch) {
        const levelCode = Number.parseInt(levelMatch[2], 10);
        return levelCode === 0 ? levelMatch[1] : `${levelMatch[1]}_L${levelCode}`;
    }

    const levelCode = Number.parseInt(String(selectedLevel?.code ?? 0), 10);
    const safeLevel = Number.isFinite(levelCode) ? Math.max(0, levelCode) : 0;
    if (safeLevel === 0) {
        return raw;
    }

    return /^\d+$/.test(raw) ? `${raw}_L${safeLevel}` : raw;
};

const normalizeSceneKey = (sceneKey) => {
    const raw = String(sceneKey ?? '').trim();
    if (!raw) {
        return null;
    }

    const levelMatch = /^(.*)_L(\d+)$/i.exec(raw);
    if (!levelMatch) {
        return raw;
    }

    const levelCode = Number.parseInt(levelMatch[2], 10);
    return levelCode === 0 ? levelMatch[1] : `${levelMatch[1]}_L${levelCode}`;
};

const normalizeApiItem = (item, categoryName, objectIndex, sceneObjectByInstanceId) => {
    const objectId = item?.device_id || item?.deviceId || item?.instanceId || item?.instance_id || item?.id || objectIndex + 1;
    const assetId = item?.AssetID || item?.assetId || item?.asset_id || item?.assetID || objectId;
    const assetName = item?.Assetname || item?.AssetName || item?.assetName || item?.name || `Asset ${assetId}`;
    const sourceCategory = item?.Category || item?.category || categoryName || DEFAULT_SUBCATEGORY;
    const category = GAME_ASSET_CATEGORY_LABEL;
    const subcategory = item?.Subcategory || item?.SubCategory || item?.subcategory || item?.Branch || item?.Room || sourceCategory;
    const group = item?.Group || item?.group || item?.Building || item?.Project || DEFAULT_GROUP;
    const matchedSceneObject = sceneObjectByInstanceId.get(String(objectId));

    return {
        group: String(group),
        category: String(category),
        subcategory: String(subcategory),
        assetName: String(assetName),
        assetId: String(assetId),
        objectId: String(objectId),
        gameObject: matchedSceneObject?.gameObject || null,
        sceneIndex: matchedSceneObject?.index,
        source: item,
    };
};

const listApiFileItems = (apiData = {}) => {
    const source = apiData?.data || apiData || {};

    return Object.entries(source).flatMap(([categoryName, categoryValue]) => {
        const records = Array.isArray(categoryValue)
            ? categoryValue
            : Object.values(categoryValue || {});

        return records
            .filter(Boolean)
            .map((record) => ({ categoryName, record }));
    });
};

const normalizeCategoryResponse = (apiData = []) => {
    if (Array.isArray(apiData)) {
        return apiData;
    }

    if (Array.isArray(apiData?.value)) {
        return apiData.value;
    }

    if (Array.isArray(apiData?.data)) {
        return apiData.data;
    }

    return Object.values(apiData?.data || apiData || {});
};

const listCategoryChildren = (category = {}) => (
    Array.isArray(category.children)
        ? category.children
        : Object.values(category.children || {})
);

const listCategoryObjects = (category = {}) => {
    const objectCollections = [
        category.objects,
        category.assets,
        category.instances,
        category.items,
        category.devices,
        category.boObjects,
        category.BOObjects,
    ];

    return objectCollections.flatMap(collection => {
        if (!collection) {
            return [];
        }

        return Array.isArray(collection) ? collection : Object.values(collection);
    }).filter(Boolean);
};

const getSceneCategoryRaw = (category = {}) => category?._raw || category || {};

const stripSceneCategorySuffix = (categoryId, categoryIndex) => {
    if (categoryId === undefined || categoryId === null) {
        return categoryId;
    }

    const id = String(categoryId).trim();
    const index = String(categoryIndex ?? '').trim();
    return index && id.endsWith(`-${index}`) ? id.slice(0, -(index.length + 1)) : id;
};

const listSceneCategoryAssets = (category = {}) => {
    const raw = getSceneCategoryRaw(category);
    const assets = category?.assets || raw?.assets || [];
    return Array.isArray(assets) ? assets : Object.values(assets || {});
};

const getSceneCategoryId = (category = {}) => {
    const raw = getSceneCategoryRaw(category);
    const categoryIndex = raw?.category_index || raw?.category || raw?.id;
    return categoryIndex || stripSceneCategorySuffix(raw?.category_id || raw?.asset_id, categoryIndex);
};

const getSceneCategoryTemplateId = (category = {}) => {
    const raw = getSceneCategoryRaw(category);
    const firstAsset = listSceneCategoryAssets(category)[0];
    return raw?.template_id
        || raw?.templateId
        || raw?.templateID
        || firstAsset?.template_id
        || firstAsset?.templateId
        || firstAsset?._raw?.template_id;
};

const getSceneCategoryAssetName = (category = {}) => {
    const raw = getSceneCategoryRaw(category);
    return raw?.assetName || raw?.asset_name || raw?.name || raw?.fbx || 'Asset';
};

const categoryMatchKey = (categoryId, templateId) => {
    if (categoryId === undefined || categoryId === null || templateId === undefined || templateId === null) {
        return null;
    }

    return `${String(categoryId).trim()}::${String(templateId).trim()}`;
};

const getSceneAssetInstanceId = (asset, fallback) => (
    asset?._raw?.instance_id ||
    asset?.instanceId ||
    asset?.instance_id ||
    asset?.device_id ||
    asset?.id ||
    fallback
);

const getSceneAssetName = (asset, fallback) => {
    const fields = asset?.fields || {};
    return fieldValue(fields, 'AssetName', 'Description', 'Model', 'SKU')
        || asset?.description?.[0]
        || asset?.name
        || fallback;
};

const getSceneAssetTemplateId = (asset = {}) => (
    asset?.template_id
    || asset?.templateId
    || asset?.templateID
    || asset?._raw?.template_id
    || asset?._raw?.templateId
    || asset?.fields?.template_id?.value
    || asset?.fields?.TemplateID?.value
);

const buildSceneAssetsByTemplateId = (sceneCategories = []) => {
    const assetsByTemplateId = new Map();

    (Array.isArray(sceneCategories) ? sceneCategories : []).forEach((sceneCategory) => {
        listSceneCategoryAssets(sceneCategory).forEach((asset) => {
            const templateId = getSceneAssetTemplateId(asset);
            if (templateId === undefined || templateId === null || templateId === '') {
                return;
            }

            const key = String(templateId).trim();
            if (!assetsByTemplateId.has(key)) {
                assetsByTemplateId.set(key, []);
            }

            assetsByTemplateId.get(key).push(asset);
        });
    });

    return assetsByTemplateId;
};

const getCategoryObjectId = (object, fallback) => (
    object?.device_id ||
    object?.deviceId ||
    object?.instanceId ||
    object?.instance_id ||
    object?.objectId ||
    object?.id ||
    fallback
);

const getCategoryObjectName = (object, fallback) => (
    object?.Assetname ||
    object?.AssetName ||
    object?.assetName ||
    object?.name ||
    object?.description?.[0] ||
    fallback
);

const categoryObjectToGameObject = (object, subcategory, fallbackIndex) => {
    const objectId = getCategoryObjectId(object, fallbackIndex + 1);
    const assetName = getCategoryObjectName(object, `Object ${objectId}`);
    const assetId = object?.AssetID || object?.assetId || object?.asset_id || object?.assetID || objectId;

    return apiItemToGameObject(object, {
        assetName,
        assetId,
        objectId,
        subcategory: subcategory?.name || subcategory?.id || DEFAULT_SUBCATEGORY,
    });
};

const sceneAssetToGameObject = (asset, sceneCategory, fallbackIndex) => {
    const raw = getSceneCategoryRaw(sceneCategory);
    const objectId = getSceneAssetInstanceId(asset, fallbackIndex + 1);
    const assetName = getSceneAssetName(asset, `Object ${objectId}`);
    const assetId = raw?.category_id || raw?.asset_id || raw?.category_index || objectId;

    return apiItemToGameObject(asset, {
        assetName,
        assetId,
        objectId,
        subcategory: raw?.category_index || raw?.category_id || DEFAULT_SUBCATEGORY,
    });
};

const categoryMatchesQuery = (category, normalizedQuery) => {
    if (!normalizedQuery) {
        return true;
    }

    const objectSearchable = listCategoryObjects(category)
        .map(object => `${getCategoryObjectName(object, '')} ${getCategoryObjectId(object, '')} ${object?.AssetID || ''}`)
        .join(' ');
    const searchable = `${category?.name || ''} ${category?.id || ''} ${category?.template_id || ''} ${objectSearchable}`.toLowerCase();
    return searchable.includes(normalizedQuery);
};

const categoryHasMatch = (category, normalizedQuery) => {
    if (categoryMatchesQuery(category, normalizedQuery)) {
        return true;
    }

    return listCategoryChildren(category).some(child => categoryHasMatch(child, normalizedQuery));
};

const removeChild = (items, parentId, childId) => {
    items[parentId].children = items[parentId].children.filter(id => id !== childId);
};

const buildCategoryTreeItems = (scenePath, apiData, sceneCategories, gameObjects, query) => {
    const items = {
        root: {
            index: 'root',
            isFolder: true,
            children: [],
            data: { name: 'Categories', depth: 0 },
        },
    };

    const normalizedQuery = query.trim().toLowerCase();
    const categories = normalizeCategoryResponse(apiData);
    const sceneGameObjectByInstanceId = new Map();
    const sceneGameObjectsByCategoryId = new Map();
    const sceneCategoryByKey = new Map();
    const sceneCategoryById = new Map();
    const sceneAssetsByTemplateId = buildSceneAssetsByTemplateId(sceneCategories);

    gameObjects.forEach((gameObject, index) => {
        const instanceId = getGameObjectInstanceId(gameObject);
        if (instanceId !== undefined && instanceId !== null) {
            sceneGameObjectByInstanceId.set(String(instanceId), { gameObject, index });
        }

        const categoryId = getGameObjectCategoryId(gameObject);
        if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
            const key = String(categoryId).trim();
            if (!sceneGameObjectsByCategoryId.has(key)) {
                sceneGameObjectsByCategoryId.set(key, []);
            }

            sceneGameObjectsByCategoryId.get(key).push({ gameObject, index });
        }
    });

    (Array.isArray(sceneCategories) ? sceneCategories : []).forEach((sceneCategory) => {
        const categoryId = getSceneCategoryId(sceneCategory);
        const templateId = getSceneCategoryTemplateId(sceneCategory);

        if (categoryId === undefined || categoryId === null || categoryId === '') {
            return;
        }

        const idKey = String(categoryId).trim();
        if (!sceneCategoryById.has(idKey)) {
            sceneCategoryById.set(idKey, []);
        }
        sceneCategoryById.get(idKey).push(sceneCategory);

        const matchKey = categoryMatchKey(categoryId, templateId);
        if (matchKey) {
            if (!sceneCategoryByKey.has(matchKey)) {
                sceneCategoryByKey.set(matchKey, []);
            }

            sceneCategoryByKey.get(matchKey).push(sceneCategory);
        }
    });

    const getMatchingSceneCategories = (category) => {
        const matchKey = categoryMatchKey(category?.id, category?.template_id);
        const exactMatches = matchKey ? sceneCategoryByKey.get(matchKey) || [] : [];
        if (exactMatches.length) {
            return exactMatches;
        }

        return category?.id === undefined || category?.id === null
            ? []
            : sceneCategoryById.get(String(category.id).trim()) || [];
    };

    const objectMatchesQuery = (name, objectId, assetId, categoryName) => {
        if (!normalizedQuery) {
            return true;
        }

        return `${name} ${objectId} ${assetId} ${categoryName || ''}`.toLowerCase().includes(normalizedQuery);
    };

    const addObjectLeaf = (parentId, objectNodeId, label, data, depth) => {
        items[objectNodeId] = {
            index: objectNodeId,
            isFolder: false,
            children: [],
            data: {
                ...data,
                name: label,
                scenePath,
                depth,
                selectable: true,
            },
        };
        items[parentId].children.push(objectNodeId);
    };

    const addCategory = (category, parentId, depth, path) => {
        if (!category) {
            return;
        }

        const children = listCategoryChildren(category);
        const categoryId = category.id ?? `${path || 'category'}-${items[parentId].children.length}`;
        const nodeId = `${parentId}/category:${categoryId}`;
        const categoryTemplateId = category.template_id ?? category.templateId ?? category.templateID;
        const templateAssets = categoryTemplateId === undefined || categoryTemplateId === null
            ? EMPTY_ARRAY
            : sceneAssetsByTemplateId.get(String(categoryTemplateId).trim()) || EMPTY_ARRAY;
        const sceneCategoryMatches = getMatchingSceneCategories(category);
        const labelSuffix = category.template_id ? ` [${category.template_id}]` : '';

        items[nodeId] = {
            index: nodeId,
            isFolder: true,
            children: [],
            data: {
                name: `${category.name || `Category ${categoryId}`}${labelSuffix}`,
                category,
                depth,
                selectable: false,
            },
        };
        items[parentId].children.push(nodeId);

        children.forEach((child, index) => {
            addCategory(child, nodeId, depth + 1, `${path}/${categoryId}/${index}`);
        });

        const addedObjectIds = new Set();

        sceneCategoryMatches.forEach((sceneCategory) => {
            const sceneCategoryRaw = getSceneCategoryRaw(sceneCategory);

            listSceneCategoryAssets(sceneCategory).forEach((asset, assetIndex) => {
                const objectId = getSceneAssetInstanceId(asset, assetIndex + 1);
                const objectKey = String(objectId);
                const assetName = getSceneAssetName(asset, `Object ${objectId}`);
                const assetId = sceneCategoryRaw?.category_id || sceneCategoryRaw?.asset_id || sceneCategoryRaw?.category_index || objectId;
                if (!objectMatchesQuery(assetName, objectId, assetId, category.name)) {
                    return;
                }

                const matchedSceneObject = sceneGameObjectByInstanceId.get(String(objectId));
                const gameObject = matchedSceneObject?.gameObject || sceneAssetToGameObject(asset, sceneCategory, assetIndex);
                const objectNodeId = `${nodeId}/scene-object:${objectId}:${assetIndex}`;
                addedObjectIds.add(objectKey);

                addObjectLeaf(
                    nodeId,
                    objectNodeId,
                    `${assetName} [${objectId}]`,
                    {
                        indices: Number.isInteger(matchedSceneObject?.index) ? [matchedSceneObject.index] : null,
                        gameObject,
                        apiObject: asset,
                        category: {
                            ...category,
                            template_id: sceneCategoryRaw?.template_id || category.template_id,
                        },
                    },
                    depth + 1
                );
            });
        });

        (sceneGameObjectsByCategoryId.get(String(categoryId).trim()) || []).forEach(({ gameObject, index }) => {
            const objectId = getGameObjectInstanceId(gameObject, index + 1);
            const objectKey = String(objectId);

            if (addedObjectIds.has(objectKey)) {
                return;
            }

            const assetName = gameObject?.name || `Object ${objectId}`;
            if (!objectMatchesQuery(assetName, objectId, objectId, category.name)) {
                return;
            }

            const objectNodeId = `${nodeId}/game-object:${objectId}:${index}`;
            addedObjectIds.add(objectKey);

            addObjectLeaf(
                nodeId,
                objectNodeId,
                `${assetName} [${objectId}]`,
                {
                    indices: Number.isInteger(index) ? [index] : null,
                    gameObject,
                    apiObject: gameObject?.source?.apiObject || gameObject?.source,
                    category,
                },
                depth + 1
            );
        });

        templateAssets.forEach((asset, assetIndex) => {
            const objectId = getSceneAssetInstanceId(asset, assetIndex + 1);
            const objectKey = String(objectId);

            if (addedObjectIds.has(objectKey)) {
                return;
            }

            const assetName = getSceneAssetName(asset, `Object ${objectId}`);
            const assetId = asset?.assetId || asset?.assetID || asset?.asset_id || asset?._raw?.asset_id || objectId;
            if (!objectMatchesQuery(assetName, objectId, assetId, category.name)) {
                return;
            }

            const matchedSceneObject = sceneGameObjectByInstanceId.get(objectKey);
            const gameObject = matchedSceneObject?.gameObject || sceneAssetToGameObject(asset, category, assetIndex);
            const objectNodeId = `${nodeId}/template-object:${objectId}:${assetIndex}`;
            addedObjectIds.add(objectKey);

            addObjectLeaf(
                nodeId,
                objectNodeId,
                `${assetName} [${objectId}]`,
                {
                    indices: Number.isInteger(matchedSceneObject?.index) ? [matchedSceneObject.index] : null,
                    gameObject,
                    apiObject: asset,
                    category,
                },
                depth + 1
            );
        });

        listCategoryObjects(category).forEach((object, objectIndex) => {
            const objectId = getCategoryObjectId(object, objectIndex + 1);
            const objectKey = String(objectId);

            if (addedObjectIds.has(objectKey)) {
                return;
            }

            const assetName = getCategoryObjectName(object, `Object ${objectId}`);
            const assetId = object?.AssetID || object?.assetId || object?.asset_id || object?.assetID || objectId;
            if (!objectMatchesQuery(assetName, objectId, assetId, category.name)) {
                return;
            }

            const matchedSceneObject = sceneGameObjectByInstanceId.get(objectKey);
            const gameObject = matchedSceneObject?.gameObject || categoryObjectToGameObject(object, category, objectIndex);
            const objectNodeId = `${nodeId}/category-object:${objectId}:${objectIndex}`;
            addedObjectIds.add(objectKey);

            addObjectLeaf(
                nodeId,
                objectNodeId,
                `${assetName} [${objectId}]`,
                {
                    indices: Number.isInteger(matchedSceneObject?.index) ? [matchedSceneObject.index] : null,
                    gameObject,
                    apiObject: object,
                    category,
                },
                depth + 1
            );
        });

        if (!items[nodeId].children.length) {
            removeChild(items, parentId, nodeId);
            delete items[nodeId];
        }
    };

    categories.forEach((category, index) => {
        addCategory(category, 'root', 1, `root/${index}`);
    });

    return items;
};

const HierarchyLoader = ({ message = 'Loading scene...' }) => (
    <section className="editor-panel editor-hierarchy-panel">
        <div className="editor-panel-header">
            <span>Hierarchy</span>
            <small>Loading...</small>
        </div>

        <div className="hierarchy-lazy-loader">
            <span className="hierarchy-loader-ring" />
            <span>{message}</span>
        </div>
    </section>
);

const buildApiObjectTreeItems = (scenePath, apiData, gameObjects, query) => {
    const items = {
        root: {
            index: 'root',
            isFolder: true,
            children: [],
            data: { name: 'Scene Objects', depth: 0 },
        },
    };

    const sceneObjectByInstanceId = new Map();
    
    gameObjects.forEach((gameObject, index) => {
        
        const instanceId = gameObject?.source?.instanceId || gameObject?.source?.instance_id || gameObject?.id;
        if (instanceId !== undefined && instanceId !== null) {
            sceneObjectByInstanceId.set(String(instanceId), { gameObject, index });
        }
    });

    const normalizedQuery = query.trim().toLowerCase();

    listApiFileItems(apiData).forEach(({ categoryName, record }, index) => {
        const meta = normalizeApiItem(record, categoryName, index, sceneObjectByInstanceId);
        const searchable = `${meta.group} ${meta.category} ${meta.subcategory} ${meta.assetName} ${meta.assetId} ${meta.objectId}`.toLowerCase();
        if (normalizedQuery && !searchable.includes(normalizedQuery)) {
            return;
        }

        const groupId = ensureFolder(items, 'root', `group:${meta.group}`, meta.group, 1);
        const categoryId = ensureFolder(items, groupId, `${groupId}/category:${meta.category}`, meta.category, 2);
        const subcategoryId = ensureFolder(items, categoryId, `${categoryId}/subcategory:${meta.subcategory}`, meta.subcategory, 3);
        const assetId = ensureFolder(items, subcategoryId, `${subcategoryId}/asset:${meta.assetName}:${meta.assetId}`, `${meta.assetName} [${meta.assetId}]`, 4);
        const objectNodeId = `${assetId}/object:${meta.objectId}:${index}`;
        const inspectorGameObject = meta.gameObject || apiItemToGameObject(record, meta);

        items[objectNodeId] = {
            index: objectNodeId,
            isFolder: false,
            children: [],
            data: {
                name: meta.objectId,
                scenePath,
                indices: Number.isInteger(meta.sceneIndex) ? [meta.sceneIndex] : null,
                gameObject: inspectorGameObject,
                apiObject: meta.source,
                depth: 5,
            },
        };
        items[assetId].children.push(objectNodeId);
    });

    return items;
};

const buildObjectTreeItems = (scenePath, gameObjects, query) => {
    
    const items = {
        root: {
            index: 'root',
            isFolder: true,
            children: [],
            data: { name: 'Scene Objects', depth: 0 },
        },
    };

    const normalizedQuery = query.trim().toLowerCase();

    gameObjects.forEach((gameObject, index) => {
        const meta = getObjectMeta(gameObject, index);
        const searchable = `${meta.group} ${meta.category} ${meta.subcategory} ${meta.assetName} ${meta.assetId} ${meta.objectId}`.toLowerCase();
        if (normalizedQuery && !searchable.includes(normalizedQuery)) {
            return;
        }

        const groupId = ensureFolder(items, 'root', `group:${meta.group}`, meta.group, 1);
        const categoryId = ensureFolder(items, groupId, `${groupId}/category:${meta.category}`, meta.category, 2);
        const subcategoryId = ensureFolder(items, categoryId, `${categoryId}/subcategory:${meta.subcategory}`, meta.subcategory, 3);
        const assetId = ensureFolder(items, subcategoryId, `${subcategoryId}/asset:${meta.assetName}:${meta.assetId}`, `${meta.assetName} [${meta.assetId}]`, 4);
        const objectId = `${assetId}/object:${index}`;

        items[objectId] = {
            index: objectId,
            isFolder: false,
            children: [],
            data: {
                name: String(meta.objectId),
                scenePath,
                indices: [index],
                gameObject,
                depth: 5,
            },
        };
        items[assetId].children.push(objectId);
    });

    return items;
};

const collectExpandedItems = (items) => Object.values(items)
    .filter(item => item.isFolder)
    .map(item => item.index);

const treeHasVisibleItems = (items) => Boolean(items?.root?.children?.length);

const buildParentItemMap = (items) => {
    const parents = new Map();

    Object.values(items).forEach((item) => {
        item.children?.forEach((childId) => {
            parents.set(childId, item.index);
        });
    });

    return parents;
};

const collectAncestorItems = (items, itemId, parentItems = buildParentItemMap(items)) => {
    if (!itemId) {
        return [];
    }

    const ancestors = [];
    let currentId = itemId;

    while (currentId && currentId !== 'root') {
        const parentId = parentItems.get(currentId);
        if (!parentId || !items[parentId]) {
            break;
        }

        ancestors.unshift(parentId);
        currentId = parentId;
    }

    return ancestors;
};

const PcuiHierarchyNode = ({
    itemId,
    items,
    depth = 0,
    expandedItems,
    selectedItems,
    onToggle,
    onSelect,
}) => {
    const item = items[itemId];
    if (!item) {
        return null;
    }

    const children = item.children || EMPTY_ARRAY;
    const isOpen = expandedItems.has(itemId);
    const isSelected = selectedItems.has(itemId);
    const isFolder = Boolean(item.isFolder);
    const title = item.data?.name || itemId;

    return (
        <div
            className={`pcui-treeview-item pcui-object-node${isFolder ? ' is-folder' : ' is-object'}${isOpen ? ' pcui-treeview-item-open' : ''}${isSelected ? ' is-selected' : ''}`}
        >
            <button
                type="button"
                className={`pcui-treeview-item-contents pcui-object-node-row${isSelected ? ' pcui-treeview-item-selected' : ''}`}
                style={{ paddingLeft: `${Math.max(0, depth) * 10 + 2}px` }}
                onClick={() => {
                    if (isFolder) {
                        onToggle(itemId);
                        return;
                    }

                    onSelect(itemId);
                }}
                title={title}
            >
                <span className="pcui-object-disclosure" aria-hidden="true">
                    {isFolder && children.length ? <FaChevronRight /> : null}
                </span>
                <span className="pcui-treeview-item-icon pcui-object-node-icon" aria-hidden="true">
                    {isFolder ? <FaLayerGroup /> : <FaCube />}
                </span>
                <span className="pcui-treeview-item-text">{title}</span>
            </button>

            {isFolder && isOpen && children.length > 0 && (
                <div className="pcui-object-node-children">
                    {children.map(childId => (
                        <PcuiHierarchyNode
                            key={childId}
                            itemId={childId}
                            items={items}
                            depth={depth + 1}
                            expandedItems={expandedItems}
                            selectedItems={selectedItems}
                            onToggle={onToggle}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const PcuiObjectTree = ({ items, expandedItems, selectedItems, onToggle, onSelect }) => (
    <div className="pcui-treeview pcui-object-tree-view">
        {(items.root?.children || EMPTY_ARRAY).map(itemId => (
            <PcuiHierarchyNode
                key={itemId}
                itemId={itemId}
                items={items}
                expandedItems={expandedItems}
                selectedItems={selectedItems}
                onToggle={onToggle}
                onSelect={onSelect}
            />
        ))}
    </div>
);

const ObjectHierarchyTree = () => {
    const dispatch = useDispatch();
    const treeContainerRef = useRef(null);
    const projectFiles = useSelector(store => store.projectFiles);
    const selectedItem = useSelector(getSelectedItem());
    const projectId = useGame((state) => state.projectID);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const selectedLevel = useGame((state) => state.selectedLevel);
    const projectSceneData = useGame((state) => state.projectSceneData);
    const setEditAssetId = useGame((state) => state.setEditAssetId);
    const setSelectedAssetId = useGame((state) => state.setSelectedAssetId);
    const setEditProps = useGame((state) => state.setEditProps);
    const selectedEditorInstance = useGame((state) => state.selectedEditorInstance);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const editorSelectionEnabled = useGame((state) => state.editorSelectionEnabled);
    const requestEditorInstanceSelection = useGame((state) => state.requestEditorInstanceSelection);
    const [query, setQuery] = useState('');
    const [apiFiles, setApiFiles] = useState(null);
    const [apiCategories, setApiCategories] = useState(null);
    const [apiStatus, setApiStatus] = useState('idle');
    const [categoryStatus, setCategoryStatus] = useState('idle');
    const [treeViewState, setTreeViewState] = useState({
        [OBJECT_TREE_ID]: {
            expandedItems: [],
            selectedItems: [],
            focusedItem: null,
        },
    });

    const gameFileInfo = projectFiles?.files?.find(f => f.name.toLowerCase() === 'game.json');
    const gameFile = useSelector(getFile('game.json'));
    const sceneName = gameFile?.data?.initialScene || Object.keys(gameFile?.data?.scenes || {})[0];
    const scenePath = sceneName ? gameFile?.data?.scenes?.[sceneName] : null;
    const sceneFile = useSelector(getFile(scenePath));
    const gameObjects = sceneFile?.data?.gameObjects || EMPTY_ARRAY;
    const sceneCategories = sceneFile?.metaData?.originalData?.categories
        || sceneFile?.data?.source?.originalData?.categories
        || sceneFile?.data?.categories
        || EMPTY_ARRAY;
    const projectSceneCategories = Array.isArray(projectSceneData?.categories)
        ? projectSceneData.categories
        : sceneCategories;
    const baseProjectId = useMemo(() => getBaseProjectId(projectId), [projectId]);
    const hasSelectedProject = Boolean(baseProjectId || gameFileInfo || projectFiles?.files?.length);
    const expectedSceneKey = useMemo(() => getExpectedSceneKey(projectId, selectedLevel), [projectId, selectedLevel]);
    const isApiSceneProject = sceneFile?.metaData?.source === 'api' || projectFiles?.name?.startsWith?.('API Scene');
    const loadedSceneKey = sceneFile?.metaData?.sceneKey || sceneFile?.data?.source?.sceneKey || null;
    const normalizedExpectedSceneKey = normalizeSceneKey(expectedSceneKey);
    const normalizedLoadedSceneKey = normalizeSceneKey(loadedSceneKey);
    const isSceneCurrent = !normalizedExpectedSceneKey || normalizedLoadedSceneKey === normalizedExpectedSceneKey;
    const isApiSceneExpected = Boolean(
        expectedSceneKey &&
        (
            loadedSceneKey ||
            projectFiles?.name?.startsWith?.('API Scene') ||
            !gameFileInfo
        )
    );
    const isSceneLoading = Boolean(isApiSceneExpected && (!sceneFile || !isSceneCurrent));
    const projectIsPuzzleGame = Boolean(isPuzzleGame);
    const shouldUseGameProjectApi = Boolean(projectIsPuzzleGame && baseProjectId);
    const shouldUseCategoryApi = Boolean(!projectIsPuzzleGame && baseProjectId);

    useEffect(() => {
        if (!shouldUseGameProjectApi) {
            setApiFiles(null);
            setApiStatus('idle');
            return;
        }

        const controller = new AbortController();

        const loadFilesWithCategory = async () => {
            try {
                setApiStatus('loading');
                const response = await fetch(`${import.meta.env.VITE_API_URL}/getFilesWithCategory/${GAME_PROJECT_CATEGORY_TEMPLATE_ID}`, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();
                setApiFiles(json?.data || json);
                setApiStatus('ready');
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }

                console.error('Failed to load game project object tree:', error);
                setApiFiles(null);
                setApiStatus('error');
            }
        };

        loadFilesWithCategory();

        return () => controller.abort();
    }, [shouldUseGameProjectApi]);

    useEffect(() => {
        if (!shouldUseCategoryApi) {
            setApiCategories(null);
            setCategoryStatus('idle');
            return;
        }

        const controller = new AbortController();

        const loadCategories = async () => {
            try {
                setCategoryStatus('loading');
                const response = await fetch(`${import.meta.env.VITE_API_URL}/getCategories/false/${baseProjectId}`, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();
                setApiCategories(json?.data || json);
                setCategoryStatus('ready');
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }

                console.error('Failed to load project category tree:', error);
                setApiCategories(null);
                setCategoryStatus('error');
            }
        };

        loadCategories();

        return () => controller.abort();
    }, [baseProjectId, shouldUseCategoryApi]);

    const treeItems = useMemo(
        () => {
            if (isSceneLoading) {
                return {
                    root: {
                        index: 'root',
                        isFolder: true,
                        children: [],
                        data: { name: 'Loading', depth: 0 },
                    },
                };
            }

            if (shouldUseGameProjectApi) {
                return buildApiObjectTreeItems(scenePath, apiFiles || {}, gameObjects, query);
            }

            if (shouldUseCategoryApi) {
                return buildCategoryTreeItems(scenePath, apiCategories || [], projectSceneCategories, gameObjects, query);
            }

            return buildObjectTreeItems(scenePath, gameObjects, query);
        },
        [apiCategories, apiFiles, gameObjects, isSceneLoading, projectSceneCategories, query, scenePath, shouldUseCategoryApi, shouldUseGameProjectApi]
    );

    useEffect(() => {
        if (!shouldUseCategoryApi || isSceneLoading) {
            return;
        }

        const sceneAssetsByTemplateId = buildSceneAssetsByTemplateId(projectSceneCategories);
        const rawCategorySummary = normalizeCategoryResponse(apiCategories).map((category) => ({
            name: category?.name,
            id: category?.id,
            templateId: category?.template_id,
            directObjects: listCategoryObjects(category).length,
            children: listCategoryChildren(category).length,
            matchingSubcategories: listCategoryChildren(category).filter((child) => (
                sceneAssetsByTemplateId.has(String(child?.template_id ?? child?.templateId ?? child?.templateID ?? '').trim())
            )).length,
        }));
        const renderedCategories = Object.values(treeItems)
            .filter((item) => item?.isFolder && item.index !== 'root')
            .map((item) => ({
                name: item.data?.name,
                id: item.data?.category?.id,
                templateId: item.data?.category?.template_id,
                childCount: item.children?.length || 0,
            }));

     
    }, [apiCategories, isSceneLoading, projectSceneCategories, shouldUseCategoryApi, treeItems]);

    const parentItems = useMemo(() => buildParentItemMap(treeItems), [treeItems]);

    const selectedItems = useMemo(() => {
        const selectedInstanceId = selectedEditorInstance?.instanceId
            || selectedItem?.params?.gameObject?.source?.instanceId
            || selectedItem?.params?.apiObject?.device_id
            || selectedItem?.params?.apiObject?.instance_id;
       
          

        if (!selectedInstanceId && (!selectedItem || selectedItem.type !== 'gameObject')) {
            return [];
        }

        const selectedIndex = selectedItem?.params?.indices?.[0];
        const item = Object.values(treeItems).find((treeItem) => {
            const treeInstanceId = treeItem.data?.gameObject?.source?.instanceId
                || treeItem.data?.gameObject?.source?.instance_id
                || treeItem.data?.apiObject?.device_id
                || treeItem.data?.apiObject?.instance_id;

            if (selectedInstanceId && treeInstanceId && String(treeInstanceId) === String(selectedInstanceId)) {
                return true;
            }

            return selectedIndex !== undefined && treeItem.data?.indices?.[0] === selectedIndex;
        });
        return item ? [item.index] : [];
    }, [selectedEditorInstance?.instanceId, selectedItem, treeItems]);

    const selectedItemId = selectedItems[0] || null;

    useEffect(() => {
        setTreeViewState((previous) => {
            const current = previous[OBJECT_TREE_ID] || {};
            const validSelectedItemId = selectedItemId && treeItems[selectedItemId] ? selectedItemId : null;
            const selectedAncestors = collectAncestorItems(treeItems, validSelectedItemId, parentItems);
            const expandedItems = query.trim()
                ? collectExpandedItems(treeItems)
                : selectedAncestors;
            const nextSelectedItems = validSelectedItemId ? [validSelectedItemId] : [];
            const nextFocusedItem = validSelectedItemId || (treeItems[current.focusedItem] ? current.focusedItem : null);

            if (
                arraysEqual(current.expandedItems || [], expandedItems) &&
                arraysEqual(current.selectedItems || [], nextSelectedItems) &&
                (current.focusedItem || null) === nextFocusedItem
            ) {
                return previous;
            }

            return {
                ...previous,
                [OBJECT_TREE_ID]: {
                    ...current,
                    expandedItems,
                    selectedItems: nextSelectedItems,
                    focusedItem: nextFocusedItem,
                },
            };
        });
    }, [parentItems, query, selectedItemId, treeItems]);

    useEffect(() => {
        if (!selectedItemId) {
            return;
        }

        const scrollSelectedIntoView = () => {
            treeContainerRef.current
                ?.querySelector('.pcui-object-node-row.pcui-treeview-item-selected')
                ?.scrollIntoView({ block: 'center', inline: 'nearest' });
        };

        const animationFrame = requestAnimationFrame(() => {
            requestAnimationFrame(scrollSelectedIntoView);
        });
        const timeout = window.setTimeout(scrollSelectedIntoView, 80);

        return () => {
            cancelAnimationFrame(animationFrame);
            window.clearTimeout(timeout);
        };
    }, [selectedItemId, treeViewState]);

    const updateTreeState = (updater) => {
        setTreeViewState((previous) => {
            const current = previous[OBJECT_TREE_ID] || {};
            const next = updater(current);

            if (
                arraysEqual(current.expandedItems || [], next.expandedItems || []) &&
                arraysEqual(current.selectedItems || [], next.selectedItems || []) &&
                (current.focusedItem || null) === (next.focusedItem || null)
            ) {
                return previous;
            }

            return {
                ...previous,
                [OBJECT_TREE_ID]: next,
            };
        });
    };

    const selectTreeItem = (item) => {
        if (!editorSelectionEnabled) {
            return;
        }

        if (!item?.data?.scenePath) {
            return;
        }

        const apiObject = toSerializableSelectionValue(item.data.apiObject);
        const originalGameObject = item.data.gameObject;
        const gameObject = toSerializableSelectionValue({
            ...originalGameObject,
            source: {
                ...(originalGameObject?.source || {}),
                apiObject,
            },
        });
        const instanceId = gameObject?.source?.instanceId || gameObject?.source?.instance_id || gameObject?.id || apiObject?.device_id || apiObject?.instance_id;
        if (instanceId) {
            const normalizedInstanceId = Number.parseInt(String(instanceId), 10);
            const angle = gameObject?.rotation?.y || apiObject?.Angle || 0;
            const position = gameObject?.position;

            setEditProps({
                name: gameObject?.name || item.data.name,
                position,
                angle,
                categoryIndex: gameObject?.source?.category || item.data.category?.id,
                assetID: apiObject?.AssetID || apiObject?.assetId,
                template_id: item.data.category?.template_id,
            });
            setEditAssetId(normalizedInstanceId);
            setSelectedAssetId(normalizedInstanceId);

            const cleanKey = sceneAssets[instanceId]?.cleanKey
            setSelectedEditorInstance({
                instanceId,
                scenePath: item.data.scenePath,
                gameObject,
                apiObject,
                cleanKey
            });
            requestEditorInstanceSelection({
                instanceId,
                name: gameObject?.name || item.data.name,
                apiObject,
                category: item.data.category,
            });
        }

        dispatch(selectItem(item.data.scenePath, 'gameObject', {
            indices: item.data.indices,
            gameObject,
            apiObject,
        }));
    };

    if (!hasSelectedProject) {
        return null;
    }

    if (isSceneLoading) {
        return <HierarchyLoader message="Loading scene..." />;
    }

    if (!gameFileInfo && !gameObjects.length) {
        return null;
    }

    const activeStatus = shouldUseGameProjectApi ? apiStatus : shouldUseCategoryApi ? categoryStatus : 'idle';
    const activeTreeData = shouldUseGameProjectApi ? apiFiles : shouldUseCategoryApi ? apiCategories : null;

    if ((shouldUseGameProjectApi || shouldUseCategoryApi) && activeStatus === 'loading' && !activeTreeData) {
        return <HierarchyLoader message="Loading hierarchy..." />;
    }

    return (
        <section className="editor-panel editor-hierarchy-panel">
            <div className="editor-panel-header">
                <span>Hierarchy</span>
                {activeStatus === 'loading' && <small>Loading...</small>}
                {activeStatus === 'error' && <small>API unavailable</small>}
            </div>

            <label className="object-search">
                <FaSearch />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search objects"
                />
            </label>

            <div className="object-tree pcui-object-tree-shell" ref={treeContainerRef}>
                <PcuiObjectTree
                    items={treeItems}
                    expandedItems={new Set(treeViewState[OBJECT_TREE_ID]?.expandedItems || EMPTY_ARRAY)}
                    selectedItems={new Set(treeViewState[OBJECT_TREE_ID]?.selectedItems || EMPTY_ARRAY)}
                    onToggle={(itemId) => {
                        updateTreeState((current) => {
                            const expanded = new Set(current.expandedItems || EMPTY_ARRAY);
                            if (expanded.has(itemId)) {
                                expanded.delete(itemId);
                            } else {
                                expanded.add(itemId);
                            }

                            return {
                                ...current,
                                expandedItems: Array.from(expanded),
                                focusedItem: itemId,
                            };
                        });
                    }}
                    onSelect={(itemId) => {
                        updateTreeState((current) => ({
                            ...current,
                            selectedItems: itemId ? [itemId] : [],
                            focusedItem: itemId || current.focusedItem,
                        }));
                        selectTreeItem(treeItems[itemId]);
                    }}
                />
            </div>
        </section>
    );
};

export default ObjectHierarchyTree;
