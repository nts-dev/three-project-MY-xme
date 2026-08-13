import * as React from "react";
import {useEffect, useRef, useState} from "react";
import {TextureLoader, Mesh, BoxGeometry, MeshStandardMaterial, Vector3} from "three";
import useGame from "../../hooks/useGame";
import * as THREE from "three";
import Waters from "./Waters"
import {useThree} from "@react-three/fiber";
import Ocean from "./Ocean";


const Ground: any = () => {
    const projectId: any = useGame((state: any) => state.projectID);  // Get projectId from global state
    const projectBaseId = String(projectId).replace(/_L\d+$/i, "");
    const floorMap = useGame((state: any) => state.floorMap);  // Get floorMap from global state
    const isPuzzleGame = useGame((state: any) => state.isPuzzleGame);
    const [dfTexture, setDfTexture] = useState<any>(null);
    const [sTexture, setSTexture] = useState<any>(null);
    const {scene} = useThree()
 
    const setCharacterIsInWater: any = useGame((state: any) => state.setCharacterIsInWater)
    // Load textures with onLoad callbacks to ensure they are loaded before applying
    useEffect(() => {
        // Load the default texture for the floor
        const dfTexLoader = new TextureLoader();
        dfTexLoader.load(
            `${import.meta.env.VITE_FILE_URL}/BedFrame_albedo.jpg`,
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                setDfTexture(texture);
            }
        );

        // Load the specific project texture if applicable
        if (projectBaseId === '125' || projectBaseId === '48' || projectBaseId === '33') {
            const sTexLoader = new TextureLoader();
            sTexLoader.load(
                `${import.meta.env.VITE_FILE_URL}/${projectBaseId}.JPG`,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    setSTexture(texture);
                }
            );
        }
    }, [projectBaseId]);

    useEffect(() => {
        if (!scene || !dfTexture || !floorMap) return; // Make sure the scene and textures are loaded

        let material: MeshStandardMaterial;
        if ((projectBaseId === '125' || projectBaseId === '48' || projectBaseId === '33') && sTexture) {
            material = new MeshStandardMaterial({map: sTexture});
        } else {
            material = new MeshStandardMaterial({map: dfTexture});
        }

        // Create the mesh (either for project 125 or other projects)
        let mesh: Mesh;
        if (projectBaseId === '125') {
            mesh = new Mesh(new BoxGeometry(333, 0.5, 160), material);
            mesh.position.set(-35, -4.8, 12);
            mesh.rotation.set(0, 57.2958 * 159.0129, 0);
        } else if (projectBaseId === '33') {
            mesh = new Mesh(new BoxGeometry(300, 0.5, 120), material);
            mesh.position.set(-20, -0, 18);
            mesh.rotation.set(0, 57.2958 * -159.014, 0);
        }else {
            const position = projectBaseId === '120' ? new Vector3(0, 0.05, 0) : new Vector3(18, -0.35, -35);
            const size = projectBaseId === '120' ? new Vector3(3850, 0.5, 2400) : new Vector3(385, 0.5, 240);
            const rotationVal =  projectBaseId === '33' ? 0 : 270.0108; 

            mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z), material);
            mesh.position.copy(position);
            mesh.rotation.set(0, 57.2958 * rotationVal, 0);
        }

        // Add the mesh to the scene
        scene.add(mesh);

        // Cleanup on unmount
        return () => {
            scene.remove(mesh);
        };
    }, [scene, projectBaseId, dfTexture, sTexture, floorMap]);

    // Return null because we are not rendering JSX, just manipulating the scene

    // if (projectId !== 144)
    //     return null;


    const handleOnCharacterIntersectionEnter = (event: any)=>{
        const collidedInstance = event.rigidBodyObject;
        if(collidedInstance.userData.name=='avatar'){
            setCharacterIsInWater(true)

        }

    }
    const handleOnCharacterIntersectionExit = (event: any)=>{
        const collidedInstance = event.rigidBodyObject;
        if(collidedInstance.userData.name=='avatar'){
            setCharacterIsInWater(false)
        }

    }

    if (!floorMap) return null;

    if(projectBaseId === '144' || isPuzzleGame)
    return (
        <>
            {/* {(projectId!==148 && projectId!==149 && projectId!==150) && <Waters/>} */}
            <Ocean />
        </>

    )
else return null

};

export default Ground;
