import { RigidBody } from "@react-three/rapier";
import MovingAsset from "./MovingAsset";
import { useState, useEffect } from "react";
import useGame from "../hooks/useGame";


export default function AnimatedAsset({ instanceData, object, name }) {
    const [data, setData] = useState([]);
    const deleteAssetId = useGame((state) => state.deleteAssetId);
    const setDeleteAssetId = useGame((state) => state.setDeleteAssetId);
    // Optimize useEffect with a single dependency check
    useEffect(() => {
        setData(instanceData || []);
    }, [instanceData]);

    // Reset deleteAssetId after rendering to allow new deletions
    useEffect(() => {
        if (deleteAssetId) {
            setDeleteAssetId(null); // Reset after removal
        }
    }, [deleteAssetId, setDeleteAssetId]);

    return (
        <>
            {data
                .filter(item => item.key !== deleteAssetId)
                .map(item => (
                    <MovingAsset
                        key={item.key}
                        data={item}
                        object={object}
                    />
                ))}
        </>
    );
}