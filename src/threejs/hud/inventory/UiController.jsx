import React, { useEffect, useRef, useState } from "react";
import useGame from "../../../hooks/useGame";
import { Euler, Vector3 } from "three";
import * as THREE from "three";
import { Q } from "@nozbe/watermelondb";
import { Toast } from "primereact/toast";
import database from "../../../database";
import UpdateAsset from "../../scene/UpdateAsset.jsx";
import { useLongPress } from "@uidotdev/usehooks";

import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import DesignPattern from "./DesignPattern";
import DB from "./IndexedDbFactory";

import { Dropdown } from "primereact/dropdown";
import { objects, sceneAssets } from "../../player/puzzle/character/Constants";
import AssetControllerActions from "./AssetControllerActions";
import AssetDeleteConfirmDialog from "./AssetDeleteConfirmDialog";
import SaveFromTemplate from "../../../components/popup/form/SaveFromTemplate.jsx";
import {
    DEFAULT_GAME_CATEGORY_INDEX,
    getRememberedCategorySelectionForAsset,
    isValidCategoryIndex,
    normalizeAssetCategoryKey,
    rememberCategorySelectionForAsset,
    requestCategorySelection
} from "../../../components/popup/form/categorySelectionRequest";

const normalizeDegrees = (value = 0) => {
    const parsed = Number.parseFloat(value);
    const safeValue = Number.isFinite(parsed) ? parsed : 0;
    return ((safeValue % 360) + 360) % 360;
};

const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const isTemporaryInstanceId = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed <= 0;
};

const getLiveRotation = (targetObject, fallbackRotation) => {
    const source = targetObject?.rotation || fallbackRotation || {};
    return new THREE.Euler(
        toFiniteNumber(source.x),
        toFiniteNumber(source.y),
        toFiniteNumber(source.z),
        source.order || 'XYZ'
    );
};

const serializeRotationDegrees = (rotation, isNew) => JSON.stringify({
    x: normalizeDegrees(0),
    y: normalizeDegrees(THREE.MathUtils.radToDeg(isNew ? rotation.y : rotation.z)),
    z: normalizeDegrees(0),
});

const getSceneKey = (projectId, selectedLevel) => {
    const raw = String(projectId ?? '').trim();
    if (!raw || raw === '0') {
        return null;
    }

    if (/_L\d+$/i.test(raw)) {
        return raw;
    }

    const levelCode = Number.parseInt(String(selectedLevel?.code ?? 1), 10);
    const safeLevel = Number.isFinite(levelCode) ? Math.max(0, levelCode) : 1;
    return /^\d+$/.test(raw) ? `${raw}_L${safeLevel}` : raw;
};

const getStatusValue = (projectId, selectedLevel) => {
    return getSceneKey(projectId, selectedLevel)?.toLowerCase() === '153_l1' ? 'Not in Use' : 'In Use';
};

