import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useGame from '../hooks/useGame';
import fileDataSlice, { addFileData } from './Redux/FileDataSlice';
import projectFilesSlice from './Redux/ProjectFilesSlice';
import selectedItemSlice from './Redux/SelectedItemSlice';
import { buildApiSceneProject } from './util/ApiSceneAdapter';
import { applySceneGridVisibility } from '../utils/gridVisibility';

const DEFAULT_LEVEL_CODE = 0;

const normalizeSceneKey = (sceneKey) => {
    const raw = String(sceneKey ?? '').trim();
    if (!raw) {
        return null;
    }

    const match = /^(.*)_L(\d+)$/i.exec(raw);
    if (!match) {
        return raw;
    }

    const levelCode = Number.parseInt(match[2], 10);
    return levelCode === DEFAULT_LEVEL_CODE ? match[1] : `${match[1]}_L${levelCode}`;
};

const getSceneKey = (projectId, selectedLevel) => {
    const raw = String(projectId ?? '').trim();
    if (!raw || raw === '0') {
        return null;
    }

    if (/_L\d+$/i.test(raw)) {
        const match = /^(.*)_L(\d+)$/i.exec(raw);
        return match && Number.parseInt(match[2], 10) === DEFAULT_LEVEL_CODE ? match[1] : raw;
    }

    const levelCode = Number.parseInt(String(selectedLevel?.code ?? DEFAULT_LEVEL_CODE), 10);
    const safeLevel = Number.isFinite(levelCode) ? Math.max(0, levelCode) : DEFAULT_LEVEL_CODE;
    if (safeLevel === DEFAULT_LEVEL_CODE) {
        return raw;
    }
    return /^\d+$/.test(raw) ? `${raw}_L${safeLevel}` : raw;
};

const ApiSceneLoader = ({ enabled }) => {
    const dispatch = useDispatch();
    const projectId = useGame((state) => state.projectID);
    const selectedLevel = useGame((state) => state.selectedLevel);
    const checkReload = useGame((state) => state.checkReload);
    const setGrid = useGame((state) => state.setGrid);
    const projectSceneData = useGame((state) => state.projectSceneData);
    const projectSceneKey = useGame((state) => state.projectSceneKey);
    const setProjectSceneData = useGame((state) => state.setProjectSceneData);

    const isEditorInactive = () => {
    if (typeof document === 'undefined') {
        return false;
    }

    return document.body.classList.contains('is-editor-fullscreen')
        || document.documentElement.classList.contains('is-editor-fullscreen')
        || Boolean(document.querySelector('.editor-app-root.is-editor-fullscreen'));
};

    useEffect(() => {
        if (!enabled || isEditorInactive()) {
            return;
        }

        const sceneKey = getSceneKey(projectId, selectedLevel);
        if (!sceneKey ) {
            dispatch(fileDataSlice.actions.clear());
            dispatch(projectFilesSlice.actions.clear());
            dispatch(selectedItemSlice.actions.unSelectItem());
            return;
        }

        const controller = new AbortController();

        const applySceneData = (data) => {
            applySceneGridVisibility(data, setGrid);
            const virtualProject = buildApiSceneProject(sceneKey, data);

            dispatch(fileDataSlice.actions.clear());
            dispatch(projectFilesSlice.actions.setState(virtualProject.projectFiles));
            virtualProject.files.forEach((file) => {
                dispatch(addFileData(file.path, file.data, file.metaData));
            });
            dispatch(selectedItemSlice.actions.unSelectItem());
        };

        const loadScene = async () => {
            try {
                if ( String(sceneKey).includes('151') ||
                    projectSceneData
                    && normalizeSceneKey(projectSceneKey) === normalizeSceneKey(sceneKey)
                ) {
                    applySceneData(projectSceneData);
                    return;
                }

                const response = await fetch(`${import.meta.env.VITE_API_URL}/project-scene/${sceneKey}_L${selectedLevel?.code}`, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                setProjectSceneData(data, sceneKey);
                applySceneData(data);
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }
                console.error('Failed to load API scene for editor:', error);
                dispatch(fileDataSlice.actions.clear());
                dispatch(projectFilesSlice.actions.setState({
                    kind: 'directory',
                    name: `API Scene ${sceneKey}`,
                    error: error.message,
                    files: [],
                }));
            }
        };
       
        loadScene();

        return () => controller.abort();
    }, [enabled, projectId, selectedLevel, checkReload, dispatch, projectSceneData, projectSceneKey, setGrid, setProjectSceneData]);

    return null;
};

export default ApiSceneLoader;
