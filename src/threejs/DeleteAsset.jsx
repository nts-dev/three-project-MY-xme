import React, { Fragment, useEffect, useRef } from "react";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";
import { Q } from "@nozbe/watermelondb";
import * as THREE from "three";

import database from "../database";
import useGame from "../hooks/useGame";
import { apiData, objects, sceneAssets } from "./player/puzzle/character/Constants.jsx";


export default function DeleteAsset() {

    const toast = useRef(null);
    const setRemovedObject = useGame((state) => state.setRemovedObject);
    const deleteAssetId = useGame((state) => state.deleteAssetId);
    const selectedAssetName = useGame((state) => state.selectedAssetName);
    const setDeleteAssetId = useGame((state) => state.setDeleteAssetId);
    const deleteAssetConfirmed = useGame((state) => state.deleteAssetConfirmed);
    const setDeleteAssetConfirmed = useGame((state) => state.setDeleteAssetConfirmed);
    const projectId = useGame((state) => state.projectID);
    const selectedLevel = useGame((state) => state.selectedLevel);
    const setLazy = useGame((state) => state.setLazy);
    const setLazyMsg = useGame((state) => state.setLazyMsg);
    const setAssetSelected = useGame((state) => state.setAssetSelected);
    const setIsEditing = useGame((state) => state.setIsEditing);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const setSelectedDragObject = useGame((state) => state.setSelectedDragObject);
    const setEditAssetId = useGame((state) => state.setEditAssetId);
    const setSelectedAssetId = useGame((state) => state.setSelectedAssetId);
    const setDrop = useGame((state) => state.setDrop);
    // const deleteObject = useGame((state) => state.deleteObject);
    const setDeleteId = useGame((state) => state.setDeleteId);

    const reject = () => {
        toast.current?.show({ severity: 'warn', summary: 'Rejected', detail: 'You have rejected', life: 3000 });
        setDeleteAssetId(0);
    }
    const showMessage = (severity, summary, details) => {
        if (toast.current) {
            toast.current.show({
                severity,
                summary,
                detail: details,
                life: 10000,
            });
        }
    };
    const updateSceneAsset = (selectedAssetId) => {
        const asset = sceneAssets[selectedAssetId];
        setDeleteId(selectedAssetId);

        if (asset) {
            const { instance, scale, noInstbject } = asset;
            const nextScale = scale?.clone?.() || new THREE.Vector3(1, 1, 1);
            nextScale.multiplyScalar(0);
            noInstbject?.scale?.set?.(nextScale);

            if (instance && asset?.quart && asset?.position && asset?.index !== undefined) {
                const matrix = new THREE.Matrix4();
                matrix.compose(asset.position, asset.quart, nextScale);
                instance.setMatrixAt(asset.index, matrix);
                instance.instanceMatrix.needsUpdate = true;
                instance.computeBoundingSphere?.();
            }
        }

        delete sceneAssets[selectedAssetId];
    }
    const clearDeletedAssetSelection = () => {
        setAssetSelected(false);
        setIsEditing(false);
        setSelectedEditorInstance(null);
        setSelectedDragObject(null);
        setEditAssetId(0);
        setSelectedAssetId(0);
        setDrop(false);
        setDeleteAssetId(0);
        setDeleteAssetConfirmed(false);
        window.dispatchEvent(new CustomEvent('editor-detach-transform-controls'));
    };
    const deleteFieldFromWaterMelon = async (editAssetId, table) => {
        try {
            const fieldsCollection = database.collections.get(table);

            // 1️⃣ Fetch all records for this instance
            const fields = await fieldsCollection
                .query(Q.where('instance_id', Number(editAssetId)))
                .fetch();

            if (fields.length === 0) return;

            // 2️⃣ Prepare all deletes in a batch
            const batchOps = fields.map(field =>
                field.prepareDestroyPermanently()
            );

            // 3️⃣ Execute in one atomic DB write
            await database.write(async () => {
                await database.batch(...batchOps);
            });

        } catch (error) {
            console.log("deleteFieldFromWaterMelon error:", error);
        }
    };

    const deleteAssetsFromLevel = async (instance_id) => {

        const result = await fetch(`${import.meta.env.VITE_API_URL}/game-delete-instance`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instance_id }),
        });

         return result.json()
    }

    const getActiveSceneProjectId = () => {
        const rawProjectId = String(projectId || "");
        if (/_L\d+$/i.test(rawProjectId)) {
            return rawProjectId;
        }

        const levelCode = Number.parseInt(String(selectedLevel?.code ?? ""), 10);
        if (Number.isFinite(levelCode) && Number(projectId) > 0) {
            return `${projectId}_L${Math.max(0, levelCode)}`;
        }

        return rawProjectId;
    };

    const parseScenePayload = (payload) => typeof payload === "string" ? JSON.parse(payload) : payload;

    const getCategoryRaw = (category) => category?._raw || category || {};

    const getCategoryKey = (category) => {
        const raw = getCategoryRaw(category);
        const fbx = String(raw?.fbx || raw?.name || "").replace(/\s+/g, "").replace(/\.(fbx|glb|gltf)$/i, "").toLowerCase();
        const categoryId = raw?.category_index || raw?.category_id || raw?.id || raw?.asset_id || raw?.name || fbx;
        return `${String(categoryId).trim().toLowerCase()}::${fbx}`;
    };

    const getAssetInstanceId = (asset) =>
        String(asset?._raw?.instance_id || asset?.instance_id || asset?.instanceId || asset?.id || "");

    const listAssets = (category) => {
        const assets = category?.assets || getCategoryRaw(category)?.assets || [];
        return Array.isArray(assets) ? assets : Object.values(assets || {});
    };

    const assetIsLocalOnly = (asset) => Boolean(asset?.localOnly || asset?._raw?.localOnly);

    const insertOrMergeAsset = (category, asset) => {
        const assetId = getAssetInstanceId(asset);
        if (!assetId) {
            return;
        }

        if (Array.isArray(category.assets)) {
            const existingIndex = category.assets.findIndex((item) => getAssetInstanceId(item) === assetId);
            if (existingIndex >= 0) {
                category.assets[existingIndex] = {
                    ...category.assets[existingIndex],
                    ...asset,
                    fields: {
                        ...(category.assets[existingIndex]?.fields || {}),
                        ...(asset?.fields || {}),
                    },
                };
            } else {
                category.assets.push(asset);
            }
        } else {
            category.assets = category.assets || {};
            const existing = category.assets[assetId];
            category.assets[assetId] = existing
                ? {
                    ...existing,
                    ...asset,
                    fields: {
                        ...(existing?.fields || {}),
                        ...(asset?.fields || {}),
                    },
                }
                : asset;
        }

        const instances = Array.isArray(category.instances) ? category.instances : [];
        category.instances = [...new Set([...instances, assetId])];
    };

    const mergeVisibleSavedAssets = (sceneData) => {
        const liveCategories = Array.isArray(apiData.current?.categories) ? apiData.current.categories : [];
        if (!liveCategories.length) {
            return sceneData;
        }

        const savedCategories = Array.isArray(sceneData?.categories) ? sceneData.categories : [];
        const savedByKey = new Map(savedCategories.map((category) => [getCategoryKey(category), category]));

        for (const liveCategory of liveCategories) {
            if (getCategoryRaw(liveCategory)?.commandOverlay) {
                continue;
            }

            const liveAssets = listAssets(liveCategory).filter((asset) => !assetIsLocalOnly(asset));
            if (!liveAssets.length) {
                continue;
            }

            const categoryKey = getCategoryKey(liveCategory);
            let savedCategory = savedByKey.get(categoryKey);
            if (!savedCategory) {
                savedCategory = {
                    ...getCategoryRaw(liveCategory),
                    assets: Array.isArray(liveCategory.assets) ? [] : {},
                    instances: [],
                };
                savedCategories.push(savedCategory);
                savedByKey.set(categoryKey, savedCategory);
            }

            for (const asset of liveAssets) {
                insertOrMergeAsset(savedCategory, JSON.parse(JSON.stringify(asset)));
            }
        }

        sceneData.categories = savedCategories;
        return sceneData;
    };

    const removeAssetFromCategory = (category, instanceId) => {
        const targetId = String(instanceId);
        const assets = category?.assets;

        if (!assets) {
            return false;
        }

        let removed = false;

        if (Array.isArray(assets)) {
            const nextAssets = assets.filter((asset) => {
                const assetId = String(asset?._raw?.instance_id || asset?.instance_id || asset?.instanceId || asset?.id || "");
                const keep = assetId !== targetId;
                if (!keep) removed = true;
                return keep;
            });
            if (removed) {
                category.assets = nextAssets;
            }
        } else if (Object.prototype.hasOwnProperty.call(assets, targetId)) {
            delete assets[targetId];
            removed = true;
        } else {
            for (const [key, asset] of Object.entries(assets)) {
                const assetId = String(asset?._raw?.instance_id || asset?.instance_id || asset?.instanceId || asset?.id || "");
                if (assetId === targetId) {
                    delete assets[key];
                    removed = true;
                    break;
                }
            }
        }

        if (removed && Array.isArray(category.instances)) {
            category.instances = category.instances.filter((id) => String(id) !== targetId);
        }

        return removed;
    };

    const findAssetInLiveScene = (instanceId) => {
        const targetId = String(instanceId);
        const categories = Array.isArray(apiData.current?.categories) ? apiData.current.categories : [];

        for (const category of categories) {
            const asset = listAssets(category).find((item) => getAssetInstanceId(item) === targetId);
            if (asset) {
                return asset;
            }
        }

        return null;
    };

    const deleteAssetFromLiveScene = (instanceId) => {
        const categories = Array.isArray(apiData.current?.categories) ? apiData.current.categories : [];
        let removed = false;

        // for (const category of categories) {
        //     removed = removeAssetFromCategory(category, instanceId) || removed;
        // }

        if (removed) {
            apiData.current = {
                ...apiData.current,
                categories: categories.filter((category) => listAssets(category).length > 0),
            };
        }

        return removed;
    };

    const deleteAssetFromSavedScene = async (instanceId) => {
        const sceneProjectId = getActiveSceneProjectId();
        if (!sceneProjectId) {
            return { removed: false };
        }

        const directDeleteResponse = await fetch(`${import.meta.env.VITE_API_URL}/project-scene/${encodeURIComponent(sceneProjectId)}/instance/${encodeURIComponent(instanceId)}`, {
            method: "DELETE",
        });
   
        
        if (directDeleteResponse.ok) {
             return { removed: true, sceneProjectId };
        }

        if (directDeleteResponse.status !== 404) {
            const errorPayload = await directDeleteResponse.json().catch(() => ({}));
            throw new Error(errorPayload?.error || `Scene delete failed (${directDeleteResponse.status})`);
        }

        const sceneResponse = await fetch(`${import.meta.env.VITE_API_URL}/project-scene/${sceneProjectId}`, {
            cache: "no-store",
        });

        if (!sceneResponse.ok) {
            return { removed: false };
        }

        const sceneData = mergeVisibleSavedAssets(parseScenePayload(await sceneResponse.json()));
        const categories = Array.isArray(sceneData?.categories) ? sceneData.categories : [];
        // const removed = categories.some((category) => removeAssetFromCategory(category, instanceId));

        if (!removed) {
            return { removed: false };
        }

        const level = String(sceneProjectId).split("_")[1] || "0";
        const saveResponse = await fetch(`${import.meta.env.VITE_API_URL}/save-project-scene`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                projectId: sceneProjectId,
                data: sceneData,
                assetName: null,
                localFields: null,
                level,
                categoryStructure: null,
                skipCommandAppend: true,
            }),
        });

        if (!saveResponse.ok) {
            throw new Error(`Scene delete save failed (${saveResponse.status})`);
        }

        return { removed: true, sceneProjectId };
    };

    const deleteOnlineAsset = async (instanceId, categoryIndex) => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=29&id=${instanceId}&cat_id=${categoryIndex}`
            );

            const result = await response.json();
            if (result.data.response) {
                showMessage("info", "Asset Deleted", result.data.text);
                setDeleteAssetId(0);
            }
        } catch (error) {
            console.error("Error deleting asset:", error);
        }
    };

    const deleteAsset = async (categoryIndex) => {
        setLazyMsg("Deleting asset...");
        setLazy(true);

        try {
            const name = sceneAssets[deleteAssetId]?.name || selectedAssetName;
            const liveAsset = findAssetInLiveScene(deleteAssetId);
            const isTemporarySceneAsset = liveAsset ? assetIsLocalOnly(liveAsset) : false;

            updateSceneAsset(deleteAssetId);
            const removedFromLiveScene = deleteAssetFromLiveScene(deleteAssetId);

            if (removedFromLiveScene && isTemporarySceneAsset) {
                showMessage("info", "Asset Deleted", "Temporary asset deleted from scene");
                setRemovedObject({ name, id: deleteAssetId });
                deleteOnlineAsset(deleteAssetId, categoryIndex);
                return;
            }

            try {
                const sceneDelete = await deleteAssetFromSavedScene(deleteAssetId);
                if (sceneDelete.removed) {
                    showMessage("info", "Asset Deleted", "Asset deleted from saved scene");
                    setRemovedObject({ name, id: deleteAssetId });
                  deleteOnlineAsset(deleteAssetId, categoryIndex);
                    return;
                }
            } catch (error) {
                console.error("Error deleting asset from saved scene:", error);
                showMessage("error", "Delete Failed", error.message || "Could not delete from saved scene");
              deleteOnlineAsset(deleteAssetId, categoryIndex);
                return;
            }

            if (projectId && isNaN(projectId)) {
                const res = await deleteAssetsFromLevel(deleteAssetId)

                if (res.success) {
                    showMessage("info", "Asset Deleted", 'Asset Deleted Successfully');
                    const removedObject = { name, id: deleteAssetId }
                    setRemovedObject(removedObject)
                  deleteOnlineAsset(deleteAssetId, categoryIndex);
                }
                return
            }

            await deleteFieldFromWaterMelon(deleteAssetId, 'assets')
            await deleteFieldFromWaterMelon(deleteAssetId, 'fields')


        } finally {
            clearDeletedAssetSelection();
            setLazy(false);
            setLazyMsg("");
        }
    }
    const confirmDelete = (position, categoryIndex) => {


        const assetName = selectedAssetName || sceneAssets[deleteAssetId]?.name || deleteAssetId;
        confirmDialog({
            closable: false,
            className: 'game-dialog',
            message: `Do you want to delete ${assetName}?`,
            header: 'Delete Confirmation',
            icon: 'pi pi-exclamation-triangle',
            defaultFocus: 'reject',
            // messageClassName: 'game-message',
            acceptLabel: 'YES',
            rejectLabel: 'NO',
            headerClassName: 'game-header',
            acceptClassName: 'p-button-sm game-btn',
            rejectClassName: 'p-button-sm game-btn',
            accept: () => deleteAsset(categoryIndex),
            reject
        });
    };

    useEffect(() => {

        if (!deleteAssetId || deleteAssetId == 614698) {
            return
        }
        const categoryIndex = sceneAssets[deleteAssetId]?.categoryIndex || objects[selectedAssetName]?.categoryIndex

        if (deleteAssetId > 0 && categoryIndex > 0) {
            if (deleteAssetConfirmed) {
                setDeleteAssetConfirmed(false);
                deleteAsset(categoryIndex);
                return;
            }

            confirmDelete('center', categoryIndex);
        }
    }, [deleteAssetConfirmed, deleteAssetId]);

    if (deleteAssetId === 614698 || deleteAssetId === 0) {
        return null
    }

    return (
        <Fragment >
            <ConfirmDialog />
            <Toast ref={toast} key={`toast-`} />

        </Fragment>
    )
}
