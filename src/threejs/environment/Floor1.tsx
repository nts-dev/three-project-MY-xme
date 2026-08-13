import { RigidBody } from "@react-three/rapier";
import * as React from "react";
import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { useEffect, useState } from "react";
import { TextureLoader } from "three";
import useGame from "../../hooks/useGame";
import * as THREE from "three";

export default function Floor() {
    const projectId = 125//useGame((state: any) => state.projectID);
    const dfTexture = useLoader(TextureLoader, `${import.meta.env.VITE_FILE_URL}/BedFrame_albedo.jpg`);
    const floorMap = useGame((state: any) => state.floorMap);
    // const sTexture = projectId === 125 || projectId === 48 ? useLoader(TextureLoader, `${process.env.REACT_APP_FILE_URL}/${projectId}.JPG`) : null;
    // const [material, setMaterial] = useState<any>();

    const fbxModel = useLoader(FBXLoader, `${import.meta.env.VITE_FILE_URL}/Test.FBX`);
    // useEffect(() => {
    //     setMaterial(
    //         <meshStandardMaterial map={dfTexture} transparent={true} opacity={0} />
    //     );
    // }, [dfTexture]);
    useEffect(() => {
        const applyMaterialToFBX = () => {
            const material = new THREE.MeshPhongMaterial({
                map: null,
                transparent: true,
                opacity: 0.35,
                color: '#636363'
            });
            if (fbxModel) {
                fbxModel.traverse((child) => {
                    // @ts-ignore
                    if (child.isMesh) {
                        // @ts-ignore
                        child.material = material;
                    }
                });
            }
        };

        applyMaterialToFBX();
    }, [fbxModel]);

    return (
        <RigidBody
            type="fixed"
            colliders="trimesh" // This will use the mesh geometry for collision
            key={`${projectId}-${floorMap}`}
        >
            <primitive
                object={fbxModel} // Load the FBX model
                scale={[0.01, 0.01, 0.01]}
            >
            </primitive>
            <mesh position={[-35, -4.68, 12]} rotation={[0, 57.2958 * 159.0129, 0]}>
                <boxGeometry args={[333, 0.5, 160]}/>

            </mesh>
        </RigidBody>
    );
}
