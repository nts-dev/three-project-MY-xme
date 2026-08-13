import * as THREE from "three";

export default function EmissiveLightPlane({
                                position,
                                rotation,
                                width,
                                height,
                                color = 'orange',
                                intensity = 5
                            }) {
    return (
        <mesh position={position} rotation={rotation}>
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial
                color="black"
                emissive={new THREE.Color(color)}
                emissiveIntensity={intensity}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}
