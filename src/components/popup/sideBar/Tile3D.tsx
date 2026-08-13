import {useEffect, useRef} from "react";
import {Canvas, useFrame} from "@react-three/fiber";
import {OrbitControls} from "@react-three/drei";
import AdjustTilesCamera from "./AdjustTilesCamera";
import * as THREE from "three"

export default function Tile3D({ object, name,categoryIndex }: any){

    const cameraRef: any = useRef();
    const RotatingObject = ({ object }: { object: THREE.Object3D }) => {
        const ref = useRef<THREE.Object3D>(null);

        const convertTexturesToSRGB = (object: THREE.Object3D) => {
            // Traverse the object to find all materials and their textures
            object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const material = child.material;

                    // Check if the material has textures and convert them to sRGBEncoding
                    if (material.map) {
                        const texture = material.map;
                        texture.colorSpace = THREE.SRGBColorSpace;
                    }

                    if (material.emissiveMap) {
                        const texture = material.emissiveMap;
                        texture.colorSpace = THREE.SRGBColorSpace;
                    }

                    if (material.specularMap) {
                        const texture = material.specularMap;
                        texture.colorSpace = THREE.SRGBColorSpace;
                    }

                    // Repeat for any other texture properties your materials may have
                }
            });
        };
        useEffect(() => {

            if (object) {
                convertTexturesToSRGB(object);
            }
        }, []);
        // Rotate the object along the y-axis
        useFrame(() => {
            if (ref.current) {
                ref.current.rotation.y += 0.01; // Adjust rotation speed here
            }
        });

        return <primitive object={object} ref={ref} />;
    };
    if (!object) return null;

    return (
        <div key={`${name}-canvas-${categoryIndex}`}>
        <Canvas
            style={{ width: "100px", height: "100px" }}
            onCreated={({camera}) => {
                cameraRef.current = camera;

            }}
            camera={{  position: [0, 2, 2],fov: 50 }}
        >
            <OrbitControls dampingFactor={0.3} />

            <ambientLight intensity={2} />
            <pointLight position={[10, 10, 10]} />
            <RotatingObject object={object} />
            <AdjustTilesCamera object={object} camera={cameraRef} />
        </Canvas>
        </div>
    );
};
