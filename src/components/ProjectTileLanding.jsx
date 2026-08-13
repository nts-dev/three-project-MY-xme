import React, { useEffect, useMemo, useRef, useState } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import useGame from "../hooks/useGame";
import "./ProjectTileLanding.css";

const PROJECTS = [
    {
        id: "33_L0",
        title: "MY Map",
        subtitle: "NTS Computers SDN BHD / First Floor / Floors 0-1380",
        user: "Admin User",
        date: "02/06/2026",
    },
    {
        id: "153_L1",
        title: "New Office Extended",
        subtitle: "NTS Computers SDN BHD / First Floor / Floors 0-1380",
        user: "Admin User",
        date: "04/16/2026",
    },
];

const THUMBNAIL_STORAGE_PREFIX = "nts-project-thumbnail:";
const API_BASE_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function getStoredThumbnail(projectId) {
    if (typeof window === "undefined") return "";

    try {
        const key = `${THUMBNAIL_STORAGE_PREFIX}${projectId}`;
        const storedUrl = window.localStorage.getItem(key) || "";
        if (/^data:image\//i.test(storedUrl)) {
            window.localStorage.removeItem(key);
            return "";
        }
        return storedUrl;
    } catch {
        return "";
    }
}

function resolveApiAssetUrl(url) {
    const rawUrl = String(url || "").trim();
    if (!rawUrl) return "";
    if (/^data:image\//i.test(rawUrl)) return "";
    if (!API_BASE_URL) return rawUrl;

    try {
        const apiUrl = new URL(`${API_BASE_URL}/`);
        const apiBasePath = apiUrl.pathname.replace(/\/+$/, "");
        const assetUrl = /^https?:\/\//i.test(rawUrl)
            ? new URL(rawUrl)
            : null;

        let assetPath = assetUrl ? assetUrl.pathname : rawUrl;
        if (assetUrl && assetUrl.origin !== apiUrl.origin) {
            return rawUrl;
        }

        assetPath = `/${assetPath.replace(/^\/+/, "")}`;
        if (apiBasePath && assetPath.startsWith(`${apiBasePath}/`)) {
            return `${apiUrl.origin}${assetPath}${assetUrl?.search || ""}`;
        }

        if (assetPath.startsWith("/api/") && apiBasePath !== "/api") {
            assetPath = assetPath.replace(/^\/api\//, "/");
        }

        return `${API_BASE_URL}/${assetPath.replace(/^\/+/, "")}${assetUrl?.search || ""}`;
    } catch {
        return rawUrl;
    }
}

function getBase64Payload(dataUrl) {
    return String(dataUrl || "").split(",")[1] || "";
}

function ProjectTile({ project, thumbnail, uploadState, onOpen, onThumbnailChange }) {
    const inputRef = useRef(null);

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            onThumbnailChange(project.id, file, String(reader.result || ""));
        };
        reader.readAsDataURL(file);
        event.target.value = "";
    };

    return (
        <article className="project-tile-card" onClick={() => onOpen(project.id)}>
            <div className="project-tile-thumbnail">
                {thumbnail ? (
                    <img src={thumbnail} alt={`${project.title} thumbnail`} />
                ) : (
                    <div className="project-tile-placeholder" aria-hidden="true" />
                )}
            </div>

            <div className="project-tile-meta">
                <span>
                    <PersonOutlineOutlinedIcon fontSize="inherit" />
                    {project.user}
                </span>
                <span>
                    <CalendarTodayOutlinedIcon fontSize="inherit" />
                    {project.date}
                </span>
            </div>

            <h2>{project.title}</h2>
            <p>{project.subtitle}</p>

            <div className="project-tile-actions">
                <button
                    type="button"
                    className="project-tile-view-button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onOpen(project.id);
                    }}
                >
                    <VisibilityIcon fontSize="inherit" />
                    View
                </button>
                <button
                    type="button"
                    className="project-tile-upload-button"
                    onClick={(event) => {
                        event.stopPropagation();
                        inputRef.current?.click();
                    }}
                >
                    <CloudUploadOutlinedIcon fontSize="inherit" />
                    {uploadState === "saving" ? "Saving" : "Image"}
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    onClick={(event) => event.stopPropagation()}
                />
            </div>
        </article>
    );
}

