export const isGameProjectId = (projectId) => /_L\d+$/i.test(String(projectId ?? ''));

export const shouldDisableGridByDefault = ({ character, firstPerson, isPuzzleGame }) => (
    Boolean(isPuzzleGame || character || firstPerson) 
);

export const getSceneGridVisible = (sceneData) => {
    const value = sceneData?.runtimeSettings?.gridVisible;
    return typeof value === 'boolean' ? value : null;
};

export const applySceneGridVisibility = (sceneData, setGrid) => {
    const gridVisible = getSceneGridVisible(sceneData);
    if (gridVisible === null || typeof setGrid !== 'function') {
        return;
    }

    setGrid(gridVisible);
};
