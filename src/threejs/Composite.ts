import * as THREE from 'three';

export default function Composite(mesh: any, elements: any, isFake=false) {

    const geometry =  mesh.geometry;
    const material =  mesh.material;

    // Create the instanced mesh with the specified geometry and material
    const instancedMesh = new THREE.InstancedMesh(geometry, material, elements.length);
    // Create a reusable transformation matrix and a position vector
    const matrix = new THREE.Matrix4();
    const tempPosition = new THREE.Vector3();
    const tempRotation = new THREE.Euler();
    const tempQuaternion = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();
    instancedMesh.userData.instances = []

    for (let i = 0; i < elements.length; i++) {
        const data = elements[i];
        const position = isFake? data.fakeLabelPosition : data.position
        const rotation = isFake? data.fakeLabelRotation : data.rotation
        // Set position, rotation, and scale from the element data
        tempPosition.set(position.x, position.y, position.z);
        tempRotation.set(rotation.x, rotation.y , rotation.z);
        tempScale.set(data.scale.x, data.scale.y, data.scale.z);

        // Reset the matrix, then apply scaling, rotation, and position
        matrix.identity();
        tempQuaternion.setFromEuler(tempRotation);
        matrix.compose(tempPosition, tempQuaternion, tempScale);
        // Set the transformation matrix for this instance
        instancedMesh.setMatrixAt(i, matrix);


       if(data.locationId){
           const instanceData = {
               data
           };
           instancedMesh.userData.instances.push(instanceData);
       }


    }
    // Mark the instance matrix as updated to apply the changes
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.userData.object =  mesh.clone()
    return instancedMesh;
}
