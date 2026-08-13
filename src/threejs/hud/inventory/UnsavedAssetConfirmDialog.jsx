import React, { useCallback, useEffect, useRef } from "react";
import { Button } from "primereact/button";
import * as THREE from "three";
import useGame from "../../../hooks/useGame";
import SaveFromTemplate from "../../../components/popup/form/SaveFromTemplate.jsx";
import { sceneAssets } from "../../player/puzzle/character/Constants.jsx";

const getCurrentAssetId = () => {
    const state = useGame.getState?.() || {};
    return state.selectedAssetId || state.editAssetId;
};

const saveExistingTemplateAsset = async (requestedAssetId = null) => {
    const state = useGame.getState?.() || {};
    const instanceId = requestedAssetId ?? state.selectedAssetId ?? state.editAssetId;
    const sceneAsset = sceneAssets[instanceId];

    if (!sceneAsset) {
        console.warn("Unsaved asset save handler is not registered.");
        return false;
    }

    const selected = state.selectedEditorInstance || {};
    const dragProps = state.dragObjectProperties || {};
    const angleValue = typeof sceneAsset.angle === "object"
        ? sceneAsset.angle?.y
        : sceneAsset.angle ?? sceneAsset.fAngle ?? 0;
    const sceneQuaternion = sceneAsset.quarternion || sceneAsset.quart;
    const dragRotation = dragProps.rotation;
    const assetName =
        sceneAsset.name ||
        selected.cleanKey ||
        selected.gameObject?.name ||
        state.selectedAssetName ||
        state.templateAssetProps?.name;
    const templateProps = {
        ...(state.templateAssetProps || {}),
        ...sceneAsset,
        position: dragProps.position?.isVector3
            ? dragProps.position
            : sceneAsset.position || state.templateAssetProps?.position,
        rotation: dragRotation?.isEuler || dragRotation?.isVector3
            ? dragRotation
            : sceneQuaternion?.isQuaternion
                ? new THREE.Euler().setFromQuaternion(sceneQuaternion)
                : state.templateAssetProps?.rotation || new THREE.Euler(0, THREE.MathUtils.degToRad(Number(angleValue) || 0), 0),
        projectId: state.templateAssetProps?.projectId || state.projectID,
    };

    return SaveFromTemplate(
        templateProps,
        assetName,
        instanceId,
        state.setLazy,
        state.setSelectedAssetId,
        state.vAlignValue,
        state.setLazyMsg,
        state.setAssetSelected,
        state.setIsEditing
    );
};

export default function UnsavedAssetConfirmDialog() {
    const assetSelected = useGame((state) => state.assetSelected);
    const hasUnsavedTransformUpdate = useGame((state) => state.hasUnsavedTransformUpdate);
    const unsavedAssetSaveHandler = useGame((state) => state.unsavedAssetSaveHandler);
    const setAssetSelected = useGame((state) => state.setAssetSelected);
    const setHasUnsavedTransformUpdate = useGame((state) => state.setHasUnsavedTransformUpdate);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const setEditAssetId = useGame((state) => state.setEditAssetId);
    const setSelectedAssetId = useGame((state) => state.setSelectedAssetId);
    const setDrop = useGame((state) => state.setDrop);
    const pendingSelectionRef = useRef(null);

    useEffect(() => {
        if (!assetSelected || !hasUnsavedTransformUpdate) {
            pendingSelectionRef.current = null;
            return;
        }

        const state = useGame.getState?.() || {};
        const instanceId = getCurrentAssetId();
        pendingSelectionRef.current = {
            instanceId,
            selectedEditorInstance: state.selectedEditorInstance,
            dragObjectProperties: state.dragObjectProperties,
            templateAssetProps: state.templateAssetProps,
        };
    }, [assetSelected, hasUnsavedTransformUpdate]);

    useEffect(() => {
        if (assetSelected && !hasUnsavedTransformUpdate) {
            setAssetSelected(false);
        }
    }, [assetSelected, hasUnsavedTransformUpdate, setAssetSelected]);

    const hideDialog = useCallback(() => {
        setAssetSelected(false);
        setHasUnsavedTransformUpdate(false);
        setSelectedEditorInstance(null);
        setEditAssetId(0);
        setSelectedAssetId(0);
        setDrop(false);
        window.dispatchEvent(new CustomEvent('editor-detach-transform-controls'));
    }, [setAssetSelected, setDrop, setEditAssetId, setHasUnsavedTransformUpdate, setSelectedAssetId, setSelectedEditorInstance]);

    const handleSave = useCallback(async () => {
        try {
            const pendingSelection = pendingSelectionRef.current;
            const currentAssetId = pendingSelection?.instanceId ?? getCurrentAssetId();
            const saved = typeof unsavedAssetSaveHandler === "function"
                ? await unsavedAssetSaveHandler(currentAssetId, pendingSelection)
                : await saveExistingTemplateAsset(currentAssetId);

            if (saved !== false) {
                setAssetSelected(false);
                setHasUnsavedTransformUpdate(false);
            }
        } catch (error) {
            console.warn("Unsaved asset save failed:", error);
        }
    }, [setAssetSelected, setHasUnsavedTransformUpdate, unsavedAssetSaveHandler]);

    if (!assetSelected || !hasUnsavedTransformUpdate) {
        return null;
    }

    return (
        <div
            className="asset-delete-dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => event.stopPropagation()}
        >
            <section
                className="asset-delete-dialog asset-unsaved-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="unsaved-asset-dialog-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="asset-delete-dialog-header">
                    <i className="pi pi-exclamation-triangle" aria-hidden="true" />
                    <h2 id="unsaved-asset-dialog-title">Save Asset</h2>
                </header>

                <p className="asset-delete-dialog-message">
                    The selected asset has not been saved. Save it before continuing, or discard the current selection.
                </p>

                <footer className="asset-delete-dialog-actions">
                    <Button
                        type="button"
                        label="Cancel"
                        icon="pi pi-times"
                        className="asset-delete-dialog-button is-delete"
                        onClick={hideDialog}
                    />
                    {/* <Button
                        type="button"
                        label="Discard"
                        icon="pi pi-trash"
                        className="asset-delete-dialog-button is-delete"
                        onClick={hideDialog}
                    /> */}
                    <Button
                        type="button"
                        label="Save"
                        icon="pi pi-save"
                        className="asset-delete-dialog-button is-cancel"
                        onClick={handleSave}
                        autoFocus
                    />
                </footer>
            </section>
        </div>
    );
}
