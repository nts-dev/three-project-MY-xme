import React from "react";
import "./SystemBuilderPopup.css";

const DEFAULT_SYSTEM_BUILDER_ID = 599;
const DEFAULT_SYSTEM_BUILDER_ORIGIN = "https://react.nts.nl/nts-site";

const getSystemBuilderOrigin = () => (
    DEFAULT_SYSTEM_BUILDER_ORIGIN
);

const getSystemBuilderUrl = (systemId) => {
    const origin = getSystemBuilderOrigin().replace(/\/$/, "");
    return `${origin}/nl/system-builder/system/${systemId || DEFAULT_SYSTEM_BUILDER_ID}/`;
};

function SystemBuilderHeader({ systemId, onClose }) {
    return (
        <header className="system-builder-popup__header">
            <div>
                <span className="system-builder-popup__eyebrow">System Builder</span>
                <strong>System {systemId || DEFAULT_SYSTEM_BUILDER_ID}</strong>
            </div>
            <button type="button" onClick={onClose} aria-label="Close system builder">
                x
            </button>
        </header>
    );
}

function SystemBuilderFrame({ systemId }) {
    return (
        <iframe
            className="system-builder-popup__frame"
            src={getSystemBuilderUrl(systemId)}
            title="System Builder"
            loading="lazy"
        />
    );
}

export default function SystemBuilderPopup({ visible, systemId = DEFAULT_SYSTEM_BUILDER_ID, onClose }) {
    if (!visible) return null;

    return (
        <div className="system-builder-popup" role="dialog" aria-modal="true" aria-label="System Builder">
            <div className="system-builder-popup__backdrop" onClick={onClose} />
            <section className="system-builder-popup__panel">
                <SystemBuilderHeader systemId={systemId} onClose={onClose} />
                <SystemBuilderFrame systemId={systemId} />
            </section>
        </div>
    );
}
