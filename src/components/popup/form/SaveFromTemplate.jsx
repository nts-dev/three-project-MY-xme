import { Q } from "@nozbe/watermelondb";
import * as THREE from "three";
import { Vector3 } from "three";
import DB from "../../../threejs/hud/inventory/IndexedDbFactory";
import database from "../../../database";
import { objects, sceneAssets } from "../../../threejs/player/puzzle/character/Constants.jsx";

import useGame from "../../../hooks/useGame";
import {
    DEFAULT_GAME_CATEGORY_INDEX,
    isValidCategoryIndex,
    normalizeAssetCategoryKey,
    rememberCategorySelectionForAsset,
    requestCategorySelection
} from "./categorySelectionRequest";


const SaveFromTemplate = async (templateProps, assetName, instanceId = null, setLazy, setSelectedAssetId, vAlignValue,setLazyMsg, setAssetSelected,setIsEditing) => {

    
    const showSaveLoader = () => {
        setLazyMsg?.("Saving asset please wait...");
        setLazy?.(true);
    };
    const hideSaveLoader = () => {
        setLazy?.(false);
        setLazyMsg?.("");
    };

     const sanitizeToNumber = (value) => {
        const match = String(value).match(/^(\d+)/);
        return match ? Number(match[1]) : NaN;
    };

    if (!templateProps || (!objects[assetName] && !sceneAssets[instanceId])) {
        hideSaveLoader();
        return false
    }
    let { categoryIndex, position, rotation, projectId, textures, color } = templateProps
    const { assetID, halfLength, halfWidth } = objects[assetName] || sceneAssets[instanceId]
    const assetCategoryKey = normalizeAssetCategoryKey(
        templateProps.nameKey,
        templateProps.assetPath,
        templateProps.fbxName,
        templateProps.fileName,
        assetName,
        assetID
    );
    const rawProjectId = String(projectId ?? '').trim();
    const projectID = sanitizeToNumber(projectId);
    if (!assetID) {
        hideSaveLoader();
        return false
    }

    if (!isValidCategoryIndex(categoryIndex)) {
        const latestState = useGame.getState?.() || {};
        const isGameProject = Boolean(latestState.isGame || latestState.isPuzzleGame);
        let selectedCategory = null;
        if (isGameProject) {
            categoryIndex = DEFAULT_GAME_CATEGORY_INDEX;
            templateProps.categoryIndex = categoryIndex;
        } else {
            selectedCategory = await requestCategorySelection({ assetName, currentCategoryIndex: categoryIndex });
            if (!selectedCategory?.categoryIndex) {
                hideSaveLoader();
                return false;
            }

            categoryIndex = selectedCategory.categoryIndex;
            templateProps.categoryIndex = categoryIndex;
        }
        rememberCategorySelectionForAsset(assetCategoryKey, categoryIndex, selectedCategory?.templateId);
        if (sceneAssets[instanceId]) {
            sceneAssets[instanceId].categoryIndex = categoryIndex;
            sceneAssets[instanceId].template_id = selectedCategory?.templateId || sceneAssets[instanceId].template_id;
            sceneAssets[instanceId].categorySelectionAssetKey = assetCategoryKey;
        }
    }
    rememberCategorySelectionForAsset(assetCategoryKey, categoryIndex, templateProps.template_id);
    const BranchCollection = database.collections.get("branches");
    const RoomsCollection = database.collections.get("rooms");
    const templateCollection = database.collections.get("templates");

    const updateFieldsData = async (dragAssetId) => {
        return makeFieldMap(dragAssetId);
    }

    const getSceneKey = () => {
        const raw = rawProjectId;
        if (!raw || raw === '0') {
            return null;
        }

        if (/_L\d+$/i.test(raw)) {
            return raw;
        }

        const selectedLevel = useGame.getState?.()?.selectedLevel;
        const levelCode = Number.parseInt(String(selectedLevel?.code ?? 1), 10);
        const safeLevel = Number.isFinite(levelCode) ? Math.max(0, levelCode) : 1;
        return /^\d+$/.test(raw) ? `${raw}_L${safeLevel}` : raw;
    };

    const getStatusValue = () => {
        return getSceneKey()?.toLowerCase() === '153_l1' ? 'Not in Use' : 'In Use';
    };

    const fieldsArrayToMap = (fields = []) => Object.fromEntries(
        fields
            .filter(({ name }) => name)
            .map(({ name, value }) => [name, value])
    );

    const saveProjectSceneInstance = async ({ id, fields, cPosition, normalRotation }) => {
        const sceneKey = getSceneKey();
        if (!sceneKey || id === undefined || id === null) {
            return;
        }

        const objectData = objects[assetName] || sceneAssets[id] || sceneAssets[instanceId] || {};
        const fileName = objectData.fileName || objectData.fbxName || assetName;
        const fieldMap = fieldsArrayToMap(fields);
        fieldMap.Angle = JSON.stringify(normalRotation);



        const response = await fetch(`${import.meta.env.VITE_API_URL}/project-scene/${encodeURIComponent(sceneKey)}/instance/${encodeURIComponent(id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: fieldMap,
                transform: {
                    position: {
                        x: cPosition.x,
                        y: cPosition.y,
                        z: cPosition.z,
                    },
                    rotation: {
                        x: rotation.x,
                        y: rotation.z,
                        z: rotation.y,
                    },
                    angle: normalRotation.y,
                    scale: {
                        x: objectData.object?.scale?.x ?? 1,
                        y: objectData.object?.scale?.y ?? 1,
                        z: objectData.object?.scale?.z ?? 1,
                    },
                },
                asset: {
                    id,
                    instanceId: id,
                    instance_id: id,
                    assetID,
                    asset_id: assetID,
                    categoryIndex,
                    category_index: categoryIndex,
                    name: assetName,
                    fbxName: fileName,
                },
                category: {
                    id: categoryIndex,
                    category_id: categoryIndex,
                    categoryIndex,
                    category_index: categoryIndex,
                    name: assetName,
                    fbx: fileName,
                    fbxName: fileName,
                    projectId,
                },
                upsert: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to update project scene JSON (${response.status})`);
        }
    };

    const fetchCategoryId = async (id) => {

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/getTemplateId/${id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            return data[0].id

        } catch (error) {
            console.error("Failed to fetch categories:", error);
        }
    };


    const makeFieldMap = async (id) => {

        const templates = await templateCollection
            .query(
                Q.and(
                    Q.where("category_id", categoryIndex.toString())
                )
            )
            .fetch();

        const rooms = await RoomsCollection.query(Q.where("room_id", parseInt(projectId.toString()))).fetch();
        const parentId = rooms[0]?._raw?.parent;
        const branches = await BranchCollection.query(Q.where("branch_id", parseInt(parentId))).fetch();
        const branchData = branches[0]?._raw;


        const cPosition = position.clone().multiplyScalar(100).sub(new Vector3(halfWidth, 0, halfLength));
          

        const normalRotation = new THREE.Vector3(
            0,
            THREE.MathUtils.radToDeg(rotation.y),
            0

        )

       
        const formData = new FormData();
        const indexeDBDataUpdate = []
        const descriptionList = []
        const statusValue = getStatusValue();




        templates.forEach((data) => {
            const fieldName = data._raw.name.replace(/\s+/g, "").trim().toLowerCase();
              
            switch (fieldName) {

                case "branch":
                    formData.append(`form_${data._raw.field_id}`, branchData.branch_id);
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: branchData.branch_id.toString(), name: data._raw.name, description: "" })
                    break;
                case "room":
                    formData.append(`form_${data._raw.field_id}`, projectID.toString());
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: projectID.toString(), name: data._raw.name, description: "" })
                    break;
                case "x-pos":
                    formData.append(`form_${data._raw.field_id}`, cPosition.x.toFixed(1));
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: cPosition.x.toFixed(1), name: data._raw.name, description: "" })
                    break;
                case "y-pos":
                    formData.append(`form_${data._raw.field_id}`, cPosition.z.toFixed(1));
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: cPosition.z.toFixed(1), name: data._raw.name, description: "" })
                    break;
                case "z-pos":
                    formData.append(`form_${data._raw.field_id}`, (parseFloat(cPosition.y) + (vAlignValue > 0 ? parseFloat(vAlignValue) * 100 : 0)).toFixed(1));

                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: (parseFloat(cPosition.y) + (vAlignValue > 0 ? parseFloat(vAlignValue) * 100 : 0)).toFixed(1), name: data._raw.name, description: "" })
                    break;
                case "angle":
                    formData.append(`form_${data._raw.field_id}`, JSON.stringify(normalRotation));
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: JSON.stringify(normalRotation), name: data._raw.name, description: "" })
                    break;
                case "assetid":
                    formData.append(`form_${data._raw.field_id}`, assetID);
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: assetID.toString(), name: data._raw.name, description: "" })
                    break;
                case "status":
                    formData.append(`form_${data._raw.field_id}`, statusValue);
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: statusValue, name: data._raw.name, description: "" })
                    break;
                case "v-align":
                    {
                        const vAlign = vAlignValue === 0.1 ? 'top' : vAlignValue === 0.05 ? 'center' : 'bottom'
                        formData.append(`form_${data._raw.field_id}`, vAlign);
                        indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: vAlign, name: data._raw.name, description: "" })
                        break;
                    }
                case "color":
                    formData.append(`form_${data._raw.field_id}`, color);

                    //console.log({fieldId: data._raw.field_id, value: color,name: data._raw.name, description: ""})
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: color, name: data._raw.name, description: "" })
                    break;
                default:
                    // indexeDBDataUpdate.push({fieldId: data._raw.field_id, value: data._raw.value,name: fieldName})
                    break;
            }
        });



        return updateDbData(
            formData,
            projectID,
            textures,
            indexeDBDataUpdate,
            descriptionList,
            categoryIndex,
            assetName,
            id,
            assetID,
            null,
            setLazy,
            cPosition,
            normalRotation
        )



    };

    const updateDbData = async (formData, projectID, textures, indexeDBDataUpdate, descriptionList, categoryIndex, assetName, id, assetID, assetNameD, setLazy, cPosition, normalRotation) => {
        const templ_id = await fetchCategoryId(categoryIndex)

        if (templ_id > 0) {

            try {
                const response = await fetch(
                    `${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=24&id=${id}&templ_id=${templ_id}&cat_id=${categoryIndex}`,
                    {
                        method: "POST",
                        body: formData,
                    }
                );
                const result = await response.json();

                if (result.data.success) {
                  
                    setAssetSelected(false)
                    setIsEditing(false)
                    useGame.getState?.()?.setHasUnsavedTransformUpdate?.(false)
                    await DB(projectID, textures, indexeDBDataUpdate, descriptionList, [], [], categoryIndex, assetName, id, assetID, assetNameD, null)
                    
                    await saveProjectSceneInstance({
                        id,
                        fields: indexeDBDataUpdate,
                        cPosition,
                        normalRotation,
                    });
                    return { saved: true, id };
                    // showMessage("info", "Fields Saved", result.data.text);

                } else {
                    // showMessage("error", "Error Saving", result.data.text);
                }

            } catch (error) {
                console.error(error)
                // showMessage("error", "Error Saving", "Failed to complete request.");
            }
        }

        return false;
    };



    showSaveLoader();

    try {
        if (instanceId) {
            return await updateFieldsData(instanceId)
        }

        
        try {
            const response = await fetch(`${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=23&id=${categoryIndex}`);


            const result = await response.json();

            if (result.data.response && result.data.newId) {

                const saved = await updateFieldsData(result.data.newId)

                setSelectedAssetId?.(result.data.newId)
                return saved
                    ? { saved: true, id: result.data.newId }
                    : false;
            }
        } catch (error) {
            console.error("Error saving data:", error);
        }

        return false;
    } finally {
        hideSaveLoader();
    }


};
export default SaveFromTemplate
