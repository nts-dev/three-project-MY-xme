import React from 'react';
import Panel from '../Panel.jsx';
import { useSelector } from 'react-redux';
import { getSelectedItem } from '../../Redux/SelectedItemSlice.js';
import { getFile } from '../../Redux/FileDataSlice.js';
import GameObjectProperties from './GameObjectProperties.jsx';
import SceneProperties from './SceneProperties.jsx';
import GameProperties from './GameProperties.jsx';
import GameObjectTypeProperties from './GameObjectTypeProperties.jsx';
import useGame from '../../../hooks/useGame';

const displayType = {
    gameJSON: 'Game Properties:',
    gameObjectTypeJSON: 'GameObject Type Properties:',
    sceneJSON: 'Scene Properties:',
    gameObject: 'GameObject Properties:'   
};

const SelectedItem = ({ dirHandle }) => {
    const selectedItem = useSelector(getSelectedItem());
    const selectedFile = useSelector(getFile(selectedItem?.filePath));
    const selectedEditorInstance = useGame((state) => state.selectedEditorInstance);

    const selectedItemInstanceId =
        selectedItem?.params?.gameObject?.source?.instanceId ||
        selectedItem?.params?.gameObject?.source?.instance_id ||
        selectedItem?.params?.apiObject?.device_id ||
        selectedItem?.params?.apiObject?.instance_id;
    const liveInstanceId = selectedEditorInstance?.instanceId;
    const shouldShowLiveEditorInstance = Boolean(
        selectedEditorInstance?.gameObject &&
        (!selectedItem || selectedItem.type !== 'gameObject' || String(selectedItemInstanceId) !== String(liveInstanceId) || !selectedFile?.data)
    );

    if (shouldShowLiveEditorInstance) {
        return (
            <Panel label="Selected GameObject:" className="selected-item-panel">
                <GameObjectProperties
                    filePath={selectedEditorInstance.scenePath || 'editor-selection'}
                    sceneJSON={{ gameObjects: [] }}
                    indices={undefined}
                    selectedGameObject={selectedEditorInstance.gameObject}
                    apiObject={selectedEditorInstance.apiObject}
                    dirHandle={dirHandle}
                />
            </Panel>
        );
    }

    if (!selectedItem) {
        return null; // nothing currently selected
    }

    const getLabel = () => {
        switch (selectedItem.type) {
            case 'gameJSON':
                return 'Game Properties:';
            case 'gameObjectTypeJSON':
                return `GameObject Type: ${selectedItem.params.type}`;
            case 'sceneJSON':
                return `Selected Scene: ${selectedItem.params.name}`;
            case 'gameObject':
                return `Selected GameObject:`;
            default:
                return 'Unknown Selection Type';
        }
    };

    return (
        <Panel label={getLabel()} className="selected-item-panel">
            {selectedItem.type === 'gameJSON' ? (
                <GameProperties gameJSON={selectedFile.data} />
            ) : selectedItem.type === 'gameObjectTypeJSON' ? (
                <GameObjectTypeProperties type={selectedItem.params.type} dirHandle={dirHandle} />
            ) : selectedItem.type === 'sceneJSON' && selectedFile ? (
                <SceneProperties sceneName={selectedItem.params.name} filePath={selectedItem.filePath} sceneJSON={selectedFile.data} />
            ) : selectedItem.type === 'gameObject' && selectedFile ? (
                <GameObjectProperties
                    filePath={selectedItem.filePath}
                    sceneJSON={selectedFile.data}
                    indices={selectedItem.params.indices}
                    selectedGameObject={selectedItem.params.gameObject}
                    apiObject={selectedItem.params.apiObject}
                    dirHandle={dirHandle}
                />
            ) : (
                `  No component Selected`
            )}       
        </Panel>
    );
};

export default SelectedItem;
