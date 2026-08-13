import React, {useEffect, useState} from "react";
import {Dialog} from 'primereact/dialog';
import {useDispatch, useSelector} from "react-redux";
import {setHtmlContent} from '../../../features/menuBar/menuSlice';
import useGame from "../../../hooks/useGame";
import HtmlData from "./htmlData";

export default function PopupHtml() {
    const info = useSelector((state: any) => state.menu.info);
    const htmlContent = useSelector((state: any) => state.menu.htmlContent);
    const editPopup = useGame((state: any) => state.editPopup);
    const [data, setData] = useState('')
    const dispatch = useDispatch();
    const [imageIcon, setImageIcon] = useState('')
    const selectedAsset = useGame((state: any) => state.selectedAsset);
    const headerElement = (
        <div className="inline-flex align-items-center justify-content-center gap-2">
            {/*<img alt="logo" src={imageIcon} width="32" style={{borderRadius: '50%'}}/>*/}
            <div style={{marginRight: 'auto'}} className="ml-2">Information</div>
        </div>

    );

    useEffect(() => {
        setData(htmlContent)
        const {assetObject} = selectedAsset
        const images = assetObject?.images
        const category_images = assetObject?.category_images

        if (assetObject) {
            if (images?.length > 0) {
                const {name} = images[0]
                setImageIcon(`${import.meta.env.VITE_DATA_URL}/${name}`)
            } else if (category_images?.length > 0) {
                const {name} = category_images[0]
                setImageIcon(`${import.meta.env.VITE_FILE_URL}/${name}`)

            }
        }


    }, [htmlContent, editPopup]);

    const hidePopup = () => {
        if (!info) return;
        setData('')
        dispatch(setHtmlContent(''))

    }


    return (
        <div className="card flex justify-content-center">
            <Dialog visible={info && data && editPopup}
                    modal
                    position='top'
                    header={headerElement}
                    onHide={hidePopup}
                    className='html-popup-data'
            >
                {/* Safely render the HTML using dangerouslySetInnerHTML */}
               <HtmlData/>
            </Dialog>
        </div>
    )
}
