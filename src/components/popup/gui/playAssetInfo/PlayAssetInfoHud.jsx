import React, { useEffect, useState } from "react";
import useGame from "../../../../hooks/useGame";
import PlayAssetInfoFrame from "./PlayAssetInfoFrame";
import { usePlayAssetInfo } from "./usePlayAssetInfo";
import SystemBuilderPopup from "../systemBuilder/SystemBuilderPopup";
import "./PlayAssetInfoHud.css";

export default function PlayAssetInfoHud({ cameraRef, sceneRef }) {
    const buttonMode = useGame((state) => state.buttonMode);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const [hiddenInstanceId, setHiddenInstanceId] = useState(null);
    const [hiddenRequestKey, setHiddenRequestKey] = useState(null);
    const [isSystemBuilderOpen, setIsSystemBuilderOpen] = useState(false);
    const assetInfo = usePlayAssetInfo({
        active: !isPuzzleGame ,
        cameraRef,
        sceneRef,
    });

    useEffect(() => {
       
        if (hiddenInstanceId && assetInfo?.requestKey && assetInfo.requestKey !== hiddenRequestKey) {
            setHiddenInstanceId(null);
            setHiddenRequestKey(null);
            return;
        }

        if (hiddenInstanceId && assetInfo?.instanceId && String(assetInfo.instanceId) !== String(hiddenInstanceId)) {
            setHiddenInstanceId(null);
            setHiddenRequestKey(null);
        }
    }, [assetInfo?.instanceId, assetInfo?.requestKey, hiddenInstanceId, hiddenRequestKey]);

    if (!assetInfo || String(assetInfo.instanceId) === String(hiddenInstanceId)) {
        return null;
    }

    return (
        <>
            <PlayAssetInfoFrame
                assetInfo={assetInfo}
                onSystemBuilderOpen={() => setIsSystemBuilderOpen(true)}
                onClose={() => {
                    setHiddenInstanceId(assetInfo.instanceId);
                    setHiddenRequestKey(assetInfo.requestKey || null);
                }}
            />
            <SystemBuilderPopup
                visible={isSystemBuilderOpen}
                systemId={599}
                onClose={() => setIsSystemBuilderOpen(false)}
            />
        </>
    );
}
