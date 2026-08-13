import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiEye, FiSearch, FiX } from "react-icons/fi";
import useGame from "../../../../hooks/useGame";
import { sceneAssets } from "../../../../threejs/player/puzzle/character/Constants.jsx";
import "./PlayAssetInfoHud.css";

const EMPTY_ARRAY = [];

const listCategoryChildren = (category = {}) => (
    Array.isArray(category.children)
        ? category.children
        : Object.values(category.children || {})
);

const listCategoryObjects = (category = {}) => {
    const collections = [
        category.objects,
        category.assets,
        category.instances,
        category.items,
        category.devices,
        category.boObjects,
        category.BOObjects,
    ];

    return collections
        .flatMap((collection) => {
            if (!collection) return [];
            return Array.isArray(collection) ? collection : Object.values(collection);
        })
        .filter(Boolean);
};

const getCategoryId = (category) => (
    category?.id
    ?? category?.category_id
    ?? category?.categoryIndex
    ?? category?.category_index
    ?? category?.template_id
);

const getObjectId = (object, fallback) => (
    object?.device_id
    || object?.deviceId
    || object?.instanceId
    || object?.instance_id
    || object?.assetId
    || object?.assetID
    || object?.objectId
    || object?.id
    || fallback
);

const getObjectName = (object, fallback) => (
    object?.Assetname
    || object?.AssetName
    || object?.assetName
    || object?.name
    || object?.description?.[0]
    || fallback
);

const getObjectSecondaryId = (object) => (
    object?.AssetID
    || object?.assetID
    || object?.assetId
    || object?.instanceData?.assetID
    || object?.instanceData?.assetId
    || object?.assetObject?.assetID
    || object?.assetObject?.assetId
);

const getSceneAssetCategoryId = (asset) => (
    asset?.categoryIndex
    || asset?.category
    || asset?.instanceData?.assetObject?.categoryIndex
    || asset?.instanceData?.assetObject?.category
    || asset?.assetObject?.categoryIndex
    || asset?.assetObject?.category
);

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

const getSceneCategoryRaw = (category = {}) => category?._raw || category || {};

