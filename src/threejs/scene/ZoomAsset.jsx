import {useCallback, useEffect, useRef, useState} from "react";
import {  useThree } from "@react-three/fiber";
import useGame from "../../hooks/useGame";
import * as THREE from 'three'
import CameraController from "./camera/CameraController";
import { sceneAssets } from "../player/puzzle/character/Constants";


export default function ZoomAsset(props) {
    const searchItem = useGame((state) => state.searchItem);

    const { camera} = useThree();
    const  setSearchItem  = useGame((state) => state.setSearchItem);
    const searchParams = new URLSearchParams(window.location.search);
    const setEditable = useGame((state) => state.setEditable);
    const setEditPopup = useGame((state) => state.setEditPopup);
    const setSelectedAssetId = useGame((state) => state.setSelectedAssetId);
    const setSelectedAsset = useGame((state) => state.setSelectedAsset);
    const scannedId = useGame((state) => state.scannedId);
    const scan = useGame((state) => state.scan);
    const locationList = useGame((state) => state.locationList);
    const setSearchCenter = useGame((state) => state.setSearchCenter);
    const setSearchDimensions = useGame((state) => state.setSearchDimensions);
    const assetIdValue =   scannedId||searchParams.get('assetId');
    const { orbitControls,gl} = props;
    const { id,noZoom } = searchItem;
    const [randomVal, setRandomVal] = useState('')
    const [randomSearchVal, setRandomSearchVal] = useState('')
    const searchCenter = useGame((state) => state.searchCenter);
    const searchDimensions = useGame((state) => state.searchDimensions);
    const buttonMode = useGame((state) => state.buttonMode);
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    const selectedEditorInstance = useGame((state) => state.selectedEditorInstance);
    const [dimensions, setDimensions] = useState({})
    const latestSelectionRef = useRef({selectedAssetId, selectedEditorInstance, buttonMode});

    useEffect(() => {
        latestSelectionRef.current = {selectedAssetId, selectedEditorInstance, buttonMode};
    }, [selectedAssetId, selectedEditorInstance, buttonMode]);

    const zoomToAsset = useCallback((assetObj) => {
        if (!assetObj?.position || !orbitControls.current) {
            return false;
        }

        const center = assetObj.position.clone
            ? assetObj.position.clone()
            : new THREE.Vector3(assetObj.position.x || 0, assetObj.position.y || 0, assetObj.position.z || 0);
        const halfHeight = Number(assetObj.halfHeight) || 0;
        const width = Number(assetObj.width || assetObj.halfWidth || 0);
        const length = Number(assetObj.length || assetObj.halfLength || 0);
        const boxSize = Math.max(width, length, halfHeight, 1);
        const fov = (camera.fov || 50) * (Math.PI / 180);
        const distance = (((boxSize / (2 * Math.tan(fov / 2))) / 100) * 2) + 0.7;
        const camPosition = center.clone().add(new THREE.Vector3(0, distance, 0));

        setDimensions({halfHeight, width, length});
        setSearchDimensions(null);
        setSearchCenter(center);

        camera.position.copy(camPosition);
        camera.lookAt(center);
        orbitControls.current.target.copy(center);
        orbitControls.current.update?.();
        camera.updateProjectionMatrix();

        return true;
    }, [camera, orbitControls, setSearchCenter, setSearchDimensions]);

    const getSelectedZoomAsset = () => {
        const {
            selectedAssetId: latestSelectedAssetId,
            selectedEditorInstance: latestSelectedEditorInstance,
        } = latestSelectionRef.current;
        const instanceId = latestSelectedAssetId
            || latestSelectedEditorInstance?.instanceId
            || latestSelectedEditorInstance?.apiObject?.instanceId
            || latestSelectedEditorInstance?.apiObject?.instance_id;

        if (sceneAssets[instanceId]) {
            return sceneAssets[instanceId];
        }

        const selectedObject = latestSelectedEditorInstance?.object;
        if (selectedObject?.position) {
            return {
                position: selectedObject.position,
                halfHeight: latestSelectedEditorInstance?.apiObject?.halfHeight || selectedObject.scale?.y || 1,
                width: latestSelectedEditorInstance?.apiObject?.width || latestSelectedEditorInstance?.apiObject?.halfWidth || selectedObject.scale?.x || 1,
                length: latestSelectedEditorInstance?.apiObject?.length || latestSelectedEditorInstance?.apiObject?.halfLength || selectedObject.scale?.z || 1,
            };
        }

        return null;
    };

    useEffect(() => {

        let  assetId = assetIdValue

        if(assetIdValue && assetIdValue.includes && assetIdValue.includes('_click')){

            assetId = assetIdValue.split('_')[0]
            setSearchItem({id: assetId,type:null,noZoom: true})
            // setDimensions({width: 0,length: 0,halfHeight: 0})
        } else{

            zoomToAsset(sceneAssets[assetIdValue])
            setSearchItem({id: assetId,type:null,noZoom: false})
        }

        if(assetId){

            const  center = sceneAssets[id]?.position || sceneAssets[assetId]?.position|| locationList[scannedId]?.position;

            if(center){
                if(!isNaN(assetId) ){
                    setEditPopup(true)
                    setEditable(false);
                    setSelectedAssetId(parseInt(String(assetId)))
                    setSelectedAsset(sceneAssets[assetId]?.instanceData)
                }

            }
            else if(assetId.includes('t')){
                const id = assetId.replace('t', '')
                setEditPopup(true)
                setEditable(false);
                setSelectedAssetId(parseInt(String(id)))
                setSelectedAsset(sceneAssets[id]?.instanceData)

            }
            else {
                setRandomVal(Math.random().toString(36).substring(2,7));
            }

        }

    }, [randomVal,scan,assetIdValue]);


    useEffect(() => {

        if(noZoom){
            return
        }
       const assetObj =  sceneAssets[id] || sceneAssets[assetIdValue]|| sceneAssets[scannedId] || locationList[scannedId]

        if(!assetObj){

            if( id > 0){
                setRandomSearchVal(Math.random().toString(36).substring(2,7));
            }
            return;
        }
        zoomToAsset(assetObj)
    }, [id,scan,scannedId,noZoom,randomSearchVal, zoomToAsset]);

    useEffect(() => {
        const handleZoomSelectedAsset = () => {
            zoomToAsset(getSelectedZoomAsset());
        };

        window.addEventListener('editor-zoom-selected-asset', handleZoomSelectedAsset);

        return () => {
            window.removeEventListener('editor-zoom-selected-asset', handleZoomSelectedAsset);
        };
    }, [zoomToAsset]);

    useEffect(() => {

        const activeDimensions = searchDimensions?.source === 'floor'
            ? searchDimensions
            : dimensions;
        const  {width,length,halfHeight} = activeDimensions || {}
        if (halfHeight>0 && searchCenter && orbitControls.current) {
            const boxSize = Math.max(width, length, halfHeight); // Find the largest dimension
            const fov = camera.fov * (Math.PI / 180); // Convert to radians

// Compute the distance required to fit the object in the view
            const distance = (((boxSize / (2 * Math.tan(fov / 2)))/100)*2) +0.5 ;

// Set the camera position above the object
            const camPosition = searchCenter.clone().add(new THREE.Vector3(0, distance, 0));
            camera.position.copy(camPosition);
            camera.lookAt(searchCenter);

// Update OrbitControls
            orbitControls.current.target.copy(searchCenter);
            camera.updateProjectionMatrix();
        } else if (searchCenter && orbitControls.current) {

                // const camdirection = orbitControls.current.target.clone()
                //     .sub(camera.position)
                //     .normalize()
                //     .multiplyScalar(2);
                // camera.updateProjectionMatrix();
                // orbitControls.current.target.copy(searchCenter);
                // camera.position.copy(searchCenter).sub(camdirection);
                // camera.lookAt(searchCenter)

        }
    }, [searchCenter, dimensions, searchDimensions]);

    return (

   <CameraController orbitControls={orbitControls} gl={gl}/>
    )

}
