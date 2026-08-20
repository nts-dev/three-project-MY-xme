import React, { useEffect, useRef, useState } from "react";
import {
    FaArrowLeft,
    FaBell,
    FaBuilding,
    FaDownload,
    FaLock,
    FaMapMarkerAlt,
    FaShareAlt,
    FaTimes,
    FaUpload,
    FaUser,
} from "react-icons/fa";
import useGame from "../../../../hooks/useGame";
import PlayAssetInfoFrame from "./PlayAssetInfoFrame";
import { usePlayAssetInfo } from "./usePlayAssetInfo";
import SystemBuilderPopup from "../systemBuilder/SystemBuilderPopup";
import { updateBuildingLabelSpriteLogo } from "../../../../threejs/label/BuildingLabelSprite";
import { sceneAssets } from "../../../../threejs/player/puzzle/character/Constants.jsx";
import "./PlayAssetInfoHud.css";

const normalizeSpriteFields = (fields) => {
    if (Array.isArray(fields)) return fields;
    if (fields && typeof fields === "object") {
        return Object.entries(fields).map(([key, value]) => (
            value && typeof value === "object"
                ? { name: value.name || key, ...value }
                : { name: key, value }
        ));
    }
    return [];
};

const getSpriteFieldValue = (fields, names, fallback = "") => {
    const wanted = names.map((name) => String(name).trim().toLowerCase());
    const field = normalizeSpriteFields(fields).find((item) => (
        wanted.includes(String(item?.name || "").trim().toLowerCase())
    ));
    const value = field?.value;
    return value === undefined || value === null || String(value).trim() === "" ? fallback : String(value);
};

const getLogoAssetIds = (info) => {
    const ids = [
        info?.instanceId,
        info?.sceneAsset?.assetID,
        info?.sceneAsset?.instanceData?.assetObject?.assetID,
        info?.sceneAsset?.instanceData?.assetObject?.assetId,
    ];

    return [...new Set(ids
        .filter((id) => id !== undefined && id !== null && String(id).trim())
        .map((id) => String(id).trim()))];
};

const buildSpritePopupInfo = (instanceId) => {
    const sceneAsset = sceneAssets?.[instanceId];
    const fields = sceneAsset?.instanceData?.assetObject?.fields;
    const fieldList = normalizeSpriteFields(fields);
    if (!fieldList.some((field) => String(field?.value ?? "").trim())) return null;

    const title = getSpriteFieldValue(fields, ["Company Name", "AssetName", "Asset Name"], sceneAsset?.name || `Asset ${instanceId}`);
    const businessType = getSpriteFieldValue(fields, ["Business Type", "Type"], "N/A");
    const streetNumber = getSpriteFieldValue(fields, ["Street Number", "Street No.", "Building Number", "Building No"], "N/A");
    const floors = getSpriteFieldValue(fields, ["Floors", "Floor", "Level"], sceneAsset?.floor || "N/A");
    const status = getSpriteFieldValue(fields, ["Status"], sceneAsset?.inUse ? "Active" : "Active");
    const area = getSpriteFieldValue(fields, ["City", "Area", "Location"], "Seri Kembangan, Selangor, Malaysia");
    const assetID = sceneAsset?.assetID || getSpriteFieldValue(fields, ["AssetID", "Asset Id"], instanceId);

    return {
        instanceId,
        sceneAsset,
        fields,
        title,
        assetID,
        businessType,
        streetNumber,
        floors,
        status,
        area,
    };
};

