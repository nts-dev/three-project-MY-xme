import React, {Fragment, useMemo} from "react";
import CollectibleMesh from "./CollectibleMesh.jsx";
import MovementAsset from "./MovementAsset.jsx"; // Assuming the combined mesh from previous step

const KEY_COLORS = ["red", "green", "yellow", "blue"];

// --- main list component ---
export default function CollectibleMeshesFromInstanceData({
                                                              type, // 'key' or 'invisible'
                                                              instanceData = [],
                                                              textures, // For 'key': object { color: texture }
                                                              texture, // For 'invisible': single texture
                                                              size,
                                                              collectable,
                                                              token,
                                                          }) {
    // ✅ memoize mapped items so they only regenerate when inputs change
    const items = useMemo(() => {
        return instanceData.map((data, i) => {
            const position = [...(data.position || [0, 0, 0])];
            position[1] += 0.011; // lift above tile
            const rotation = data.rotation || [0, 0, 0];
            const id = data.key;


            // Handle type-specific props
            const typeSpecificProps = type === 'key' ? {
                color: KEY_COLORS[i % KEY_COLORS.length],
                texture: textures?.[KEY_COLORS[i % KEY_COLORS.length]],
            } : {
                texture,
            };

            return (
                <Fragment key={`${id}_`}>
                    {token.category!=='movement' && <CollectibleMesh
                    key={id}
                    type={type}
                    id={id}
                    token={token}
                    {...typeSpecificProps}
                    rPosition={position}
                    rotation={rotation}
                    size={size}
                    collectable={collectable}
                />}
                    {/*{token.category==='movement' &&*/}
                    {/*    <MovementAsset*/}
                    {/*    key={`${id}_moving`}*/}
                    {/*    data={data}*/}
                    {/*    object={object}*/}
                    {/*    {...typeSpecificProps}*/}
                    {/*    token={token}*/}
                    {/*    size={size}*/}
                    {/*/>}*/}
                </Fragment>
            );
        });
    }, [collectable, instanceData, size, texture, textures, token, type]); // Dependencies adapt to type

    return <>{items}</>;
}
