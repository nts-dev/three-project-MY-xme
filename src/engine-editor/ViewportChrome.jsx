import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import useGame from '../hooks/useGame';
import EnvSetting from '../threejs/hud/environment/EnvSetting';
import { shouldDisableGridByDefault } from '../utils/gridVisibility';
import ViewportLevelDropdown from './ViewportLevelDropdown';
import ViewportPathAnimationDropdown from './ViewportPathAnimationDropdown';
import {
    getGoogleMapsViewportMode,
    isGoogleMapsWebGLProject,
    subscribeGoogleMapsViewportMode,
    toggleGoogleMapsViewportMode,
} from '../components/project-map/projectGoogleMapsViewportMode';

const verticalTools = [
    { icon: 'mini-icon-gizmo.png', label: 'Move', mode: 'translate' },
    { icon: 'mini-icon-rotate.png', label: 'Rotate', mode: 'rotate' },
    { icon: 'mini-icon-scale.png', label: 'Scale', mode: 'scale' },
    { icon: 'mini-icon-grid.png', label: 'Walls', action: 'walls' },
    { iconClass: 'pi pi-home', label: 'Roof', action: 'roof' },
    { iconClass: 'pi pi-tags', label: 'Labels', action: 'label', nonGameOnly: true },
    { iconClass: 'pi pi-map-marker', label: 'Dots', action: 'dots' },
    { icon: 'mini-icon-graph.png', label: 'Graph', toggleKey: 'graph' },
    { iconClass: 'pi pi-sitemap', label: 'Path Animations', action: 'pathAnimation', projectOnly: 'pathAnimation' },
    { iconClass: 'pi pi-map', label: 'Ground', action: 'ground', projectOnly: 'groundPath' },
    { icon: 'mini-icon-cursor.png', label: 'Select', action: 'select' },
    { icon: 'mini-icon-light.png', label: 'Light', toggleKey: 'light' },
    { hudAction: 'Tools', iconClass: 'pi pi-wrench', label: 'Tools' },
    { hudAction: 'Scanner', iconClass: 'pi pi-qrcode', label: 'Scanner' },
    { hudAction: 'ZoomIn', iconClass: 'pi pi-plus-circle', label: 'Zoom In' },
    { hudAction: 'ZoomOut', iconClass: 'pi pi-minus-circle', label: 'Zoom Out' },
];

const iconSrc = (icon) => `${import.meta.env.BASE_URL}webglstudio-icons/${icon}`;

const ViewportCompass = () => {
    return (
        <div className="viewport-compass" aria-label="Viewport compass">
            <div className="compass-cube">
                <span className="compass-axis compass-x">+X</span>
                <span className="compass-axis compass-y">+Y</span>
                <span className="compass-axis compass-z">+Z</span>
            </div>
        </div>
    );
};

