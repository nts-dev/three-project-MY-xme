import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import ProjectFiles from './Sidebar/ProjectFiles/ProjectFiles.jsx';
import ObjectHierarchyTree from './Sidebar/Hierarchy/ObjectHierarchyTree.jsx';
import SelectedItem from './Sidebar/SelectedItem/SelectedItem.jsx';
import AssetFormPanel from './Sidebar/SelectedItem/AssetFormPanel.jsx';
import BottomDock from './BottomDock.jsx';
import EditorTopBar from './EditorTopBar.jsx';
import ViewportChrome from './ViewportChrome.jsx';
import './Lit/EditorProjectPath.js';
import { useDispatch, useSelector } from 'react-redux';
import { selectItem } from './Redux/SelectedItemSlice.js';

const MonacoCodeWorkspace = lazy(() => import('./MonacoCodeWorkspace.jsx'));
const DEFAULT_PANEL_SIZES = {
    left: 296,
    right: 420,
    bottom: 226,
};
const PANEL_LIMITS = {
    leftMin: 190,
    rightMin: 280,
    bottomMin: 120,
    viewportMin: 360,
    editorTop: 30,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getPanelSizeLimits = () => {
    const viewportWidth = window.innerWidth || 1200;
    const viewportHeight = window.innerHeight || 800;

    return {
        maxSidePanel: Math.max(PANEL_LIMITS.leftMin, viewportWidth - PANEL_LIMITS.viewportMin),
        maxBottomPanel: Math.max(PANEL_LIMITS.bottomMin, viewportHeight - PANEL_LIMITS.editorTop - 180),
    };
};

const toSerializableSelectionValue = (value, seen = new WeakSet()) => {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value !== 'object') {
        return typeof value === 'function' ? undefined : value;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (seen.has(value)) {
        return undefined;
    }

    seen.add(value);

    if (value._raw && typeof value._raw === 'object') {
        return toSerializableSelectionValue(value._raw, seen);
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => toSerializableSelectionValue(item, seen))
            .filter((item) => item !== undefined);
    }

    return Object.fromEntries(
        Object.entries(value)
            .map(([key, entry]) => [key, toSerializableSelectionValue(entry, seen)])
            .filter(([, entry]) => entry !== undefined)
    );
};