export default function ProjectTileLanding() {
    const setProjectID = useGame((state) => state.setProjectID);
    const setDirectPlayMode = useGame((state) => state.setDirectPlayMode);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const setCharacter = useGame((state) => state.setCharacter);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setPauseGame = useGame((state) => state.setPauseGame);
    const setGrid = useGame((state) => state.setGrid);
    const setEditorSelectionEnabled = useGame((state) => state.setEditorSelectionEnabled);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const setPackageControl = useGame((state) => state.setPackageControl);
    const setIsPackage = useGame((state) => state.setIsPackage);
    const [thumbnails, setThumbnails] = useState(() => {
        return PROJECTS.reduce((next, project) => {
            next[project.id] = resolveApiAssetUrl(getStoredThumbnail(project.id));
            return next;
        }, {});
    });
    const [uploadStates, setUploadStates] = useState({});

    const projects = useMemo(() => PROJECTS, []);

    useEffect(() => {
        if (!API_BASE_URL) return;

        let isCancelled = false;

        fetch(`${API_BASE_URL}/project-tile-image-list`)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((payload) => {
                if (isCancelled) return;

                const latestByProject = {};
                for (const image of payload?.images || []) {
                    const projectId = image?.projectId;
                    if (!projectId || latestByProject[projectId]) continue;
                    latestByProject[projectId] = resolveApiAssetUrl(image.url);
                }

                setThumbnails((current) => ({ ...current, ...latestByProject }));
            })
            .catch((error) => {
                console.warn("Failed to load project tile images:", error);
            });

        return () => {
            isCancelled = true;
        };
    }, []);

    const openProject = (projectId) => {
        setPackageControl(false);
        setIsPackage(false);
        setDirectPlayMode(true);
        setButtonMode("Play mode");
        setCharacter(false);
        setFirstPerson(false);
        setPauseGame(false);
        setGrid(false);
        setEditorSelectionEnabled(false);
        setSelectedEditorInstance(null);
        setProjectID(projectId);

        window.dispatchEvent(new CustomEvent("editor-detach-transform-controls"));
        window.dispatchEvent(new Event("resize"));
    };

    const updateThumbnail = async (projectId, file, dataUrl) => {
        if (!API_BASE_URL) return;

        setUploadStates((current) => ({ ...current, [projectId]: "saving" }));

        try {
            const response = await fetch(`${API_BASE_URL}/project-tile-images`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    tileId: projectId,
                    fileName: file.name,
                    contentBase64: getBase64Payload(dataUrl),
                }),
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.error || `HTTP ${response.status}`);
            }

            const payload = await response.json();
            const nextThumbnail = resolveApiAssetUrl(payload.url);
            if (nextThumbnail) {
                setThumbnails((current) => ({ ...current, [projectId]: nextThumbnail }));
                try {
                    window.localStorage.setItem(`${THUMBNAIL_STORAGE_PREFIX}${projectId}`, nextThumbnail);
                } catch (error) {
                    console.error("Failed to store project thumbnail URL:", error);
                }
            }
            setUploadStates((current) => ({ ...current, [projectId]: "saved" }));
        } catch (error) {
            console.error("Failed to upload project tile image:", error);
            setUploadStates((current) => ({ ...current, [projectId]: "error" }));
        }
    };

    return (
        <section className="project-tile-landing">
            <header className="project-tile-landing-header">
                <h1>NTS Computers SDN BHD</h1>
            </header>
            <div className="project-tile-grid">
                {projects.map((project) => (
                    <ProjectTile
                        key={project.id}
                        project={project}
                        thumbnail={thumbnails[project.id]}
                        uploadState={uploadStates[project.id]}
                        onOpen={openProject}
                        onThumbnailChange={updateThumbnail}
                    />
                ))}
            </div>
        </section>
    );
}
