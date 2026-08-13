import * as THREE from "three";
import useGame from "../../hooks/useGame";
import {useEffect} from "react";
import {useThree} from "@react-three/fiber";

export default function DevicePath({sceneObject}: any) {
    const devicePath = useGame((state: any) => state.devicePath);
    const newDevicePath = useGame((state: any) => state.newDevicePath);
    const setNewDevicePath = useGame((state: any) => state.setNewDevicePath);
    const projectId: any = useGame((state: any) => state.projectID);
    const {scene} = useThree()

    const addRedDots = () => {


        const geometry = new THREE.SphereGeometry(0.2, 32, 32);

        let index = 0
        for (const point of devicePath) {


            const fraction = index / (devicePath.length - 1);
            const color = new THREE.Color().setHSL(0, 1, 0.5 * (1 - fraction)); // Adjust the lightness based on fraction
            const material = new THREE.MeshBasicMaterial({color: color});
            const sphere = new THREE.Mesh(geometry, material);
            const x = projectId == 48 ? (parseFloat(point.posx) / 100) - 4 : (parseFloat(point.posx) / 100)
            const z = projectId == 48 ? ((parseFloat(point.posz)) / 100) - 4 : (parseFloat(point.posz) / 100) - 3
            sphere.name = 'sphere_dot'
            sphere.position.set(x, 0.0, z);
            if (sceneObject)
                sceneObject.add(sphere);
            index++
        }
    };

    const getObjectsByName = (name: string) => {
        const result: any = [];
        scene.traverse((child) => {
            if (child.name === name) {
                result.push(child);
            }
        });
        return result;
    }

    const removeRedDots = () => {
        const initSphereList = getObjectsByName('sphere_dot')
        for (const initSphere of initSphereList) {
            if (initSphere) {
                initSphere.parent?.remove(initSphere)
                // continue;
            }
        }


        // pathDifference.forEach((point: any) => {
        //     const sphere = scene.getObjectByName(point.id)
        //     if(sphere)
        //         sphere.layers.mask = 0;
        // });
    }

    const pathDifference = () => {

        const set2 = new Set(devicePath);
        return newDevicePath.filter((item: any) => !set2.has(item));

    }

    useEffect(() => {

        removeRedDots()

        if (devicePath.length > 0) {
            addRedDots();
            // setNewDevicePath(devicePath)

        }
        // const pathdiff = pathDifference()
        //
        // // else {
        //     removeRedDots()
        // // }

    }, [devicePath]);

    return null;
}
