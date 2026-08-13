import React, { useState } from 'react';
import ReduxProvider from './Redux/ReduxProvider.jsx';
import AutoSave from './AutoSave.jsx';
import CurrentModal from './CurrentModal.jsx';
import ApiSceneLoader from './ApiSceneLoader.jsx';
import EditorShell from './EditorShell.jsx';
import 'react-tooltip/dist/react-tooltip.css';
import './styles.css';

const EngineEditorPanel = ({ directPlayMode = false }) => {
    const [dirHandle, setDirHandle] = useState(null);

    return (
        <div className="engine-editor-panel">
            <ReduxProvider>
                <AutoSave dirHandle={dirHandle}>
                    <ApiSceneLoader enabled={!dirHandle} />
                    {!directPlayMode && <EditorShell dirHandle={dirHandle} setDirHandle={setDirHandle} />}
                    {!directPlayMode && <CurrentModal dirHandle={dirHandle} setDirHandle={setDirHandle} />}
                </AutoSave>
            </ReduxProvider>
        </div>
    );
};

export default EngineEditorPanel;
