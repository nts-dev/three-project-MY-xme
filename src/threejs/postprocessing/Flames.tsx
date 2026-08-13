import {SpriteAnimator} from "@react-three/drei";


export default function Flames({position}: any){


    return(
        <SpriteAnimator
            position={position}
            startFrame={0}
            autoPlay={true}
            loop={true}
            scale={3}
            textureImageURL={`${import.meta.env.VITE_FILE_URL}/flame.png`}
            textureDataURL={`${import.meta.env.VITE_FILE_URL}/flame.json`}
            alphaTest={0.05}
            asSprite={true}
        />
    )
}
