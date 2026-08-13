import {AddLabel} from "./Label";
import {Vector3} from "three";
import * as THREE from "three";
// import {locationData} from "../InstancePattern";

interface TextIndex{
    index: number,
    fieldIndex: number
}
interface SizeAndFont{
    length: number,
    width: number,
    font: number
}

const AnnotationData: any = []

export default function AttachLabel(projectId: number,textList: Array<string>, scene: any,position: Vector3,labelRotation: Vector3, updateIndices: Array<TextIndex>,offsetPosition: Vector3, offsetRotation: Vector3, sizeAndFont: SizeAndFont, isAnnotation: boolean,isLod=false){
    const pLable = AddLabel(projectId,sizeAndFont.width, sizeAndFont.length, textList,offsetPosition , sizeAndFont.font, 'label',labelRotation,updateIndices,isLod,isAnnotation);
    const pivotObject = new THREE.Group()
    if(pLable){
        pivotObject.add(pLable)
    }
    const labePosition = position.clone()
    pivotObject.position.copy(labePosition)
    pivotObject.rotation.set(offsetRotation.x,offsetRotation.y,offsetRotation.z)
    pivotObject.scale.multiplyScalar(0.01)
  
    scene.add(pivotObject);
 
    if(isAnnotation){
        AnnotationData.push({text: pLable})
    }
    return pLable?.id
}

export {AnnotationData}