const ViewportChrome = () => {
    const editorGizmoMode = useGame((state) => state.editorGizmoMode);
    const setEditorGizmoMode = useGame((state) => state.setEditorGizmoMode);
    const walls = useGame((state) => state.walls);
    const setWalls = useGame((state) => state.setWalls);
    const grid = useGame((state) => state.grid);
    const setGrid = useGame((state) => state.setGrid);
    const label = useGame((state) => state.label);
    const setLabel = useGame((state) => state.setLabel);
    const dots = useGame((state) => state.dots);
    const setDots = useGame((state) => state.setDots);
    const roof = useGame((state) => state.roof);
    const setRoof = useGame((state) => state.setRoof);
    const floorMap = useGame((state) => state.floorMap);
    const setFloorMap = useGame((state) => state.setFloorMap);
    const projectId = useGame((state) => state.projectID);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const cameraRef = useGame((state) => state.cameraRef);
    const scanner = useGame((state) => state.scanner);
    const firstPerson = useGame((state) => state.firstPerson);
    const character = useGame((state) => state.character);
    const setScanner = useGame((state) => state.setScanner);
    const editorSelectionEnabled = useGame((state) => state.editorSelectionEnabled);
    const setEditorSelectionEnabled = useGame((state) => state.setEditorSelectionEnabled);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [isPathAnimationOpen, setIsPathAnimationOpen] = useState(false);
    const [toggledTools, setToggledTools] = useState({});
    const [pressedTool, setPressedTool] = useState(null);
    const toolsPanelRef = useRef(null);
    const gridDefaultKeyRef = useRef(null);
    const isGameProject = shouldDisableGridByDefault({ character, firstPerson, isPuzzleGame });
    const projectBaseId = String(projectId).replace(/_L\d+$/i, '');
    const showPathAnimationControls = ['125', '48', '33'].includes(projectBaseId);
    const showGroundMapControls = ['125', '48', '153', '33'].includes(projectBaseId);
    const isGoogleMapsProject = isGoogleMapsWebGLProject(projectId);
    const googleMapsViewportMode = useSyncExternalStore(
        (callback) => subscribeGoogleMapsViewportMode(projectId, callback),
        () => getGoogleMapsViewportMode(projectId),
        () => "three"
    );

    useEffect(() => {
        const nextKey = `${projectId}:${Boolean(isPuzzleGame)}`;
        if (gridDefaultKeyRef.current === nextKey) {
            return;
        }

        gridDefaultKeyRef.current = nextKey;
        if (isGameProject) {
            setGrid(false);
        }
    }, [isGameProject, isPuzzleGame, projectId, setGrid]);

    const zoomCamera = (directionMultiplier) => {
        const camera = cameraRef?.current;
        if (!camera) {
            return;
        }

        const direction = new THREE.Vector3(0, 0, directionMultiplier);
        direction.applyQuaternion(camera.quaternion);
        camera.position.add(direction.multiplyScalar(0.3));
    };

    const toggleSelectionMode = () => {
        const nextEnabled = !editorSelectionEnabled;
        setEditorSelectionEnabled(nextEnabled);

        if (!nextEnabled) {
            setSelectedEditorInstance(null);
            window.dispatchEvent(new CustomEvent('editor-detach-transform-controls'));
        }
    };

    const handleHudAction = (tool, event) => {
        switch (tool.hudAction) {
            case 'Tools':
                toolsPanelRef.current?.toggle(event);
                setIsToolsOpen((value) => !value);
                break;
            case 'Scanner':
                setScanner(!scanner);
                break;
            case 'ZoomIn':
                zoomCamera(-1);
                break;
            case 'ZoomOut':
                zoomCamera(1);
                break;
            default:
                break;
        }
    };

    const isToolActive = (tool) => (
        (tool.mode && editorGizmoMode === tool.mode) ||
        (tool.action === 'walls' && walls) ||
        (tool.action === 'roof' && roof) ||
        (tool.action === 'ground' && floorMap) ||
        (tool.action === 'grid' && grid) ||
        (tool.action === 'label' && label) ||
        (tool.action === 'dots' && dots) ||
        (tool.action === 'pathAnimation' && isPathAnimationOpen) ||
        (tool.action === 'select' && editorSelectionEnabled) ||
        (tool.hudAction === 'Tools' && isToolsOpen) ||
        (tool.hudAction === 'Scanner' && scanner) ||
        (tool.toggleKey === 'graph' && isGoogleMapsProject && googleMapsViewportMode === 'google') ||
        (tool.toggleKey && tool.toggleKey !== 'graph' && toggledTools[tool.toggleKey])
    );

    return (
        <>
            <EnvSetting op={toolsPanelRef} />
            <div className="viewport-dropdown-row">
                <ViewportLevelDropdown />
            </div>
            {showPathAnimationControls && isPathAnimationOpen && (
                <div className="viewport-path-toolbar-popover">
                    <ViewportPathAnimationDropdown />
                </div>
            )}
            <div className="webglstudio-vertical-toolstrip" aria-label="Viewport tools">
                {verticalTools.filter(tool => {
                    if (tool.toggleKey === 'graph' && !isGoogleMapsProject) {
                        return false;
                    }

                    if (tool.projectOnly === 'groundPath' && !showGroundMapControls) {
                        return false;
                    }

                    if (tool.projectOnly === 'pathAnimation' && !showPathAnimationControls) {
                        return false;
                    }

                    return !tool.nonGameOnly || !isGameProject;
                }).map(tool => {
                    const isGraphMapToggle = tool.toggleKey === 'graph' && isGoogleMapsProject;
                    const isActive = isToolActive(tool);
                    const isPressed = pressedTool === tool.label;
                    const toolLabel = isGraphMapToggle
                        ? (googleMapsViewportMode === 'google' ? 'Google Map View' : 'Three.js View')
                        : tool.label;

                    return (
                        <button
                            key={tool.label}
                            type="button"
                            aria-label={toolLabel}
                            data-tooltip={toolLabel}
                            data-tooltip-placement="right"
                            aria-pressed={tool.mode || tool.action || tool.hudAction || tool.toggleKey ? isActive : undefined}
                            className={`webglstudio-tool-button ${isActive ? 'is-active' : ''} ${isPressed ? 'is-pressed' : ''}`}
                            onPointerDown={() => setPressedTool(tool.label)}
                            onPointerUp={() => setPressedTool(null)}
                            onPointerLeave={() => setPressedTool(null)}
                            onBlur={() => setPressedTool(null)}
                            onClick={(event) => {
                                if (tool.mode) {
                                    setEditorGizmoMode(tool.mode);
                                    return;
                                }

                                if (tool.action === 'walls') {
                                    setWalls(!walls);
                                    return;
                                }

                                if (tool.action === 'roof') {
                                    setRoof(!roof);
                                    return;
                                }

                                if (tool.action === 'ground') {
                                    setFloorMap(!floorMap);
                                    return;
                                }

                                if (tool.action === 'grid') {
                                    setGrid(!grid);
                                    return;
                                }

                                if (tool.action === 'label') {
                                    setLabel(!label);
                                    return;
                                }

                                if (tool.action === 'dots') {
                                    setDots(!dots);
                                    return;
                                }

                                if (tool.action === 'pathAnimation') {
                                    setIsPathAnimationOpen((value) => !value);
                                    return;
                                }

                                if (tool.action === 'select') {
                                    toggleSelectionMode();
                                    return;
                                }

                                if (tool.toggleKey) {
                                    if (tool.toggleKey === 'graph' && isGoogleMapsProject) {
                                        toggleGoogleMapsViewportMode(projectId);
                                        return;
                                    }

                                    setToggledTools((current) => ({
                                        ...current,
                                        [tool.toggleKey]: !current[tool.toggleKey],
                                    }));
                                    return;
                                }

                                if (tool.hudAction) {
                                    handleHudAction(tool, event);
                                }
                            }}
                        >
                            {tool.iconClass ? (
                                <i
                                    className={`${tool.hudAction === 'Tools' && isToolsOpen ? 'pi pi-spin pi-spinner' : tool.iconClass} visible-element`}
                                    aria-hidden="true"
                                />
                            ) : (
                                <img src={iconSrc(tool.icon)} alt="" />
                            )}
                        </button>
                    );
                })}
            </div>
            {/* <ViewportCompass /> */}
        </>
    );
};

export default ViewportChrome;
