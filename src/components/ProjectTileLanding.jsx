import { useCallback, useEffect, useRef, useState } from "react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import useGame from "../hooks/useGame";
import "./ProjectTileLanding.css";

const API_BASE_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const FILE_BASE_URL = String(import.meta.env.VITE_FILE_URL || "").replace(/\/$/, "");

const PROJECTS = [
    {
        id: "33_L0",
        number: "01",
        title: "MY Map",
        imageFile: "33.png",
        type: "Floor Plan",
        date: "02/06/2026",
        buildingCount: "2 buildings",
        floorLabel: "First Floor / Floors 0-13",
    },
    {
        id: "153_L1",
        number: "02",
        title: "New Office Extended",
        imageFile: "153.jpeg",
        type: "Site Map",
        date: "04/16/2026",
        buildingCount: "3 buildings",
        floorLabel: "First Floor / Floors 0-13",
    },
    {
        id: "153_L2",
        number: "03",
        title: "XME Map",
        imageFile: "153.jpeg",
        type: "Terrain Map",
        date: "11/17/2026",
        buildingCount: "XME estate",
        floorLabel: "Satellite terrain / Nilai",
    },
    {
        id: "126",
        number: "04",
        title: "Tradestar Kenya LDT Street View",
        org: "NTS COMPUTERS KENYA",
        imageFile: "126.png",
        type: "Office",
        date: "08/22/2026",
        buildingCount: "1 building",
        floorLabel: "Economic Building, 1st Floor, Rm 25",
    },
];

function buildFileImageUrl(fileName) {
    const encodedFileName = encodeURIComponent(fileName);

    if (API_BASE_URL) {
        return `${API_BASE_URL}/files/${encodedFileName}`;
    }

    if (FILE_BASE_URL) {
        return `${FILE_BASE_URL}/${encodedFileName}`;
    }

    return `/files/${encodedFileName}`;
}

/** "11/17/2026" (month/day/year) -> "17 Nov 2026"; anything else unchanged. */
function formatDate(value) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value || ""));
    if (!match) return value;
    const date = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ProjectTile({ project, onOpen }) {
    const openProject = () => onOpen(project.id);

    const handleKeyDown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openProject();
    };

    return (
        <article
            className="project-tile-card"
            tabIndex={0}
            onClick={openProject}
            onKeyDown={handleKeyDown}
        >
            <div className="project-tile-media">
                <img
                    className="project-tile-image"
                    src={buildFileImageUrl(project.imageFile)}
                    alt={`${project.title} location preview`}
                    loading="lazy"
                />
                <span className="project-tile-type">{project.type}</span>
            </div>

            <div className="project-tile-content">
                <p className="project-tile-org">
                    {project.org || "NTS Computers SDN BHD"}
                </p>
                <h2 title={project.title}>{project.title}</h2>

                <div className="project-tile-location">
                    <LocationOnOutlinedIcon fontSize="inherit" />
                    <span>{project.floorLabel}</span>
                </div>

                <div className="project-tile-footer">
                    <div className="project-tile-meta">
                        <span title="Last updated">
                            <CalendarTodayOutlinedIcon fontSize="inherit" />
                            {formatDate(project.date)}
                        </span>
                        <span>
                            <BusinessOutlinedIcon fontSize="inherit" />
                            {project.buildingCount}
                        </span>
                    </div>

                    <button
                        type="button"
                        className="project-tile-open-button"
                        aria-label={`Open ${project.title}`}
                        onClick={(event) => {
                            event.stopPropagation();
                            openProject();
                        }}
                    >
                        Open
                        <ArrowForwardIcon fontSize="inherit" />
                    </button>
                </div>
            </div>
        </article>
    );
}

/**
 * The project tiles in one horizontally scrolling row (swipe, trackpad, Shift+wheel or the arrow
 * buttons), so any number of sites fits. Cards snap into place; the buttons scroll about one view
 * and are disabled at either end. Arrow keys work while the row has focus.
 */