function BuildingLabelPopup({ popup, onClose, onMouseEnter, onMouseLeave }) {
    const [uploadStatus, setUploadStatus] = useState("");
    if (!popup?.info) return null;

    const { info } = popup;
    const left = Math.min(Math.max((popup.clientX || window.innerWidth / 2) + 18, 280), window.innerWidth - 270);
    const top = Math.min(Math.max((popup.clientY || window.innerHeight / 2) - 30, 56), window.innerHeight - 300);

    const uploadLogo = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        setUploadStatus("Uploading...");

        await updateBuildingLabelSpriteLogo({
            sprite: info.sceneAsset?.buildingLabel,
            fields: info.fields,
            fallbackName: info.sceneAsset?.name || info.title,
            logoUrl: previewUrl,
        });

        try {
            const formData = new FormData();
            const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
            const logoAssetIds = getLogoAssetIds(info);
            formData.append("asset_id", logoAssetIds[0] || info.instanceId);
            formData.append("asset_ids", JSON.stringify(logoAssetIds));
            formData.append("logo", file, `logo-${info.instanceId}-${Date.now()}-${safeName}`);

            const response = await fetch(`${import.meta.env.VITE_API_URL}/upload-logo`, {
                method: "POST",
                body: formData,
            });
            if (!response.ok) throw new Error(response.statusText || `HTTP ${response.status}`);
            const result = await response.json();
            const savedLogoUrl = result?.file?.url;
            if (savedLogoUrl) {
                await updateBuildingLabelSpriteLogo({
                    sprite: info.sceneAsset?.buildingLabel,
                    fields: info.fields,
                    fallbackName: info.sceneAsset?.name || info.title,
                    logoUrl: savedLogoUrl,
                });
            }
            setUploadStatus("Logo uploaded");
        } catch (error) {
            console.error("Failed to upload marker logo:", error);
            setUploadStatus("Logo upload failed");
        } finally {
            setTimeout(() => URL.revokeObjectURL(previewUrl), 1000);
        }
    };

    return (
        <div
            className="play-building-label-popup"
            style={{ left, top }}
            role="dialog"
            aria-label={`${info.title} marker details`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="play-building-label-popup__head">
                <span className="play-building-label-popup__icon"><FaBuilding aria-hidden="true" /></span>
                <div>
                    <strong>{info.title}</strong>
                    <span>AssetID - {info.assetID}</span>
                </div>
                <button type="button" aria-label="Close marker details" onClick={onClose}>
                    <FaTimes aria-hidden="true" />
                </button>
            </div>
            <dl className="play-building-label-popup__rows">
                <div><dt>Business Type</dt><dd>{info.businessType}</dd></div>
                <div><dt>Street Number</dt><dd>{info.streetNumber}</dd></div>
                <div><dt>Floors</dt><dd>{info.floors}</dd></div>
                <div><dt>Status</dt><dd className="is-active">• {info.status}</dd></div>
            </dl>
            <div className="play-building-label-popup__place">
                <strong>{info.title}</strong>
                <span>{info.area}</span>
            </div>
            <label className="play-building-label-popup__upload">
                <FaUpload aria-hidden="true" />
                <span>Upload Logo</span>
                <input type="file" accept="image/*" onChange={uploadLogo} />
            </label>
            {uploadStatus && <span className="play-building-label-popup__status">{uploadStatus}</span>}
        </div>
    );
}

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
    const [labelPopup, setLabelPopup] = useState(null);
    const labelPopupCloseTimerRef = useRef(null);
    const assetInfo = usePlayAssetInfo({
        active: !isPuzzleGame ,
        cameraRef,
        sceneRef,
    });

    const clearLabelPopupCloseTimer = () => {
        if (labelPopupCloseTimerRef.current) {
            window.clearTimeout(labelPopupCloseTimerRef.current);
            labelPopupCloseTimerRef.current = null;
        }
    };

    const scheduleLabelPopupClose = () => {
        clearLabelPopupCloseTimer();
        labelPopupCloseTimerRef.current = window.setTimeout(() => {
            setLabelPopup(null);
            labelPopupCloseTimerRef.current = null;
        }, 260);
    };

    useEffect(() => {
        const handleLabelHover = (event) => {
            clearLabelPopupCloseTimer();
            const instanceId = event.detail?.instanceId;
            const info = buildSpritePopupInfo(instanceId);
            if (!info) {
                setLabelPopup(null);
                return;
            }
            setLabelPopup((currentPopup) => {
                if (String(currentPopup?.info?.instanceId || "") === String(instanceId)) {
                    return {
                        ...currentPopup,
                        info,
                    };
                }

                return {
                    info,
                    clientX: event.detail?.clientX,
                    clientY: event.detail?.clientY,
                };
            });
        };

        window.addEventListener("play-building-label-hover", handleLabelHover);
        window.addEventListener("play-building-label-hover-end", scheduleLabelPopupClose);
        return () => {
            clearLabelPopupCloseTimer();
            window.removeEventListener("play-building-label-hover", handleLabelHover);
            window.removeEventListener("play-building-label-hover-end", scheduleLabelPopupClose);
        };
    }, []);

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
        return (
            <>
                {showMapDashboard ? <PlayMapDashboardChrome assetInfo={assetInfo} /> : null}
                <BuildingLabelPopup
                    popup={labelPopup}
                    onClose={() => setLabelPopup(null)}
                    onMouseEnter={clearLabelPopupCloseTimer}
                    onMouseLeave={scheduleLabelPopupClose}
                />
            </>
        );
    }

    return (
        <>
            {showMapDashboard ? <PlayMapDashboardChrome assetInfo={assetInfo} /> : null}
            <BuildingLabelPopup
                popup={labelPopup}
                onClose={() => setLabelPopup(null)}
                onMouseEnter={clearLabelPopupCloseTimer}
                onMouseLeave={scheduleLabelPopupClose}
            />
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