const EditorShell = ({ dirHandle, setDirHandle }) => {
    const dispatch = useDispatch();
    const projectFiles = useSelector(store => store.projectFiles);
    const projectPath = dirHandle?.name || projectFiles?.name || 'No project loaded';
    const [workspaceMode, setWorkspaceMode] = useState('canvas');
    const [panelSizes, setPanelSizes] = useState(DEFAULT_PANEL_SIZES);
    const resizeRef = useRef(null);

    const clampPanelSizes = useCallback((sizes) => {
        const { maxSidePanel, maxBottomPanel } = getPanelSizeLimits();
        const left = clamp(sizes.left, PANEL_LIMITS.leftMin, maxSidePanel);
        const right = clamp(sizes.right, PANEL_LIMITS.rightMin, Math.max(PANEL_LIMITS.rightMin, maxSidePanel));
        const availableViewport = Math.max(PANEL_LIMITS.viewportMin, window.innerWidth - left - right);

        if (availableViewport < PANEL_LIMITS.viewportMin) {
            const overflow = PANEL_LIMITS.viewportMin - availableViewport;
            const nextRight = clamp(right - overflow, PANEL_LIMITS.rightMin, maxSidePanel);
            return {
                left,
                right: nextRight,
                bottom: clamp(sizes.bottom, PANEL_LIMITS.bottomMin, maxBottomPanel),
            };
        }

        return {
            left,
            right,
            bottom: clamp(sizes.bottom, PANEL_LIMITS.bottomMin, maxBottomPanel),
        };
    }, []);

    const startPanelResize = useCallback((event, panel) => {
        if (event.button !== 0) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        resizeRef.current = {
            panel,
            startX: event.clientX,
            startY: event.clientY,
            startSizes: panelSizes,
        };
        document.body.classList.add('is-editor-panel-resizing');
        document.body.classList.add(`is-editor-panel-resizing-${panel}`);
    }, [panelSizes]);

    const updatePanelResize = useCallback((event) => {
        const resize = resizeRef.current;
        if (!resize) {
            return;
        }

        const dx = event.clientX - resize.startX;
        const dy = event.clientY - resize.startY;
        const nextSizes = { ...resize.startSizes };

        if (resize.panel === 'left') {
            nextSizes.left += dx;
        } else if (resize.panel === 'right') {
            nextSizes.right -= dx;
        } else if (resize.panel === 'bottom') {
            nextSizes.bottom -= dy;
        }

        setPanelSizes(clampPanelSizes(nextSizes));
        window.dispatchEvent(new Event('resize'));
    }, [clampPanelSizes]);

    const stopPanelResize = useCallback(() => {
        if (!resizeRef.current) {
            return;
        }

        resizeRef.current = null;
        document.body.classList.remove('is-editor-panel-resizing');
        document.body.classList.remove('is-editor-panel-resizing-left', 'is-editor-panel-resizing-right', 'is-editor-panel-resizing-bottom');
        window.dispatchEvent(new Event('resize'));
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }, []);

    useEffect(() => {
        const handleSceneObjectSelect = (event) => {
            const detail = event.detail || {};
            if (!detail.scenePath || !detail.gameObject) {
                return;
            }

            const apiObject = toSerializableSelectionValue(detail.apiObject);
            const gameObject = toSerializableSelectionValue({
                ...detail.gameObject,
                source: {
                    ...(detail.gameObject?.source || {}),
                    apiObject,
                },
            });

            dispatch(selectItem(detail.scenePath, 'gameObject', {
                indices: null,
                gameObject,
                apiObject,
            }));
        };

        window.addEventListener('editor-select-scene-object', handleSceneObjectSelect);
        return () => window.removeEventListener('editor-select-scene-object', handleSceneObjectSelect);
    }, [dispatch]);

    useEffect(() => {
        const handleResize = () => {
            setPanelSizes((current) => clampPanelSizes(current));
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            document.body.classList.remove('is-editor-panel-resizing');
            document.body.classList.remove('is-editor-panel-resizing-left', 'is-editor-panel-resizing-right', 'is-editor-panel-resizing-bottom');
        };
    }, [clampPanelSizes]);

    return (
        <div
            className="rogue-editor-shell"
            style={{
                '--editor-left': `${panelSizes.left}px`,
                '--editor-right': `${panelSizes.right}px`,
                '--editor-bottom': `${panelSizes.bottom}px`,
            }}
            onPointerMove={updatePanelResize}
            onPointerUp={stopPanelResize}
            onPointerCancel={stopPanelResize}
        >
            <EditorTopBar workspaceMode={workspaceMode} setWorkspaceMode={setWorkspaceMode} />
            <ViewportChrome />
            {workspaceMode !== 'canvas' && (
                <Suspense fallback={<div className={`editor-code-workspace is-${workspaceMode}`}><div className="editor-code-loading">Loading code editor...</div></div>}>
                    <MonacoCodeWorkspace mode={workspaceMode} onClose={() => setWorkspaceMode('canvas')} />
                </Suspense>
            )}

            <div className="rogue-editor-project-path">
                <editor-project-path label="Project" path={projectPath}></editor-project-path>
            </div>

            <aside className="rogue-editor-left">
                <ProjectFiles setDirHandle={setDirHandle} />
                <ObjectHierarchyTree />
                <span
                    className="editor-panel-resize-handle is-left"
                    role="separator"
                    aria-label="Resize left panel"
                    aria-orientation="vertical"
                    onPointerDown={(event) => startPanelResize(event, 'left')}
                />
            </aside>

            <aside className="rogue-editor-right">
                <span
                    className="editor-panel-resize-handle is-right"
                    role="separator"
                    aria-label="Resize right panel"
                    aria-orientation="vertical"
                    onPointerDown={(event) => startPanelResize(event, 'right')}
                />
                <div className="editor-panel inspector-panel">
                    <div className="editor-panel-header editor-panel-tabs">
                        <span>Inspector</span>
                        <span>Asset</span>
                    </div>
                    <SelectedItem dirHandle={dirHandle} />
                    <AssetFormPanel />
                </div>
            </aside>

            <span
                className="editor-panel-resize-handle is-bottom"
                role="separator"
                aria-label="Resize bottom panel"
                aria-orientation="horizontal"
                onPointerDown={(event) => startPanelResize(event, 'bottom')}
            />
            <BottomDock />
        </div>
    );
};

export default EditorShell;
