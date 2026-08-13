

import * as THREE from 'three'
import UpdateAsset from "../../../threejs/scene/UpdateAsset.jsx";
import {sceneAssets} from "../../../threejs/player/puzzle/character/Constants.jsx";

const SaveSceneAsset = (selectedAssetId, fieldsMap, dragObjectProp, selectedAsset, scene) => {

    const {labelId} = sceneAssets[selectedAssetId] ?? 0
    // console.log(labelId)
    const label = scene.getObjectById(labelId)
    if (sceneAssets[selectedAssetId]?.instanceData.assetObject.content) {
        sceneAssets[selectedAssetId].instanceData.assetObject.content = fieldsMap[30638]?.value
    }

    if (label && label.userData.updateText) {
        const updateIndices = label.userData.updateIndices
        const textList = label.userData.textList


        for (const updateIndex of updateIndices) {
            const index = updateIndex.index
            const fieldIndex = updateIndex.fieldIndex ? updateIndex.fieldIndex.split('_')[1] : 0
            const assetId = index === 1 && updateIndex.fieldIndex ? updateIndex.fieldIndex.split('_')[0] : 0

            textList[index] = assetId > 0 ? `[${assetId}]${fieldsMap[fieldIndex]?.value}` : fieldsMap[fieldIndex]?.value || 'No SKU Found'
        }
        // Call updateText with the new list of text lines
        label.userData.updateText(textList,'#000',30);
    }

    const extractAngle = (angle)=> {
        try {
            const obj = JSON.parse(angle);
            if (typeof obj === 'object' && obj !== null) {
                return obj; // Return parsed object if valid
            }
        } catch (error) {
            console.log(error)
            // If parsing fails, return the original string
        }
        return {x: 0,y: angle || 0, z: 0 }; // Return original string if it's not a valid object
    }

    const {instanceId, object, halfWidth, halfLength} = dragObjectProp

    if (parseInt(instanceId) == parseInt(selectedAssetId)) {
        for (const i in fieldsMap) {
            const field = fieldsMap[i];
            const xPos = field.name == "X-pos" ? field.value : null
            if (xPos) {
                object.position.x = (parseFloat(xPos) + halfWidth) / 100
            }
            const yPos = field.name == "Y-pos" ? field.value : null

            if (yPos) {
                object.position.z = (parseFloat(yPos) + halfLength) / 100
            }
            const zPos = field.name == "Z-pos" ? field.value : null
            if (zPos) {
                object.position.y = (parseFloat(zPos)) / 100
            }
            const angle = field.name == "Angle" ? field.value : null
            if (angle) {
                const newAngle = extractAngle(angle)

                object.rotation.set(THREE.MathUtils.degToRad(newAngle.x), THREE.MathUtils.degToRad(newAngle.y), THREE.MathUtils.degToRad(newAngle.z))
            }
        }

    }
    UpdateAsset(fieldsMap, selectedAssetId, selectedAsset);




}
export default SaveSceneAsset