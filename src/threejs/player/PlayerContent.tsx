import {useLoader} from "@react-three/fiber";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import useGame from "../../hooks/useGame";
import  {useEffect, useMemo, useState} from "react";
import Ecctrl from "./Ecctrl";
import CharacterModel from "./CharacterModel";
import RemotePlayerList from "./RemotePlayerList";


export default function PlayerContent({ charUrl, projectID, client, orbitControls }: any) {

    const model: any = useLoader(GLTFLoader,charUrl);
    const character = useGame((state: any) => state.character);
    const firstPerson = useGame((state: any) => state.firstPerson);
    const center = useGame((state: any) => state.searchCenter);
    const [capsuleHalfHeight, setCapsuleHalfHeight] = useState(0.25);
    const [capsuleRadius, setCapsuleRadius] = useState(0.3);


    const charModel = useMemo(() => {
        const { animations } = model;
      
        if (animations && animations.length) {
            animations.forEach((animation: { name: string }, index: any) => {
                switch (index) {
                    case 0:
                        model.animations[index].name = "Idle";
                        break;
                    case 8:
                        model.animations[index].name = projectID === 144 ? "Idle" : "Jump";
                        break;
                    case 2:
                        model.animations[index].name = "Walk";
                        break;
                    case 10:
                        model.animations[index].name = projectID === 144 ? "Walk" : animation.name;
                        break;
                    case 4:
                        model.animations[index].name = projectID === 144 ? "Fail" : animation.name;
                        break;
                    case 5:
                        model.animations[index].name = projectID === 144 ? "Recover" : animation.name;
                        break;
                    case 6:
                        model.animations[index].name = projectID === 144 ? "Jump" : animation.name;
                        break;
                    case 15:
                        model.animations[index].name = projectID === 144 ? "Climb" : animation.name;
                        break;
                }
            });
        }
   
     model.scene?.scale.set(1.4,1.4,1.4)
        return model;
    }, [character, firstPerson, projectID,model, projectID]);


    useEffect(() => {
        if (projectID === 144) {
            setCapsuleHalfHeight(0.25);
            setCapsuleRadius(0.2);
        } else {
            setCapsuleHalfHeight(0.45);
            setCapsuleRadius(0.3);
        }


    }, [character, firstPerson, projectID, charModel, center]);


    return (

        <>

            {( character || firstPerson) && <Ecctrl
                key={`${projectID}_controller`}
                animated
                followLight={false}
                springK={0}
                dampingC={0}
                disableFollowCam={false}
                characterInitDir={Math.PI}
                client={client}
                orbitControls={orbitControls}
                capsuleHalfHeight={capsuleHalfHeight}
                capsuleRadius={capsuleRadius}
            >
                <CharacterModel charModel={charModel} />
            </Ecctrl> }

            <RemotePlayerList playerObject={charModel} />

      </>
    );
}
