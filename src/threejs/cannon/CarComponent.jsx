import { useEffect, useState } from "react";
import useGame from "../../hooks/useGame";
import Car from "./Car"; // Assuming Car is in a separate file
import * as THREE from 'three'
import {useThree} from "@react-three/fiber";
const CarComponent = ({  world, orbitControls }) => {
    const { scene, camera } = useThree();
    const character = useGame((state) => state.character);
    const [carInstance, setCarInstance] = useState(null);

    useEffect(() => {
        if (!world || !scene) return;

        const carModel = new THREE.Object3D()
        if (character) {
            const newCar = new Car(carModel, world, camera, orbitControls);
             newCar.init();
             // newCar.scene.scale.set(0.02, 0.02, 0.02)
             scene.add(newCar.scene)

             setCarInstance(newCar);
        } else {

            if (carInstance && world) {
                scene.remove(carInstance.scene);
                carInstance.destroy();
                setCarInstance(null);
            }
        }

        return () => {

            if (carInstance && world) {
                scene.remove(carInstance.scene);
                carInstance.destroy();
                setCarInstance(null);
            }
        };
    }, [character, scene, world]); // Runs when `character` changes

    return null; // No need for JSX, as the car is added directly to the scene
};

export default CarComponent;
