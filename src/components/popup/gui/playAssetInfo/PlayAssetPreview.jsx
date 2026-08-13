import React from "react";
import { Galleria } from "primereact/galleria";

const renderImage = (item, className) => (
    <img
        className={className}
        src={item?.itemImageSrc}
        alt={item?.alt || ""}
        draggable={false}
    />
);

export default function PlayAssetPreview({ title, imageUrl, images = [] }) {
    const galleryImages = images.length
        ? images
        : [{ itemImageSrc: imageUrl, thumbnailImageSrc: imageUrl, alt: `${title} preview` }];

    return (
        <div className="play-asset-info__preview" aria-label={`${title} preview`}>
            <Galleria
                value={galleryImages}
                item={(item) => renderImage(item, "play-asset-info__preview-image")}
                thumbnail={(item) => renderImage(item, "play-asset-info__preview-thumb")}
                numVisible={Math.min(4, galleryImages.length)}
                showThumbnails={galleryImages.length > 1}
                showIndicators={false}
                showItemNavigators={galleryImages.length > 1}
                circular
            />
        </div>
    );
}
