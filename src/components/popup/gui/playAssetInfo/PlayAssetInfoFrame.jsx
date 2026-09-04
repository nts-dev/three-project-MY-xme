import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaArrowLeft,
    FaBuilding,
    FaCamera,
    FaCar,
    FaChevronLeft,
    FaChevronRight,
    FaDownload,
    FaEdit,
    FaGlobe,
    FaHeart,
    FaHospital,
    FaMapMarkerAlt,
    FaPhoneAlt,
    FaRegClock,
    FaRegStar,
    FaSchool,
    FaShareAlt,
    FaStar,
    FaStarHalfAlt,
    FaStore,
    FaTimes,
    FaUtensils,
} from "react-icons/fa";
import { Q } from "@nozbe/watermelondb";
import database from "../../../../database";
import useGame from "../../../../hooks/useGame";
import { sceneAssets } from "../../../../threejs/player/puzzle/character/Constants.jsx";
import { publicAssetCssUrl } from "../../../../puzzleUi/publicAssetUrl";

const leftAnchorUrl = publicAssetCssUrl("left.svg");
const rightAnchorUrl = publicAssetCssUrl("right.svg");

const isFaultyImageFileName = (fileName) => {
    const normalized = String(fileName || "").trim().toLowerCase();
    return !normalized || normalized === "no_image.png" || normalized === "image1.jpeg" || normalized === "image1.jpg";
};

const getImageHostUrl = (fileName) => {
    const text = String(fileName || "").trim();
    const cleanFileName = text.includes("/files/")
        ? text.split("/files/").pop()
        : text.replace(/^\.\.\/files\//i, "").replace(/^\/?files\//i, "");

    return `${import.meta.env.VITE_IMAGE_URL}/${String(cleanFileName || "no_image.png").split("/").map(encodeURIComponent).join("/")}`;
};

const getAssetImageUrl = (fileName) => {
    return getImageHostUrl(fileName);
};

const TAB_ITEMS = [
    { value: "spec", label: "Meta", icon: FaEdit },
    { value: "media", label: "Media", icon: FaCamera },
];

const specGroupsCache = new Map();
const infoCache = new Map();
const mediaCache = new Map();
const filesCache = new Map();
const logsCache = new Map();

const deferWork = (callback) => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        const frameId = window.requestAnimationFrame(callback);
        return () => window.cancelAnimationFrame(frameId);
    }

    const timerId = setTimeout(callback, 0);
    return () => clearTimeout(timerId);
};

const normalizeDateValue = (value) => {
    if (!value) return "";
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const slashMatch = text.match(/^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/);
    if (slashMatch) return `${slashMatch[3]}-${slashMatch[1]}-${slashMatch[2]}`;
    const dashMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dashMatch) return `${dashMatch[3]}-${dashMatch[2]}-${dashMatch[1]}`;
    return text;
};

const fieldValue = (field) => field?.value ?? "";
const HIDDEN_META_ROW_NAMES = new Set([
    "id",
    "assetid",
    "asset id",
    "assetname",
    "asset name",
    "date",
    "date in",
    "angle",
    "x-pos",
    "y-pos",
    "z-pos",
    "x pos",
    "y pos",
    "z pos",
    "position",
    "rotation",
    "scale",
    "scale factor",
    "color",
    "status",
    "v-align",
    "vertical align",
    "room",
    "branch",
]);

const shouldShowMetaRow = (field) => !HIDDEN_META_ROW_NAMES.has(String(field?.name || "").trim().toLowerCase());

const imageObject = (imageList) => {
    if (!imageList || imageList.length === 0) {
        const url = getImageHostUrl("no_image.png");
        return [{ itemImageSrc: url, thumbnailImageSrc: url, alt: "No image available" }];
    }

    const validImages = imageList.filter((image) => !isFaultyImageFileName(image?.name));
    if (!validImages.length) {
        const url = getImageHostUrl("no_image.png");
        return [{ itemImageSrc: url, thumbnailImageSrc: url, alt: "No image available" }];
    }

    return validImages.map((image, index) => {
        const url = getAssetImageUrl(image.name);
        return {
            id: image.id,
            itemImageSrc: url,
            thumbnailImageSrc: url,
            alt: `Asset image ${index + 1}`,
        };
    });
};

