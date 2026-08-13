import React from "react";
import { FiBox, FiEye, FiMaximize2, FiRefreshCcw } from "react-icons/fi";
import { getProductImage } from "./systemBuilderUtils";

const FALLBACK_IMAGE = "https://www.nts.nl/view/images/not-available-small.jpg";

export default function SystemBuilderNativePreview({ detail, product }) {
    const imageUrl = getProductImage(product, detail?.img || FALLBACK_IMAGE);

    return (
        <aside className="sb-native-preview">
            <header>
                <div>
                    <FiBox />
                    <strong>System builder</strong>
                </div>
                <button type="button"><FiRefreshCcw /> Reset</button>
            </header>
            <div className="sb-native-preview__toolbar">
                <button type="button"><FiEye /> Show Foam</button>
                <button type="button"><FiBox /> Show Box</button>
                <button type="button" aria-label="Expand"><FiMaximize2 /></button>
            </div>
            <div className="sb-native-preview__image">
                <img src={imageUrl} alt={product?.name || detail?.title || "System"} />
            </div>
            <strong className="sb-native-preview__caption">
                {product?.name || detail?.title || "System builder"}
            </strong>
            <div className="sb-native-preview__thumbs">
                {[0, 1, 2, 3].map((index) => (
                    <button type="button" className={index === 0 ? "is-active" : ""} key={index}>
                        {index === 0 ? <img src={imageUrl} alt="" /> : null}
                    </button>
                ))}
            </div>
        </aside>
    );
}
