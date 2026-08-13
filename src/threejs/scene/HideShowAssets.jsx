import {useEffect} from "react";
import useGame from "../../hooks/useGame";
import * as THREE from "three";
import {sceneAssets} from "../player/puzzle/character/Constants.jsx";

export default function HideShowAssets({scene}){
    const hideAssets = useGame((state) => state.hideAssets);
    const hideAssetProps = useGame((state) => state.hideAssetProps);

    const turnOnOffAllAssets = (isOn) => {
        for (const i in sceneAssets) {
            const asset = sceneAssets[i];
            const { instance, index, position, quart, scale, noInstbject, inUse } = asset;

            const newScale = scale?.clone();
            if(!inUse){
                isOn ? newScale?.multiplyScalar(1) : newScale?.multiplyScalar(0);
            }

            if (noInstbject != undefined) {
                noInstbject.scale.set(newScale);
            }
            if (instance != undefined) {
                const matrix = new THREE.Matrix4();
                if (position && matrix)
                    matrix.compose(position, quart, newScale);
                instance.instanceMatrix.needsUpdate = true;
                instance.setMatrixAt(index, matrix);
            }
        }
    };
    useEffect(() => {
        turnOnOffAllAssets(hideAssets)

    }, [hideAssets]);

    useEffect(() => {
        const {instanceId,  isHidden} = hideAssetProps
        const asset = sceneAssets[instanceId];
        if(asset){
            const { instance, index, position, quart, scale, noInstbject } = asset;
            const newScale = scale?.clone();

            if(isHidden){
                if(scene.current){
                    const obj = scene.current.getObjectByName('hover');
                    if (obj) {

                        obj.parent?.remove(obj);
                    }
                }
                newScale?.multiplyScalar(0)
            }
            else{
                newScale?.multiplyScalar(1)
            }

            if (noInstbject != undefined) {
                noInstbject.scale.set(newScale);
            }
            if (instance != undefined) {
                const matrix = new THREE.Matrix4();
                if (position && matrix)
                    matrix.compose(position, quart, newScale);
                instance.instanceMatrix.needsUpdate = true;
                instance.setMatrixAt(index, matrix);
            }

            sceneAssets[instanceId].inUse = !!isHidden
        }

    }, [hideAssetProps]);

    return null
}