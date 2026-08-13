import React, {Suspense, useEffect} from "react";
import useGame from "../../hooks/useGame";
import PlayerContent from "./PlayerContent";
import {Html} from "@react-three/drei";
import { ProgressBar } from 'primereact/progressbar';

export default function Player({ client, orbitControls }: any) {
    const projectID = useGame((state: any) => state.projectID);
    const charUrl =  projectID === 144 || projectID === 147? "sonic.glb" : "Nathan_man.glb";
    const characterUrl = `${import.meta.env.VITE_FILE_URL}/` + (projectID === 145? "blue_car.glb": charUrl )

    const center: any = useGame((state: any) => state.searchCenter);


    function Loader() {
        return (
            <Html
                key={charUrl}
                position={[center.x, center.y, center.z]} // Adjust for head height
                // occlude="blending"
                zIndexRange={[2, 0]}
            >
            <div className='progressBar' >
                <ProgressBar mode="indeterminate" />
            </div>
            </Html>
        );

    }
    return (
        <Suspense fallback={<Loader/>}>
            {/*<Car/>*/}
            <PlayerContent
                charUrl={characterUrl}
                projectID={projectID}
                client={client}
                orbitControls={orbitControls}
            />
        </Suspense>
    );
}
