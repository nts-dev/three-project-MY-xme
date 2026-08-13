
import {useEffect, useState} from "react";
import useGame from "../../hooks/useGame";
import {useThree} from "@react-three/fiber";
import {FBXLoader} from "three/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "three";
import {Object3D} from "three";
import VideoTexture from "./VideoTexture";
import {useSelector} from "react-redux";


export default function Building() {
    const setMatList: any = useGame((state: any) => state.setMatList)
    const matList: Array<object> = useGame((state: any) => state.matList)
    const shadow: boolean = useGame((state: any) => state.shadow)

    const walls = useSelector((state: any) => state.menu.walls);
    // const walls: boolean = useGame((state: any) => state.walls)
    const setColliders: any = useGame((state: any) => state.setColliders)
    const {scene} = useThree()

    const projectID: number = useGame((state: any) => state.projectID)
    const checkReload = useGame((state: any) => state.checkReload);
    const colliders =  useGame((state: any) => state.colliders)
    const [wallObj, setWallObj] = useState<any>()
    const [loaded, setLoaded] = useState<boolean>(false)

    const updateWalls = (show: boolean, index: number) => {
        const wall = scene.getObjectByName('walls');

        if (!wall) {
            return; // Early exit if wall doesn't exist
        }

        wall.traverse((child: any) => {
            if (child.isMesh) {
                // Check if the child has materials
                if (child.material) {
                    // Handle material array or single material case
                    if (Array.isArray(child.material)) {
                        if (!show) {
                            // Apply semi-transparent materials
                            child.material.forEach((material: any, index: number) => {
                                const transparentMaterial = new THREE.MeshPhongMaterial({
                                    map: material.map,
                                    transparent: true,
                                    color: '#808080',
                                    opacity: 0.3,

                                });
                                child.material[index] = transparentMaterial;
                            });
                        } else {
                            // Restore original materials from matList
                            matList.forEach((material: any, index: number) => {
                                child.material[index] = material;
                            });
                        }
                    } else {
                        // For single material case
                        if (!show) {
                            child.material = new THREE.MeshPhongMaterial({
                                map:child.material.map,
                                transparent: true,
                                color: '#808080',
                                opacity: 0.3,
                            });
                        } else {
                            child.material = matList; // Restore original material
                        }
                    }
                }
            }
        });
    };

    // useEffect(() => {


    const setUpMaterials = (fbxFile: any) => {
        if (fbxFile.children.length > 0) {
            const oMatList: Array<object> = []
            let index = 0
            if (projectID == 48) {
                index = 6
            } else if (projectID == 32) {
                index = 2
                for(const i in fbxFile.children){
                    // @ts-ignore
                    if(i!=index)
                        updateNonWalls(fbxFile.children[i])
                }
            }else if (projectID == 125) {
                index = 3
                for(const i in fbxFile.children){
                    // @ts-ignore
                    if(i!=index)
                      updateNonWalls(fbxFile.children[i])
                }

            }
            fbxFile.children[index].traverse((child: any) => {
                if (child.isMesh) {
                    // Check if the child has materials
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach((materialr: any) => {
                                // const texture = materialr.map.clone()
                                // texture.colorSpace = THREE.SRGBColorSpace;
                                const tMaterials = new THREE.MeshPhongMaterial({
                                    map: materialr.map,
                                    color: '#b4b4b4'
                                });
                                if (tMaterials.map) {
                                    tMaterials.map.colorSpace = THREE.SRGBColorSpace;
                                    tMaterials.map.needsUpdate = true; // Ensure the texture updates
                                    tMaterials.map.wrapS = THREE.RepeatWrapping;
                                    tMaterials.map.wrapT = THREE.RepeatWrapping;
                                }

                                oMatList.push(tMaterials)
                            });
                        } else {
                            const tMaterials = new THREE.MeshPhongMaterial({
                                map: child.material.map,
                            });
                            if (tMaterials.map) {
                                tMaterials.map.colorSpace = THREE.SRGBColorSpace;
                                tMaterials.map.needsUpdate = true; // Ensure the texture updates
                                tMaterials.map.wrapS = THREE.RepeatWrapping;
                                tMaterials.map.wrapT = THREE.RepeatWrapping;
                            }
                            oMatList.push(tMaterials)
                        }
                    }
                }
            })

            fbxFile.traverse((child: any) => {

                if (child.isMesh && child.name == "Roof") {
                    child.layers.mask = 0
                }
            })

            if(projectID == 139){
                fbxFile.children[7].material.map((material: any, index: number)=>{
                    const tMaterials = new THREE.MeshPhongMaterial({
                        map: material.map,
                        color: '#808080'
                    });
                    fbxFile.children[7].material[index]= tMaterials
                })


            }

            fbxFile.children[index].name = 'walls'
            if (projectID == 125 || projectID == 48 || projectID == 70 || projectID == 132 || projectID == 135 || projectID == 137 || projectID == 139 || projectID == 32)
                updateWalls(false, index)
            setMatList(oMatList)
        }
    }


    const updateNonWalls = (mesh: any)=>{
        mesh.traverse((child: any) => {
            if (child.isMesh) {

                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((materialr: any, index: number) => {
                            const tMaterials = new THREE.MeshPhongMaterial({
                                map: materialr.map,
                                color: '#b4b4b4',
                                transparent: true,
                                opacity: 0.3
                            });
                            child.material[index] = tMaterials
                        });
                    } else {
                        const tMaterials = new THREE.MeshPhongMaterial({
                            map: child.material.map,
                            transparent: true,
                            opacity: 0.3

                        });
                        child.material= tMaterials
                    }
                }


            }
        })
    }


    useEffect(() => {
        if (projectID > 0) {
            const fbxLoader = new FBXLoader()
            fbxLoader.load(`${import.meta.env.VITE_FILE_URL}/${projectID}.FBX`, object => {

                if (scene) {
                    object.scale.multiplyScalar(0.01)
                    const sceneObj = scene.getObjectByName('sceneObj')
                    if (sceneObj) {
                        sceneObj.add(object)
                    }
                    else {
                        const sceneObject = new Object3D()
                        sceneObject.name = 'sceneObj'
                        sceneObject.add(object)
                        scene.add(sceneObject)
                    }
                }
                if(projectID==137){
                    setWallObj(object)
                    setLoaded(true)
                    // VideoTexture(object,camera,sound)
                    object.traverse((child: any) => {

                        if (child.isMesh && child.name == "Roof") {
                            child.layers.mask = 0
                        }
                    })
                }
                else{
                    setUpMaterials(object)
                }

                object.traverse((child: any) => {
                    if (child.isMesh) {
                        colliders.push(child); // Add the child mesh to the colliders array
                    }
                });


                setColliders([...colliders]);



            })
        }

    }, [projectID, checkReload])


    useEffect(() => {

        let index = 0
        if (projectID == 48) {
            index = 6
        } else if (projectID == 32) {
            index = 2
        }
        else if (projectID == 125) {
             index = 2
    }

        if (walls) {
            if(projectID!=137)
            updateWalls(true, index)

        } else if (!walls) {
            if(projectID!=137)
            updateWalls(false, index)
        }

    }, [shadow, walls, projectID, checkReload])

    return (
        <>
            {/* { loaded && <VideoTexture object={wallObj}/> } */}
        </>

    );


};
