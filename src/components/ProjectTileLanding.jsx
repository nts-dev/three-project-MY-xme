import React from "react";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
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
            <img
                className="project-tile-image"
                src={buildFileImageUrl(project.imageFile)}
                alt={`${project.title} location preview`}
            />
            <span className="project-tile-number" aria-hidden="true">
                {project.number}
            </span>
            <span className="project-tile-type">{project.type}</span>

            <div className="project-tile-content">
                <p className="project-tile-org">NTS COMPUTERS SDN BHD</p>
                <h2>{project.title}</h2>

                <div className="project-tile-location">
                    <LocationOnOutlinedIcon fontSize="inherit" />
                    <span>{project.floorLabel}</span>
                </div>

                <div className="project-tile-meta">
                    <span>
                        <CalendarTodayOutlinedIcon fontSize="inherit" />
                        {project.date}
                    </span>
                    <span>
                        <BusinessOutlinedIcon fontSize="inherit" />
                        {project.buildingCount}
                    </span>
                </div>

                <button
                    type="button"
                    className="project-tile-open-button"
                    onClick={(event) => {
                        event.stopPropagation();
                        openProject();
                    }}
                >
                    Open Location
                    <ArrowForwardIcon fontSize="inherit" />
                </button>
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
                    <strong>NTS Computers SDN BHD</strong>
                    <span>Digital Twin Platform</span>
                </div>
                <div className="project-tile-status">
                    <span aria-hidden="true" />
                    2 locations online
                </div>
            </header>

            <main className="project-tile-main">
                <div className="project-tile-title">
                    <p>SELECT A LOCATION</p>
                    <h1>Property Locations</h1>
                    <span>Choose a site to open its Digital Twin viewer</span>
                </div>

                <div className="project-tile-grid">
                    {PROJECTS.map((project) => (
                        <ProjectTile
                            key={project.id}
                            project={project}
                            onOpen={openProject}
                        />
                    ))}
                </div>
            </main>
        </section>
    );
}
