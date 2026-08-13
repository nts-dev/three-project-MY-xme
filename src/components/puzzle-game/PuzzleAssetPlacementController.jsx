import { useEffect } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame";
import SaveFromTemplate from "../popup/form/SaveFromTemplate";
import { objects, sceneAssets } from "../../threejs/player/puzzle/character/Constants.jsx";

const extractNumber = (str) => String(str || "").match(/^\d+/)?.[0];

const normalizeSavedResult = (result, fallbackId = null) => {
    if (result === false) return null;
    if (result && typeof result === "object") {
        return result.id ?? result.newId ?? result.instanceId ?? fallbackId;
    }

    return fallbackId;
};

const Z_ROTATION_AXIS = new THREE.Vector3(0, 0, 1);

export default function PuzzleAssetPlacementController({ scene }) {
    const {
        selectedAssetName,
        templateAssetProps,
        projectID,
        defaultInstanceId,
        scannedId,
        setLazy,
        setRemovedObject,
        rotationValue,
        setSelectedAssetId,
        setAssetClone,
        setSelectedCatId,
        selectedCatId,
        apiData,
        setApiData,
        setLazyMsg,
        setAssetSelected,
        setIsEditing,
        setSelectedEditorInstance,
        setSelectedDragObject,
        setEditAssetId
    } = useGame((state) => state);

    const cloneAsset = (name, position, id, oldName, vAlignValue) => {
        const asset = objects[name];
        const { object, scale, catId } = asset || {};

        if (!scale || !object || !scene) return;

        const cloneObject = object.clone(true);

        const newPos = position.clone();
        newPos.y += ((vAlignValue || 0) - (cloneObject.userData.vAlignValue || 0));

        cloneObject.position.copy(newPos);
        // cloneObject.rotation.set(0, 0, 0);
        cloneObject.children.length > 0 ? cloneObject.children[0].scale.set(scale.x, scale.y, scale.z) : cloneObject.scale.set(scale.x, scale.y, scale.z);
        cloneObject.userData.rotationValue = rotationValue || 0;
        cloneObject.userData.catId = catId || 0;
        cloneObject.userData.vAlignValue = vAlignValue || 0;


        if (oldName && id && id > 0) {
            setRemovedObject({ name: oldName, id });
        }

        return cloneObject;
    };

    const applyUiYRotationToCloneZ = (object, props) => {
        if (!object) return 0;

        const uiYRotation = props?.rotation?.y ?? object.rotation.y ?? 0;
        object.rotation.set(object.rotation.x || 0, 0, uiYRotation);
        object.updateMatrix?.();
        object.updateMatrixWorld?.(true);

        return THREE.MathUtils.radToDeg(uiYRotation || 0);
    };

    const clearSavedAssetSelection = () => {
        setAssetSelected?.(false);
        setIsEditing?.(false);
        setSelectedDragObject?.(null);
        setSelectedEditorInstance?.(null);
        setEditAssetId?.(0);
        window.dispatchEvent(new CustomEvent("editor-detach-transform-controls"));
    };

    const publishSavedClone = (instanceId, object) => {
        if (!instanceId || !object) return;

        setSelectedAssetId?.(instanceId);
        setAssetClone(object);
    };

    const registerSavedAsset = (instanceId, assetName, props, vAlignValue, object) => {
        if (!instanceId || !assetName) return;

        if (!object) return;

        const asset = objects[assetName] || {};
        const zAxisAngle = applyUiYRotationToCloneZ(object, props);
        object.userData = {
            ...object.userData,
            instanceId,
            instance_id: instanceId,
            device_id: instanceId,
            originalId: instanceId,
            name: assetName,
            assetKey: assetName,
            assetID: asset.assetID,
            assetId: asset.assetID,
            categoryIndex: props?.categoryIndex || asset.categoryIndex,
            template_id: asset.template_id,
            vAlignValue,
            axis: Z_ROTATION_AXIS,
            angle: zAxisAngle,
        };

        sceneAssets[instanceId] = {
            ...(sceneAssets[instanceId] || {}),
            position: object.position.clone(),
            rotation: object.rotation.clone(),
            scale: object.scale.clone(),
            angle: zAxisAngle,
            fAngle: zAxisAngle,
            quarternion: object.quaternion.clone(),
            quart: object.quaternion.clone(),
            object,
            instance: sceneAssets[instanceId]?.instance || null,
            index: sceneAssets[instanceId]?.index || 0,
            axis: Z_ROTATION_AXIS,
            name: assetName,
            cleanKey: assetName,
            vAlignValue,
            categoryIndex: props?.categoryIndex || asset.categoryIndex,
            inUse: true,
            halfHeight: asset.halfHeight ?? sceneAssets[instanceId]?.halfHeight,
            halfLength: asset.halfLength ?? sceneAssets[instanceId]?.halfLength,
            halfWidth: asset.halfWidth ?? sceneAssets[instanceId]?.halfWidth,
            assetID: asset.assetID,
            fileName: asset.fileName,
            textures: asset.textures || sceneAssets[instanceId]?.textures || [],
        };

        return object;
    };

    useEffect(() => {
        const { position, vAlignValue } = templateAssetProps || {};
       
        if (!position || !selectedAssetName) return;
        
        const obj = cloneAsset(selectedAssetName, position, null, null, vAlignValue);
        SaveFromTemplate(
            templateAssetProps,
            selectedAssetName,
            null,
            setLazy,
            setSelectedAssetId,
            vAlignValue,
            setLazyMsg,
            setAssetSelected,
            setIsEditing
        ).then((result) => {
            const instanceId = normalizeSavedResult(result);
            const savedObject = registerSavedAsset(instanceId, selectedAssetName, templateAssetProps, vAlignValue, obj);
            if (savedObject) {
                publishSavedClone(instanceId, savedObject);
            }
            clearSavedAssetSelection();
        });
    }, [templateAssetProps]);

    useEffect(() => {
        if (!scannedId || !selectedAssetName || selectedAssetName.includes("platform")) return;

        const id = parseInt(extractNumber(scannedId), 10);
        const asset = objects[selectedAssetName];

        if (!asset || !asset.assetID || [0, 8725, 8743].includes(asset.assetID) || id === defaultInstanceId) {
            return;
        }

        const sourceAsset = sceneAssets[id];
        if (!sourceAsset) return;

        setLazy(true);
        const { position, categoryIndex, name, vAlignValue, angle } = sourceAsset;
        const obj = cloneAsset(selectedAssetName, position, id, name, vAlignValue);

        const props = {
            categoryIndex,
            position,
            rotation: new THREE.Euler(0, THREE.MathUtils.degToRad(angle || 0), 0),
            projectId: projectID,
            textures: [],
        };

        SaveFromTemplate(
            props,
            selectedAssetName,
            id,
            setLazy,
            setSelectedAssetId,
            vAlignValue,
            setLazyMsg,
            setAssetSelected,
            setIsEditing
        ).then((result) => {
            const instanceId = normalizeSavedResult(result, id);
            const savedObject = registerSavedAsset(instanceId, selectedAssetName, props, vAlignValue, obj);
            if (savedObject) {
                publishSavedClone(instanceId, savedObject);
            }
            clearSavedAssetSelection();
        });
    }, [scannedId]);

    return null;
}
