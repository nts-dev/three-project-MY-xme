import { createPortal } from "react-dom";
import "./AvatarLoadingOverlay.css";

const AVATAR_LOADING_ROOT_ID = "avatar-loading-hud-root";

function getAvatarLoadingRoot() {
    let root = document.getElementById(AVATAR_LOADING_ROOT_ID);

    if (!root) {
        root = document.createElement("div");
        root.id = AVATAR_LOADING_ROOT_ID;
        root.className = "avatar-loading-hud-root";
        document.body.appendChild(root);
    }

    return root;
}

export default function AvatarLoadingOverlay() {
    if (typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div className="avatar-loading-overlay" aria-live="polite" role="status">
            <div className="avatar-loading-panel">
                <span className="avatar-loading-panel__dot" aria-hidden="true" />
                <div className="avatar-loading-panel__title">PLAYER AVATAR</div>
                <div className="avatar-loading-panel__text">Applying selected color...</div>
                <div className="avatar-loading-ring" aria-hidden="true">
                    <span className="avatar-loading-ring__track avatar-loading-ring__track--outer" />
                    <span className="avatar-loading-ring__track avatar-loading-ring__track--inner" />
                </div>
            </div>
        </div>,
        getAvatarLoadingRoot()
    );
}
