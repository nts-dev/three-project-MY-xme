import React, { useEffect, useSyncExternalStore } from "react";
import useGame from "../../hooks/useGame";
import ThreeView from "../ThreeView.jsx";
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
    const isGoogleViewportActive = false;

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
            {!isGoogleViewportActive && (
                <div className="project-google-webgl-viewport-switch__three">
                    <ThreeView />
                </div>
            )}
        </div>
    );
}
