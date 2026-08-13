import { useRef, useEffect } from 'react';
import * as THREE from 'three';

const CannonR3FInstances = ({ object, createInstances,scene }) => {

    function createInstancedObjects(scene, object, createInstances) {

        console.log(object)
        const instancedMesh = new THREE.InstancedMesh(
            object.geometry,
            object.material,
            createInstances.length
        );

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const scaleVec = new THREE.Vector3();

        createInstances.forEach((instance, index) => {
            const position = new THREE.Vector3(...instance.position);
            quaternion.setFromEuler(new THREE.Euler(...instance.rotation));
            scaleVec.set(instance.scale, instance.scale, instance.scale);

            // Create transformation matrix manually
            matrix.compose(position, quaternion, scaleVec);

            instancedMesh.setMatrixAt(index, matrix);
        });

        instancedMesh.instanceMatrix.needsUpdate = true;
        scene.add(instancedMesh);

        return instancedMesh;
    }

    useEffect(() => {
        createInstancedObjects(scene, object, createInstances)
    }, [object]);

    return null
};

export default CannonR3FInstances;