const stripSceneCategorySuffix = (categoryId, categoryIndex) => {
    if (categoryId === undefined || categoryId === null) {
        return categoryId;
    }

    const id = String(categoryId).trim();
    const index = String(categoryIndex ?? "").trim();
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

const categoryMatchKey = (categoryId, templateId) => {
    if (categoryId === undefined || categoryId === null || templateId === undefined || templateId === null) {
        return null;
    }

    return `${String(categoryId).trim()}::${String(templateId).trim()}`;
};

const getSceneAssetInstanceId = (asset, fallback) => (
    asset?._raw?.instance_id
    || asset?.instanceId
    || asset?.instance_id
    || asset?.device_id
    || asset?.id
    || fallback
);

const getSceneAssetName = (asset, fallback) => {
    const fields = asset?.fields || {};
    return fields.AssetName?.value
        || fields.Description?.value
        || fields.Model?.value
        || fields.SKU?.value
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

const buildSceneAssetsByTemplateId = (sceneCategories = EMPTY_ARRAY) => {
    const assetsByTemplateId = new Map();

    (Array.isArray(sceneCategories) ? sceneCategories : EMPTY_ARRAY).forEach((sceneCategory) => {
        listSceneCategoryAssets(sceneCategory).forEach((asset) => {
            const templateId = getSceneAssetTemplateId(asset);
            if (templateId === undefined || templateId === null || templateId === "") return;

            const key = String(templateId).trim();
            assetsByTemplateId.set(key, [...(assetsByTemplateId.get(key) || EMPTY_ARRAY), asset]);
        });
    });

    return assetsByTemplateId;
};

const buildSceneObjectsByCategory = () => {
    const grouped = new Map();

    Object.values(sceneAssets || {}).forEach((asset) => {
        const categoryId = getSceneAssetCategoryId(asset);
        if (categoryId === undefined || categoryId === null || categoryId === "") return;

        const key = String(categoryId);
        const id = asset?.id || asset?.assetId || asset?.instanceId || asset?.instanceData?.id || key;
        const item = {
            ...asset,
            id,
            name: asset?.name || asset?.instanceData?.name || asset?.instanceData?.description?.[0] || `Object ${id}`,
            assetId: asset?.assetId || asset?.assetID || asset?.instanceData?.assetID || asset?.instanceData?.assetId,
            __fromSceneAsset: true,
        };

        grouped.set(key, [...(grouped.get(key) || EMPTY_ARRAY), item]);
    });

    return grouped;
};

const addGroupedObject = (grouped, categoryId, object) => {
    if (categoryId === undefined || categoryId === null || categoryId === "") return;

    const key = String(categoryId).trim();
    grouped.set(key, [...(grouped.get(key) || EMPTY_ARRAY), object]);
};

const buildLoadedSceneObjectsByCategory = (sceneCategories = EMPTY_ARRAY, gameObjects = EMPTY_ARRAY) => {
    const byId = new Map();
    const byKey = new Map();
    const sceneGameObjectByInstanceId = new Map();

    gameObjects.forEach((gameObject, index) => {
        const instanceId = getGameObjectInstanceId(gameObject, index + 1);
        if (instanceId !== undefined && instanceId !== null && instanceId !== "") {
            sceneGameObjectByInstanceId.set(String(instanceId), gameObject);
        }

        const categoryId = getGameObjectCategoryId(gameObject);
        addGroupedObject(byId, categoryId, {
            ...gameObject,
            id: instanceId,
            name: gameObject?.name || `Object ${instanceId}`,
            assetId: gameObject?.source?.assetId || gameObject?.source?.assetID,
            __fromLoadedScene: true,
        });
    });

    (Array.isArray(sceneCategories) ? sceneCategories : EMPTY_ARRAY).forEach((sceneCategory) => {
        const categoryId = getSceneCategoryId(sceneCategory);
        const templateId = getSceneCategoryTemplateId(sceneCategory);
        const matchKey = categoryMatchKey(categoryId, templateId);

        listSceneCategoryAssets(sceneCategory).forEach((asset, index) => {
            const objectId = getSceneAssetInstanceId(asset, index + 1);
            const matchedGameObject = sceneGameObjectByInstanceId.get(String(objectId));
            const object = {
                ...(matchedGameObject || asset),
                id: objectId,
                name: matchedGameObject?.name || getSceneAssetName(asset, `Object ${objectId}`),
                assetId: asset?._raw?.asset_id || asset?.asset_id || asset?.assetId,
                __fromLoadedScene: true,
            };

            addGroupedObject(byId, categoryId, object);
            if (matchKey) {
                addGroupedObject(byKey, matchKey, object);
            }
        });
    });

    return { byId, byKey };
};

const categoryMatchesQuery = (category, normalizedQuery, directObjects = EMPTY_ARRAY) => {
    if (!normalizedQuery) return true;

    const objectSearchable = [...listCategoryObjects(category), ...directObjects]
        .map((object) => `${getObjectName(object, "")} ${getObjectId(object, "")} ${getObjectSecondaryId(object) || ""}`)
        .join(" ");
    const searchable = `${category?.name || ""} ${getCategoryId(category) || ""} ${category?.template_id || ""} ${objectSearchable}`.toLowerCase();
    return searchable.includes(normalizedQuery);
};

const getDirectCategoryObjects = (category, sceneObjectsByCategory, loadedSceneObjectsByCategory, sceneAssetsByTemplateId) => {
    const templateId = category?.template_id ?? category?.templateId ?? category?.templateID;
    if (templateId !== undefined && templateId !== null && templateId !== "") {
        return sceneAssetsByTemplateId.get(String(templateId).trim()) || EMPTY_ARRAY;
    }

    const categoryId = getCategoryId(category);
    const matchKey = categoryMatchKey(categoryId, category?.template_id);
    const exactLoadedObjects = matchKey ? loadedSceneObjectsByCategory.byKey.get(matchKey) || EMPTY_ARRAY : EMPTY_ARRAY;
    const loadedObjects = exactLoadedObjects.length
        ? exactLoadedObjects
        : loadedSceneObjectsByCategory.byId.get(String(categoryId)) || EMPTY_ARRAY;
    const directObjects = sceneObjectsByCategory.get(String(categoryId)) || EMPTY_ARRAY;

    const objects = [
        ...listCategoryObjects(category),
        ...directObjects,
        ...loadedObjects,
    ];

    const seenObjects = new Set();
    return objects.filter((object, index) => {
        const key = String(getObjectId(object, index));
        if (seenObjects.has(key)) {
            return false;
        }

        seenObjects.add(key);
        return true;
    });
};

const categoryHasObjects = (category, sceneObjectsByCategory, loadedSceneObjectsByCategory, sceneAssetsByTemplateId) => (
    getDirectCategoryObjects(category, sceneObjectsByCategory, loadedSceneObjectsByCategory, sceneAssetsByTemplateId).length > 0
    || listCategoryChildren(category).some((child) => categoryHasObjects(child, sceneObjectsByCategory, loadedSceneObjectsByCategory, sceneAssetsByTemplateId))
);

const categoryHasMatch = (category, normalizedQuery, sceneObjectsByCategory, loadedSceneObjectsByCategory, sceneAssetsByTemplateId) => {
    if (!categoryHasObjects(category, sceneObjectsByCategory, loadedSceneObjectsByCategory, sceneAssetsByTemplateId)) {
        return false;
    }

    const directObjects = getDirectCategoryObjects(category, sceneObjectsByCategory, loadedSceneObjectsByCategory, sceneAssetsByTemplateId);
    return (
        categoryMatchesQuery(category, normalizedQuery, directObjects)
        || listCategoryChildren(category).some((child) => categoryHasMatch(child, normalizedQuery, sceneObjectsByCategory, loadedSceneObjectsByCategory, sceneAssetsByTemplateId))
    );
};

const buildCategoryTreeItems = (categories, query, sceneCategories = EMPTY_ARRAY, gameObjects = EMPTY_ARRAY) => {
    const items = {
        root: {
            index: "root",
            isFolder: true,
            children: [],
            data: { name: "Categories", depth: 0 },
        },
    };
    const normalizedQuery = query.trim().toLowerCase();
    const sceneObjectsByCategory = buildSceneObjectsByCategory();
    const loadedSceneObjectsByCategory = buildLoadedSceneObjectsByCategory(sceneCategories, gameObjects);
    const sceneAssetsByTemplateId = buildSceneAssetsByTemplateId(sceneCategories);

    const addObject = (parentId, object, objectIndex, depth) => {
        const objectId = getObjectId(object, objectIndex + 1);
        const objectName = getObjectName(object, `Object ${objectId}`);
        const secondaryId = getObjectSecondaryId(object);
        const itemId = `${parentId}/object:${objectId}:${objectIndex}`;

        items[itemId] = {
            index: itemId,
            isFolder: false,
            children: [],
            data: {
                name: objectName,
                id: objectId,
                secondaryId,
                depth,
            },
        };
        items[parentId].children.push(itemId);
    };

    const addCategory = (category, parentId, depth, path) => {
        if (!category || !categoryHasMatch(category, normalizedQuery, sceneObjectsByCategory, loadedSceneObjectsByCategory, sceneAssetsByTemplateId)) return;

        const categoryId = getCategoryId(category) ?? `${path}-${items[parentId].children.length}`;
        const itemId = `${parentId}/category:${categoryId}`;

        items[itemId] = {
            index: itemId,
            isFolder: true,
            children: [],
            data: {
                name: category.name || `Category ${categoryId}`,
                id: categoryId,
                templateId: category.template_id,
                depth,
            },
        };
        items[parentId].children.push(itemId);

        listCategoryChildren(category).forEach((child, index) => {
            addCategory(child, itemId, depth + 1, `${path}/${categoryId}/${index}`);
        });

        const categoryObjects = getDirectCategoryObjects(category, sceneObjectsByCategory, loadedSceneObjectsByCategory, sceneAssetsByTemplateId);

        categoryObjects.forEach((object, index) => {
            const searchable = `${getObjectName(object, "")} ${getObjectId(object, "")} ${getObjectSecondaryId(object) || ""} ${category.name || ""}`.toLowerCase();
            if (normalizedQuery && !searchable.includes(normalizedQuery)) return;
            addObject(itemId, object, index, depth + 1);
        });
    };

    (Array.isArray(categories) ? categories : EMPTY_ARRAY)
        .forEach((category, index) => addCategory(category, "root", 1, `root/${index}`));

    return items;
};

const collectExpandedItems = (items) => Object.values(items)
    .filter((item) => item.isFolder)
    .map((item) => item.index);

const countTreeObjects = (items) => Object.values(items || {}).filter((item) => item && !item.isFolder).length;

const treeHasVisibleItems = (items) => Boolean(items?.root?.children?.length);

const PlayCategoryTreeNode = ({
    itemId,
    items,
    depth = 0,
    expandedItems,
    selectedItems,
    onToggle,
    onSelect,
}) => {
    const item = items[itemId];
    if (!item) return null;

    const children = item.children || EMPTY_ARRAY;
    const isOpen = expandedItems.has(itemId);
    const isSelected = selectedItems.has(itemId);
    const isFolder = Boolean(item.isFolder);
    const title = item.data?.name || itemId;
    const itemNumber = item.data?.templateId || item.data?.id;
    const secondaryNumber = item.data?.secondaryId;

    return (
        <div className={`pcui-treeview-item pcui-object-node${isFolder ? " is-folder" : " is-object"}${isOpen ? " pcui-treeview-item-open" : ""}${isSelected ? " is-selected" : ""}`}>
            <button
                type="button"
                className={`pcui-treeview-item-contents pcui-object-node-row${isSelected ? " pcui-treeview-item-selected" : ""}`}
                style={{ paddingLeft: `${Math.max(0, depth) * 10 + 2}px` }}
                onClick={() => {
                    if (isFolder) {
                        onToggle(itemId);
                    } else {
                        onSelect(itemId);
                    }
                }}
                title={title}
            >
                <span className="pcui-object-disclosure" aria-hidden="true">
                    {isFolder && children.length ? <span className="pcui-object-chevron" /> : null}
                </span>
                <span className="pcui-treeview-item-branch" aria-hidden="true">
                    {isFolder ? null : "—"}
                </span>
                <span className="pcui-treeview-item-text">
                    <span className="pcui-treeview-item-name">{title}</span>
                    {itemNumber !== undefined && itemNumber !== null && itemNumber !== "" && (
                        <span className="pcui-treeview-item-id">[{itemNumber}]</span>
                    )}
                    {secondaryNumber !== undefined && secondaryNumber !== null && secondaryNumber !== "" && (
                        <span className="pcui-treeview-item-id pcui-treeview-item-id--active">[{secondaryNumber}]</span>
                    )}
                </span>
                {isSelected && isFolder && (
                    <span className="pcui-treeview-item-eye" aria-hidden="true">
                        <FiEye />
                    </span>
                )}
            </button>

            {isFolder && isOpen && children.length > 0 && (
                <div className="pcui-object-node-children">
                    {children.map((childId) => (
                        <PlayCategoryTreeNode
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

const PlayCategoryTree = ({ items, expandedItems, selectedItems, onToggle, onSelect }) => (
    <div className="pcui-treeview pcui-object-tree-view">
        {(items.root?.children || EMPTY_ARRAY).map((itemId) => (
            <PlayCategoryTreeNode
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

export default function PlayCategoryPopup() {
    const rawCategories = useGame((state) => state.rawCategories);
    const checkedItems = useGame((state) => state.checkedItems);
    const projectSceneData = useGame((state) => state.projectSceneData);
    const sceneCategories = Array.isArray(projectSceneData?.categories)
        ? projectSceneData.categories
        : EMPTY_ARRAY;
    const [query, setQuery] = useState("");
    const [expandedItems, setExpandedItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [panelPosition, setPanelPosition] = useState({ x: 20, y: 96 });
    const [isVisible, setIsVisible] = useState(true);
    const dragStateRef = useRef(null);

    const treeItems = useMemo(() => {
        return buildCategoryTreeItems(rawCategories, query, sceneCategories);
    }, [query, rawCategories, sceneCategories]);

    useEffect(() => {
        setExpandedItems((current) => {
            if (query.trim() || current.length === 0) {
                return collectExpandedItems(treeItems);
            }

            const validCurrent = current.filter((itemId) => treeItems[itemId]);
            return validCurrent.length === current.length ? current : validCurrent;
        });
        setSelectedItems((current) => current.filter((itemId) => treeItems[itemId]));
    }, [query, treeItems]);

    const objectCount = countTreeObjects(treeItems);
    const hasTreeItems = treeHasVisibleItems(treeItems);
    const activeCount = Array.isArray(checkedItems) && checkedItems.length ? checkedItems.length : objectCount;

    if (!isVisible) {
        return null;
    }

    const handleDragStart = (event) => {
        if (event.button !== 0) return;

        dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: panelPosition.x,
            originY: panelPosition.y,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    };

    const handleDragMove = (event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        const maxX = Math.max(0, window.innerWidth - 390);
        const maxY = Math.max(0, window.innerHeight - 454);
        const nextX = Math.min(Math.max(0, dragState.originX + event.clientX - dragState.startX), maxX);
        const nextY = Math.min(Math.max(0, dragState.originY + event.clientY - dragState.startY), maxY);

        setPanelPosition({ x: nextX, y: nextY });
    };

    const handleDragEnd = (event) => {
        if (dragStateRef.current?.pointerId !== event.pointerId) return;
        dragStateRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    };

    return (
        <aside
            className="play-category-popup"
            aria-label="Play mode category tree"
            style={{ left: `${panelPosition.x}px`, top: `${panelPosition.y}px` }}
        >
            <span className="play-category-popup__anchor play-category-popup__anchor--tl" aria-hidden="true" />
            <span className="play-category-popup__anchor play-category-popup__anchor--br" aria-hidden="true" />
            <button
                type="button"
                className="play-category-popup__close"
                aria-label="Close categories"
                onClick={() => setIsVisible(false)}
            >
                <FiX aria-hidden="true" />
            </button>

            <div
                className="play-category-popup__header"
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
            >
                <h2>Categories</h2>
                {/* <span className="play-category-popup__status" aria-hidden="true">
                    <span className="play-category-popup__status-dot play-category-popup__status-dot--warm" />
                    <span className="play-category-popup__status-dot play-category-popup__status-dot--cyan" />
                </span> */}
            </div>

            <label className="play-category-popup__search">
                <FiSearch aria-hidden="true" />
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search objects"
                />
                <span aria-hidden="true">CMD+F</span>
            </label>

            <div className="play-category-popup__tree object-tree pcui-object-tree-shell">
                {hasTreeItems ? (
                    <PlayCategoryTree
                        items={treeItems}
                        expandedItems={new Set(expandedItems)}
                        selectedItems={new Set(selectedItems)}
                        onToggle={(itemId) => {
                            setExpandedItems((current) => {
                                const next = new Set(current);
                                if (next.has(itemId)) {
                                    next.delete(itemId);
                                } else {
                                    next.add(itemId);
                                }
                                return Array.from(next);
                            });
                        }}
                        onSelect={(itemId) => setSelectedItems(itemId ? [itemId] : [])}
                    />
                ) : (
                    <div className="play-category-popup__empty">No categories available</div>
                )}
            </div>

            <div className="play-category-popup__footer">
                <span>Total: <strong>{objectCount}</strong></span>
                <span>Active: <strong>{activeCount}</strong></span>
                <span>V_04.2_DELTA</span>
            </div>
        </aside>
    );
}
