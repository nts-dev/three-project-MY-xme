import * as THREE from "three";
import useGame from "../../hooks/useGame";
import {useEffect, useState} from "react";
import {AddLabel} from "../label/Label";
import {useThree} from "@react-three/fiber";
import {Vector3} from "three";

export default function Dots({sceneObject}: any) {
    const dots = useGame((state: any) => state.dots);
    const dotEvent = useGame((state: any) => state.dotEvent);

    const projectId: any = useGame((state: any) => state.projectID);
    const setCordinates = useGame((state: any) => state.setCordinates);
    const {scene} = useThree()


    const fetchDevices = async () => {
        // const URL = process.env.NODE_ENV === 'production' ? 'https://bo.nts.nl/three-api' : 'http://localhost:4000/api';
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/dots/${projectId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            addRedDots(data)

        } catch (error) {
            console.error('Failed to fetch devices:', error);
        }
    };

    const addRedDots = (data: any) => {
        const geometry = new THREE.SphereGeometry(2, 32, 32);
        const listDots = [
            {x: 10000, y: 10000},
            {x: -10000, y: 10000},
            {x: 10000, y: -10000},
            {x: -10000, y: -10000},
            {x: 0, y: 0},
        ]

        const cordList: any = []
        listDots.forEach((point: any, index: number) => {
            const fraction = 1 / (listDots.length - 1);
            const color = new THREE.Color().setHSL(0, 1, 0.5 * (1 - fraction)); // Adjust the lightness based on fraction
            const material = new THREE.MeshBasicMaterial({color: color});


            const baseLatitude = data[0].latitude
            const baseLongitude = data[0].longitude

            const baseAngle = data[0].angle

            const angle_theta = (Math.PI / 180) * parseFloat(baseAngle)
            const delta_x_pos = ((parseFloat(point.x) / 100) * Math.cos(angle_theta) + (parseFloat(point.y) / 100) * Math.sin(angle_theta))
            const delta_y_pos = ((parseFloat(point.y) / 100) * Math.cos(angle_theta) - (parseFloat(point.x) / 100) * Math.sin(angle_theta))

            // const latitude = ((delta_x_pos/111319.4917) + parseFloat(baseLatitude)).toFixed(7)
            // const longitude = ((delta_y_pos/111319.4917) + parseFloat(baseLongitude)).toFixed(7)
            let latitude = 0
            let longitude = 0

            if (projectId == 125) {
                if ((point.x > 0 && point.y > 0) || (point.x < 0 && point.y < 0)) {
                    latitude = (-parseFloat(point.x) / 100 / 111319.4917) + parseFloat(baseLatitude)
                    const degreesToRadians = (degrees: any) => degrees * (Math.PI / 180);
                    longitude = (parseFloat(point.y) / (111320 * Math.cos(degreesToRadians(latitude + parseFloat(baseLatitude)) / 2) * 100) + parseFloat(baseLongitude))
                } else {
                    latitude = (parseFloat(point.x) / 100 / 111319.4917) + parseFloat(baseLatitude)
                    const degreesToRadians = (degrees: any) => degrees * (Math.PI / 180);
                    longitude = (-parseFloat(point.y) / (111320 * Math.cos(degreesToRadians(latitude + parseFloat(baseLatitude)) / 2) * 100) + parseFloat(baseLongitude))
                }
            } else {
                latitude = (parseFloat(point.x) / 100 / 111319.4917) + parseFloat(baseLatitude)
                const degreesToRadians = (degrees: any) => degrees * (Math.PI / 180);
                longitude = (parseFloat(point.y) / (111320 * Math.cos(degreesToRadians(latitude + parseFloat(baseLatitude)) / 2) * 100) + parseFloat(baseLongitude))
            }


            cordList.push(`(${point.x / 100},${point.y / 100})    ${latitude},${longitude}`)

            const sphere = new THREE.Mesh(geometry, material);

            // const pLable = AddLabel(25, 10, [`(${point.x/100},${point.y/100 })`,`${latitude},${longitude}`], new THREE.Vector3(x+16, 0, z), 25)

            const pLable = AddLabel(projectId,25, 10, [`(${point.x / 100},${point.y / 100})`, `${latitude.toFixed(7)},${longitude.toFixed(7)}`], new THREE.Vector3(delta_x_pos, 0, delta_y_pos), 25, 'label_dot',new Vector3(),[] ,false, false)
            if (pLable) {
                pLable.rotation.x = -Math.PI / 2

            }
            sceneObject.add(pLable)
            sphere.position.set(delta_x_pos, 0.0, delta_y_pos);
            sphere.name = 'dot'
            if (sceneObject)
                sceneObject.add(sphere);
        });
        setCordinates(cordList)
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

    useEffect(() => {
        const sphereList = getObjectsByName('dot')
        const labels = getObjectsByName('label_dot')

        if (dotEvent != null) {
            const event = dotEvent.originalEvent.target.parentNode

            if (event.parentNode.tagName == "LI") {
                dots ? event.classList.add('box-shadow') : event.classList.remove('box-shadow')
            } else {
                dots ? event.parentNode.parentNode.classList.add('box-shadow') : event.parentNode.parentNode.classList.remove('box-shadow')
            }
        }
        if (dots && projectId) {
            if (sphereList.length > 0) {
                for (const label of labels) {
                    label.children[0].layers.mask = dots
                    // label.children[1].layers.mask = dots
                }
                for (const sphere of sphereList) {
                    sphere.layers.mask = dots
                    // sphere.layers.mask = dots
                }
            } else {
                fetchDevices();
            }

        } else {
            for (const label of labels) {
                label.children[0].layers.mask = dots
                // label.children[1].layers.mask = dots
            }
            for (const sphere of sphereList) {
                sphere.layers.mask = dots
                // sphere.layers.mask = dots
            }
        }
    }, [dots, projectId, dotEvent]);


    return null;
}
