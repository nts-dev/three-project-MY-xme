
import * as THREE from "three";
import {sceneAssets} from "../player/puzzle/character/Constants";

export default function UpdateAsset(updatedFieldsMap, selectedAssetId, selectedAsset, editObjectProps= {},scaleMultiplier = 1) {

    if(!sceneAssets[selectedAssetId]){
            return
        }


    const {index, instance, length, width, fAngle, position, quart, scale, axis} = sceneAssets[selectedAssetId] ? sceneAssets[selectedAssetId] : {}

    let x,y,z,newAngle;

    if(updatedFieldsMap){
        const xId = selectedAsset.xId?.split('_')[1]
        const yId = selectedAsset.yId?.split('_')[1]
        const zId = selectedAsset.zId?.split('_')[1]
        const angleId = selectedAsset.angleId?.split('_')[1]

         x = updatedFieldsMap[xId]?.value ? updatedFieldsMap[xId]?.value : ((position?.x * 100) - width)
         y = updatedFieldsMap[yId]?.value ? updatedFieldsMap[yId]?.value : ((position?.z * 100) - length)
         z = updatedFieldsMap[zId]?.value ? updatedFieldsMap[zId]?.value : (position?.y * 100)
         newAngle = updatedFieldsMap[angleId]?.value ? updatedFieldsMap[angleId]?.value : fAngle

    }else {
        const {position, rotation} = editObjectProps

            x = (position.x*100)  - width
            y = (position.z*100)  - length
            z = (position.y*100)
            newAngle = THREE.MathUtils.radToDeg(rotation.y)

    }

    const newPosition = new THREE.Vector3(parseFloat(x) + width, parseFloat(z), parseFloat(y) + length).multiplyScalar(0.01);

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

    const angleValue = extractAngle(newAngle || 0)

    const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(angleValue.y - fAngle));
       sceneAssets[selectedAssetId].position.copy(newPosition)
       sceneAssets[selectedAssetId].angle = angleValue.y

    const finalQuaternion = new THREE.Quaternion();
    finalQuaternion.multiplyQuaternions(quart, rotationQuaternion);
    if (instance != undefined) {
        const matrix = new THREE.Matrix4();
        scale.multiplyScalar(scaleMultiplier)
        if (position && matrix) matrix.compose(newPosition, finalQuaternion, scale);
        instance.instanceMatrix.needsUpdate = true;
        instance.setMatrixAt(index, matrix);
    }
    return null

}
