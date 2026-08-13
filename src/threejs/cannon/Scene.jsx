import React, { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

import Ground from './Ground';
import CarComponent from "./CarComponent.jsx";
import PhysicsUpdater from "./PhysicsUpdater.jsx";
import {GameExperience} from "../GameExperience.jsx";
import {usePhysics} from "./PhysicsContext";
import useGame from "../../hooks/useGame";


const Scene = ({orbitControls}) => {
    const { scene, camera } = useThree();
    const sceneObj = new THREE.Object3D()
    const projectId = useGame((state) => state.projectID)
    const character = useGame((state) => state.character)
    const firstPerson= useGame((state) => state.firstPerson)

    const world = usePhysics();
    // Initialize scene
    useEffect(() => {
        sceneObj.scale.set(0.1, 0.1, 0.1)
        scene.add(sceneObj)

        return () => {

            // Cleanup scene resources if needed
            scene.remove(sceneObj);
        };
    }, [projectId]);

    return (
        <>
            <Ground key={`ground${projectId}`} scene={sceneObj} />
            <CarComponent key={`car${projectId}`} world={world} orbitControls={orbitControls}/>
            <GameExperience key={`gameexperience-${projectId}`} world={world} cscene={sceneObj}/>
           <PhysicsUpdater key={`physics${projectId}`} world={world}/>
        </>
    );
};

export default Scene;