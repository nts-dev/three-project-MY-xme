import * as THREE from "three";
import * as CANNON from "cannon-es";
import { useRef, useEffect } from "react";
import useGame from "../../hooks/useGame";
import {Object3D} from "three";

const CannonInstances = ({ object, createInstances, scene, world }) => {
    const checkReload = useGame((state) => state.checkReload);
    const instancedMesh = useRef();
    const debugMeshes = useRef([]); // Array to store debug meshes
    const bodies = useRef([]);

    useEffect(() => {

        instancedMesh.current = new THREE.InstancedMesh(
            object.geometry,
            object.material,
            createInstances.length
        );

        const sceneObj = new Object3D()
        // // Initialize Cannon.js bodies, instancedMesh, and debug meshes
         createInstances.map((instance, index) => {
            const { position, rotation, scale } = instance;

            const cposition = new THREE.Vector3(position[0], position[1], position[2]);
            const quaternion = new THREE.Quaternion(rotation[0], rotation[1], rotation[2], rotation[3]);
             const objClone = object.clone()
             objClone.position.copy(cposition)

             objClone.rotation.set(rotation[0],rotation[1],rotation[2])
             objClone.scale.set(scale.x,scale.y,scale.z)

             sceneObj.add(objClone);



        });

        // Add instancedMesh to the scene

        // instancedMesh.current.frustumCulled = false;
        // sceneObj.scale.set(5, 5, 5);
        scene.add(sceneObj);

        // Cleanup
        return () => {
            // bodies.current.forEach((body) => world.removeBody(body));
            // debugMeshes.current.forEach((mesh) => scene.remove(mesh));
             scene.remove(sceneObj);
        };
    }, [createInstances, checkReload, scene, world]);


    return null;
};

export default CannonInstances;