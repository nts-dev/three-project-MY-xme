import React, { useEffect, useState, useSyncExternalStore } from "react";
import useGame from "../../hooks/useGame";
import ThreeView from "../ThreeView.jsx";
import ProjectGoogleMapsThreeScene from "./ProjectGoogleMapsThreeScene.jsx";
import {
    getGoogleMapsViewportMode,
    isGoogleMapsWebGLProject,
    subscribeGoogleMapsViewportMode,
} from "./projectGoogleMapsViewportMode.js";
import "./ProjectGoogleWebGLMap.css";

export default function ProjectViewportRouter() {
    const projectId = useGame((state) => state.projectID);
    const viewportMode = useSyncExternalStore(
        (callback) => subscribeGoogleMapsViewportMode(projectId, callback),
        () => getGoogleMapsViewportMode(projectId),
        () => "three"
    );
    const isMapsProject = isGoogleMapsWebGLProject(projectId);
    const [hasMountedGoogleViewport, setHasMountedGoogleViewport] = useState(false);
    const isGoogleViewportActive = isMapsProject && viewportMode === "google";

    useEffect(() => {
        if (isGoogleViewportActive) {
            setHasMountedGoogleViewport(true);
        }
    }, [isGoogleViewportActive]);

    useEffect(() => {
        window.requestAnimationFrame(() => {
            window.dispatchEvent(new Event("resize"));
        });
    }, [viewportMode]);

    if (!isMapsProject) {
        return <ThreeView />;
    }

    return (
        <div className="project-google-webgl-viewport-switch">
            <div className="project-google-webgl-viewport-switch__three">
                <ThreeView />
            </div>
            {hasMountedGoogleViewport && (
                <div
                    className={`project-google-webgl-viewport-switch__google${isGoogleViewportActive ? " is-active" : ""}`}
                    aria-hidden={!isGoogleViewportActive}
                >
                    <ProjectGoogleMapsThreeScene />
                </div>
            )}
        </div>
    );
}
