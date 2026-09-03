import React, { useEffect, useState } from "react";
import {
    FaArrowLeft,
    FaBell,
    FaBuilding,
    FaClock,
    FaDownload,
    FaEnvelope,
    FaGlobe,
    FaHotel,
    FaLock,
    FaMapMarkerAlt,
    FaPhoneAlt,
    FaRegStar,
    FaShareAlt,
    FaStar,
    FaStarHalfAlt,
    FaTimes,
    FaUpload,
    FaUser,
    FaWhatsapp,
} from "react-icons/fa";
import useGame from "../../../../hooks/useGame";
import PlayAssetInfoFrame from "./PlayAssetInfoFrame";
import { loadPlayAssetInfo } from "./assetInfoData";
import { usePlayAssetInfo } from "./usePlayAssetInfo";
import SystemBuilderPopup from "../systemBuilder/SystemBuilderPopup";
import { updateBuildingLabelSpriteLogo } from "../../../../threejs/label/BuildingLabelSprite";
import { sceneAssets } from "../../../../threejs/player/puzzle/character/Constants.jsx";
import "./PlayAssetInfoHud.css";

const buildBackendLogoUrl = (logoNameOrUrl) => {
    const value = String(logoNameOrUrl || "").trim();
    if (!value) return "";
    if (value.startsWith("data:") || value.startsWith("blob:")) {
        return value;
    }

    const apiBase = String(import.meta.env.VITE_API_URL || "")
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/api$/i, "");
    const cleanName = value
        .replace(/^https?:\/\/[^/]+\/.*?\/files\//i, "")
        .replace(/^https?:\/\/[^/]+\/files\//i, "")
        .replace(/^(\.\.\/)?files\//i, "")
        .replace(/^\/?(api\/)?files\//i, "")
        .replace(/^\/+/, "");
    const encodedPath = cleanName.split("/").map(encodeURIComponent).join("/");
    return apiBase ? `${apiBase}/files/${encodedPath}` : `/files/${encodedPath}`;
};

const buildImageHostUrl = (fileName = "no_image.png") => (
    `${import.meta.env.VITE_IMAGE_URL}/${String(fileName || "no_image.png").split("/").map(encodeURIComponent).join("/")}`
);

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

const getRatingStars = (rating) => {
    const numericRating = Math.max(0, Math.min(5, Number.parseFloat(rating) || 0));
    const fullStars = Math.floor(numericRating);
    const hasHalfStar = numericRating % 1 >= 0.25 && numericRating % 1 < 0.75;
    const roundedFullStars = numericRating % 1 >= 0.75 ? Math.min(fullStars + 1, 5) : fullStars;
    const emptyStars = Math.max(0, 5 - roundedFullStars - (hasHalfStar ? 1 : 0));

    return [
        ...Array.from({ length: roundedFullStars }, (_, index) => ({ type: "full", key: `full-${index}` })),
        ...(hasHalfStar ? [{ type: "half", key: "half" }] : []),
        ...Array.from({ length: emptyStars }, (_, index) => ({ type: "empty", key: `empty-${index}` })),
    ];
};

const buildSpritePopupInfo = (instanceId) => {
    const sceneAsset = sceneAssets?.[instanceId];
    const fields = sceneAsset?.instanceData?.assetObject?.fields;
    const fieldList = normalizeSpriteFields(fields);
    if (!sceneAsset && !fieldList.some((field) => String(field?.value ?? "").trim())) return null;

    const title = getSpriteFieldValue(fields, ["Company Name", "AssetName", "Asset Name"], sceneAsset?.name || `Asset ${instanceId}`);
    const businessType = getSpriteFieldValue(fields, ["Business Type", "Type"], "N/A");
    const streetNumber = getSpriteFieldValue(fields, ["Street Number", "Street No.", "Building Number", "Building No"], "N/A");
    const floors = getSpriteFieldValue(fields, ["Floors", "Floor", "Level"], sceneAsset?.floor || "N/A");
    const status = getSpriteFieldValue(fields, ["Status"], sceneAsset?.inUse ? "Active" : "Active");
    const area = getSpriteFieldValue(fields, ["City", "Area", "Location"], "Seri Kembangan, Selangor, Malaysia");
    const assetID = sceneAsset?.assetID || getSpriteFieldValue(fields, ["AssetID", "Asset Id"], instanceId);
    const address = getSpriteFieldValue(fields, ["Address", "Street Address"], area);
    const phone = getSpriteFieldValue(fields, ["Phone Number", "Phone", "Telephone", "Contact Number"], "+60 11-1073 6259");
    const whatsapp = getSpriteFieldValue(fields, ["WhatsApp", "Whatsapp", "WhatsApp Number"], phone);
    const website = getSpriteFieldValue(fields, ["Website", "Web", "URL"], "smilehotel.com.my");
    const email = getSpriteFieldValue(fields, ["Email", "Email Address"], "info@smilehotel.com.my");
    const openingHours = getSpriteFieldValue(fields, ["Opening Hours", "Opening Hour", "Hours"], "Mon-Fri: 9:00 AM-5:30");
    const saturdayHours = getSpriteFieldValue(fields, ["Saturday Hours", "Sat Hours"], "PM Sat: 9:00AM-1:30");
    const sundayHours = getSpriteFieldValue(fields, ["Sunday Hours", "Sun Hours"], "PM Sun: Closed");
    const rating = getSpriteFieldValue(fields, ["Rating", "Google Rating"], "4.5");
    const reviews = getSpriteFieldValue(fields, ["Reviews", "Review Count"], "127");
    const logoUrl = buildBackendLogoUrl(getSpriteFieldValue(fields, ["Logo", "Logo Url", "Logo URL", "Picture", "Image"], ""));
    const photoUrl = buildBackendLogoUrl(getSpriteFieldValue(fields, ["Photo", "Photo Url", "Photo URL", "Cover", "Cover Image", "Storefront"], ""));

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
        address,
        phone,
        whatsapp,
        website,
        email,
        openingHours,
        saturdayHours,
        sundayHours,
        rating,
        reviews,
        logoUrl,
        photoUrl,
    };
};

function BuildingLabelPopup({ popup, onClose, activeAssetInfo }) {
    const [uploadStatus, setUploadStatus] = useState("");
    const [popupAssetInfo, setPopupAssetInfo] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const instanceId = popup?.info?.instanceId;

        setPopupAssetInfo(null);
        if (!instanceId) return undefined;

        loadPlayAssetInfo({
            instanceId,
            fallbackName: popup?.info?.title || "",
        }).then((nextInfo) => {
            if (!cancelled) {
                setPopupAssetInfo(nextInfo);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [popup?.info?.instanceId, popup?.info?.title]);

    if (!popup?.info) return null;

    const { info } = popup;
    const left = Math.min(Math.max((popup.clientX || window.innerWidth / 2) + 16, 26), window.innerWidth - 314);
    const top = Math.min(Math.max((popup.clientY || window.innerHeight / 2) - 34, 42), window.innerHeight - 396);
    const isSidebarMatch = activeAssetInfo && (
        String(activeAssetInfo.instanceId || "") === String(info.instanceId || "") ||
        String(activeAssetInfo.title || "").trim().toLowerCase() === String(info.title || "").trim().toLowerCase()
    );
    const sidebarPhotoUrl = isSidebarMatch
        ? activeAssetInfo?.images?.[0]?.itemImageSrc || activeAssetInfo?.imageUrl
        : "";
    const resolvedPopupPhotoUrl = popupAssetInfo?.images?.[0]?.itemImageSrc || popupAssetInfo?.imageUrl;
    const popupPhotoUrl = sidebarPhotoUrl || resolvedPopupPhotoUrl || info.photoUrl || buildImageHostUrl("no_image.png");

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
            formData.append("instance_id", info.instanceId);
            formData.append("asset_id", info.instanceId);
            formData.append("logo", file, `logo-${info.instanceId}-${Date.now()}-${safeName}`);

            const response = await fetch(`${import.meta.env.VITE_API_URL}/upload-logo`, {
                method: "POST",
                body: formData,
            });
            if (!response.ok) throw new Error(response.statusText || `HTTP ${response.status}`);
            const result = await response.json();
            const savedLogoUrl = buildBackendLogoUrl(result?.file?.name || result?.file?.url);
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
        >
            <div className="play-building-label-popup__head">
                <span className="play-building-label-popup__icon"><FaHotel aria-hidden="true" /></span>
                <strong>{info.businessType}</strong>
                <button type="button" aria-label="Close marker details" onClick={onClose}>
                    <FaTimes aria-hidden="true" />
                </button>
            </div>
            <div className="play-building-label-popup__summary">
                <label className="play-building-label-popup__logo" aria-label="Upload logo">
                    {info.logoUrl ? <img src={info.logoUrl} alt="" /> : <FaBuilding aria-hidden="true" />}
                    <input type="file" accept="image/*" onChange={uploadLogo} />
                </label>
                <div className="play-building-label-popup__title-block">
                    <h2>{info.title}</h2>
                    <div className="play-building-label-popup__rating">
                        <span className="play-building-label-popup__stars" aria-label={`${info.rating} out of 5 stars`}>
                            {getRatingStars(info.rating).map((star) => (
                                star.type === "half"
                                    ? <FaStarHalfAlt key={star.key} aria-hidden="true" />
                                    : star.type === "empty"
                                        ? <FaRegStar key={star.key} aria-hidden="true" />
                                        : <FaStar key={star.key} aria-hidden="true" />
                            ))}
                        </span>
                        <strong>{info.rating}</strong>
                        <span>{info.reviews} reviews</span>
                    </div>
                    <p>{info.address}</p>
                </div>
            </div>
            <div className="play-building-label-popup__cards">
                <div className="play-building-label-popup__card play-building-label-popup__card--hours">
                    <FaClock aria-hidden="true" />
                    <div>
                        <span>Opening Hours</span>
                        <strong><i aria-hidden="true" />Open</strong>
                        <p>{info.openingHours}</p>
                        <p>{info.saturdayHours}</p>
                        <p>{info.sundayHours}</p>
                    </div>
                </div>
                <div className="play-building-label-popup__card">
                    <FaPhoneAlt aria-hidden="true" />
                    <div>
                        <span>Phone Number</span>
                        <strong>{info.phone}</strong>
                    </div>
                </div>
                <div className="play-building-label-popup__card">
                    <FaWhatsapp aria-hidden="true" />
                    <div>
                        <span>Whatsapp</span>
                        <strong>{info.whatsapp}</strong>
                    </div>
                </div>
                <div className="play-building-label-popup__card">
                    <FaGlobe aria-hidden="true" />
                    <div>
                        <span>Website</span>
                        <strong>{info.website}</strong>
                    </div>
                </div>
                <div className="play-building-label-popup__card">
                    <FaEnvelope aria-hidden="true" />
                    <div>
                        <span>Email</span>
                        <strong>{info.email}</strong>
                    </div>
                </div>
            </div>
            <div className="play-building-label-popup__photo">
                {popupPhotoUrl ? <img src={popupPhotoUrl} alt="" /> : null}
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
 
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const character = useGame((state) => state.character);
    const firstPerson = useGame((state) => state.firstPerson);

    const [hiddenInstanceId, setHiddenInstanceId] = useState(null);
    const [hiddenRequestKey, setHiddenRequestKey] = useState(null);
    const [isSystemBuilderOpen, setIsSystemBuilderOpen] = useState(false);
     const playAssetInfoRequest = useGame((state) => state.playAssetInfoRequest);
    const [labelPopup, setLabelPopup] = useState(null);
    const assetInfo = usePlayAssetInfo({
        active: !isPuzzleGame || character || firstPerson,
        cameraRef,
        sceneRef,
    });

    useEffect(() => {
        const handleBuildingLabelClick = (event) => {
            const instanceId = event.detail?.instanceId;
            const info = buildSpritePopupInfo(instanceId);

            if (!info) {
                setLabelPopup(null);
                return;
            }

            setLabelPopup({
                info,
                clientX: event.detail?.clientX,
                clientY: event.detail?.clientY,
            });

            if (assetInfo?.instanceId) {
                setHiddenInstanceId(assetInfo.instanceId);
                setHiddenRequestKey(assetInfo.requestKey || null);
            }
        };

        window.addEventListener("play-building-label-click", handleBuildingLabelClick);
        return () => {
            window.removeEventListener("play-building-label-click", handleBuildingLabelClick);
        };
    }, [assetInfo?.instanceId, assetInfo?.requestKey]);

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


    const isHiddenAsset = assetInfo && String(assetInfo.instanceId) === String(hiddenInstanceId);

    if (!assetInfo || isHiddenAsset) {
        return (
            <>
                {<PlayMapDashboardChrome assetInfo={assetInfo} /> }
                <BuildingLabelPopup
                    popup={labelPopup}
                    activeAssetInfo={assetInfo}
                    onClose={() => setLabelPopup(null)}
                />
            </>
        );
    }

    return (
        <>
            { <PlayMapDashboardChrome assetInfo={assetInfo} /> }
            <BuildingLabelPopup
                popup={labelPopup}
                activeAssetInfo={assetInfo}
                onClose={() => setLabelPopup(null)}
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