const updateProjectSceneInstance = async ({ projectId, selectedLevel, instanceId, fields, transform, asset, category }) => {
    const sceneKey = getSceneKey(projectId, selectedLevel);
    if (!sceneKey || instanceId === undefined || instanceId === null) {
        return;
    }

    const response = await fetch(`${import.meta.env.VITE_API_URL}/project-scene/${encodeURIComponent(sceneKey)}/instance/${encodeURIComponent(instanceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, transform, asset, category, upsert: true }),
    });

    if (!response.ok) {
        throw new Error(`Failed to update scene instance ${instanceId}: HTTP ${response.status}`);
    }
};

export default function UiController({ objectData, sceneRef, transformControlsRef, headless = false }) {

    const { object, categoryIndex: initialCategoryIndex, halfWidth, halfLength, assetID, template_id, textures, fbxName } = objectData;

    const dragObjectProperties = useGame((state) => state.dragObjectProperties);
    const setDragObjectProperties = useGame((state) => state.setDragObjectProperties);
    const setIsDragAssetDeleted = useGame((state) => state.setIsDragAssetDeleted);
    const projectID = useGame((state) => state.projectID);
    const selectedLevel = useGame((state) => state.selectedLevel);
    const dragAssetProps = useGame((state) => state.dragAssetProps);
    const setDragAssetProps = useGame((state) => state.setDragAssetProps);
    const BranchCollection = database.collections.get("branches");
    const RoomsCollection = database.collections.get("rooms");
    const templateCollection = database.collections.get("templates");
    const setLazy = useGame((state) => state.setLazy)
    const setLazyMsg = useGame((state) => state.setLazyMsg)
    const [description, setDescription] = useState([])
    const setShowDetails = useGame((state) => state.setShowDetails);
    const setIndexId = useGame((state) => state.setIndexId);
    const setFieldId = useGame((state) => state.setFieldId);
    const selectedGridIds = useGame((state) => state.selectedGridIds);
    const selectedTableIds = useGame((state) => state.selectedTableIds);
    const gridFieldId = useGame((state) => state.gridFieldId);
    const tableFieldId = useGame((state) => state.tableFieldId);
    const setFormValues = useGame((state) => state.setFormValues);
    const setEditAssetId = useGame((state) => state.setEditAssetId);
    const editAssetId = useGame((state) => state.editAssetId);
    const setEditProps = useGame((state) => state.setEditProps);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const updateSelectedEditorTransform = useGame((state) => state.updateSelectedEditorTransform);
    const newSetValue = useRef(0)
    const setDrop = useGame((state) => state.setDrop)
    const setFirstDrop = useGame((state) => state.setFirstDrop)
    const setIsEditing= useGame((state) => state.setIsEditing)
    const setDragObjectProp = useGame((state) => state.setDragObjectProp)
    const [dbTemplateId, setDbTemplateId] = useState(0)
    const categoryIndexRef = useRef(initialCategoryIndex);
    const templateIdRef = useRef(template_id);
    const [categoryIndex, setCategoryIndex] = useState(initialCategoryIndex);

    const [assetName, setAssetName] = useState(assetID)
    const [assetOptions, setAssetOptions] = useState([])
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)
    const setAssetSelected = useGame((state) => state.setAssetSelected);
    const setUnsavedAssetSaveHandler = useGame((state) => state.setUnsavedAssetSaveHandler);
    const setHasUnsavedTransformUpdate = useGame((state) => state.setHasUnsavedTransformUpdate);

    // const[ objectChildren, setObjectChildren] = useState<any>()
    // const selectedDragObject = useGame((state) => state.selectedDragObject)

    const toast = useRef(null);
    const saveDataRef = useRef(null);
    const assetCategoryKey = normalizeAssetCategoryKey(
        objectData?.nameKey,
        objectData?.assetPath,
        fbxName,
        object?.userData?.assetKey,
        object?.userData?.assetPath,
        object?.userData?.name,
        assetID
    );

    useEffect(() => {
        const rememberedCategory = getRememberedCategorySelectionForAsset(assetCategoryKey);
        const nextCategoryIndex = isValidCategoryIndex(initialCategoryIndex)
            ? initialCategoryIndex
            : rememberedCategory?.categoryIndex || 0;
        const nextTemplateId = template_id || rememberedCategory?.templateId || 0;

        categoryIndexRef.current = nextCategoryIndex;
        templateIdRef.current = nextTemplateId;
        setCategoryIndex(nextCategoryIndex);
        setDbTemplateId(nextTemplateId || 0);

        if (isValidCategoryIndex(nextCategoryIndex)) {
            fetchCategoryId(nextCategoryIndex);
        }
    }, [assetCategoryKey, initialCategoryIndex, template_id]);

    useEffect(() => {
        categoryIndexRef.current = categoryIndex;
    }, [categoryIndex]);

    useEffect(() => {
        templateIdRef.current = template_id || dbTemplateId;
    }, [dbTemplateId, template_id]);

    useEffect(() => {
        if (isValidCategoryIndex(categoryIndex)) {
            fetchCategoryId(categoryIndex)
        }
    }, []);

    const applySelectedCategory = (nextCategoryIndex, nextTemplateId = null) => {
        categoryIndexRef.current = nextCategoryIndex;
        templateIdRef.current = nextTemplateId || templateIdRef.current;
        setCategoryIndex(nextCategoryIndex);
        rememberCategorySelectionForAsset(assetCategoryKey, nextCategoryIndex, nextTemplateId);

        if (nextTemplateId) {
            setDbTemplateId(nextTemplateId);
        }

        if (object?.userData) {
            object.userData.categoryIndex = nextCategoryIndex;
            object.userData.template_id = nextTemplateId || object.userData.template_id;
            object.userData.categorySelectionAssetKey = assetCategoryKey;
        }

        object?.children?.forEach?.((child) => {
            if (child?.userData) {
                child.userData.categoryIndex = nextCategoryIndex;
                child.userData.template_id = nextTemplateId || child.userData.template_id;
                child.userData.categorySelectionAssetKey = assetCategoryKey;
            }
        });
    };

    const ensureCategoryForSave = async () => {
        const activeCategoryIndex = categoryIndexRef.current;
        if (isValidCategoryIndex(activeCategoryIndex)) {
            return activeCategoryIndex;
        }

        const latestState = useGame.getState?.() || {};
        const isGameProject = Boolean(latestState.isGame || latestState.isPuzzleGame);
        if (isGameProject) {
            applySelectedCategory(DEFAULT_GAME_CATEGORY_INDEX);
            await fetchCategoryId(DEFAULT_GAME_CATEGORY_INDEX);
            return DEFAULT_GAME_CATEGORY_INDEX;
        }

        const selectedCategory = await requestCategorySelection({
            assetName: fbxName || assetName,
            currentCategoryIndex: activeCategoryIndex,
        });

        if (!selectedCategory?.categoryIndex) {
            showMessage("warn", "Category Required", "Choose a category before saving this asset.");
            return null;
        }

        applySelectedCategory(selectedCategory.categoryIndex, selectedCategory.templateId);

        if (!selectedCategory.templateId) {
            await fetchCategoryId(selectedCategory.categoryIndex);
        }

        return selectedCategory.categoryIndex;
    };



    const updateObjectPosition = (values) => {
        const scaledPosition = new Vector3(values[0], values[1], values[2]);
        object?.position?.set(scaledPosition.x, scaledPosition.y, scaledPosition.z);
        setHasUnsavedTransformUpdate(true);
        setDragObjectProperties(
            {
                position: scaledPosition,
                rotation: dragObjectProperties?.rotation,
                distance: dragObjectProperties?.distance,
                interval: dragObjectProperties?.interval,

            });
    };
    const updateObjectRotation = (values) => {
        const scaledRotation = new Euler(
            values[0],
            values[1],
            values[2]
        );

        const nonEulerRotation = new Vector3(
            values[0],
            values[1],
            values[2]
        )

        object?.rotation?.set(scaledRotation.x, scaledRotation.y, scaledRotation.z);
        setHasUnsavedTransformUpdate(true);
        setDragObjectProperties({
            rotation: nonEulerRotation,
            position: dragObjectProperties?.position,
            distance: dragObjectProperties?.distance,
            interval: dragObjectProperties?.interval,
        });

    };
    const handlePositionInputChange = (axis, value) => {
        const updatedPosition = { ...dragObjectProperties?.position, [axis]: value };

        updateObjectPosition([updatedPosition.x, updatedPosition.y, updatedPosition.z]);
    };
    const handleRotationInputChange = (axis, value) => {
        const scaledRotation = { ...dragObjectProperties?.rotation, [axis]: THREE.MathUtils.degToRad(value) };
        updateObjectRotation([scaledRotation.x ?? dragObjectProperties.rotation.x, scaledRotation.y ?? dragObjectProperties.rotation.y, scaledRotation.z ?? dragObjectProperties.rotation.z]);
    };

    const handleDescriptionInputChange = (name, e) => {
        e.preventDefault()
        const value = e.currentTarget.value
        setDescription((prevDescriptionList) =>
            prevDescriptionList.map((item) =>
                item.name === name ? { ...item, value } : item
            )
        );

    };

    const incrementPosition = (axis, value) => {
        newSetValue.current += value

        const updatedProps = {
            position:
            {
                ...dragObjectProperties.position,
                [axis]: newSetValue.current,
            },
            rotation: dragObjectProperties.rotation,
            distance: dragObjectProperties?.distance,
            interval: dragObjectProperties?.interval,

        };
        setDragObjectProperties(updatedProps)
        setHasUnsavedTransformUpdate(true);
        object?.position?.set(updatedProps.position.x, updatedProps.position.y, updatedProps.position.z);

    };
    const incrementRotation = (axis, value) => {

        newSetValue.current += value
        const updatedProps = {
            position: dragObjectProperties.position,
            rotation: {
                ...dragObjectProperties.rotation,
                [axis]: newSetValue.current,
            },
            distance: dragObjectProperties?.distance,
            interval: dragObjectProperties?.interval,

        };
        setDragObjectProperties(updatedProps)
        setHasUnsavedTransformUpdate(true);

        const scaledRotation = new Euler(
            dragObjectProperties.rotation.x,
            dragObjectProperties.rotation.y,
            dragObjectProperties.rotation.z
        );
        scaledRotation[axis] = newSetValue.current

        object?.rotation?.set(scaledRotation.x, scaledRotation.y, scaledRotation.z);

    }

    const updateFieldsData = async (dragAssetId, index) => {
        await makeFieldMap(dragAssetId, index);
    }

    const getActiveSaveInstanceId = (requestedAssetId = null) => {
        const latestState = useGame.getState();
        const selected = latestState.selectedEditorInstance;
        const selectedObject = selected?.object;
        const selectedId = selected?.instanceId ??
            selectedObject?.userData?.instanceId ??
            selectedObject?.userData?.instance_id ??
            selectedObject?.userData?.device_id;
        const isDroppedSelection = selected?.scenePath === 'dropped-assets' ||
            selectedObject?.userData?.source === 'editor-bottom-dock';

        if (isDroppedSelection && isTemporaryInstanceId(selectedId)) {
            return selectedId;
        }

        return requestedAssetId ?? editAssetId;
    };

    const resetSavedDragAssetProps = () => {
        const latestDragAssetProps = useGame.getState().dragAssetProps || {};

        if (Object.keys(latestDragAssetProps).length > 0) {
            setDragAssetProps({});
        }
    };

    const resetDroppedAssetState = () => {
        setAssetSelected(false);
        setHasUnsavedTransformUpdate(false);
        setIsEditing(false);
        setDrop(false);
        setFirstDrop(false);
        setDragAssetProps({});
        setDragObjectProp(null);
        setDragObjectProperties({ position: {}, rotation: {}, distance: {}, interval: {} });
        setSelectedEditorInstance(null);
        setEditProps({});
        setEditAssetId(0);
        window.dispatchEvent(new CustomEvent('editor-detach-transform-controls'));
    };

    const stampSavedObjectMetadata = (targetObject, savedId) => {
        if (!targetObject || !savedId) {
            return;
        }

        const activeCategoryIndex = categoryIndexRef.current;
        const activeTemplateId = templateIdRef.current || template_id || dbTemplateId;
        const nextUserData = {
            instanceId: savedId,
            instance_id: savedId,
            device_id: savedId,
            id: savedId,
            categoryIndex: activeCategoryIndex,
            category_index: activeCategoryIndex,
            assetID,
            assetId: assetID,
            template_id: activeTemplateId,
            name: fbxName || targetObject.userData?.name || targetObject.name,
            fbxName,
        };

        targetObject.traverse?.((child) => {
            child.userData = {
                ...child.userData,
                ...nextUserData,
            };
        });

        targetObject.userData = {
            ...targetObject.userData,
            ...nextUserData,
        };
    };

    const detachEditorGizmo = () => {
        setDrop(false);
        window.dispatchEvent(new CustomEvent('editor-detach-transform-controls'));

        const controls = transformControlsRef?.current;
        if (!controls) {
            return;
        }

        transformControlsRef.current = null;

        try {
            controls.detach();
        } catch {
            controls.object = undefined;
        }

        controls.object = undefined;

        const helper = controls.getHelper?.();
        helper?.parent?.remove(helper);
        controls.dispose?.();
    };

    const updateDroppedSelectionInstanceId = (temporaryId, savedId, index) => {
        const latestState = useGame.getState();
        const selected = latestState.selectedEditorInstance;
        const selectedObject = selected?.object;
        const isSelectedDrop = selectedObject &&
            String(selected?.instanceId ?? selectedObject.userData?.instanceId ?? '') === String(temporaryId ?? '');
        const targetObject = isSelectedDrop
            ? selectedObject
            : (object?.children?.length > 0 && object.children[index] ? object.children[index] : object);

        if (targetObject?.userData) {
            stampSavedObjectMetadata(targetObject, savedId);
        }

        if (isSelectedDrop && selected) {
            const nextSource = {
                ...(selected.gameObject?.source || {}),
                instanceId: savedId,
                instance_id: savedId,
                apiObject: {
                    ...(selected.apiObject || selected.gameObject?.source?.apiObject || {}),
                    instanceId: savedId,
                    instance_id: savedId,
                    device_id: savedId,
                    id: savedId,
                },
            };
            const nextGameObject = {
                ...selected.gameObject,
                source: nextSource,
            };
            const cleanKey = sceneAssets[savedId]?.cleanKey
            setSelectedEditorInstance({
                ...selected,
                instanceId: savedId,
                object: targetObject,
                gameObject: nextGameObject,
                apiObject: nextSource.apiObject,
                cleanKey
            });
            updateSelectedEditorTransform({
                instanceId: savedId,
                object: targetObject,
                position: targetObject?.position
                    ? { x: targetObject.position.x, y: targetObject.position.y, z: targetObject.position.z }
                    : selected.position,
                rotation: targetObject?.rotation
                    ? { x: targetObject.rotation.x, y: targetObject.rotation.y, z: targetObject.rotation.z }
                    : selected.rotation,
                scale: targetObject?.scale
                    ? { x: targetObject.scale.x, y: targetObject.scale.y, z: targetObject.scale.z }
                    : selected.scale,
            });
        }

        setEditAssetId(savedId);
        setEditProps({
            name: targetObject?.userData?.name || assetName || fbxName,
            position: targetObject?.position?.clone?.() || targetObject?.position,
            angle: targetObject?.rotation?.y || 0,
            obj: targetObject,
            categoryIndex: categoryIndexRef.current,
            assetID,
            template_id: template_id || dbTemplateId,
        });

        return targetObject;
    };


    useEffect(() => {
        if (dragAssetProps) {
            const { dragAssetId, index } = dragAssetProps

            if (dragAssetId > 0 && !dragAssetProps.skipAutoFieldUpdate) {

                if (object.children.length > 0) {
                    object.children[index].userData.instanceId = dragAssetId
                }

                updateFieldsData(dragAssetId, index)
            }

        }
    }, [dragAssetProps]);


    useEffect(() => {
        findDescriptionFields()


    }, [editAssetId, categoryIndex]);


    const findDescriptionFields = async () => {
        if (categoryIndex === undefined || categoryIndex === null || categoryIndex === '') {
            setFormValues([])
            setDescription([])
            return
        }

        const fieldsCollection = database.collections.get('fields');
        const fields = await fieldsCollection.query(Q.where('instance_id', editAssetId), Q.sortBy('field_id', Q.asc)).fetch();

        const fieldsMap = {}

        for (const field of fields) {
            fieldsMap[field._raw.field_id] = field._raw.value
        }

        const templates = await templateCollection
            .query(
                Q.and(
                    Q.where("category_id", categoryIndex.toString()),
                    Q.where("description", "1"),
                )
            )
            .fetch();
        const descriptionList = []

        for (const template of templates) {

            descriptionList.push({
                name: template._raw.name,
                value: fieldsMap[template._raw.field_id],
                fieldId: template._raw.field_id,
                indexId: template._raw.index_id
            })
        }
        setFormValues(descriptionList)
        setDescription(descriptionList)

    }

    const deleteAssetFromDb = async (isBack) => {

        if (isBack) {
            confirmUndo('top', isBack)
        } else {
            confirmDelete('top', isBack)
        }


    };
    const deleteAsset = async (isBack) => {

        const dragAssetId = dragAssetProps?.dragAssetId

        setDrop(false)
        setFirstDrop(false)
        const assetId = dragAssetId || editAssetId

        //console.log("Deleting asset with ID:", assetId, "isBack:", isBack)
        const sceneObject = sceneRef?.current.getObjectByName("sceneObj");
        const isUnsavedDroppedAsset = isTemporaryInstanceId(assetId) || isTemporaryInstanceId(object?.userData?.instanceId);

        try {
            if (isUnsavedDroppedAsset && !isBack) {
                if (object?.parent) {
                    object.parent.remove(object);
                } else {
                    sceneObject?.remove(object);
                }

                if (sceneRef.current && object && transformControlsRef.current) {
                    const controls = transformControlsRef.current;
                    transformControlsRef.current = null;

                    try {
                        controls.detach();
                    } catch {
                        controls.object = undefined;
                    }

                    controls.object = undefined;

                    const helper = controls.getHelper?.();
                    helper?.parent?.remove(helper);
                    controls.dispose?.();
                }

                return;
            }

            if (editAssetId && !isBack) {
                deleteFromScene()
            }

            if (!assetId || !isBack) {

                sceneObject?.remove(object)
            }

            if (sceneRef.current && object && transformControlsRef.current) {
                const controls = transformControlsRef.current;
                transformControlsRef.current = null;

                try {
                    controls.detach();
                } catch {
                    controls.object = undefined;
                }

                controls.object = undefined;

                const helper = controls.getHelper?.();
                helper?.parent?.remove(helper);
                controls.dispose?.();



            }
            if (isBack) {

                // if(dragAssetProps.dragAssetId){
                const dragProp = {
                    ...dragAssetProps,
                    ['dragAssetId']: -1
                }
                setDragAssetProps(dragProp)
                // }
                return
            }

            if (!assetId) return;

            try {
                const response = await fetch(
                    `${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=29&id=${assetId}&cat_id=${categoryIndex}`
                );
                const result = await response.json();
                if (result.data.response) {
                    showMessage("info", "Asset Deleted", result.data.text);
                    setIsDragAssetDeleted(true);
                }
            } catch (error) {
                console.error("Error deleting asset:", error);
            }
        } finally {
            if (!isBack) {
                resetDroppedAssetState();
            }
        }
    }

    const deleteFromScene = () => {
        // if(selectedDragObject){
        //     // console.log(selectedDragObject)
        //     // sceneRef?.current?.remove(selectedDragObject.parent)
        // }

        UpdateAsset(null, editAssetId, null, dragObjectProperties, 0)



        deleteFieldFromWaterMelon(editAssetId, 'assets')
        deleteFieldFromWaterMelon(editAssetId, 'fields')



        // }
    }


    const deleteFieldFromWaterMelon = async (editAssetId, table) => {
        try {
            const fieldsCollection = database.collections.get(table);
            const fields = await fieldsCollection
                .query(Q.where('instance_id', editAssetId))
                .fetch();

            if (fields.length > 0) {
                // Assuming you want to delete all fetched fields
                await database.write(async () => {
                    for (const field of fields) {
                        // await field.markAsDeleted(); // Soft delete
                        // Or use the line below for permanent deletion
                        await field.destroyPermanently();
                    }
                });

                // console.log(`Deleted ${fields.length} fields with instance_id: ${editAssetId}`);
            } else {
                // console.log(`No fields found with instance_id: ${editAssetId}`);
            }
        } catch (error) {
            console.error('Error deleting field:', error);
        }
    };
    const sanitizeToNumber = (value) => {
        const match = String(value).match(/^(\d+)/);
        return match ? Number(match[1]) : NaN;
    };
    const makeFieldMap = async (id, index, isNew) => {
        const latestState = useGame.getState();
        const latestDragObjectProperties = latestState.dragObjectProperties || dragObjectProperties || {};
        const latestSelectedEditorInstance = latestState.selectedEditorInstance;
        const activeCategoryIndex = categoryIndexRef.current;
        const latestSelectedObject = String(latestSelectedEditorInstance?.instanceId ?? '') === String(id ?? '')
            ? latestSelectedEditorInstance?.object
            : null;

        const templates = await templateCollection
            .query(
                Q.and(
                    Q.where("category_id", activeCategoryIndex.toString())
                )
            )
            .fetch();

        const rooms = await RoomsCollection.query(Q.where("room_id", parseInt(projectID.toString()))).fetch();
        const parentId = rooms[0]?._raw?.parent;
        const branches = await BranchCollection.query(Q.where("branch_id", parseInt(parentId))).fetch();
        const branchData = branches[0]?._raw;




        object?.updateMatrixWorld?.(true);
        latestSelectedObject?.updateMatrixWorld?.(true);
        const targetObject = latestSelectedObject || (object?.children?.length > 0 && object.children[index]
            ? object.children[index]
            : object);
        const position = new THREE.Vector3();

        if (targetObject?.getWorldPosition) {
            targetObject.getWorldPosition(position);
        }
        else {
            position.copy(latestDragObjectProperties?.position || new THREE.Vector3());
        }


        const rotation = getLiveRotation(targetObject, latestDragObjectProperties?.rotation);
        const savedRotation = serializeRotationDegrees(rotation, isNew);

        const cPosition = position.clone().multiplyScalar(100).sub(new Vector3(halfWidth, 0, halfLength))

        const normalRotation = new THREE.Vector3(
            normalizeDegrees(THREE.MathUtils.radToDeg(rotation.x)),
            normalizeDegrees(THREE.MathUtils.radToDeg(rotation.y)),
            normalizeDegrees(THREE.MathUtils.radToDeg(rotation.z))

        )

        const formData = new FormData();
        const indexeDBDataUpdate = []
        const descriptionList = []
        const statusValue = getStatusValue(projectID, selectedLevel);

        description.map(({ value, fieldId, name }) => {
            if (!value) {
                return
            }
            const regex = /\[(\d+)\]/; // Matches a number inside square brackets
            const match = value.match(regex);
            let textValue = value;
            if (match) {
                textValue = match[1]; // The captured group (the number inside brackets)
            }
            descriptionList.push(value)
            indexeDBDataUpdate.push({ fieldId: fieldId, value: value, name, description: "1" })
            formData.append(`form_${fieldId}`, textValue);
        })



        templates.forEach((data) => {
            const fieldName = data._raw.name.replace(/\s+/g, "").trim().toLowerCase();

            const projectId = sanitizeToNumber(projectID);
       
            switch (fieldName) {
                case "branch":
                    formData.append(`form_${data._raw.field_id}`, branchData?.branch_id );
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: branchData?.branch_id?.toString(), name: data._raw.name, description: "" })
                    break;
                case "room":
                    formData.append(`form_${data._raw.field_id}`, projectId.toString());
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: projectId.toString(), name: data._raw.name, description: "" })
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
                    formData.append(`form_${data._raw.field_id}`, cPosition.y.toFixed(1));
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: cPosition.y.toFixed(1), name: data._raw.name, description: "" })
                    break;
                case "angle":
                    formData.append(`form_${data._raw.field_id}`, savedRotation);
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: savedRotation, name: data._raw.name, description: "" })
                    break;
                case "assetid":
                    formData.append(`form_${data._raw.field_id}`, assetID);
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: assetID?.toString(), name: data._raw.name, description: "" })
                    break;
                case "status":
                    formData.append(`form_${data._raw.field_id}`, statusValue);
                    indexeDBDataUpdate.push({ fieldId: data._raw.field_id, value: statusValue, name: data._raw.name, description: "" })
                    break;
                default:
                    // indexeDBDataUpdate.push({fieldId: data._raw.field_id, value: data._raw.value,name: fieldName})
                    break;
            }
        });

        await DB(projectID, textures, indexeDBDataUpdate, descriptionList, [], [], activeCategoryIndex, fbxName, id, assetID)
        //
        const saved = await updateDbData(formData, id, index);
        if (saved) {
            const savedAngle = normalizeDegrees(normalRotation.y);
            stampSavedObjectMetadata(targetObject, id);
            sceneAssets[id] = {
                ...(sceneAssets[id] || {}),
                object: targetObject,
                position: targetObject?.position?.clone?.() || position.clone(),
                rotation: targetObject?.rotation?.clone?.() || rotation.clone(),
                scale: targetObject?.scale?.clone?.() || latestDragObjectProperties?.scale || object?.scale?.clone?.(),
                angle: savedAngle,
                fAngle: savedAngle,
                quarternion: targetObject?.quaternion?.clone?.(),
                quart: targetObject?.quaternion?.clone?.(),
                name: fbxName || sceneAssets[id]?.name,
                cleanKey: fbxName || sceneAssets[id]?.cleanKey,
                categoryIndex: activeCategoryIndex,
                assetID,
                fileName: fbxName || sceneAssets[id]?.fileName,
                textures,
                inUse: true,
                halfWidth,
                halfLength,
                halfHeight: targetObject?.userData?.halfHeight || sceneAssets[id]?.halfHeight,
            };
        }

        if (saved && activeCategoryIndex && activeCategoryIndex > 0) {
            const fields = Object.fromEntries(
                indexeDBDataUpdate.map(({ name, value }) => [name, value])
            );
            fields.Angle = savedRotation;

             const fileName = objects[fbxName]?.fileName;
            
            try {
                await updateProjectSceneInstance({
                    projectId: projectID,
                    selectedLevel,
                    instanceId: id,
                    fields,
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
                        angle: normalizeDegrees(normalRotation.z),
                        scale: {
                            x: targetObject?.scale?.x ?? latestDragObjectProperties?.scale?.x ?? object?.scale?.x ?? 1,
                            y: targetObject?.scale?.y ?? latestDragObjectProperties?.scale?.y ?? object?.scale?.y ?? 1,
                            z: targetObject?.scale?.z ?? latestDragObjectProperties?.scale?.z ?? object?.scale?.z ?? 1,
                        },
                    },
                    asset: {
                        id,
                        instanceId: id,
                        instance_id: id,
                        assetID,
                        asset_id: assetID,
                        categoryIndex: activeCategoryIndex,
                        category_index: activeCategoryIndex,
                        name: fbxName,
                        fbxName: fileName || fbxName,
                    },
                    category: {
                        id: activeCategoryIndex,
                        category_id: activeCategoryIndex,
                        categoryIndex: activeCategoryIndex,
                        category_index: activeCategoryIndex,
                        name: fbxName,
                        fbx: fileName || fbxName,
                        fbxName: fileName || fbxName,
                        projectId: projectID,
                    },
                });
            } catch (error) {
                console.error('Failed to update saved project scene:', error);
                showMessage("error", "Scene Save Failed", error.message || "Could not update saved scene JSON");
            }
        }
    };


    const updateDbData = async (formData, id, index) => {

        const activeCategoryIndex = categoryIndexRef.current;
        const templ_id = templateIdRef.current || template_id || dbTemplateId;

        if (templ_id > 0) {

            try {
                const response = await fetch(
                    `${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=24&id=${id}&templ_id=${templ_id}&cat_id=${activeCategoryIndex}`,
                    {
                        method: "POST",
                        body: formData,
                    }
                );
                const result = await response.json();
                if (result.data.success) {
                    showMessage("info", "Fields Saved", result.data.text);
                    const objLength = object.children.length - 1
                    setAssetSelected(false)
                    setHasUnsavedTransformUpdate(false)
                    setIsEditing(false)
                    if (index == objLength || objLength < 0) {
                        if (dragAssetProps.dragAssetId) {
                            const dragProp = {
                                ...dragAssetProps,
                                ['dragAssetId']: null
                            }
                            setDragAssetProps(dragProp)
                        }
                    }


                    if (selectedGridIds.length > 0 && gridFieldId) {
                        updateJoinedFieldValue(templ_id, selectedGridIds, gridFieldId, id.toString())
                    }
                    if (selectedTableIds.length > 0 && tableFieldId) {
                        updateJoinedFieldValue(templ_id, selectedTableIds, tableFieldId, id.toString())
                    }

                    return true;
                } else {
                    showMessage("error", "Error Saving", result.data.text);
                }
            } catch (error) {
                showMessage("error", "Error Saving", error);
            }
        }
        return false;
    };

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

    const fetchCategoryId = async (id) => {

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/getTemplateId/${id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const nextTemplateId = data[0].id;
            templateIdRef.current = nextTemplateId;
            setDbTemplateId(nextTemplateId);
            return nextTemplateId;

        } catch (error) {
            console.error("Failed to fetch categories:", error);
        }

        return null;
    };

    const addToDb = async (data, index, temporaryId = null) => {
        const activeCategoryIndex = categoryIndexRef.current;
        try {
            const response = await fetch(
                `${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=23&id=${activeCategoryIndex}`
            );
            const result = await response.json();

            if (result.data.response && result.data.newId) {
                const savedId = result.data.newId;
                // child.userData.name = fbxName.split('.')[0];
                data.push(savedId);
                // child.userData.instanceId = result.data.newId
                updateDroppedSelectionInstanceId(temporaryId, savedId, index);
                setDragObjectProp({ object, instanceId: savedId, halfWidth, halfLength });

                setDragAssetProps({
                    dragAssetId: savedId,
                    index,
                    objId: objectData.object?.children?.[index]?.id,
                    name: savedId,
                    skipAutoFieldUpdate: true,
                });

                return savedId;
            }
        } catch (error) {
            console.error("Error saving data:", error);
        }

        return null;
    }

    const saveNewAsset = async (data, index, temporaryId) => {
        const savedId = await addToDb(data, index, temporaryId);
        if (!savedId) {
            return null;
        }

        await makeFieldMap(savedId, index, true);
        setFirstDrop(false);
        return savedId;
    };

    const saveData = async (requestedAssetId = null) => {
        const activeCategoryIndex = await ensureCategoryForSave();
        if (!activeCategoryIndex) return;

        const templ_id = templateIdRef.current || template_id || dbTemplateId;

        if (!templ_id) return;
        setLazyMsg("Saving asset...");
        setLazy(true);
        const data = [];
        const activeEditAssetId = getActiveSaveInstanceId(requestedAssetId);
        let savedDroppedAsset = false;
        try {
            if (object.children.length == 0) {

                if (activeEditAssetId > 0) {
                    await makeFieldMap(activeEditAssetId, 0);
                }
                else {
                    savedDroppedAsset = Boolean(await saveNewAsset(data, 0, activeEditAssetId))
                }
                return
            }

            const promises = object.children.map(async (child, index) => {

                if (activeEditAssetId > 0) {
                    await makeFieldMap(activeEditAssetId, index);
                    return false;
                }
                return Boolean(await saveNewAsset(data, index, activeEditAssetId))

            });

            const savedResults = await Promise.all(promises);
            savedDroppedAsset = savedResults.some(Boolean);
            // setObjectChildren(data); // ✅ Now update the state after loop completes
        } finally {
            if (savedDroppedAsset) {
                resetSavedDragAssetProps();
            }
            detachEditorGizmo();
            setLazy(false);
            setLazyMsg("");
        }
    };

    const getVector3Value = (value, fallback = null) => {
        if (value?.isVector3) {
            return value.clone();
        }

        if (value && typeof value === "object") {
            return new THREE.Vector3(
                toFiniteNumber(value.x),
                toFiniteNumber(value.y),
                toFiniteNumber(value.z)
            );
        }

        if (fallback?.isVector3) {
            return fallback.clone();
        }

        if (fallback && typeof fallback === "object") {
            return new THREE.Vector3(
                toFiniteNumber(fallback.x),
                toFiniteNumber(fallback.y),
                toFiniteNumber(fallback.z)
            );
        }

        return fallback;
    };

    const hasRotationYValue = (value) => (
        value && Number.isFinite(Number.parseFloat(value.y))
    );

    const getCurrentTemplateTransform = (latestState, instanceId, sceneAsset, pendingSelection = null) => {
        const selected = pendingSelection?.selectedEditorInstance || latestState.selectedEditorInstance;
        const selectedObject = selected?.object;
        const transformObject = transformControlsRef?.current?.object;
        const objectInstanceId = (target) => (
            target?.userData?.instanceId ??
            target?.userData?.instance_id ??
            target?.userData?.device_id ??
            target?.userData?.id
        );
        const isMatchingObject = (target) => {
            if (!target) return false;
            const targetId = objectInstanceId(target);
            return targetId === undefined || targetId === null || String(targetId) === String(instanceId);
        };
        const liveObject = [transformObject, selectedObject, sceneAsset?.object, object]
            .find((target) => isMatchingObject(target));
        const dragProps = pendingSelection?.dragObjectProperties || latestState.dragObjectProperties || {};

        liveObject?.updateMatrixWorld?.(true);

        const livePosition = new THREE.Vector3();
        if (liveObject?.getWorldPosition) {
            liveObject.getWorldPosition(livePosition);
        }

        const sceneQuaternion = sceneAsset?.quarternion || sceneAsset?.quart;
        const angleValue = typeof sceneAsset?.angle === "object"
            ? sceneAsset.angle?.y
            : sceneAsset?.angle ?? sceneAsset?.fAngle ?? 0;
        const dragRotation = dragProps.rotation;
        const templateRotation = latestState.templateAssetProps?.rotation;
        let rotation = new THREE.Euler(0, THREE.MathUtils.degToRad(Number(angleValue) || 0), 0);

        if (hasRotationYValue(dragRotation)) {
            rotation = new THREE.Euler(0, toFiniteNumber(dragRotation.y), 0);
        } else if (hasRotationYValue(liveObject?.rotation)) {
            rotation = new THREE.Euler(0, toFiniteNumber(liveObject.rotation.y), 0);
        } else if (sceneQuaternion?.isQuaternion) {
            const quaternionRotation = new THREE.Euler().setFromQuaternion(sceneQuaternion);
            rotation = new THREE.Euler(0, quaternionRotation.y, 0);
        } else if (hasRotationYValue(templateRotation)) {
            rotation = new THREE.Euler(0, toFiniteNumber(templateRotation.y), 0);
        }

        return {
            position: liveObject?.getWorldPosition
                ? livePosition
                : getVector3Value(dragProps.position, sceneAsset?.position || pendingSelection?.templateAssetProps?.position || latestState.templateAssetProps?.position),
            rotation,
        };
    };

    const saveTemplateAsset = async (requestedAssetId = null, pendingSelection = null) => {
        const latestState = useGame.getState?.() || {};
        const instanceId = requestedAssetId ?? latestState.selectedAssetId ?? latestState.editAssetId;
        const sceneAsset = sceneAssets[instanceId] || {};
        const assetName =
            sceneAsset.name ||
            pendingSelection?.selectedEditorInstance?.cleanKey ||
            pendingSelection?.selectedEditorInstance?.gameObject?.name ||
            latestState.selectedEditorInstance?.cleanKey ||
            latestState.selectedEditorInstance?.gameObject?.name ||
            latestState.selectedAssetName ||
            pendingSelection?.templateAssetProps?.name ||
            latestState.templateAssetProps?.name;
        const latestTransform = getCurrentTemplateTransform(latestState, instanceId, sceneAsset, pendingSelection);
        const templateProps = {
            ...(latestState.templateAssetProps || {}),
            ...(pendingSelection?.templateAssetProps || {}),
            ...sceneAsset,
            position: latestTransform.position,
            rotation: latestTransform.rotation,
            projectId: pendingSelection?.templateAssetProps?.projectId || latestState.templateAssetProps?.projectId || latestState.projectID,
        };

        return SaveFromTemplate(
            templateProps,
            assetName,
            instanceId,
            latestState.setLazy,
            latestState.setSelectedAssetId,
            latestState.vAlignValue,
            latestState.setLazyMsg,
            latestState.setAssetSelected,
            latestState.setIsEditing
        );
    };

    saveDataRef.current = saveData;

    useEffect(() => {
        const saveSelectedAsset = (requestedAssetId = null, pendingSelection = null) => {
            const latestState = useGame.getState?.() || {};
            const selected = pendingSelection?.selectedEditorInstance || latestState.selectedEditorInstance;
            const selectedObject = selected?.object;
            const isDroppedSelection = selected?.scenePath === 'dropped-assets' ||
                selectedObject?.userData?.source === 'editor-bottom-dock';

            return isDroppedSelection
                ? saveDataRef.current?.(requestedAssetId)
                : saveTemplateAsset(requestedAssetId, pendingSelection);
        };
        setUnsavedAssetSaveHandler(saveSelectedAsset);

        return () => {
            const latestState = useGame.getState?.() || {};
            const hasActiveSelection = Boolean(latestState.selectedEditorInstance?.object || latestState.editAssetId);
            if (!hasActiveSelection && latestState.unsavedAssetSaveHandler === saveSelectedAsset) {
                setUnsavedAssetSaveHandler(null);
            }
        };
    }, [setUnsavedAssetSaveHandler]);

    useEffect(() => {
        const handleEditorDeleteRequest = async (event) => {
            const requestedId = event.detail?.instanceId;
            const activeId = dragAssetProps?.dragAssetId || editAssetId || object?.userData?.instanceId;

            if (
                requestedId !== undefined &&
                requestedId !== null &&
                activeId !== undefined &&
                activeId !== null &&
                String(requestedId) !== String(activeId)
            ) {
                return;
            }

            await deleteAsset(false);
            window.dispatchEvent(new CustomEvent('editor-delete-selected-asset-complete', {
                detail: {
                    instanceId: requestedId ?? activeId,
                },
            }));
        };

        window.addEventListener('editor-delete-selected-asset', handleEditorDeleteRequest);
        return () => window.removeEventListener('editor-delete-selected-asset', handleEditorDeleteRequest);
    }, [deleteAsset, dragAssetProps?.dragAssetId, editAssetId, object]);

    const updateJoinedFieldValue = async (template_id, nValues, fieldId, dragAssetId) => {
        const formData = new FormData();
        formData.append(`field_id`, fieldId);
        formData.append(`nValue`, nValues);
        formData.append(`device_id`, dragAssetId);
        formData.append(`templ_id`, template_id);

        try {
            await fetch(
                `${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=51`, {
                method: 'POST',
                body: formData,
            });


        } catch (error) {
            console.error('Error updating field:', error);
        }
    }

    const infoButtonClicked = (indexId, fieldId) => {
        if (!indexId) {
            return
        }
        setShowDetails(true)
        setFieldId(fieldId)
        setIndexId(indexId)

    }

    const copyAsset = () => {
        const sceneObject = sceneRef?.current.getObjectByName("sceneObj");
        if (object && sceneObject) {
            const copyObj = object.clone()
            copyObj.position.add(new THREE.Vector3(1, 0, 1));
            sceneObject.add(copyObj)

        }


    }

    const getDeleteAssetName = () => {
        if (assetName) {
            return assetName;
        }

        if (editAssetId && sceneAssets[editAssetId]?.name) {
            return sceneAssets[editAssetId].name;
        }

        return editAssetId || dragAssetProps?.dragAssetId || assetID;
    }

    const requestDeleteAsset = () => {
        setDeleteConfirmVisible(true);
    }

    const cancelDeleteAsset = () => {
        setDeleteConfirmVisible(false);
    }

    const confirmDeleteAsset = () => {
        setDeleteConfirmVisible(false);
        accept(false);
    }

    const useProgressiveLongPress = (axis, incrementValue, isRotation) => {

        const [intervalId, setIntervalId] = useState(null);
        const startIncrement = () => {
            const id = setInterval(() => {

                if (isRotation) {
                    incrementRotation(axis, incrementValue)
                } else {
                    incrementPosition(axis, incrementValue); // Increment position progressively
                }

            }, 5); // Adjust interval time as needed
            setIntervalId(id);
        };

        const stopIncrement = () => {
            if (intervalId) {
                clearInterval(intervalId);
                setIntervalId(null);
            }
        };

        return useLongPress(
            () => {
            }, // No action here as we handle it in onStart
            {
                onStart: startIncrement,
                onFinish: stopIncrement,
                onCancel: stopIncrement,
                threshold: 500, // Delay before starting the long press
            }
        );
    };

    const longPressAttrs = {
        xMinus: useProgressiveLongPress("x", -0.01, false), // Decrement x progressively
        xPlus: useProgressiveLongPress("x", 0.01, false),  // Increment x progressively
        yMinus: useProgressiveLongPress("y", -0.01, false), // Decrement y progressively
        yPlus: useProgressiveLongPress("y", 0.01, false),  // Increment y progressively
        zMinus: useProgressiveLongPress("z", -0.01, false), // Decrement z progressively
        zPlus: useProgressiveLongPress("z", 0.01, false),  // Increment z progressively


        xRminus: useProgressiveLongPress("x", -0.01, true), // Decrement x progressively
        xRplus: useProgressiveLongPress("x", 0.01, true),  // Increment x progressively
        yRminus: useProgressiveLongPress("y", -0.01, true), // Decrement y progressively
        yRplus: useProgressiveLongPress("y", 0.01, true),  // Increment y progressively
        zRminus: useProgressiveLongPress("z", -0.01, true), // Decrement z progressively
        zRplus: useProgressiveLongPress("z", 0.01, true),  // Increment z progressively

        // rotationMinus: useProgressiveLongPress("rotationMinus", -0.01),  // Increment z progressively
        // rotationPlus: useProgressiveLongPress("rotationPlus", 0.01),  // Increment z progressively
    };
    const accept = (isBack) => {
        // toast.current?.show({ severity: 'info', summary: 'Confirmed', detail: 'You have accepted', life: 3000 });
        deleteAsset(isBack)
    }

    const reject = () => {
        toast.current?.show({ severity: 'warn', summary: 'Rejected', detail: 'You have rejected', life: 3000 });
    }

    const confirmUndo = (position, isBack) => {

        confirmDialog({
            message: 'Are you sure you want to undo?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            defaultFocus: 'accept',
            position,
            accept: () => accept(isBack),
            reject
        });
    };

    const confirmDelete = (position, isBack) => {
        confirmDialog({
            message: 'Do you want to delete this Asset?',
            header: 'Delete Confirmation',
            icon: 'pi pi-info-circle',
            defaultFocus: 'reject',
            acceptClassName: 'p-button-danger',
            position,
            accept: () => accept(isBack),
            reject
        });
    };

    useEffect(() => {
        const options = []
        for (const i in objects) {
            const asset = objects[i]
            if (asset.assetID == assetID) {
                setAssetName(i)
            }
            options.push(i)
        }
        setAssetOptions(options)

    }, []);


    const onAssetChange = (e) => {
        setAssetName(e.value)

    }

    if (headless) {
        return <Toast ref={toast} key={`toast-${assetID}-headless`} />;
    }

    return (
        <div key={assetID}>
            <Toast ref={toast} key={`toast-${assetID}`} />
            <div
                className="custom-overlay"
            >
                <div className="icon-field-container">
                    <Dropdown
                        value={assetName}
                        options={assetOptions}
                        onChange={onAssetChange}
                        placeholder="Select AssetID"
                        className="w-full asset-dropdown"
                    />
                </div>
                {(description.length !== 0) && <span className="asset-controller-header">Description</span>}
                {description.map(({ name, value, indexId, fieldId }, idx) => (
                    <div key={`description-${fieldId || idx}`} className="icon-field-container">
                        <span className="p-inputgroup-addon">{name}</span>
                        <div className="edit-field">
                            <input
                                key={`input-${fieldId || idx}`}
                                type="text"
                                className="input-text"
                                value={value}
                                readOnly={!!indexId}
                                onClick={() => infoButtonClicked(indexId, fieldId)}
                                onChange={(e) => handleDescriptionInputChange(name, e)}
                            />
                            {indexId && (
                                <div className="icon-container">
                                    <i
                                        className="pi pi-info-circle"
                                        onClick={() => infoButtonClicked(indexId, fieldId)}
                                    ></i>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Position Controls */}
                <span className="asset-controller-header">Position</span>


                {["x", "z", "y"].map((axis, idx) => (
                    <div key={`position-${axis}-${idx}`} className="icon-field-container">
                        <span className="p-inputgroup-addon">
                            {axis === "y" ? "Z" : axis === "z" ? "Y" : axis.toUpperCase()}
                        </span>
                        <div className="edit-field">
                            <i
                                className="pi pi-minus pointer"
                                onPointerDown={() => {
                                    newSetValue.current = dragObjectProperties.position[axis]


                                    incrementPosition(axis, -0.01)

                                }} // Regular click
                                {...longPressAttrs[`${axis}Minus`]} // Long press for decrement
                            ></i>
                            <input
                                key={`position-input-${axis}-${idx}`}
                                type="text"
                                className="input-text p-input-text"
                                value={parseFloat(String(dragObjectProperties?.position[axis] * 100)).toFixed(2)}
                                onChange={(e) =>
                                    handlePositionInputChange(axis, parseFloat(e.target.value) / 100 || 0)
                                }
                            />
                            <i
                                className="pi pi-plus pointer"
                                onPointerDown={() => {
                                    newSetValue.current = dragObjectProperties.position[axis]
                                    incrementPosition(axis, 0.01)

                                }} // Regular click
                                {...longPressAttrs[`${axis}Plus`]} // Long press for increment
                            ></i>
                        </div>
                    </div>
                ))}
                {/* Rotation Controls */}
                <span className="asset-controller-header">Rotation</span>

                <div key="rotation-y" className="icon-field-container">
                    <span className="p-inputgroup-addon">Y</span>
                    <div className="edit-field">
                        <i
                            className="pi pi-minus pointer"
                            onPointerDown={() => {
                                newSetValue.current = dragObjectProperties.rotation.y
                                incrementRotation("y", -0.01)
                            }}
                            {...longPressAttrs.yRminus}
                        ></i>
                        <input
                            key="rotation-input-y"
                            type="text"
                            className="input-text p-input-text"
                            value={parseFloat(String(THREE.MathUtils.radToDeg(dragObjectProperties.rotation.y))).toFixed(1)}
                            onChange={(e) => handleRotationInputChange("y", parseFloat(e.currentTarget.value) || 0)}
                        />
                        <i
                            className="pi pi-plus pointer"
                            onPointerDown={() => {
                                newSetValue.current = dragObjectProperties.rotation.y
                                incrementRotation("y", 0.01)
                            }}
                            {...longPressAttrs.yRplus}
                        ></i>
                    </div>
                </div>
                <DesignPattern />
                <ConfirmDialog />
                <AssetControllerActions
                    onUndo={() => deleteAssetFromDb(true)}
                    onCopy={copyAsset}
                    onSave={saveData}
                    onDelete={requestDeleteAsset}
                />
                <AssetDeleteConfirmDialog
                    visible={deleteConfirmVisible}
                    assetName={getDeleteAssetName()}
                    onConfirm={confirmDeleteAsset}
                    onCancel={cancelDeleteAsset}
                />

            </div>
            {/*)}*/}
        </div>
    );

}
;

