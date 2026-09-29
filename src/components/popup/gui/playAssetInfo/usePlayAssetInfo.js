import { useEffect, useRef, useState } from "react";
import useGame from "../../../../hooks/useGame";
import { hasPlaySceneMetadata, loadPlayAssetInfo } from "./assetInfoData";

export const usePlayAssetInfo = ({ active }) => {
    const [assetInfo, setAssetInfo] = useState(null);
    const playAssetInfoRequest = useGame((state) => state.playAssetInfoRequest);
    const projectId = useGame((state) => state.projectID);
    const activeIdRef = useRef(null);
    const requestIdRef = useRef(0);
    const cacheRef = useRef(new Map());

    useEffect(() => {

        if (!active) {
            return;
        }
       
        const instanceId = playAssetInfoRequest?.instanceId;
        
        const requestKey = playAssetInfoRequest?.requestKey || playAssetInfoRequest;
        if (!instanceId) {
            return;
        }

        if (String(projectId) !== "153_L1" && !hasPlaySceneMetadata(instanceId)) {
            activeIdRef.current = null;
            setAssetInfo(null);
            return;
        }

        activeIdRef.current = instanceId;

        const immediateInfo = {
            instanceId,
            requestKey,
            title: playAssetInfoRequest.name || `Asset ${instanceId}`,
            categoryIndex: playAssetInfoRequest.categoryIndex,
            assetID: playAssetInfoRequest.assetID,
            imageUrl: "",
            images: [],
            specGroups: [],
            infoSections: [],
            isLoadingDetails: true,
        };

        const cacheKey = `${projectId}:${instanceId}`;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
            setAssetInfo({
                ...cached,
                requestKey,
                categoryIndex: playAssetInfoRequest.categoryIndex ?? cached.categoryIndex,
                assetID: playAssetInfoRequest.assetID ?? cached.assetID,
            });
            return;
        }

        setAssetInfo(immediateInfo);

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        loadPlayAssetInfo({
            projectId,
            instanceId,
            fallbackName: playAssetInfoRequest.name,
        }).then((nextInfo) => {
            if (requestId !== requestIdRef.current) {
                return;
            }

            if (!nextInfo) {
                activeIdRef.current = null;
                setAssetInfo(null);
                return;
            }

            const infoWithRequest = {
                ...nextInfo,
                requestKey,
                categoryIndex: playAssetInfoRequest.categoryIndex ?? nextInfo.categoryIndex,
                assetID: playAssetInfoRequest.assetID ?? nextInfo.assetID,
                isLoadingDetails: false,
            };
            cacheRef.current.set(cacheKey, nextInfo);
            setAssetInfo(infoWithRequest);
        }).catch((error) => {
            if (requestId === requestIdRef.current) {
                console.warn("Play asset info load failed:", error);
            }
        });
    }, [active, playAssetInfoRequest, projectId]);

    useEffect(() => {
        if (!active) {
            activeIdRef.current = null;
            setAssetInfo(null);
        }
    }, [active]);

    return assetInfo;
};