const buildGroupsFromTemplate = async (selectedAssetId, categoryIndex, fallbackTitle) => {
    if (!selectedAssetId || !categoryIndex) return [];

    const fieldsCollection = database.collections.get("fields");
    const templatesCollection = database.collections.get("templates");
    const optionsCollection = database.collections.get("options");
    const [fields, templates] = await Promise.all([
        fieldsCollection.query(Q.where("instance_id", selectedAssetId), Q.sortBy("field_id", Q.asc)).fetch(),
        templatesCollection.query(Q.where("category_id", String(categoryIndex))).fetch(),
    ]);

    const fieldsById = new Map(fields.map((item) => [item._raw.field_id, item._raw]));
    const hydratedTemplates = templates
        .map((item) => {
            const template = { ...item._raw };
            const field = fieldsById.get(template.field_id);
            const value = field?.value ?? template.value ?? "";

            return {
                ...template,
                value: typeof value === "string" ? value.replace("[]undefined", "Not connected") : value,
                instance_id: field?.instance_id,
                read_only: field?.read_only ?? template.read_only,
                visible: field?.visible ?? template.visible,
                index_id: field?.index_id,
            };
        });
    const visibleTemplates = hydratedTemplates.filter((item) => item.viewer === "1");

    const fieldMap = new Map();
    const rawFieldMap = new Map();
    const descriptions = [];

    hydratedTemplates.forEach((item) => {
        rawFieldMap.set(item.field_id, {
            fieldId: item.field_id,
            parentId: item.parent_id,
            name: item.name,
            value: item.value || "",
            type: item.type || "input",
            readOnly: item.read_only,
            visible: item.visible,
            indexId: item.index_id,
            isDescription: item.description,
            children: [],
            options: [],
        });
    });

    visibleTemplates.forEach((item) => {
        if (item.description === "1" && item.value) descriptions.push(item.value);
        fieldMap.set(item.field_id, {
            fieldId: item.field_id,
            parentId: item.parent_id,
            name: item.name,
            value: item.value || "",
            type: item.type || "input",
            readOnly: item.read_only,
            visible: item.visible,
            indexId: item.index_id,
            isDescription: item.description,
            children: [],
            options: [],
        });
    });

    const comboFields = [];
    for (const field of fieldMap.values()) {
        if (field.name === "Description") field.value = descriptions.join(" ");
        if (field.type === "combo") {
            comboFields.push(field);
        }
    }

    await Promise.all(comboFields.map(async (field) => {
        const options = await optionsCollection.query(Q.where("field_id", parseInt(field.fieldId, 10))).fetch();
        field.options = options.map((option) => ({
            id: option._raw.field_id,
            name: option._raw.name,
        }));
        field.value = field.value || field.options[0]?.name || "";
    }));

    const groupsByName = new Map();
    const assetName = visibleTemplates.find((item) => item.name === "AssetName");
    const fallbackGroupName = "Specifications";
    const ensureGroup = (sourceField = null) => {
        const groupName = sourceField?.name || fallbackGroupName;
        if (!groupsByName.has(groupName)) {
            groupsByName.set(groupName, {
                fieldId: sourceField?.fieldId || sourceField?.field_id || groupName,
                name: groupName,
                children: [],
            });
        }
        return groupsByName.get(groupName);
    };
    const addFieldToGroup = (group, field) => {
        if (!group || !field) return;
        if (group.children.some((item) => String(item.fieldId) === String(field.fieldId))) return;
        group.children.push(field);
    };
    const findParentLabel = (field) => {
        let parent = fieldMap.get(field.parentId) || rawFieldMap.get(field.parentId);
        const visited = new Set();

        while (parent && !visited.has(parent.fieldId)) {
            visited.add(parent.fieldId);
            if (parent.type === "label") {
                return parent;
            }
            parent = fieldMap.get(parent.parentId) || rawFieldMap.get(parent.parentId);
        }

        return null;
    };

    const fallbackGroup = ensureGroup({
        fieldId: "specifications",
        name: fallbackGroupName,
    });
    addFieldToGroup(fallbackGroup, { fieldId: "selected-id", name: "ID", value: selectedAssetId, type: "input", readOnly: "1" });
    addFieldToGroup(fallbackGroup, { fieldId: assetName?.field_id || "asset-name", name: assetName?.name || "AssetName", value: assetName?.value || fallbackTitle || "Not Defined", type: "input" });

    for (const field of fieldMap.values()) {
        if (field.type === "label" && field.parentId === 0) {
            ensureGroup(field);
        }
    }

    for (const field of fieldMap.values()) {
        if (field.type === "label") continue;

        const parentLabel = field.parentId ? findParentLabel(field) : null;
        if (parentLabel && field.value !== "") {
            addFieldToGroup(ensureGroup(parentLabel), field);
            continue;
        }

        if (field.value !== "") {
            addFieldToGroup(fallbackGroup, field);
        }
    }

    if (fallbackGroup.children.length <= 2 && groupsByName.size > 1) {
        groupsByName.delete(fallbackGroupName);
    }

    return Array.from(groupsByName.values()).filter((group) => group.children?.length);
};

const normalizeApiSpecGroups = (specGroups = []) => (
    Array.isArray(specGroups)
        ? specGroups.map((group, groupIndex) => ({
            fieldId: group.fieldId || group.title || `api-group-${groupIndex}`,
            name: group.name || group.title || "Details",
            children: (group.children || group.rows || []).map((field, fieldIndex) => ({
                fieldId: field.fieldId || field.label || `api-field-${groupIndex}-${fieldIndex}`,
                name: field.name || field.label || "Field",
                value: field.value,
                type: field.type || "input",
            })),
        })).filter((group) => group.children.length)
        : []
);

