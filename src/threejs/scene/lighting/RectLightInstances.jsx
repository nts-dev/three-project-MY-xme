import React, { useMemo } from "react";
import RectLight from "./RectLight";
import { sceneAssets } from "../../InstancePattern";
import SpotLight from "./SpotLight";
import EmissiveLightPlane from "./EmmisiveLightPlane";

export default function RectLightInstances({ instanceData }) {
    const lights = useMemo(() => {
        if (!instanceData || instanceData.length === 0) return [];

        return instanceData
            .filter(({ position }) => position !== undefined)
            .map(({ key, position, rotation }) => {
                const asset = sceneAssets[key];
                if (!asset) return null;

                const { length, halfHeight } = asset;
                const newPosition = [
                    position[0] - length / 200,
                    position[1] + halfHeight / 100,
                    position[2],
                ];

                return (

                    // <EmissiveLightPlane
                    //     key={key}
                    //     position={newPosition}
                    //     rotation={[rotation[0], -Math.PI / 2, rotation[2]]}
                    //     width={(halfHeight * 2) / 100}
                    //     height={(length * 2) / 100}
                    //     color="orange"
                    //     intensity={10}
                    // />
                    <RectLight
                        key={key}
                        position={newPosition}
                        rotation={[rotation[0], -Math.PI / 2, rotation[2]]}
                        width={(halfHeight * 2) / 100}
                        height={(length * 2) / 100}
                        intensity={6}
                        color="orange"
                        showPlane={true}
                    />

                    // <SpotLight
                    //     position={[newPosition]}
                    //     rotation={[-Math.PI / 2, 0, 0]}
                    //     angle={Math.PI / 8}
                    //     intensity={10}
                    //     color="orange"
                    //     showSprite={true}
                    // />
                );
            })
            .filter(Boolean); // remove any nulls
    }, [instanceData]);

    return <>{lights}</>;
}
