import {useEffect} from "react";
import * as THREE from "three"

export default function AdjustTilesCamera ({ object,camera }:any) {

    useEffect(() => {
        if(camera.current) {
            const box = new THREE.Box3().setFromObject(object); // Get the object's bounding box
            const size = new THREE.Vector3();
            box.getSize(size); // Get the size of the bounding box


            const maxDim = Math.max(size.x, size.y, size.z); // Determine the largest dimension
            const fov = camera.current.fov * (Math.PI / 180); // Convert FOV to radians
            // Calculate the camera distance based on the object's size and FOV
            const distance = (maxDim / 0.8) / Math.tan(fov / 2); // 0.7 corresponds to 70% of the tile
            const center = new THREE.Vector3();
            box.getCenter(center); // Get the center of the bounding box


            camera.current.position.set(center.x, center.y, center.z + distance); // Position the camera


            camera.current.lookAt(center); // Make the camera look at the object
            camera.current.updateProjectionMatrix();// Update the camera projection
        }

    }, [object, camera]);

    return null;
};
