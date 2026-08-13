import React, { useEffect, useState, useMemo, useRef } from "react";

import { Skeleton } from "primereact/skeleton";
import {sceneAssets} from "../player/puzzle/character/Constants";


const imageCache = new Map(); // Cache fetched images

const SearchComponent = ({ item, handleSelect }) => {
    const [loading, setLoading] = useState(true);
    const [image, setImage] = useState(`${import.meta.env.VITE_FILE_URL}/no_image.png`);

    const imgRef = useRef(null);
    const observerRef = useRef(null);

    // Memoized instanceId to prevent unnecessary fetch calls
    const cachedImage = useMemo(() => imageCache.get(item?.id), [item?.id]);

    // useEffect(() => {
    //     setInstanceId(item?.id);
    // }, [item?.id]);

    useEffect(() => {
        if (cachedImage) {
            setImage(cachedImage);
            setLoading(false);
        } else {
            observerRef.current = new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) {
                    fetchImages();
                    observerRef.current?.disconnect(); // Stop observing once loaded
                }
            });

            if (imgRef.current) {
                observerRef.current.observe(imgRef.current);
            }

            return () => observerRef.current?.disconnect();
        }
    }, [cachedImage]);

    const fetchImages = async () => {
        try {
            setLoading(true);

            let assetID = -1;
            if (sceneAssets[item?.id]) {
                assetID = sceneAssets[item?.id].assetID;
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/getImages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assetID, id: item?.id }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const allImages = await response.json();
            const { category_images = [], images = [] } = allImages;

            const imgUrl = images.length > 0 ? images[0]?.name :
                category_images.length > 0 ? category_images[0]?.name :
                    "no_image.png";

            const fullUrl = `${import.meta.env.VITE_FILE_URL}/${imgUrl}`;
            imageCache.set(item.id, fullUrl); // Store in cache
            setImage(fullUrl);
        } catch (error) {
            console.error("Failed to fetch images:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-start w-full h-auto group">
            <div className="relative flex w-12 h-12 overflow-hidden rounded-md cursor-pointer" ref={imgRef}>
                {loading ? (
                    <Skeleton size="3rem" />
                ) : (
                    <img
                        src={image}
                        loading="lazy"
                        alt={item.name || "Product Image"}
                        className="object-cover bg-fill-thumbnail"
                        style={{ width: "3rem" }}
                    />
                )}
            </div>

            <div className="flex flex-col w-full overflow-hidden p-2">
                <div className="flex justify-between items-center">
                    <div className="flex-shrink-0 text-brand-dark truncate search-bar-id" style={{ fontSize: "0.8rem", maxWidth: "6.5rem" }}>
                        {item.name}
                    </div>
                    <i className="pi pi-question-circle" style={{ fontSize: "0.8rem" }} onClick={() => handleSelect(item, false)}></i>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-brand-dark text-12px search-bar-sku " style={{ fontSize: '0.8rem', maxWidth: "6.5rem" }}>
                        {item.type && item.type === 'project' ? `ProjectID: ${item.id} ` : `AssetID: ${item.id}`}
                    </span>
                    <i className="pi pi-map-marker" style={{ fontSize: '0.8rem' }} onClick={() => handleSelect(item, true)}></i>
                </div>
            </div>
        </div>
    );
};

export default SearchComponent;
