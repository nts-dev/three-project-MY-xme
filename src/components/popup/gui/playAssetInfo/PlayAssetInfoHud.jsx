import React, { useEffect, useState } from "react";
import {
    FaArrowLeft,
    FaBell,
    FaDownload,
    FaLock,
    FaMapMarkerAlt,
    FaShareAlt,
    FaUser,
} from "react-icons/fa";
import useGame from "../../../../hooks/useGame";
import PlayAssetInfoFrame from "./PlayAssetInfoFrame";
import { usePlayAssetInfo } from "./usePlayAssetInfo";
import SystemBuilderPopup from "../systemBuilder/SystemBuilderPopup";
import "./PlayAssetInfoHud.css";

function PlayMapDashboardChrome({ assetInfo }) {
    const projectId = useGame((state) => state.projectID);
    const setProjectID = useGame((state) => state.setProjectID);
    const setDirectPlayMode = useGame((state) => state.setDirectPlayMode);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const setCharacter = useGame((state) => state.setCharacter);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setPauseGame = useGame((state) => state.setPauseGame);
    const setEditorSelectionEnabled = useGame((state) => state.setEditorSelectionEnabled);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const mapName = String(projectId || "").startsWith("153") ? "New Office Extended" : "MY Map";

    const returnToTiles = () => {
        setProjectID(0);
        setDirectPlayMode(false);
        setButtonMode("Play mode");
        setCharacter(false);
        setFirstPerson(false);
        setPauseGame(false);
        setEditorSelectionEnabled(false);
        setSelectedEditorInstance(null);
        window.dispatchEvent(new CustomEvent("editor-detach-transform-controls"));
        window.dispatchEvent(new Event("resize"));
    };

    return (
        <div className="play-map-dashboard" aria-hidden="false">
            <div className="play-map-dashboard__topbar">
                <button type="button" className="play-map-dashboard__back" onClick={returnToTiles}>
                    <FaArrowLeft aria-hidden="true" />
                    <span>All Locations</span>
                </button>
                <div className="play-map-dashboard__brand">
                    <span><FaLock aria-hidden="true" /></span>
                    <strong>NTS Computers SDN BHD</strong>
                </div>
                <div className="play-map-dashboard__crumbs">
                    <span>{mapName}</span>
                    <span>{assetInfo?.title || "Select a location"}</span>
                </div>
                <div className="play-map-dashboard__live">
                    <span aria-hidden="true" />
                    Live Sync
                </div>
                <div className="play-map-dashboard__utility">
                    <button type="button" aria-label="Share"><FaShareAlt aria-hidden="true" /></button>
                    <button type="button" aria-label="Download"><FaDownload aria-hidden="true" /></button>
                    <button type="button" aria-label="Notifications"><FaBell aria-hidden="true" /></button>
                    <button type="button" aria-label="Profile"><FaUser aria-hidden="true" /></button>
                </div>
            </div>

            <div className="play-map-dashboard__view-toggle">
                <button type="button" className="is-active">3D</button>
                <button type="button">2D</button>
                <button type="button">Plan</button>
            </div>

            <div className="play-map-dashboard__bottom">
                <div><FaMapMarkerAlt aria-hidden="true" /> Jalan Sungai Besi Indah 5/2</div>
                <strong>{assetInfo?.title || "Selected location"}</strong>
            </div>

            <div className="play-map-dashboard__stats">
                <span>Buildings <strong>2</strong></span>
                <span>Floors <strong>7-8</strong></span>
                <span>Status <strong>Active</strong></span>
            </div>
        </div>
    );
}

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

    const showMapDashboard = buttonMode === "Play mode";
    const isHiddenAsset = assetInfo && String(assetInfo.instanceId) === String(hiddenInstanceId);

    if (!assetInfo || isHiddenAsset) {
        return showMapDashboard ? <PlayMapDashboardChrome assetInfo={assetInfo} /> : null;
    }

    return (
        <>
            {showMapDashboard ? <PlayMapDashboardChrome assetInfo={assetInfo} /> : null}
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
