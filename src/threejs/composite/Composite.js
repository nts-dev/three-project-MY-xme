import * as THREE from 'three';
import { Annotation } from "./Annotation";

const cssRenders = [];

export default function makeComposite(assetData, model, pmodel, length, width, height, plength, pwidth, pheight, objectScene, camera, scene) {
    const asset = assetData.fields;
    let qLength = asset.qtyLenght?.value;
    let qHeight = asset.qtyHeight?.value;
    let qWidth = asset.qtyWide?.value;
    let angle = asset.Angle?.value ? Number(asset.Angle?.value) : 0;

    let directionxy = asset.DirectionXY?.value || '';
    let directionx = 270;
    let directiony = 90;

    if (directionxy !== '') {
        directionx = parseInt(directionxy.split(';')[0], 10);
        directiony = parseInt(directionxy.split(';')[1], 10);
    }

    // Create a new InstancedMesh for the objects
    const count = qLength * qHeight * qWidth;

    // Define the dimensions of the plane (120cm x 120cm)
    const planeWidth = 120 ; // Convert to meters
    const planeHeight = 120 ; // Convert to meters
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    // Create plane geometry with 120x120 cm
    const geometry = new THREE.BoxGeometry(planeWidth, 5, planeHeight);
    const instancedMesh = new THREE.InstancedMesh(geometry, model.children[0].material, count);
    let instanceMatrix = new THREE.Matrix4();
    let dummy = new THREE.Object3D();

    let TLength = 0;
    let THeight = 0;
    let TWidth = 0;
    let index = 0;

    for (let z = 0; z < qWidth; z++) {
        for (let x = 0; x < qHeight; x++) {
            for (let y = 0; y < qLength; y++) {
                dummy.position.set(TWidth, THeight, TLength);

                if (z === 0) {
                    dummy.rotation.y = THREE.MathUtils.degToRad(directionx);
                } else {
                    dummy.rotation.y = THREE.MathUtils.degToRad(directiony);
                }

                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index++, dummy.matrix);

                TWidth += width;
            }
            THeight += height;
            TWidth = 0;
        }
        TLength += length;
        THeight = 0;
    }

    // Apply scaling for length, width, and height
    let totalLength = asset.Length?.value ? parseFloat(asset.Length?.value) / 5000 : 1;
    let totalWidth = asset.Width?.value ? parseFloat(asset.Width?.value) / 2000 : 1;
    let totalHeight = asset.Height?.value ? parseFloat(asset.Height?.value) / 1000 : 1;


    instancedMesh.scale.set(
        totalWidth / (qWidth*width ),
        totalHeight / (qHeight * height),
        totalLength / (qLength * length)
    );

    // Add instancedMesh to compositeGroup
    const compositeGroup = new THREE.Group();
    compositeGroup.add(instancedMesh);

    // Pallet setup
    const pallete = pmodel.clone();
    const compositeAsset = new THREE.Group();
    compositeAsset.add(pallete);

    compositeGroup.rotation.y = THREE.MathUtils.degToRad(angle + 90);
    compositeGroup.position.y = (pheight * 2) / 50;
    // compositeGroup.position.z = 0.13;
    compositeAsset.add(compositeGroup);

    let posX = parseInt(asset['X-pos']?.value, 10) / 100;
    let posY = parseInt(asset['Z-pos']?.value, 10) / 100;
    let posZ = parseInt(asset['Y-pos']?.value, 10) / 100;

    compositeAsset.position.set(posX, posY, posZ);
    compositeAsset.rotation.y = THREE.MathUtils.degToRad(angle + 90);
    objectScene.add(compositeAsset);

    const qnty = qHeight * qLength * qWidth;
    const annotationText = `${asset['SKU']?.value} ${asset['Productname']?.value} ${qnty} ${asset['Location']?.value}`;

    const annotation = new Annotation(
        compositeAsset, camera, new THREE.Vector3(0, 0, 0), annotationText,
        angle, totalHeight, totalLength, totalWidth, asset, `annotation_`, pheight
    );

    cssRenders.push(annotation);
}

export { cssRenders };
