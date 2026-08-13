import LabelData from "./LabelData";
import AttachLabel from "../label/AttachLabel";
import {Vector3} from "three";
import * as THREE from "three";
import Composite from "../Composite";

const LABEL_SCALE = 0.01;
const LABEL_ROTATION = new Vector3(THREE.MathUtils.degToRad(90), 0, THREE.MathUtils.degToRad(90));
const FAKE_ROTATE_OFFSET_POSITIVE = new Vector3(0.0358, -0.02, 0);
const FAKE_ROTATE_OFFSET_NEGATIVE = new Vector3(-0.016, -0.02, 0);
const BOX_SCALE = new Vector3(1, 1, 1);
const ZERO_VECTOR = new Vector3();
const SIZE_AND_FONT = {width: 30, length: 5, font: 35};
const WHITE_LABEL_GEOMETRY = new THREE.PlaneGeometry(SIZE_AND_FONT.width - 5, SIZE_AND_FONT.length);
const WHITE_LABEL_MATERIAL = new THREE.MeshBasicMaterial({ color: "#fff" });

export default async function AddLabels(projectID:number,branchId: number, scene: any, width: number, height: number, box: any) {

    const elements = [];
    const searchList = [];
    const locationList: any = {};
    let boxPosition = new Vector3();
    const labels = await LabelData(branchId)
    let rotate = true;
    let labelId: number | undefined = 0
    const positiveLabelOffset = new Vector3(0, -2, -width / 100 + 5.1);
    const negativeLabelOffset = new Vector3(0, -2, width / 100 + 3);
    const positiveBoxOffset = new Vector3(-width, height * 2, 0);
    const negativeBoxOffset = new Vector3(width, height * 2, 0);



    for (const i in labels) {
        const label = labels[i]
        const textList = [label.Location]
        const xPos = parseFloat(label.Xpos);
        const zPos = parseFloat(label.Zpos);
        const yPos = parseFloat(label.Ypos);
        const position = new Vector3(xPos, zPos, yPos)
        const textIndexList: any = [];
        const labelPosition = position.clone().multiplyScalar(LABEL_SCALE)
        const fakeLabelPosition = labelPosition.clone()
        const fakeLabelRotation = LABEL_ROTATION.clone()
        if (rotate) {
            const labelAngle = THREE.MathUtils.degToRad(-(parseFloat(label.angle) + 270))
             labelId = AttachLabel(projectID,textList, scene, labelPosition,ZERO_VECTOR, textIndexList, positiveLabelOffset, new Vector3(0, labelAngle, 0), SIZE_AND_FONT, false,true)
            fakeLabelPosition.add(FAKE_ROTATE_OFFSET_POSITIVE)
            fakeLabelRotation.add(new Vector3(0,Math.PI/2, 0))
            boxPosition = position.clone().add(positiveBoxOffset)
        } else {
            const labelAngle = THREE.MathUtils.degToRad((parseFloat(label.angle) + 270))
            labelId = AttachLabel(projectID,textList, scene, labelPosition,ZERO_VECTOR, textIndexList, negativeLabelOffset, new Vector3(0, labelAngle, 0), SIZE_AND_FONT,false,true)
            fakeLabelPosition.add(FAKE_ROTATE_OFFSET_NEGATIVE)
            fakeLabelRotation.add(new Vector3(0,-Math.PI/2,0))
            boxPosition = position.clone().add(negativeBoxOffset)
        }
        fakeLabelPosition.multiplyScalar(100)
        const element = {
            fakeLabelPosition,
            fakeLabelRotation,
            position: boxPosition,
            rotation: LABEL_ROTATION.clone(),
            scale: BOX_SCALE.clone(),
            locationId: label.Location,
            box: box.children[0]
        }

       if(labelId)
          locationList[label.Location] = element

        // if(label.RackID == 290134)
           elements.push(element)


        const searchTerms = {
            name : label.Location,
            id: label.Location,

        }

        searchList.push(searchTerms)
        rotate = !rotate
    }
    const createWhiteLabel = () => {
        return new THREE.Mesh(WHITE_LABEL_GEOMETRY, WHITE_LABEL_MATERIAL);
    };

    if (elements.length > 0) {
        //box composite
        const compositeObj = Composite(box.children[0], elements)
        compositeObj.scale.multiplyScalar(0.01)
        compositeObj.name = box.children[0].name;

        scene.add(compositeObj)

        //fake label composite
        const fakeLabel = createWhiteLabel()
        const fakeLabelComposite = Composite(fakeLabel,elements, true)
        fakeLabelComposite.scale.multiplyScalar(0.01)
        fakeLabelComposite.layers.mask = 0
        fakeLabelComposite.name = 'label'

        scene.add(fakeLabelComposite)
    }


    return {searchList:searchList,locationList:locationList}

}
