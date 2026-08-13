import React, { useMemo } from "react";
import InvisibleMesh from "./InvisibleMesh.jsx";

// --- main list component ---
export default function InvisibleMeshesFromInstanceData({
                                                      instanceData = [],
                                                      texture,
                                                      size
                                                  }) {


    // ✅ memoize mapped keys so they only regenerate when inputs change
    const keys = useMemo(
        () =>
            instanceData.map((data) => {

                const position = [...(data.position || [0, 0, 0])];
                position[1] += 0.011; // lift above tile
                const rotation = data.rotation || [0, 0, 0];
                const id = data.key;



                return (
                    <InvisibleMesh
                        key={id}
                        id={id}
                        texture={texture}
                        position={position}
                        rotation={rotation}
                        size={size}

                    />
                );
            }),
        [instanceData, texture, size]
    );

    return <>{keys}</>;
}
