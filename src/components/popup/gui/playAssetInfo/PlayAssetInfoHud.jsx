import React, { useEffect, useState } from "react";
import {
    FaArrowLeft,
    FaBell,
    FaBuilding,
    FaClock,
    FaDownload,
    FaEnvelope,
    FaGlobe,
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
import { formatStreetAddress, getBusinessKind } from "./businessKind";
import { GALLERY_UPDATED_EVENT, firstRealPhotoUrl, getGalleryCacheKey, isPlaceholderImage, loadAssetGalleryImages, photoCredit } from "./galleryImages";

const firstPhotoCredit = (images) => photoCredit((images || []).find((image) => !isPlaceholderImage(image)));
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

const getApiBaseUrl = () => (
    String(import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000/api" : "/api"))
        .trim()
        .replace(/\/+$/, "")
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
    // Names in priority order: "Company Name" wins over "AssetName" whatever the record's field order.
    const list = normalizeSpriteFields(fields);
    for (const name of names) {
        const wanted = String(name).trim().toLowerCase();
        const field = list.find((item) => String(item?.name || item?.label || "").trim().toLowerCase() === wanted);
        const value = field?.value;
        if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
    }
    return fallback;
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

const normalizePhoneNumber = (value) => (
    String(value || "")
        .replace(/[^\d+]/g, "")
        .replace(/^00/, "+")
);

const isUsableContactValue = (value) => {
    const normalized = String(value || "").trim();
    return normalized && normalized.toUpperCase() !== "N/A";
};

const buildPhoneHref = (value) => {
    const phone = normalizePhoneNumber(value);
    return phone ? `tel:${phone}` : "";
};

const buildWhatsAppHref = (value) => {
    const phone = normalizePhoneNumber(value).replace(/^\+/, "");
    return phone ? `https://wa.me/${phone}` : "";
};

const buildWebsiteHref = (value) => {
    const website = String(value || "").trim();
    if (!isUsableContactValue(website)) return "";
    return /^https?:\/\//i.test(website) ? website : `https://${website}`;
};

const buildMailHref = (value) => {
    const email = String(value || "").trim();
    return isUsableContactValue(email) ? `mailto:${email}` : "";
};

const flattenAssetInfoRows = (assetInfo) => (
    (assetInfo?.specGroups || []).flatMap((group) => group?.children || group?.rows || [])
);

const findAssetInfoValue = (assetInfo, names, fallback = "") => {
    const rows = flattenAssetInfoRows(assetInfo);
    const targets = names.map((name) => String(name).trim().toLowerCase());
    const exactMatch = rows.find((row) => (
        targets.includes(String(row?.name || row?.label || "").trim().toLowerCase())
    ));

    const looseMatch = exactMatch || rows.find((row) => {
        const rowName = String(row?.name || row?.label || "").trim().toLowerCase();
        return targets.some((target) => rowName.includes(target));
    });

    const value = looseMatch?.value;
    if (looseMatch && (value === undefined || value === null || String(value).trim() === "")) {
        return "N/A";
    }

    return value === undefined || value === null || String(value).trim() === "" ? fallback : String(value).trim();
};


const fetchGooglePlaceDetails = async (fields, fallbackTitle, fallbackAddress, fallbackRating, fallbackReviews) => {
    const companyName = getSpriteFieldValue(fields, ["Company Name", "AssetName", "Asset Name"], fallbackTitle);
    const coordinates = getSpriteFieldValue(fields, ["Cordinates", "Coordinates"], "");
    if (!companyName || !coordinates) return null;
   
    try {
        const url = `${getApiBaseUrl()}/search-places?cordinates=${encodeURIComponent(coordinates)}&companyName=${encodeURIComponent(companyName)}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const place = await res.json();
        return {
            title: place.name || place.title || companyName,
            address: place.address || place.formatted_address || place.vicinity || fallbackAddress,
            rating: String(place.rating ?? place.googleRating ?? fallbackRating),
            reviews: String(place.reviewCount ?? place.user_ratings_total ?? place.reviews ?? fallbackReviews),
        };
    } catch (e) { console.warn("Places lookup failed",e); return null; }
};


const normalizeWhatsAppMessages = (payload) => {
    const rows = Array.isArray(payload)
        ? payload
        : payload?.messages || payload?.data || payload?.rows || payload?.items || [];

    return (Array.isArray(rows) ? rows : []).map((message, index) => ({
        id: message.id || message.message_id || `${message.timestamp || ""}-${index}`,
        author: message.author || message.sender || message.senderName || message.userName || message.from || "WhatsApp",
        text: message.text || message.body || message.message || message.content || "",
        timestamp: message.timestamp || message.createdAt || message.created_at || message.time || "",
    })).filter((message) => String(message.text || "").trim());
};

const fetchWhatsAppMessagesForNumber = async (phoneNumber) => {
    const normalizedNumber = normalizePhoneNumber(phoneNumber);
    if (!normalizedNumber) return [];

    const apiBase = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
    const configuredUrl = String(import.meta.env.VITE_WHATSAPP_MESSAGES_URL || "").trim();
    const encodedNumber = encodeURIComponent(normalizedNumber);
    const candidates = [
        configuredUrl && `${configuredUrl.replace(/\/+$/, "")}?phone=${encodedNumber}`,
        apiBase && `${apiBase}/whatsapp/group-messages?phone=${encodedNumber}`,
        apiBase && `${apiBase}/whatsapp/messages?phone=${encodedNumber}`,
        apiBase && `${apiBase}/whatsapp-chat/${encodedNumber}`,
    ].filter(Boolean);

    for (const url of candidates) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const messages = normalizeWhatsAppMessages(await response.json());
            if (messages.length) return messages;
        } catch (error) {
            console.warn("Failed to load WhatsApp messages:", error);
        }
    }

    return [];
};

const buildSpritePopupInfo = (instanceId, projectId) => {
    const sceneAsset = sceneAssets?.[instanceId];
    const fields = sceneAsset?.instanceData?.assetObject?.fields;
    const fieldList = normalizeSpriteFields(fields);
    if (!sceneAsset && !fieldList.some((field) => String(field?.value ?? "").trim())) return null;

    const title = getSpriteFieldValue(fields, ["Company Name", "AssetName", "Asset Name"], sceneAsset?.name || `Asset ${instanceId}`);
    const companyName = getSpriteFieldValue(fields, ["Company Name"], "");
    const businessKind = getBusinessKind(
        getSpriteFieldValue(fields, ["Business Type", "Kind of Business", "Type"], ""),
        companyName,
        getSpriteFieldValue(fields, ["Business Description", "Description"], ""),
        getSpriteFieldValue(fields, ["Comments"], ""),
    );
    const businessType = businessKind.label;
    const streetNumber = getSpriteFieldValue(fields, ["Building Number", "Building No", "Street Number", "Street No."], "");
    const streetName = getSpriteFieldValue(fields, ["Street Name", "Street"], "");
    const streetAddress = formatStreetAddress(streetNumber, streetName);
    const floors = getSpriteFieldValue(fields, ["Floors", "Floor", "Level"], sceneAsset?.floor || "N/A");
    const status = getSpriteFieldValue(fields, ["Status"], sceneAsset?.inUse ? "Active" : "Active");
    const area = String(projectId).startsWith("153")
        ? "XME Business Park, Nilai Impian, 71800 Nilai, Negeri Sembilan, Malaysia"
        : getSpriteFieldValue(fields, ["City", "Area", "Location"], "Seri Kembangan, Selangor, Malaysia");
    const coordinates = getSpriteFieldValue(fields, ["Cordinates", "Coordinates"], "");
    const assetID = sceneAsset?.assetID || getSpriteFieldValue(fields, ["AssetID", "Asset Id"], instanceId);
    const address = getSpriteFieldValue(fields, ["Address", "Street Address"], area);
    const phone = getSpriteFieldValue(fields, ["Phone Number", "Phone", "Telephone", "Contact Number"], "+60 11-1073 6259");
    const whatsapp = getSpriteFieldValue(fields, ["WhatsApp", "Whatsapp", "WhatsApp Number"], phone);
    const website = getSpriteFieldValue(fields, ["Website Url", "Website URL", "Website", "Web", "URL"], "N/A");
    const email = getSpriteFieldValue(fields, ["Email", "Email Address"], "N/A");
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
        businessKind,
        streetNumber,
        streetName,
        streetAddress,
        floors,
        status,
        area,
        coordinates,
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
    const [googlePlace, setGooglePlace] = useState(null);
    const [googlePlaceStatus, setGooglePlaceStatus] = useState("idle");
    const [whatsAppChat, setWhatsAppChat] = useState(null);
    const [whatsAppMessages, setWhatsAppMessages] = useState([]);
    const [whatsAppStatus, setWhatsAppStatus] = useState("idle");
    // Same photo as the sidebar gallery: { instanceId, url ("" = none), loading }.
    const [galleryPhoto, setGalleryPhoto] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const instanceId = popup?.info?.instanceId;

        setPopupAssetInfo(null);
        setGooglePlace(null);
        setGooglePlaceStatus("idle");
        if (!instanceId) return undefined;

        loadPlayAssetInfo({
            instanceId,
            fallbackName: popup?.info?.title || "",
        }).then((nextInfo) => {
            if (!cancelled) {
                // Keep the loaded image data tied to the exact instance that
                // requested it. This prevents a late response from a previous
                // selection from becoming the image for the newly selected ID.
                setPopupAssetInfo({
                    instanceId: String(instanceId),
                    data: nextInfo,
                });
            }
        });

        return () => {
            cancelled = true;
        };
    }, [popup?.info?.instanceId, popup?.info?.title]);
    useEffect(() => {
        let cancelled = false;
        const currentLoadedInfo = (
            popupAssetInfo &&
            String(popupAssetInfo.instanceId || "") === String(popup?.info?.instanceId || "")
        ) ? popupAssetInfo.data : null;
        const fieldsForLookup = currentLoadedInfo
            ? flattenAssetInfoRows(currentLoadedInfo)
            : popup?.info?.fields;
        const coordinates = getSpriteFieldValue(fieldsForLookup, ["Cordinates", "Coordinates"], popup?.info?.coordinates || "");
        const companyName = getSpriteFieldValue(fieldsForLookup, ["Company Name", "AssetName", "Asset Name"], currentLoadedInfo?.title || popup?.info?.title || "");
        const address = getSpriteFieldValue(fieldsForLookup, ["Address", "Street Address"], popup?.info?.address || "");
        const rating = getSpriteFieldValue(fieldsForLookup, ["Rating", "Google Rating"], popup?.info?.rating || "");
        const reviews = getSpriteFieldValue(fieldsForLookup, ["Reviews", "Review Count"], popup?.info?.reviews || "");
        const hasCoordinates = Boolean(String(coordinates || "").trim());
        setGooglePlace(null);
        setGooglePlaceStatus(hasCoordinates ? "loading" : "idle");
        if (!fieldsForLookup || !hasCoordinates) return;
        
        fetchGooglePlaceDetails(
            fieldsForLookup,
            companyName,
            address,
            rating,
            reviews
        ).then((data)=>{
            if (cancelled) return;
            if (data) setGooglePlace(data);
            setGooglePlaceStatus(data ? "ready" : "empty");
        });
        return ()=>{cancelled=true;};
    }, [popup?.info?.instanceId, popupAssetInfo]);

    useEffect(() => {
        let cancelled = false;
        const instanceId = popup?.info?.instanceId;
        if (!instanceId) {
            setGalleryPhoto(null);
            return undefined;
        }
        const loadedInfo = popupAssetInfo && String(popupAssetInfo.instanceId) === String(instanceId) ? popupAssetInfo.data : null;
        const sceneAsset = sceneAssets?.[instanceId];
        const assetID = loadedInfo?.assetID || sceneAsset?.assetID || sceneAsset?.assetId || instanceId;
        const cacheKey = getGalleryCacheKey(instanceId, assetID);

        setGalleryPhoto((current) => (current?.instanceId === String(instanceId) && current.url ? current : { instanceId: String(instanceId), url: "", loading: true }));
        loadAssetGalleryImages({ instanceId, assetID, apiImages: Array.isArray(loadedInfo?.images) ? loadedInfo.images : [] })
            .then((images) => {
                if (!cancelled) setGalleryPhoto({ instanceId: String(instanceId), url: firstRealPhotoUrl(images), credit: firstPhotoCredit(images), loading: false });
            })
            .catch(() => {
                if (!cancelled) setGalleryPhoto({ instanceId: String(instanceId), url: "", loading: false });
            });

        // Uploads in the sidebar update the shared cache; follow them here.
        const handleGalleryUpdate = (event) => {
            if (event?.detail?.cacheKey !== cacheKey) return;
            setGalleryPhoto({ instanceId: String(instanceId), url: firstRealPhotoUrl(event.detail.images), credit: firstPhotoCredit(event.detail.images), loading: false });
        };
        window.addEventListener(GALLERY_UPDATED_EVENT, handleGalleryUpdate);
        return () => {
            cancelled = true;
            window.removeEventListener(GALLERY_UPDATED_EVENT, handleGalleryUpdate);
        };
    }, [popup?.info?.instanceId, popupAssetInfo]);

    useEffect(() => {
        setWhatsAppChat(null);
        setWhatsAppMessages([]);
        setWhatsAppStatus("idle");
    }, [popup?.info?.instanceId]);

    useEffect(() => {
        let cancelled = false;
        const phoneNumber = whatsAppChat?.phoneNumber;

        if (!phoneNumber) return undefined;

        setWhatsAppStatus("loading");
        setWhatsAppMessages([]);

        fetchWhatsAppMessagesForNumber(phoneNumber)
            .then((messages) => {
                if (cancelled) return;
                setWhatsAppMessages(messages);
                setWhatsAppStatus(messages.length ? "ready" : "empty");
            })
            .catch((error) => {
                console.warn("Failed to load WhatsApp chat:", error);
                if (!cancelled) {
                    setWhatsAppMessages([]);
                    setWhatsAppStatus("error");
                }
            });

        return () => {
            cancelled = true;
        };
    }, [whatsAppChat?.phoneNumber]);

    if (!popup?.info) return null;

    const { info } = popup;
    // Docked on the left of the screen, under the top bar (mobile CSS moves it to the bottom sheet).
    const left = 16;
    const top = 68;
    const KindIcon = info.businessKind?.Icon || FaBuilding;
    const initials = String(info.title || "")
        .replace(/\(.*?\)|\b(sdn|bhd)\b|[^\p{L}\p{N}\s]/giu, " ")
        .split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("");
    // Only reuse sidebar image data when it belongs to this exact instance ID.
    // Matching by title can accidentally reuse the previous asset's image when
    // two assets have the same/fallback title.
    const isSidebarMatch = activeAssetInfo && (
        String(activeAssetInfo.instanceId || "") === String(info.instanceId || "")
    );
    const sidebarPhotoUrl = isSidebarMatch
        ? activeAssetInfo?.images?.[0]?.itemImageSrc || activeAssetInfo?.imageUrl
        : "";

    // Only use the async image result if it was loaded for the currently
    // selected instance.
    const isPopupAssetInfoMatch = (
        popupAssetInfo &&
        String(popupAssetInfo.instanceId || "") === String(info.instanceId || "")
    );
    const resolvedPopupInfo = isPopupAssetInfoMatch ? popupAssetInfo.data : null;
    const resolvedPopupPhotoUrl = resolvedPopupInfo?.images?.[0]?.itemImageSrc || resolvedPopupInfo?.imageUrl;
    const matchingGalleryPhoto = galleryPhoto?.instanceId === String(info.instanceId) ? galleryPhoto : null;
    // The sidebar gallery photo first (uploaded images), then other sources; never the placeholder.
    const popupPhotoUrl = [matchingGalleryPhoto?.url, sidebarPhotoUrl, resolvedPopupPhotoUrl, info.photoUrl].find((url) => url && !isPlaceholderImage(url)) || "";
    const popupPhotoLoading = !popupPhotoUrl && Boolean(matchingGalleryPhoto?.loading);
    const displayPhone = findAssetInfoValue(resolvedPopupInfo, ["Telephone", "Phone Number", "Phone", "Contact Number"], info.phone);
    const displayWhatsApp = findAssetInfoValue(resolvedPopupInfo, ["WhatsApp", "Whatsapp", "WhatsApp Number"], info.whatsapp || displayPhone);
    const displayWebsite = findAssetInfoValue(resolvedPopupInfo, ["Website Url", "Website URL", "Website", "Web", "URL"], info.website);
    const displayEmail = findAssetInfoValue(resolvedPopupInfo, ["Email", "Email Address"], info.email);
    const displayOpeningHours = findAssetInfoValue(resolvedPopupInfo, ["Opening Hours", "Opening Hour", "Hours"], info.openingHours);
    const resolvedAddress = findAssetInfoValue(resolvedPopupInfo, ["Address", "Street Address"], info.address);
    const resolvedRating = findAssetInfoValue(resolvedPopupInfo, ["Rating", "Google Rating"], info.rating);
    const resolvedReviews = findAssetInfoValue(resolvedPopupInfo, ["Reviews", "Review Count"], info.reviews);
    const resolvedCoordinates = findAssetInfoValue(resolvedPopupInfo, ["Cordinates", "Coordinates"], info.coordinates);
    const displayTitle = googlePlace?.title || resolvedPopupInfo?.title || info.title;
    const isWaitingForGooglePlace = Boolean(resolvedCoordinates) && googlePlaceStatus === "loading";
    // Street number and name first (from the unit record), then the area.
    const displayStreet = info.streetAddress || "";
    const displayAddress = displayStreet
        ? info.area
        : isWaitingForGooglePlace ? "Loading address..." : googlePlace?.address || resolvedAddress;
    const displayRating = isWaitingForGooglePlace ? "..." : googlePlace?.rating || resolvedRating;
    const displayReviews = isWaitingForGooglePlace ? "..." : googlePlace?.reviews || resolvedReviews;
    const hasValue = (value) => isUsableContactValue(value) && !/^loading/i.test(String(value));
    const hasRating = hasValue(displayRating) && displayRating !== "..." && Number.parseFloat(displayRating) > 0;
    // "Mon–Fri 9 AM–6 PM; Sat 9 AM–1 PM; Sun Closed" -> one line per part.
    const hoursLines = hasValue(displayOpeningHours)
        ? String(displayOpeningHours).split(/\s*[;\n]\s*/).map((line) => line.trim()).filter(Boolean)
        : [];
    const phoneHref = buildPhoneHref(displayPhone);
    const whatsAppHref = buildWhatsAppHref(displayWhatsApp);
    const websiteHref = buildWebsiteHref(displayWebsite);
    const mailHref = buildMailHref(displayEmail);

    const openWhatsAppChat = (phoneNumber) => {
        const normalizedNumber = normalizePhoneNumber(phoneNumber);
        if (!normalizedNumber || normalizedNumber.toUpperCase?.() === "N/A") return;

        setWhatsAppChat({
            phoneNumber: normalizedNumber,
            title: displayTitle,
        });
    };

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
            className="play-building-label-popup blp"
            style={{ left, top, "--blp-accent": info.businessKind?.color || "#10b981" }}
            role="dialog"
            aria-label={`${displayTitle} marker details`}
        >
            <div className="blp__hero">
                {popupPhotoUrl ? (
                    <img key={`${info.instanceId}-${popupPhotoUrl}`} src={popupPhotoUrl} alt="" referrerPolicy="no-referrer" />
                ) : popupPhotoLoading ? (
                    <div className="play-asset-info__skeleton play-asset-info__skeleton--photo" role="status" aria-label="Loading photo" />
                ) : (
                    <div className="blp__hero-empty"><KindIcon aria-hidden="true" /></div>
                )}
                <span className="blp__industry">
                    <KindIcon aria-hidden="true" />
                    {info.businessType}
                </span>
                {popupPhotoUrl && popupPhotoUrl === matchingGalleryPhoto?.url && matchingGalleryPhoto?.credit && (
                    <span className="blp__credit">{matchingGalleryPhoto.credit}</span>
                )}
                <button type="button" className="blp__close" aria-label="Close marker details" onClick={onClose}>
                    <FaTimes aria-hidden="true" />
                </button>
            </div>

            <header className="blp__header">
                <label className="blp__logo" title="Upload logo">
                    {info.logoUrl ? <img src={info.logoUrl} alt="" /> : <span>{initials || <FaBuilding aria-hidden="true" />}</span>}
                    <input type="file" accept="image/*" onChange={uploadLogo} aria-label="Upload logo" />
                </label>
                <div className="blp__heading">
                    <h2 title={displayTitle}>{displayTitle}</h2>
                    {hasRating ? (
                        <div className="blp__rating" aria-label={`${displayRating} out of 5 stars, ${displayReviews} reviews`}>
                            <strong>{displayRating}</strong>
                            <span className="blp__stars" aria-hidden="true">
                                {getRatingStars(displayRating).map((star) => (
                                    star.type === "half"
                                        ? <FaStarHalfAlt key={star.key} />
                                        : star.type === "empty"
                                            ? <FaRegStar key={star.key} />
                                            : <FaStar key={star.key} />
                                ))}
                            </span>
                            <span>({displayReviews})</span>
                        </div>
                    ) : (
                        <div className="blp__rating blp__rating--empty">No reviews yet</div>
                    )}
                </div>
            </header>

            <div className="blp__address">
                <FaMapMarkerAlt aria-hidden="true" />
                <div>
                    {displayStreet && <strong>{displayStreet}</strong>}
                    {displayAddress && <span>{displayAddress}</span>}
                </div>
            </div>

            <nav className="blp__actions" aria-label="Contact">
                <a className={phoneHref ? "" : "is-disabled"} href={phoneHref || undefined} aria-disabled={!phoneHref}>
                    <span><FaPhoneAlt aria-hidden="true" /></span>Call
                </a>
                <button type="button" className={whatsAppHref ? "" : "is-disabled"} disabled={!whatsAppHref} onClick={() => openWhatsAppChat(displayWhatsApp)}>
                    <span><FaWhatsapp aria-hidden="true" /></span>WhatsApp
                </button>
                <a className={websiteHref ? "" : "is-disabled"} href={websiteHref || undefined} target="_blank" rel="noreferrer" aria-disabled={!websiteHref}>
                    <span><FaGlobe aria-hidden="true" /></span>Website
                </a>
                <a className={mailHref ? "" : "is-disabled"} href={mailHref || undefined} aria-disabled={!mailHref}>
                    <span><FaEnvelope aria-hidden="true" /></span>Email
                </a>
            </nav>

            <ul className="blp__list">
                {hoursLines.length > 0 && (
                    <li>
                        <FaClock aria-hidden="true" />
                        <div>
                            <span className="blp__list-label">Opening hours</span>
                            {hoursLines.map((line) => <strong key={line}>{line}</strong>)}
                        </div>
                    </li>
                )}
                {hasValue(displayPhone) && (
                    <li>
                        <FaPhoneAlt aria-hidden="true" />
                        <div>
                            <span className="blp__list-label">Phone</span>
                            <a href={phoneHref || undefined}>{displayPhone}</a>
                        </div>
                    </li>
                )}
                {hasValue(displayWebsite) && (
                    <li>
                        <FaGlobe aria-hidden="true" />
                        <div>
                            <span className="blp__list-label">Website</span>
                            <a href={websiteHref || undefined} target="_blank" rel="noreferrer">{displayWebsite.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}</a>
                        </div>
                    </li>
                )}
                {hasValue(displayEmail) && (
                    <li>
                        <FaEnvelope aria-hidden="true" />
                        <div>
                            <span className="blp__list-label">Email</span>
                            <a href={mailHref || undefined}>{displayEmail}</a>
                        </div>
                    </li>
                )}
            </ul>

            <footer className="blp__footer">
                <span className={`blp__status${/^(?!.*\bnot\b).*(in use|active|open)/i.test(String(info.status)) ? " is-on" : ""}`}><i aria-hidden="true" />{info.status}</span>
                <label className="blp__upload">
                    <FaUpload aria-hidden="true" />
                    Upload logo
                    <input type="file" accept="image/*" onChange={uploadLogo} />
                </label>
            </footer>
            {uploadStatus && <span className="play-building-label-popup__status">{uploadStatus}</span>}
            {whatsAppChat && (
                <div className="play-building-label-whatsapp" role="dialog" aria-label={`WhatsApp chat for ${whatsAppChat.phoneNumber}`}>
                    <div className="play-building-label-whatsapp__head">
                        <span><FaWhatsapp aria-hidden="true" /></span>
                        <div>
                            <strong>WhatsApp Chat</strong>
                            <p>{whatsAppChat.title} · {whatsAppChat.phoneNumber}</p>
                        </div>
                        <button type="button" aria-label="Close WhatsApp chat" onClick={() => setWhatsAppChat(null)}>
                            <FaTimes aria-hidden="true" />
                        </button>
                    </div>
                    <div className="play-building-label-whatsapp__messages">
                        {whatsAppStatus === "loading" && <p className="play-building-label-whatsapp__empty">Loading messages...</p>}
                        {whatsAppStatus === "empty" && <p className="play-building-label-whatsapp__empty">No WhatsApp group messages found for this number.</p>}
                        {whatsAppStatus === "error" && <p className="play-building-label-whatsapp__empty">Unable to load WhatsApp messages.</p>}
                        {whatsAppMessages.map((message) => (
                            <div className="play-building-label-whatsapp__message" key={message.id}>
                                <div>
                                    <strong>{message.author}</strong>
                                    {message.timestamp ? <span>{new Date(message.timestamp).toLocaleString()}</span> : null}
                                </div>
                                <p>{message.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
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
    const projectId = useGame((state) => state.projectID);
 
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
            const info = buildSpritePopupInfo(instanceId, projectId);

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
    }, [assetInfo?.instanceId, assetInfo?.requestKey, projectId]);

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
