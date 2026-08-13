/* eslint-disable */
import { RigidBody } from "@react-three/rapier";
import * as React from "react";
import useGame from "../../hooks/useGame";
import {useLoader} from "@react-three/fiber";
import {useEffect, useRef, useState} from "react";
import {TextureLoader} from "three";
import {Q} from "@nozbe/watermelondb";
import database from "../../database";

export default function Floor() {
    const projectId = useGame((state) => state.projectID);
    const dfTexture = useLoader(TextureLoader, `${import.meta.env.VITE_VIDEO_URL}/BedFrame_albedo.jpg`);
    const floorHeight = useGame((state)  => state.floorHeight)
    const setFloorHeight = useGame((state)  => state.setFloorHeight)
    const characterRef = useGame((state)  => state.characterRef)
    const center= useGame((state) => state.searchCenter);

    const [material, setMaterial] = useState();
    const rigidBodyRef = useRef(null);
    const roomsCollection = database.collections.get('rooms');


    useEffect(() => {

       setMaterial(
           <meshStandardMaterial
               map={dfTexture}
               colorWrite={false}
               depthTest={false}
               depthWrite={false}
               transparent={false}
               opacity={0}
               color={'grey'}
           />
       );

    }, [projectId, dfTexture]);


    useEffect(() => {

        if (rigidBodyRef.current) {
            const currentPosition = rigidBodyRef.current.translation();
            rigidBodyRef.current.setTranslation({ x: currentPosition.x, y: floorHeight, z: currentPosition.z }, true);
        }
        if (characterRef) {
            const currentPosition = characterRef.translation();
            characterRef.setTranslation({ x: currentPosition.x, y: floorHeight, z: currentPosition.z }, true);
        }
    }, [floorHeight]);

    const findFloors = async () => {
        const rooms = await roomsCollection.query(Q.where('room_id', parseInt(projectId.toString()))).fetch()
        // @ts-ignore
        const floors = rooms[0]?._raw?.floors

        if(!floors){
            return;
        }

        const floorList = JSON.parse(floors)

        for(let i=0; i < floors.length-1;i++){
            const floor = floorList[i]/100
            const nFloor = floorList[i+1]/100
            if(center.y>=floor && center.y<nFloor){
                setFloorHeight(floor)
                return
            }
        }
        setFloorHeight(floorList[floorList.length-1]/100)


    }

    useEffect(() => {
        if(center){
            findFloors()
        }

    }, [center,projectId]);
    return (
        <RigidBody ref={rigidBodyRef}  type="fixed" key={`${projectId}`} >
            {projectId==125?(<mesh  position={[-35, -0.36, 12]} rotation={[0,57.2958*159.0129,0]}>
                    <boxGeometry args={[333,0.5,160]} />
                    {material}
                </mesh>):
                (<mesh   position={projectId==120?[0, 0.03, 0]:[18, -0.36, -35]} rotation={[0,57.2958*270.0108,0]}>
                    <boxGeometry args={projectId==120?[3850,0.5,2400]:[38500,0.5,24000]} />
                    {material}
                </mesh>)
            }
        </RigidBody>
    );
}
