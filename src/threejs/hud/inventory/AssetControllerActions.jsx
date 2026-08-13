import React from "react";
import { Button } from "primereact/button";

export default function AssetControllerActions({
    onUndo,
    onCopy,
    onSave,
    onDelete,
}) {
    return (
        <div className="asset-controller-actions">
            <Button
                icon="pi pi-arrow-circle-left"
                className="asset-controller-action-button"
                onClick={onUndo}
                tooltip="Undo Select"
                key="undo-select"
            />
            <Button
                icon="pi pi-clipboard"
                className="asset-controller-action-button"
                onClick={onCopy}
                tooltip="Copy Asset"
                key="copy-asset"
            />
            <Button
                icon="pi pi-save"
                className="asset-controller-action-button"
                onClick={onSave}
                tooltip="Save Asset"
                key="save-asset"
            />
            <Button
                icon="pi pi-trash"
                className="asset-controller-action-button is-danger"
                onClick={onDelete}
                tooltip="Delete Asset"
                key="delete-asset"
            />
        </div>
    );
}
