import  { useEffect } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { useThree } from '@react-three/fiber';
import { usePhysics } from './PhysicsContext'; // Import the usePhysics hook

const Ground = ({ scene }) => {
    // const { scene } = useThree();
    const world = usePhysics(); // Access the physics world from context

    useEffect(() => {
        if (!world) return; // Ensure world is defined

        // Ground mesh
        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floorMesh = new THREE.Mesh(
            floorGeo,
            new THREE.MeshToonMaterial({ color: 'gray' })
        );
        floorMesh.rotation.x = -Math.PI * 0.5;
        scene.add(floorMesh);

        // Ground physics body
        const floorS = new CANNON.Plane();
        const floorB = new CANNON.Body({ mass: 0 });
        floorB.addShape(floorS);
        world.addBody(floorB);
        floorB.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5);

        return () => {
            // Cleanup ground resources if needed
            scene.remove(floorMesh);
            world.removeBody(floorB);
        };
    }, [scene, world]);

    return null; // Ground is added to the scene directly, so no JSX is returned
};

export default Ground;