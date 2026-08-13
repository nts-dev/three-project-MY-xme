import {Billboard, Text} from "@react-three/drei";
import * as THREE from "three";
import React from "react";

export default function PointText({text}) {
    return (
        <group>
            <Text
                font={`${import.meta.env.VITE_VIDEO_URL}/bebas-neue-v9-latin-regular.woff`}
                scale={2}

                rotation-y={Math.PI / 2}
            >
                {text}
                <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} />
            </Text>

        </group>
    );
}
