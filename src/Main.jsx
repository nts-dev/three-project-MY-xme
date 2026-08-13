import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import LoadWatermelon from "./LoadMelonDB";
// import {ThreeViewSidebar} from "./components/ThreeViewSidebar";
import ProjectViewportRouter from "./components/project-map/ProjectViewportRouter.jsx";
import EngineEditorPanel from "./engine-editor/EngineEditorPanel.jsx";
import UrlProjectSync from "./components/UrlProjectSync.jsx";
import ProjectTileLanding from "./components/ProjectTileLanding.jsx";
import {createTheme, ThemeProvider} from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import React from "react";
import useGame from "./hooks/useGame";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import '@playcanvas/pcui/styles';

function isEmbeddedEditMode(params) {
    return params.get("mode") === "edit"
        || params.get("skipMenu") === "1"
        || params.get("source") === "theia";
}

function hasUrlLaunchParams() {
    if (typeof window === "undefined") return false;

    const params = new URLSearchParams(window.location.search);
    return !isEmbeddedEditMode(params) && Boolean(params.get("launch") || params.get("projectId"));
}

function isUrlLevelProjectLaunch() {
    if (typeof window === "undefined") return false;

    const params = new URLSearchParams(window.location.search);
    const projectId = String(params.get("projectId") || window.__NTS_RESOLVED_LAUNCH_PARAMS?.projectId || "").trim().replace(/[,\s]+$/g, "");

    return /_L\d+$/i.test(String(projectId || ""))
        && !isEmbeddedEditMode(params);
}

function isUrlProjectLaunch() {
    if (typeof window === "undefined") return false;

    const params = new URLSearchParams(window.location.search);
    const projectId = String(params.get("projectId") || window.__NTS_RESOLVED_LAUNCH_PARAMS?.projectId || "").trim().replace(/[,\s]+$/g, "");

    return hasUrlLaunchParams()
        || Boolean(projectId && !isEmbeddedEditMode(params));
}

function isUrlPackageLaunch() {
    if (typeof window === "undefined") return false;

    const params = new URLSearchParams(window.location.search);
    const projectId = String(params.get("projectId") || window.__NTS_RESOLVED_LAUNCH_PARAMS?.projectId || "").trim().replace(/[,\s]+$/g, "");
    const isPackage = params.get("isPackage") || window.__NTS_RESOLVED_LAUNCH_PARAMS?.isPackage;
    const packageParam = params.get("package");
    const mode = params.get("mode");
    const view = params.get("view");

    return String(projectId || "").replace(/_L\d+$/i, "") === "140"
        || /^(1|true|yes|on)$/i.test(String(isPackage || "").trim())
        || /^(1|true|yes|on)$/i.test(String(packageParam || "").trim())
        || mode === "package"
        || view === "package";
}

function setInitialFullscreenClass(enabled, isUrlProjectLaunch = false, isPackage = false) {
    if (typeof document === "undefined") return;

    document.documentElement.classList.toggle("is-editor-fullscreen", enabled);
    document.body.classList.toggle("is-editor-fullscreen", enabled);
    document.documentElement.classList.toggle("is-url-project-fullscreen", enabled && isUrlProjectLaunch);
    document.body.classList.toggle("is-url-project-fullscreen", enabled && isUrlProjectLaunch);
    document.documentElement.classList.toggle("is-package-project-fullscreen", enabled && isPackage);
    document.body.classList.toggle("is-package-project-fullscreen", enabled && isPackage);
}

setInitialFullscreenClass(isUrlProjectLaunch() || isUrlPackageLaunch(), isUrlProjectLaunch(), isUrlPackageLaunch());

function ProjectViewerBackButton() {
    const setProjectID = useGame((state) => state.setProjectID);
    const setDirectPlayMode = useGame((state) => state.setDirectPlayMode);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const setCharacter = useGame((state) => state.setCharacter);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setPauseGame = useGame((state) => state.setPauseGame);
    const setEditorSelectionEnabled = useGame((state) => state.setEditorSelectionEnabled);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const setPackageControl = useGame((state) => state.setPackageControl);
    const setIsPackage = useGame((state) => state.setIsPackage);

    const returnToTiles = () => {
        setProjectID(0);
        setDirectPlayMode(false);
        setButtonMode("Play mode");
        setCharacter(false);
        setFirstPerson(false);
        setPauseGame(false);
        setEditorSelectionEnabled(false);
        setSelectedEditorInstance(null);
        setPackageControl(false);
        setIsPackage(false);
        window.dispatchEvent(new CustomEvent("editor-detach-transform-controls"));
        window.dispatchEvent(new Event("resize"));
    };

    return (
        <button
            type="button"
            className="project-viewer-back-button"
            aria-label="Back to projects"
            title="Back to projects"
            onClick={returnToTiles}
        >
            <ArrowBackIcon fontSize="small" />
        </button>
    );
}

export default function Main(){
    const theme = useGame((state) => state.darkTheme);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const isPackage = useGame((state) => state.isPackage);
    const projectId = useGame((state) => state.projectID);
    const isUrlProjectLaunchActive = isUrlProjectLaunch();
    const isUrlLevelProjectLaunchActive = isUrlLevelProjectLaunch();
    const isUrlPackageProjectLaunch = isUrlPackageLaunch();
    const useFullscreenLayout = isUrlProjectLaunchActive || isPackage || isUrlPackageProjectLaunch;

    React.useLayoutEffect(() => {
        setInitialFullscreenClass(useFullscreenLayout, isUrlProjectLaunchActive, isPackage || isUrlPackageProjectLaunch);
    }, [isUrlProjectLaunchActive, isPackage, isUrlPackageProjectLaunch, useFullscreenLayout]);

    const defaultTheme = createTheme();

    const darkTheme = createTheme({
        palette: {
            mode: 'dark',
        },
    });

    return (
        <DndProvider backend={HTML5Backend}>
            <ThemeProvider theme={theme ? darkTheme : defaultTheme}>
                <Box >
                    <CssBaseline />
                    <Box
                        component="main"
                        className={`editor-app-root${isPuzzleGame ? ' is-game-project-root' : ''}${useFullscreenLayout ? ' is-editor-fullscreen' : ''}${isUrlProjectLaunchActive ? ' is-url-project-fullscreen' : ''}${isUrlLevelProjectLaunchActive ? ' is-url-level-project-fullscreen' : ''}${isPackage || isUrlPackageProjectLaunch ? ' is-package-project-fullscreen' : ''}`}
                        sx={{
                            flexGrow: 1,
                            height: '100vh',
                            overflow: 'hidden',
                        }}
                    >
                        <UrlProjectSync />
                        <LoadWatermelon />

                        <EngineEditorPanel directPlayMode />
                        {projectId ? (
                            <>
                                <ProjectViewportRouter />
                                <ProjectViewerBackButton />
                            </>
                        ) : (
                            <ProjectTileLanding />
                        )}
                    </Box>
                </Box>
            </ThemeProvider>
        </DndProvider>
    )
}
