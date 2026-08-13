import React from "react";
import { Button } from "primereact/button";

export default function AssetDeleteConfirmDialog({
    visible,
    assetName,
    onConfirm,
    onCancel,
}) {
    if (!visible) {
        return null;
    }

    return (
        <div className="asset-delete-dialog-backdrop" role="presentation" onMouseDown={onCancel}>
            <section
                className="asset-delete-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="asset-delete-dialog-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="asset-delete-dialog-header">
                    <i className="pi pi-exclamation-triangle" aria-hidden="true" />
                    <h2 id="asset-delete-dialog-title">Delete Asset</h2>
                </header>

                <p className="asset-delete-dialog-message">
                    Delete {assetName || "this asset"} from the scene?
                </p>

                <footer className="asset-delete-dialog-actions">
                    <Button
                        type="button"
                        label="Cancel"
                        icon="pi pi-times"
                        className="asset-delete-dialog-button is-cancel"
                        onClick={onCancel}
                    />
                    <Button
                        type="button"
                        label="Delete"
                        icon="pi pi-trash"
                        className="asset-delete-dialog-button is-delete"
                        onClick={onConfirm}
                        autoFocus
                    />
                </footer>
            </section>
        </div>
    );
}
