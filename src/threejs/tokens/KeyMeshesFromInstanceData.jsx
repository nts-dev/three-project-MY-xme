import React, { useMemo } from "react";
import KeyMesh from "./KeyMesh.jsx";

const KEY_COLORS = ["red", "green", "yellow", "blue"];


// --- main list component ---
export default function KeyMeshesFromInstanceData({
                                                      instanceData = [],
                                                      textures = {},
                                                      size
                                                  }) {
    // ✅ memoize mapped keys so they only regenerate when inputs change
    const keys = useMemo(
        () =>
            instanceData.map((data, i) => {
                // console.log(data)
                const color = KEY_COLORS[i % KEY_COLORS.length];
                const texture = textures[color];
                const position = [...(data.position || [0, 0, 0])];
                position[1] += 0.011; // lift above tile
                const rotation = data.rotation || [0, 0, 0];
                const id = data.key;



                return (
                    <KeyMesh
                        key={id}
                        id={id}
                        color={color}
                        texture={texture}
                        position={position}
                        rotation={rotation}
                        size={size}

                    />
                );
            }),
        [instanceData, textures, size]
    );

    return <>{keys}</>;
}
