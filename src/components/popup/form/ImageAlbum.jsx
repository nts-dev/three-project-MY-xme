import * as React from 'react';
import { useEffect, useState } from 'react';
import { Galleria } from 'primereact/galleria';
import { Skeleton } from 'primereact/skeleton';
import useGame from "../../../hooks/useGame";
import { Image } from 'primereact/image';
import {sceneAssets} from "../../../threejs/player/puzzle/character/Constants";


export default function ImageAlbum() {
    const images = useGame((state) => state.images);
    const setImages = useGame((state) => state.setImages);
    const [activeIndex, setActiveIndex] = useState(0);
    const [imageListing, setImageListing] = useState([]);
    const [loading, setLoading] = useState(true); // Loading state
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    const setSelectedImageProps = useGame((state) => state.setSelectedImageProps);
    const selectedImageProps = useGame((state) => state.selectedImageProps);

    useEffect(() => {

        if (images[activeIndex]) {
            const { id, blob } = images[activeIndex];
            setSelectedImageProps({ id, isDeleted: false, activeIndex, blob });
        } else {
            setSelectedImageProps({ id: 0, isDeleted: false });
        }
    }, [activeIndex, images]);

    const imageObject = (imageList) => {
        if (!imageList || imageList.length === 0) {
            const url = `${import.meta.env.VITE_FILE_URL}/no_image.png`;
            return [{
                itemImageSrc: url,
                thumbnailImageSrc: url,
                alt: `Description for Image 1`,
                title: `Title 1`
            }];
        }

        return imageList.map((imageUrl, index) => {
            const { id, name } = imageUrl;
            const url = `${import.meta.env.VITE_FILE_URL}/${name}`;
            return {
                id,
                itemImageSrc: url,
                thumbnailImageSrc: url,
                alt: `Description for Image ${index + 1}`,
                title: `Title ${index + 1}`
            };
        });
    };

    const fetchImages = async () => {
        try {
            setLoading(true); // Start loading
            if (!sceneAssets[selectedAssetId]) return;

            const { assetID } = sceneAssets[selectedAssetId];
            const response = await fetch(`${import.meta.env.VITE_API_URL}/getImages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    assetID,
                    id: selectedAssetId
                })
            }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const allImages = await response.json();
            const { category_images, images } = allImages;

            if (images && images.length > 0) {
                const imageList = imageObject(images);
                setImages(imageList);
            } else {
                const imageList = imageObject(category_images);
                setImages(imageList);
            }

            setActiveIndex(0);
        } catch (error) {
            console.error('Failed to fetch images:', error);
        } finally {
            setLoading(false); // Stop loading after fetching images
        }
    };

    useEffect(() => {
        // console.log(selectedAssetId)
        fetchImages();
    }, []);

    useEffect(() => {

        const { isDeleted, blob } = selectedImageProps;

        if (isDeleted && !blob) {

            fetchImages();
        }
    }, [selectedImageProps]);

    useEffect(() => {
        setImageListing(images);
    }, [selectedAssetId, images]);

    const itemTemplate = (item) => {
        if (!item) return null;

        if (item?.type === 'video' || item?.itemImageSrc?.endsWith('mp4')) {
            return (
                <video controls style={{ width: '100%' }}>
                    <source src={item.itemImageSrc} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
            );
        } else {
            return <Image src={item.itemImageSrc} alt={item.alt} style={{ width: '80%', maxWidth: '10rem' }} preview />;
        }
    };

    const thumbnailTemplate = (item) => {
        if (!item) return null;

        if (item?.type === 'video' || item.itemImageSrc?.endsWith('mp4')) {
            return (
                <video>
                    <source src={item.itemImageSrc} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
            );
        } else {
            return <img src={item.thumbnailImageSrc} alt={item.alt} style={{ width: '100%' }} />;
        }
    };

    return (
        <div className="card" style={{ paddingTop: "0.5rem" }}>
            {loading ? (
                <div className="flex flex-column align-items-center">
                    <Skeleton shape="rectangle" width="70%" height="10rem" className="mb-2" />
                    <div className="flex gap-2">
                        <Skeleton size="3rem" />
                        <Skeleton  size="3rem" />
                        <Skeleton size="3rem" />
                    </div>
                </div>
            ) : (
                <Galleria
                    value={imageListing}
                    item={itemTemplate}
                    thumbnail={thumbnailTemplate}
                    circular
                     activeIndex={activeIndex}
                    onItemChange={(e) => setActiveIndex(e.index)}
                />
            )}
        </div>
    );
}