const PlaySpecTab = ({ assetInfo }) => {
    const [groups, setGroups] = useState([]);
    const [status, setStatus] = useState("loading");
    const selectedAssetId = assetInfo?.instanceId;
    const categoryIndex = assetInfo?.categoryIndex || sceneAssets?.[selectedAssetId]?.categoryIndex;
    const apiGroups = useMemo(() => normalizeApiSpecGroups(assetInfo?.specGroups), [assetInfo?.specGroups]);

    useEffect(() => {
        let cancelled = false;
        let cancelDeferred = null;

        const load = async () => {
            if (assetInfo?.hasSceneFields) {
                setGroups(apiGroups);
                setStatus(apiGroups.length ? "ready" : "idle");
                return;
            }

            if (!selectedAssetId || !categoryIndex) {
                setGroups(apiGroups);
                setStatus(apiGroups.length ? "ready" : "idle");
                return;
            }

            const cacheKey = `${selectedAssetId}:${categoryIndex}`;
            const cached = specGroupsCache.get(cacheKey);
            if (cached) {
                setGroups(cached.length ? cached : apiGroups);
                setStatus(cached.length || apiGroups.length ? "ready" : "idle");
                return;
            }

            try {
                setStatus("loading");
                const nextGroups = await buildGroupsFromTemplate(selectedAssetId, categoryIndex, assetInfo?.title);
                if (!cancelled) {
                    specGroupsCache.set(cacheKey, nextGroups);
                    setGroups(nextGroups.length ? nextGroups : apiGroups);
                    setStatus("ready");
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to load play asset fields:", error);
                    setGroups(apiGroups);
                    setStatus(apiGroups.length ? "ready" : "error");
                }
            }
        };

        cancelDeferred = deferWork(load);
        return () => {
            cancelled = true;
            cancelDeferred?.();
        };
    }, [apiGroups, assetInfo?.hasSceneFields, assetInfo?.title, categoryIndex, selectedAssetId]);

    if (status === "loading") return <div className="play-asset-info__empty">Loading fields...</div>;
    if (status === "error") return <div className="play-asset-info__empty">Unable to load fields</div>;
    if (!groups.length) return <div className="play-asset-info__empty">No fields available</div>;

    const rows = groups.flatMap((group) => group.children || []).filter(shouldShowMetaRow);
    if (!rows.length) return <div className="play-asset-info__empty">No fields available</div>;

    return (
        <div className="play-asset-info__groups play-asset-info__groups--flat">
            <div className="play-asset-info__rows">
                {rows.map((field, index) => (
                    <div className="play-asset-info__row" key={`${field.fieldId || field.name}-${index}`}>
                        <span>{field.name}</span>
                        <strong>{field.name === "Date In" ? normalizeDateValue(fieldValue(field)) : fieldValue(field) || "Not Defined"}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PlayInfoTab = ({ selectedAssetId }) => {
    const [status, setStatus] = useState("loading");
    const [htmlContent, setHtmlContent] = useState("");

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!selectedAssetId) {
                setHtmlContent("");
                setStatus("idle");
                return;
            }

            const cached = infoCache.get(String(selectedAssetId));
            if (cached !== undefined) {
                setHtmlContent(cached);
                setStatus("ready");
                return;
            }

            try {
                setStatus("loading");
                const response = await fetch(`${import.meta.env.VITE_API_URL}/notes/${selectedAssetId}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (!cancelled) {
                    const nextHtml = data?.notes || "";
                    infoCache.set(String(selectedAssetId), nextHtml);
                    setHtmlContent(nextHtml);
                    setStatus("ready");
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to load play asset info:", error);
                    setStatus("error");
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [selectedAssetId]);

    if (status === "loading") return <div className="play-asset-info__empty">Loading info...</div>;
    if (status === "error") return <div className="play-asset-info__empty">Unable to load info</div>;
    if (!htmlContent || htmlContent === "undefined" || !String(htmlContent).trim()) {
        return <div className="play-asset-info__empty">No info data</div>;
    }

    return <div className="play-asset-info__html" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

const PlayMediaTab = ({ assetInfo }) => {
    const [images, setImages] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const selectedAssetId = assetInfo?.instanceId;

    useEffect(() => {
        let cancelled = false;
        const fetchImages = async () => {
            try {
                setLoading(true);
                const sceneAsset = sceneAssets?.[selectedAssetId];
                const assetID = assetInfo?.assetID || sceneAsset?.assetID || sceneAsset?.assetId || selectedAssetId;
                const cacheKey = `${selectedAssetId}:${assetID}`;
                const cached = mediaCache.get(cacheKey);
                if (cached) {
                    setImages(cached);
                    setActiveIndex(0);
                    setLoading(false);
                    return;
                }
                const response = await fetch(`${import.meta.env.VITE_API_URL}/getImages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ assetID, id: selectedAssetId }),
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const allImages = await response.json();
                const imageList = allImages?.images?.length ? allImages.images : allImages?.category_images;
                if (!cancelled) {
                    const nextImages = imageObject(imageList);
                    mediaCache.set(cacheKey, nextImages);
                    setImages(nextImages);
                    setActiveIndex(0);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to fetch play asset images:", error);
                    setImages(imageObject([]));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchImages();
        return () => {
            cancelled = true;
        };
    }, [assetInfo?.assetID, selectedAssetId]);

    if (loading) return <div className="play-asset-info__empty">Loading media...</div>;

    const activeImage = images[activeIndex] || images[0];
    const goToPrevious = () => setActiveIndex((index) => (index <= 0 ? images.length - 1 : index - 1));
    const goToNext = () => setActiveIndex((index) => (index >= images.length - 1 ? 0 : index + 1));

    return (
        <div className="play-asset-info__media">
            <div className="play-asset-info__media-stage">
                <div className="play-asset-info__media-preview">
                    <img className="play-asset-info__media-main" src={activeImage?.itemImageSrc} alt={activeImage?.alt || ""} />
                </div>
                <div className="play-asset-info__media-actions" aria-label="Media actions">
                    <button type="button" aria-label="Download image" onClick={() => activeImage?.itemImageSrc && window.open(activeImage.itemImageSrc, "_blank")}>
                        <FaDownload aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Favorite image">
                        <FaHeart aria-hidden="true" />
                    </button>
                    <span aria-hidden="true" />
                    <button type="button" aria-label="Previous image" onClick={goToPrevious} disabled={images.length < 2}>
                        <FaChevronLeft aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Next image" onClick={goToNext} disabled={images.length < 2}>
                        <FaChevronRight aria-hidden="true" />
                    </button>
                </div>
            </div>
            <div className="play-asset-info__thumbs">
                {images.map((image, index) => (
                    <button
                        type="button"
                        key={`${image.itemImageSrc}-${index}`}
                        className={activeIndex === index ? "is-active" : ""}
                        onClick={() => setActiveIndex(index)}
                    >
                        <img src={image.thumbnailImageSrc} alt={image.alt || ""} />
                    </button>
                ))}
            </div>
        </div>
    );
};

const PlayFilesTab = ({ selectedAssetId }) => {
    const [files, setFiles] = useState([]);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let cancelled = false;
        const loadFiles = async () => {
            const cacheKey = String(selectedAssetId);
            const cached = filesCache.get(cacheKey);
            if (cached) {
                setFiles(cached);
                setStatus("ready");
                return;
            }

            try {
                setStatus("loading");
                const response = await fetch(`${import.meta.env.VITE_API_URL}/getDocumentFiles/${selectedAssetId}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (!cancelled) {
                    const nextFiles = (Array.isArray(data) ? data : []).map((fileData) => ({
                        url: `${import.meta.env.VITE_FILE_URL}/${fileData.name}`,
                        name: fileData.name,
                        type: fileData.type?.split("/")?.[1] || fileData.type || "",
                        date: fileData.date,
                    }));
                    filesCache.set(cacheKey, nextFiles);
                    setFiles(nextFiles);
                    setStatus("ready");
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to load play asset files:", error);
                    setFiles([]);
                    setStatus("error");
                }
            }
        };
        loadFiles();
        return () => {
            cancelled = true;
        };
    }, [selectedAssetId]);

    if (status === "loading") return <div className="play-asset-info__empty">Loading files...</div>;
    if (status === "error") return <div className="play-asset-info__empty">Unable to load files</div>;

    return (
        <table className="play-asset-info__table">
            <thead><tr><th>Name</th><th>Type</th><th>Date</th></tr></thead>
            <tbody>
                {files.length ? files.map((file) => (
                    <tr key={file.name} onDoubleClick={() => window.open(file.url, "_blank")}>
                        <td>{file.name}</td>
                        <td>{file.type}</td>
                        <td>{file.date}</td>
                    </tr>
                )) : <tr><td colSpan="3">No files available</td></tr>}
            </tbody>
        </table>
    );
};

const PlayLogsTab = ({ selectedAssetId }) => {
    const [logs, setLogs] = useState([]);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        let cancelled = false;
        const loadLogs = async () => {
            const cacheKey = String(selectedAssetId);
            const cached = logsCache.get(cacheKey);
            if (cached) {
                setLogs(cached);
                setStatus("ready");
                return;
            }

            try {
                setStatus("loading");
                const response = await fetch(`${import.meta.env.VITE_API_URL}/getPlanning/${selectedAssetId}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (!cancelled) {
                    const nextLogs = Array.isArray(data) ? data : [];
                    logsCache.set(cacheKey, nextLogs);
                    setLogs(nextLogs);
                    setStatus("ready");
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Failed to load play asset logs:", error);
                    setLogs([]);
                    setStatus("error");
                }
            }
        };
        loadLogs();
        return () => {
            cancelled = true;
        };
    }, [selectedAssetId]);

    if (status === "loading") return <div className="play-asset-info__empty">Loading logs...</div>;
    if (status === "error") return <div className="play-asset-info__empty">Unable to load logs</div>;

    return (
        <div className="play-asset-info__logs">
            {logs.length ? logs.map((log) => (
                <div className="play-asset-info__log" key={log.id || log.event_id}>
                    <strong>{log.event_name || log.name || "Log"}</strong>
                    <span>{log.start_date || log.date || ""}</span>
                    <p>{log.details || log.info || ""}</p>
                </div>
            )) : <div className="play-asset-info__empty">No logs available</div>}
        </div>
    );
};

const valueText = (value) => {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.filter(Boolean).join(", ");
    if (typeof value === "object") return Object.values(value).filter(Boolean).join(", ");
    return String(value).trim();
};

const getApiBaseUrl = () => (
    String(import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000/api" : "/api"))
        .trim()
        .replace(/\/+$/, "")
);

const findMetaValue = (rows, names) => {
    const targets = names.map((name) => String(name).trim().toLowerCase());
    const exactMatch = rows.find((row) => targets.includes(String(row?.name || "").trim().toLowerCase()));
    if (exactMatch) return valueText(exactMatch.value);

    const looseMatch = rows.find((row) => {
        const rowName = String(row?.name || "").trim().toLowerCase();
        return targets.some((target) => rowName.includes(target));
    });

    return looseMatch ? valueText(looseMatch.value) : "";
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

const fetchGooglePlaceDetails = async ({ companyName, coordinates, fallbackAddress, fallbackRating, fallbackReviews }) => {
    if (!companyName || !coordinates) return null;

    try {
        const url = `${getApiBaseUrl()}/search-places?cordinates=${encodeURIComponent(coordinates)}&companyName=${encodeURIComponent(companyName)}`;
        const response = await fetch(url);
        if (!response.ok) return null;

        const place = await response.json();
        return {
            title: place.name || place.title || companyName,
            address: place.address || place.formatted_address || place.vicinity || fallbackAddress,
            rating: String(place.rating ?? place.googleRating ?? fallbackRating),
            reviews: String(place.reviewCount ?? place.user_ratings_total ?? place.reviews ?? fallbackReviews),
        };
    } catch (error) {
        console.warn("Places lookup failed", error);
        return null;
    }
};

const getBusinessKind = (businessType, title, description) => {
    const text = `${businessType || ""} ${title || ""} ${description || ""}`.toLowerCase();

    if (/restaurant|food|cafe|coffee|dining|tomyam|kitchen|catering|bistro|bakery/.test(text)) {
        return { label: businessType || "Restaurant", Icon: FaUtensils, className: "restaurant" };
    }
    if (/school|education|academy|college|university|tuition|training/.test(text)) {
        return { label: businessType || "School", Icon: FaSchool, className: "school" };
    }
    if (/clinic|hospital|medical|pharmacy|health|dental/.test(text)) {
        return { label: businessType || "Healthcare", Icon: FaHospital, className: "healthcare" };
    }
    if (/car|auto|vehicle|garage|workshop|tyre|parking/.test(text)) {
        return { label: businessType || "Automotive", Icon: FaCar, className: "automotive" };
    }
    if (/store|shop|retail|market|mall|mart|trading/.test(text)) {
        return { label: businessType || "Store", Icon: FaStore, className: "store" };
    }

    return { label: businessType || "Company", Icon: FaBuilding, className: "company" };
};

const linkWithProtocol = (url) => {
    const text = valueText(url);
    if (!text) return "";
    return /^https?:\/\//i.test(text) ? text : `https://${text}`;
};

const getEditFieldIcon = (name) => {
    const text = String(name || "").trim().toLowerCase();
    if (/street|address|building|unit|city|state|town/.test(text)) return FaMapMarkerAlt;
    if (/opening|hours|schedule|check/.test(text)) return FaRegClock;
    if (/website|url|web/.test(text)) return FaGlobe;
    if (/telephone|phone|contact/.test(text)) return FaPhoneAlt;
    if (/business type|company type|category|type/.test(text)) return FaBuilding;
    return FaEdit;
};

const isLongEditField = (name, value) => {
    const text = String(name || "").trim().toLowerCase();
    return /description|comments|opening|hours|schedule/.test(text) || String(value || "").length > 70;
};

const buildMetaModel = (assetInfo, title) => {
    const groups = normalizeApiSpecGroups(assetInfo?.specGroups);
    const rows = groups.flatMap((group) => group.children || []).filter(shouldShowMetaRow);
    const companyName = findMetaValue(rows, ["Company Name", "AssetName"]) || title;
    const businessDescription = findMetaValue(rows, ["Business Description", "Description"]);
    const comments = findMetaValue(rows, ["Comments"]);
    const description = businessDescription || comments;
    const businessType = findMetaValue(rows, ["Business Type", "Company Type", "Category", "Type"]);
    const streetName = findMetaValue(rows, ["Street Name", "Street", "Address"]);
    const streetNumber = findMetaValue(rows, ["Street Number", "Street No.", "Street No", "No.", "No"]);
    const buildingNumber = findMetaValue(rows, ["Building Number", "Building No", "Unit"]);
    const formattedStreetNumber = streetNumber
        ? `No. ${String(streetNumber).replace(/^no\.?\s*/i, "").trim()}`
        : "";
    const address = [formattedStreetNumber, streetName].filter(Boolean).join(", ") ||
        [streetName, buildingNumber].filter(Boolean).join(", ") ||
        streetName ||
        buildingNumber;
    const city = findMetaValue(rows, ["City", "Town", "State"]) || "Seri Kembangan, Selangor, Malaysia";
    const openingHours = findMetaValue(rows, ["Opening Hours", "Hours"]);
    const website = findMetaValue(rows, ["Website Url", "Website URL", "Website"]);
    const telephone = findMetaValue(rows, ["Telephone", "Phone", "Contact"]);
    const businessKind = getBusinessKind(businessType, companyName, description);
    const consumedNames = new Set([
        "company name",
        "assetname",
        "business description",
        "description",
        "comments",
        "business type",
        "company type",
        "category",
        "type",
        "street name",
        "street",
        "address",
        "street number",
        "street no.",
        "street no",
        "no.",
        "no",
        "building number",
        "building no",
        "unit",
        "city",
        "town",
        "state",
        "opening hours",
        "hours",
        "website url",
        "website",
        "telephone",
        "phone",
        "contact",
    ]);
    const extraRows = rows
        .filter((row) => !consumedNames.has(String(row?.name || "").trim().toLowerCase()))
        .map((row) => ({ label: row.name, value: valueText(row.value) }))
        .filter((row) => row.value);

    return {
        address,
        businessKind,
        businessType,
        businessDescription,
        city,
        comments,
        companyName,
        description,
        extraRows,
        openingHours,
        rows,
        telephone,
        website,
    };
};

const PlaySidebarGallery = ({ assetInfo }) => {
    const [images, setImages] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const selectedAssetId = assetInfo?.instanceId;
    const sceneAsset = sceneAssets?.[selectedAssetId];
    const assetID = assetInfo?.assetID || sceneAsset?.assetID || sceneAsset?.assetId || selectedAssetId;
    const cacheKey = `${selectedAssetId}:${assetID}`;
    const apiImages = useMemo(() => (
        Array.isArray(assetInfo?.images)
            ? assetInfo.images.filter((image) => {
                const url = String(image?.itemImageSrc || image?.thumbnailImageSrc || "");
                return url && !/\/no_image\.png(?:$|\?)/i.test(url);
            })
            : []
    ), [assetInfo?.images]);

    const fetchImages = useCallback(async ({ force = false } = {}) => {
        try {
            setLoading(true);
            if (!force && apiImages.length) {
                mediaCache.set(cacheKey, apiImages);
                setImages(apiImages);
                setActiveIndex(0);
                setLoading(false);
                return;
            }

            if (!force) {
                const cached = mediaCache.get(cacheKey);
                if (cached) {
                    setImages(cached);
                    setActiveIndex(0);
                    setLoading(false);
                    return;
                }
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/getImages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assetID, id: selectedAssetId }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const allImages = await response.json();
            const imageList = allImages?.images?.length ? allImages.images : allImages?.category_images;
            const nextImages = imageObject(imageList);
            mediaCache.set(cacheKey, nextImages);
            setImages(nextImages);
            setActiveIndex(0);
        } catch (error) {
            console.error("Failed to fetch play asset images:", error);
            setImages(imageObject([]));
        } finally {
            setLoading(false);
        }
    }, [apiImages, assetID, cacheKey, selectedAssetId]);

    useEffect(() => {
        fetchImages();
    }, [fetchImages]);

    useEffect(() => {
        const handleAddPhotosRequest = (event) => {
            if (event?.detail?.selectedAssetId && event.detail.selectedAssetId !== selectedAssetId) return;
            fetchImages({ force: true });
        };

        window.addEventListener("play-asset-info-add-photos", handleAddPhotosRequest);
        return () => window.removeEventListener("play-asset-info-add-photos", handleAddPhotosRequest);
    }, [fetchImages, selectedAssetId]);

    const activeImage = images[activeIndex] || images[0];
    const hasMultipleImages = images.length > 1;
    const goToPrevious = () => setActiveIndex((index) => (index <= 0 ? images.length - 1 : index - 1));
    const goToNext = () => setActiveIndex((index) => (index >= images.length - 1 ? 0 : index + 1));

    return (
        <div className="play-asset-info__hero-gallery">
            <div className="play-asset-info__hero-image">
                {loading ? (
                    <div className="play-asset-info__empty">Loading photos...</div>
                ) : (
                    <img src={activeImage?.itemImageSrc} alt={activeImage?.alt || ""} />
                )}
                {hasMultipleImages && (
                    <>
                        <button type="button" className="play-asset-info__gallery-nav play-asset-info__gallery-nav--left" aria-label="Previous photo" onClick={goToPrevious}>
                            <FaChevronLeft aria-hidden="true" />
                        </button>
                        <button type="button" className="play-asset-info__gallery-nav play-asset-info__gallery-nav--right" aria-label="Next photo" onClick={goToNext}>
                            <FaChevronRight aria-hidden="true" />
                        </button>
                    </>
                )}
            </div>

            <div className="play-asset-info__gallery-footer">
                <div className="play-asset-info__gallery-thumbs" aria-label="Business photos">
                    {images.map((image, index) => (
                        <button
                            type="button"
                            key={`${image.thumbnailImageSrc}-${index}`}
                            className={activeIndex === index ? "is-active" : ""}
                            onClick={() => setActiveIndex(index)}
                            aria-label={`Show photo ${index + 1}`}
                        >
                            <img src={image.thumbnailImageSrc} alt="" />
                        </button>
                    ))}
                </div>
                <span className="play-asset-info__gallery-count">
                    {Math.min(activeIndex + 1, Math.max(images.length, 1))} / {Math.max(images.length, 1)}
                </span>
            </div>
        </div>
    );
};

export default function PlayAssetInfoFrame({ assetInfo, onClose, onSystemBuilderOpen }) {
    const projectId = useGame((state) => state.projectID);
    const selectedAssetId = assetInfo?.instanceId;
    const title = useMemo(() => assetInfo?.title || `Asset ${selectedAssetId}`, [assetInfo?.title, selectedAssetId]);
    const showSystemBuilder = String(projectId ?? "").includes("137");
    const meta = useMemo(() => buildMetaModel(assetInfo, title), [assetInfo, title]);
    const [isEditing, setIsEditing] = useState(false);
    const [draftRows, setDraftRows] = useState([]);
    const BusinessIcon = meta.businessKind.Icon;

    useEffect(() => {
        
        setDraftRows(meta.rows.map((row) => ({
            fieldId: row.fieldId,
            name: row.name,
            value: valueText(row.value),
        })));
        setIsEditing(false);
    }, [meta.rows, selectedAssetId]);

    const handleEditRequest = () => {
        setIsEditing(true);
        if (typeof window === "undefined") return;
        window.dispatchEvent(new CustomEvent("play-asset-info-edit-request", {
            detail: {
                assetInfo,
                instanceId: selectedAssetId,
                meta,
            },
        }));
    };

    const handleDraftChange = (index, value) => {
        setDraftRows((rows) => rows.map((row, rowIndex) => (
            rowIndex === index ? { ...row, value } : row
        )));
    };

    const handleSaveRequest = () => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("play-asset-info-save-request", {
                detail: {
                    assetInfo,
                    fields: draftRows,
                    instanceId: selectedAssetId,
                },
            }));
        }
        setIsEditing(false);
    };

    const handleAddPhotosRequest = () => {
        if (typeof window === "undefined") return;
        window.dispatchEvent(new CustomEvent("play-asset-info-add-photos", {
            detail: { selectedAssetId },
        }));
    };

    
    if (!assetInfo) return null;

    return (
        <aside
            className={`play-asset-info play-asset-info--sidebar${isEditing ? " is-editing" : ""}`}
            style={{
                "--play-asset-info-left-anchor-url": leftAnchorUrl,
                "--play-asset-info-right-anchor-url": rightAnchorUrl,
            }}
            aria-live="polite"
        >
            <span className="play-asset-info__anchor play-asset-info__anchor--tl" aria-hidden="true" />
            <span className="play-asset-info__anchor play-asset-info__anchor--tr" aria-hidden="true" />
            <span className="play-asset-info__anchor play-asset-info__anchor--bl" aria-hidden="true" />
            <span className="play-asset-info__anchor play-asset-info__anchor--br" aria-hidden="true" />
            <button type="button" className="play-asset-info__close" aria-label="Close asset info" onClick={onClose}>
                ×
            </button>

            <div className="play-asset-info__hero">
                <PlaySidebarGallery assetInfo={assetInfo} />
                <button type="button" className="play-asset-info__sidebar-back" aria-label="Close asset info" onClick={onClose}>
                    <FaArrowLeft aria-hidden="true" />
                </button>
            </div>

            <div className="play-asset-info__body">
                <div className="play-asset-info__title-block">
                    <h2>{meta.companyName || title}</h2>
                    {meta.city && <span className="play-asset-info__subtitle">{meta.city.split(",")[0]}</span>}
                    <div className="play-asset-info__rating-line">
                        <span className="play-asset-info__google-mark">G</span>
                        <strong>4.5</strong>
                        <span className="play-asset-info__rating-stars" aria-label="4.5 out of 5 stars">
                            <FaStar aria-hidden="true" />
                            <FaStar aria-hidden="true" />
                            <FaStar aria-hidden="true" />
                            <FaStar aria-hidden="true" />
                            <FaStar aria-hidden="true" />
                        </span>
                        <span>(127 reviews)</span>
                    </div>
                    <div className={`play-asset-info__business-badge play-asset-info__business-badge--${meta.businessKind.className}`}>
                        <BusinessIcon aria-hidden="true" />
                        <span>{meta.businessKind.label}</span>
                    </div>
                </div>

                <div className="play-asset-info__body-actions">
                    <button type="button" className="play-asset-info__edit-button" onClick={handleEditRequest}>
                        <FaEdit aria-hidden="true" />
                        <span>{isEditing ? "Editing" : "Edit info"}</span>
                    </button>
                    <button type="button" className="play-asset-info__add-photos" onClick={handleAddPhotosRequest}>
                        <FaCamera aria-hidden="true" />
                        <span>Add Photos</span>
                    </button>
                    {showSystemBuilder && (
                        <button
                            type="button"
                            className="play-asset-info__systembuilder"
                            onClick={onSystemBuilderOpen}
                        >
                            Systembuilder
                        </button>
                    )}
                </div>

                <section className="play-asset-info__meta-section" aria-label="Business metadata">
                    <h3>Meta</h3>
                    {isEditing ? (
                        <div className="play-asset-info__edit-form">
                            {draftRows.map((row, index) => {
                                const FieldIcon = getEditFieldIcon(row.name);
                                const useTextarea = isLongEditField(row.name, row.value);

                                return (
                                    <label className="play-asset-info__edit-row" key={`${row.fieldId || row.name}-${index}`}>
                                        <FieldIcon className="play-asset-info__edit-icon" aria-hidden="true" />
                                        <span>{row.name}</span>
                                        {useTextarea ? (
                                            <textarea
                                                rows={/opening|hours|schedule/i.test(row.name) ? 4 : 3}
                                                placeholder={`${row.name}...`}
                                                value={row.value}
                                                onChange={(event) => handleDraftChange(index, event.target.value)}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                placeholder={`${row.name}...`}
                                                value={row.value}
                                                onChange={(event) => handleDraftChange(index, event.target.value)}
                                            />
                                        )}
                                    </label>
                                );
                            })}
                            <div className="play-asset-info__edit-actions">
                                <button type="button" onClick={handleSaveRequest}>Save</button>
                                <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="play-asset-info__meta-list">
                        {meta.address && (
                            <div className="play-asset-info__meta-item">
                                <FaMapMarkerAlt aria-hidden="true" />
                                <div>
                                    <strong>{meta.address}</strong>
                                    {meta.city && <span>{meta.city}</span>}
                                </div>
                            </div>
                        )}
                        {meta.openingHours && (
                            <div className="play-asset-info__meta-item">
                                <FaRegClock aria-hidden="true" />
                                <div>
                                    <strong>{meta.openingHours}</strong>
                                </div>
                            </div>
                        )}
                        {meta.website && (
                            <a className="play-asset-info__meta-item" href={linkWithProtocol(meta.website)} target="_blank" rel="noreferrer">
                                <FaGlobe aria-hidden="true" />
                                <div>
                                    <strong>{meta.website}</strong>
                                </div>
                            </a>
                        )}
                        {meta.telephone && (
                            <a className="play-asset-info__meta-item" href={`tel:${meta.telephone.replace(/[^\d+]/g, "")}`}>
                                <FaPhoneAlt aria-hidden="true" />
                                <div>
                                    <strong>{meta.telephone}</strong>
                                </div>
                            </a>
                        )}
                        <button type="button" className="play-asset-info__meta-item play-asset-info__meta-action">
                            <FaShareAlt aria-hidden="true" />
                            <div>
                                <strong>Send to your phone</strong>
                            </div>
                        </button>
                        {meta.extraRows.slice(0, 6).map((row) => (
                            <div className="play-asset-info__meta-item play-asset-info__meta-item--plain" key={row.label}>
                                <BusinessIcon aria-hidden="true" />
                                <div>
                                    <span>{row.label}</span>
                                    <strong>{row.value}</strong>
                                </div>
                            </div>
                        ))}
                        {!meta.address && !meta.openingHours && !meta.website && !meta.telephone && !meta.extraRows.length && (
                            <div className="play-asset-info__empty">No metadata available</div>
                        )}
                        </div>
                    )}
                </section>
                {meta.businessDescription && (
                    <section className="play-asset-info__text-section" aria-label="About">
                        <h3>About</h3>
                        <p>{meta.businessDescription}</p>
                    </section>
                )}
                {meta.comments && (
                    <section className="play-asset-info__text-section play-asset-info__text-section--notes" aria-label="Notes">
                        <h3>Notes</h3>
                        <p>{meta.comments}</p>
                    </section>
                )}
            </div>
        </aside>
    );
}
