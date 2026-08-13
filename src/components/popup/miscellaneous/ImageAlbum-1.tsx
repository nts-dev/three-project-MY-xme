import *  as React from 'react';
import {useEffect, useState} from 'react';
import {Galleria} from 'primereact/galleria';
import useGame from "../../../hooks/useGame";

export default function ImageAlbum() {
    const selectedAsset: any = useGame((state: any) => state.selectedAsset)
    const [images, setImages] = useState([]);
    const [mageNum, setImageNum] = useState(0)

    const selectedAssetId: number = useGame((state: any) => state.selectedAssetId);
    // const responsiveOptions = [
    //     {
    //         breakpoint: '991px',
    //         numVisible: 4
    //     },
    //     {
    //         breakpoint: '767px',
    //         numVisible: 3
    //     },
    //     {
    //         breakpoint: '575px',
    //         numVisible: 1
    //     }
    // ];


    const imageObject = (imageList: Array<string>): any => {

        if (!imageList || imageList.length == 0) {
            const url = `${import.meta.env.VITE_FILE_URL}/no_image.png`;

            return [{
                itemImageSrc: url,
                thumbnailImageSrc: url, // Assuming thumbnail URLs follow a similar pattern
                alt: `Description for Image ${1}`,
                title: `Title ${1}`
            }];
        }

        return imageList.map((imageUrl: string, index: number) => {
            const {name}: any = imageUrl
            const url = `${import.meta.env.VITE_FILE_URL}/${name}`;

            return {
                itemImageSrc: url,
                thumbnailImageSrc: url, // Assuming thumbnail URLs follow a similar pattern
                alt: `Description for Image ${index + 1}`,
                title: `Title ${index + 1}`
            };
        });
    }

    useEffect(() => {

        const {assetObject}: any = selectedAsset
        const {category_images, images}: any = assetObject
        if (images && images.length > 0) {
            const imageList: any = imageObject(images)
            setImages(imageList)
        } else {

            const imageList: any = imageObject(category_images)
            setImages(imageList)
        }


    }, [selectedAssetId])


    const itemTemplate = (item: any) => {
        if (item == undefined) {
            return
        }
        return <img src={item.itemImageSrc} alt={item.alt} style={{width: '100%'}}/>
    }

    const thumbnailTemplate = (item: any) => {
        if (item == undefined) {
            return
        }
        return <img src={item.thumbnailImageSrc} alt={item.alt}/>
    }

    return (
        <div className="card" style={{paddingTop: "1rem"}}>
            <Galleria value={images} numVisible={mageNum}
                      item={itemTemplate} thumbnail={thumbnailTemplate} circular autoPlay
                      transitionInterval={3000}/>
        </div>
    )
}