function ProjectCarousel({ children, count }) {
    const trackRef = useRef(null);
    const [edges, setEdges] = useState({ start: true, end: true, first: 1, last: count, progress: 1 });

    const updateEdges = useCallback(() => {
        const track = trackRef.current;
        if (!track) return;
        const max = track.scrollWidth - track.clientWidth;
        const card = track.firstElementChild;
        const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
        const step = card ? card.getBoundingClientRect().width + gap : track.clientWidth;
        const perView = Math.max(1, Math.floor((track.clientWidth + gap + 1) / step));
        const first = Math.min(count, Math.round(track.scrollLeft / step) + 1);
        const last = Math.min(count, first + perView - 1);
        setEdges({
            start: track.scrollLeft <= 2,
            end: track.scrollLeft >= max - 2,
            first,
            last,
            // Share of the row in view, and how far along it is (for the progress bar).
            view: max > 0 ? track.clientWidth / track.scrollWidth : 1,
            progress: max > 0 ? track.scrollLeft / max : 0,
        });
    }, [count]);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return undefined;
        updateEdges();
        track.addEventListener("scroll", updateEdges, { passive: true });
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateEdges) : null;
        observer?.observe(track);
        window.addEventListener("resize", updateEdges);
        return () => {
            track.removeEventListener("scroll", updateEdges);
            observer?.disconnect();
            window.removeEventListener("resize", updateEdges);
        };
    }, [updateEdges, count]);

    const scrollByPage = (direction) => {
        const track = trackRef.current;
        if (!track) return;
        // As many whole cards as fit in the view (at least one), so cards stay aligned to the snap points.
        const card = track.firstElementChild;
        const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
        const step = card ? card.getBoundingClientRect().width + gap : track.clientWidth;
        const cards = Math.max(1, Math.floor((track.clientWidth + gap + 1) / step));
        track.scrollBy({ left: direction * cards * step, behavior: "smooth" });
    };

    const onKeyDown = (event) => {
        if (event.key === "ArrowRight") { event.preventDefault(); scrollByPage(1); }
        if (event.key === "ArrowLeft") { event.preventDefault(); scrollByPage(-1); }
    };

    const scrollable = !(edges.start && edges.end);

    return (
        <>
        <div className={`project-tile-carousel${scrollable ? " is-scrollable" : ""}${edges.start ? " at-start" : ""}${edges.end ? " at-end" : ""}`}>
            <button
                type="button"
                className="project-tile-scroll project-tile-scroll--prev"
                aria-label="Previous sites"
                onClick={() => scrollByPage(-1)}
                disabled={edges.start}
            >
                <ChevronLeftIcon fontSize="inherit" />
            </button>
            <div
                ref={trackRef}
                className="project-tile-grid"
                role="region"
                aria-label="Sites"
                tabIndex={0}
                onKeyDown={onKeyDown}
            >
                {children}
            </div>
            <button
                type="button"
                className="project-tile-scroll project-tile-scroll--next"
                aria-label="More sites"
                onClick={() => scrollByPage(1)}
                disabled={edges.end}
            >
                <ChevronRightIcon fontSize="inherit" />
            </button>
        </div>
        {scrollable && (
            <div className="project-tile-pager" aria-live="polite">
                <span>{edges.first === edges.last ? edges.first : `${edges.first}–${edges.last}`} of {count}</span>
                <div className="project-tile-progress" aria-hidden="true">
                    <i style={{ width: `${Math.max(8, (edges.view ?? 1) * 100)}%`, left: `${(edges.progress ?? 0) * (100 - Math.max(8, (edges.view ?? 1) * 100))}%` }} />
                </div>
            </div>
        )}
        </>
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

    return (
        <section className="project-tile-landing">
            <header className="project-tile-nav">
                <div className="project-tile-brand">
                    <span className="project-tile-logo" aria-hidden="true">N</span>
                    <div>
                        <strong>NTS Computers SDN BHD</strong>
                        <span>Digital Twin Platform</span>
                    </div>
                </div>
                <div className="project-tile-status">
                    <span aria-hidden="true" />
                    All systems operational
                </div>
            </header>

            <main className="project-tile-main">
                <div className="project-tile-title">
                    <div>
                        <p>Locations</p>
                        <h1>Select a property</h1>
                        <span>Open a site to explore its digital twin, assets and live data.</span>
                    </div>
                    <div className="project-tile-count">
                        <strong>{PROJECTS.length}</strong>
                        <span>{PROJECTS.length === 1 ? "site" : "sites"} available</span>
                    </div>
                </div>

                <ProjectCarousel count={PROJECTS.length}>
                    {PROJECTS.map((project) => (
                        <ProjectTile
                            key={project.id}
                            project={project}
                            onOpen={openProject}
                        />
                    ))}
                </ProjectCarousel>
            </main>
        </section>
    );
}
