import { useEffect, useRef, useState } from "react";
import useGame from "../../../../hooks/useGame";
import { loadPlayAssetInfo } from "./assetInfoData";

export const usePlayAssetInfo = ({ active }) => {
    const [assetInfo, setAssetInfo] = useState(null);
    const playAssetInfoRequest = useGame((state) => state.playAssetInfoRequest);
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

        const cached = cacheRef.current.get(String(instanceId));
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
            instanceId,
            fallbackName: playAssetInfoRequest.name,
        }).then((nextInfo) => {
            if (requestId !== requestIdRef.current || !nextInfo) {
                return;
            }

            const infoWithRequest = {
                ...nextInfo,
                requestKey,
                categoryIndex: playAssetInfoRequest.categoryIndex ?? nextInfo.categoryIndex,
                assetID: playAssetInfoRequest.assetID ?? nextInfo.assetID,
                isLoadingDetails: false,
            };
            cacheRef.current.set(String(instanceId), nextInfo);
            setAssetInfo(infoWithRequest);
        }).catch((error) => {
            if (requestId === requestIdRef.current) {
                console.warn("Play asset info load failed:", error);
            }
        });
    }, [active, playAssetInfoRequest]);

    useEffect(() => {
        if (!active) {
            activeIdRef.current = null;
            setAssetInfo(null);
        }
    }, [active]);

    return assetInfo;
};
