import React from 'react';
import { useDispatch } from 'react-redux';
import { modifyGameObject } from '../../Redux/FileDataSlice.js';
import GameObjectTypeProperties from './GameObjectTypeProperties.jsx';
import Divider from '../Divider.jsx';
import currentModalSlice from '../../Redux/CurrentModalSlice.js';
import fileDataSlice from '../../Redux/FileDataSlice.js';
import { FaBox, FaCog, FaEye, FaLayerGroup, FaPlus, FaPowerOff, FaSave, FaTag, FaTrash } from 'react-icons/fa';
import useGame from '../../../hooks/useGame';
import { NumericInput, Panel as PcPanel, SliderInput, TextInput } from '@playcanvas/pcui/react';
import * as THREE from 'three';
import AssetDeleteConfirmDialog from '../../../threejs/hud/inventory/AssetDeleteConfirmDialog.jsx';

const toNumber = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const roundUi = (value) => Number.parseFloat(Number(value || 0).toFixed(6));
const sceneToUiPosition = (value = 0) => roundUi(toNumber(value) * 100);
const uiToScenePosition = (value = 0) => toNumber(value) / 100;
const normalizeDegrees = (value = 0) => roundUi(((toNumber(value) % 360) + 360) % 360);
const radiansToUiDegrees = (value = 0) => {
    const degrees = (toNumber(value) * 180) / Math.PI;
    return normalizeDegrees(degrees);
};
const uiDegreesToRadians = (value = 0) => (toNumber(value) * Math.PI) / 180;
const getInstanceAxisKey = (axis) => {
    if (axis && typeof axis === 'object') {
        const axisValues = {
            x: Math.abs(toNumber(axis.x, 0)),
            y: Math.abs(toNumber(axis.y, 0)),
            z: Math.abs(toNumber(axis.z, 0)),
        };
        const activeAxis = Object.entries(axisValues).find(([, value]) => value > 0);
        if (activeAxis) {
            return activeAxis[0];
        }
    }

    if (typeof axis === 'string' && ['x', 'y', 'z'].includes(axis.toLowerCase())) {
        return axis.toLowerCase();
    }

    return 'y';
};
const getInstanceAxisVector = (axis) => {
    if (axis && typeof axis === 'object') {
        const vector = new THREE.Vector3(
            toNumber(axis.x, 0),
            toNumber(axis.y, 0),
            toNumber(axis.z, 0)
        );
        if (vector.lengthSq() > 0) {
            return vector.normalize();
        }
    }

    const axisKey = getInstanceAxisKey(axis);
    return new THREE.Vector3(
        axisKey === 'x' ? 1 : 0,
        axisKey === 'y' ? 1 : 0,
        axisKey === 'z' ? 1 : 0
    );
};
const applyInstancedAngleRotation = (object, axis, previousAngle, nextAngle) => {
    const axisVector = getInstanceAxisVector(axis);
    const previousRotation = new THREE.Quaternion().setFromAxisAngle(
        axisVector,
        uiDegreesToRadians(previousAngle)
    );
    const initialQuaternion = object.quaternion.clone().multiply(previousRotation.invert());
    const nextRotation = new THREE.Quaternion().setFromAxisAngle(
        axisVector,
        uiDegreesToRadians(nextAngle)
    );
    const finalQuaternion = new THREE.Quaternion().multiplyQuaternions(initialQuaternion, nextRotation);

    object.quaternion.copy(finalQuaternion);
    object.rotation.setFromQuaternion(finalQuaternion);
};

const InspectorSection = ({ title, children, defaultOpen = true, action }) => (
    <PcPanel
        headerText={title}
        collapsible
        collapsed={!defaultOpen}
        headerSize={24}
        class={['pcui-inspector-section']}
    >
        {action ? (
            <div className="pcui-inspector-section-toolbar">
                <button
                    type="button"
                    className="inspector-section-action"
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        action.onClick();
                    }}
                    aria-label={action.title}
                >
                    {action.icon}
                </button>
            </div>
        ) : null}
        <div className="inspector-section-body">
            {children}
        </div>
    </PcPanel>
);

const InspectorIconButton = ({ title, children, onClick, className = '' }) => (
    <button
        type="button"
        className={`inspector-pcui-icon-button ${className}`.trim()}
        onClick={onClick}
        data-tooltip={title}
        aria-label={title}
    >
        {children}
    </button>
);

const AxisField = ({ axis, value, onChange, readOnly, precision = 6, step = 0.01 }) => (
    <label className="inspector-axis-field">
        <span>{axis}</span>
        <NumericInput
            value={toNumber(value)}
            precision={precision}
            step={step}
            keyChange
            readOnly={readOnly}
            onChange={onChange}
            class={['pcui-inspector-input']}
        />
    </label>
);

const TransformRow = ({ label, value, onChange, readOnly }) => (
    <div className="inspector-transform-row">
        <span className="inspector-row-label">{label}</span>
        <AxisField axis="x" value={value.x} onChange={(val) => onChange('x', val)} readOnly={readOnly} />
        <AxisField axis="y" value={value.y} onChange={(val) => onChange('y', val)} readOnly={readOnly} />
        <AxisField axis="z" value={value.z} onChange={(val) => onChange('z', val)} readOnly={readOnly} />
    </div>
);

const RotationRow = ({ axis, value, onChange, readOnly }) => (
    <label className="inspector-rotation-row">
        <span className="inspector-axis-name">{axis}</span>
        <SliderInput
            value={toNumber(value)}
            min={0}
            max={360}
            sliderMin={0}
            sliderMax={360}
            precision={4}
            step={1}
            readOnly={readOnly}
            onChange={onChange}
            class={['pcui-inspector-slider']}
        />
    </label>
);

const PropertyRows = ({ data }) => {
    const entries = Object.entries(data || {}).filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object');

    if (!entries.length) {
        return <div className="inspector-empty">No properties</div>;
    }

    return entries.map(([key, value]) => (
        <label className="inspector-property-row" key={key}>
            <span>{key}</span>
            <TextInput
                value={String(value ?? '')}
                readOnly
                class={['pcui-inspector-input']}
            />
        </label>
    ));
};

const DroppedAssetActions = ({ assetName, instanceId }) => {
    const [deleteConfirmVisible, setDeleteConfirmVisible] = React.useState(false);
    const unsavedAssetSaveHandler = useGame((state) => state.unsavedAssetSaveHandler);

    const saveDroppedAsset = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (typeof unsavedAssetSaveHandler !== 'function') {
            console.warn('Asset save handler is not registered.');
            return;
        }

        await unsavedAssetSaveHandler(instanceId);
    };

    const confirmDeleteDroppedAsset = () => {
        setDeleteConfirmVisible(false);
        window.dispatchEvent(new CustomEvent('editor-delete-selected-asset', {
            detail: {
                instanceId,
            },
        }));
    };

    return (
        <>
            <div className="inspector-dropped-asset-actions">
                <InspectorIconButton title="Save asset" onClick={saveDroppedAsset} className="is-save">
                    <FaSave />
                </InspectorIconButton>
                <InspectorIconButton title="Delete asset" onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDeleteConfirmVisible(true);
                }} className="is-danger">
                    <FaTrash />
                </InspectorIconButton>
            </div>
            <AssetDeleteConfirmDialog
                visible={deleteConfirmVisible}
                assetName={assetName}
                onConfirm={confirmDeleteDroppedAsset}
                onCancel={() => setDeleteConfirmVisible(false)}
            />
        </>
    );
};

const ComponentRows = ({ componentsJSON, addComponent, removeComponent, readOnly, droppedAssetActions }) => (
    <InspectorSection
        title="Components"
        action={!readOnly ? { icon: <FaPlus />, title: 'Add component', onClick: addComponent } : null}
    >
        {componentsJSON.length ? (
            <div className="inspector-component-list">
                {componentsJSON.map((componentJSON, index) => (
                    <div className="inspector-component-row" key={`${componentJSON.type}-${index}`}>
                        <span className="inspector-component-indent" />
                        <span className="inspector-component-label">
                            {componentJSON.type === 'model'
                                ? `Model: ${componentJSON.assetPath || componentJSON.file || ''}`
                                : `${componentJSON.type || 'Component'}`}
                        </span>
                        {droppedAssetActions && index === 0 ? droppedAssetActions : null}
                        {!readOnly ? (
                            <InspectorIconButton title="Remove component" onClick={() => removeComponent(index)}>
                                <FaTrash />
                            </InspectorIconButton>
                        ) : null}
                    </div>
                ))}
            </div>
        ) : (
            <div className="inspector-empty">No components</div>
        )}
    </InspectorSection>
);

const getInstancedSelectionId = (instancedSelection) => {
    const instanceInfo = instancedSelection?.instanceInfo || {};
    return instanceInfo.assetId || instanceInfo.instanceId || instanceInfo.instance_id || instanceInfo.id;
};

const writeInstancedProxyMatrix = (object, expectedInstanceId) => {
    const instancedSelection = object?.userData?.__instancedSelection;
    if (!instancedSelection?.mesh || instancedSelection.instanceIndex === undefined) {
        return;
    }
   

    const selectionId = getInstancedSelectionId(instancedSelection) || object?.userData?.instanceId || object?.userData?.instance_id;
    if (
        expectedInstanceId !== undefined &&
        expectedInstanceId !== null &&
        selectionId !== undefined &&
        selectionId !== null &&
        String(selectionId) !== String(expectedInstanceId)
    ) {
        return;
    }

    object.updateMatrix();
    instancedSelection.mesh.setMatrixAt(instancedSelection.instanceIndex, object.matrix);
    instancedSelection.mesh.instanceMatrix.needsUpdate = true;

    const instanceInfo = instancedSelection.mesh.userData?.instances?.[instancedSelection.instanceIndex];
    if (instanceInfo) {
        instanceInfo.position = object.position.clone();
        instanceInfo.scale = object.scale.clone();
        instanceInfo.angle = {
            ...(typeof instanceInfo.angle === 'object' ? instanceInfo.angle : {}),
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z,
        };
    }
};

const GameObjectProperties = ({ filePath, sceneJSON, indices, selectedGameObject, apiObject, dirHandle }) => {
    const dispatch = useDispatch();
    const selectedEditorInstance = useGame((state) => state.selectedEditorInstance);
    const updateSelectedEditorTransform = useGame((state) => state.updateSelectedEditorTransform);
    const setDragObjectProperties = useGame((state) => state.setDragObjectProperties);

    const getGameObjectJSON = (parent, gameObjectIndices) => {
        const childGameObject = parent.gameObjects[gameObjectIndices[0]];
        if (gameObjectIndices.length === 1) {
            return childGameObject;
        } else {
            return getGameObjectJSON(childGameObject, indices.slice(1, indices.length));
        }
    };

    const baseGameObjectJSON = selectedGameObject || getGameObjectJSON(sceneJSON, indices);
    const baseInstanceId = baseGameObjectJSON?.source?.instanceId || baseGameObjectJSON?.source?.instance_id || apiObject?.device_id || apiObject?.instance_id;
    const liveGameObjectJSON = selectedEditorInstance?.gameObject && (
        !baseInstanceId || String(selectedEditorInstance.instanceId) === String(baseInstanceId)
    )
        ? selectedEditorInstance.gameObject
        : null;
    const gameObjectJSON = liveGameObjectJSON || baseGameObjectJSON;
    const activeInstanceId = selectedEditorInstance?.instanceId || baseInstanceId;
    const selectedSource = gameObjectJSON?.source?.apiObject?.source || apiObject?.source;
    const isDroppedAssetSelection = selectedSource === 'editor-bottom-dock';
    const isLiveEditorSelection = Boolean(
        selectedEditorInstance?.gameObject &&
        activeInstanceId !== undefined &&
        activeInstanceId !== null &&
        String(selectedEditorInstance.instanceId) === String(activeInstanceId)
    );
    const isVirtualSelection = Boolean(
        selectedGameObject &&
        (!indices || isLiveEditorSelection || selectedSource === 'editor-bottom-dock')
    );

    const position = gameObjectJSON?.position || { x: 0, y: 0, z: 0};
    const scale = gameObjectJSON?.scale || { x: 1, y: 1, z: 1};
    const rotation = gameObjectJSON?.rotation || { x: 0, y: 0, z: 0};
    const instanceAngle = selectedEditorInstance?.object?.userData?.angle;
    const hasInstanceAngle = isVirtualSelection && instanceAngle !== undefined && instanceAngle !== null && Number.isFinite(Number.parseFloat(instanceAngle));
    const uiPosition = {
        x: sceneToUiPosition(position.x),
        y: sceneToUiPosition(position.y),
        z: sceneToUiPosition(position.z),
    };
    const uiRotation = {
        x: hasInstanceAngle ? 0 : radiansToUiDegrees(rotation.x),
        y: hasInstanceAngle ? normalizeDegrees(instanceAngle) : radiansToUiDegrees(rotation.y),
        z: hasInstanceAngle ? 0 : radiansToUiDegrees(rotation.z),
    };
      
    const toSceneTransformValue = (group, value) => {
        if (group === 'position') {
            return uiToScenePosition(value);
        }

        if (group === 'rotation') {
            return uiDegreesToRadians(value);
        }

        return toNumber(value);
    };

    const changeProperty = (field, value) => {
        const [group, axis] = field;
        const sceneValue = axis ? toSceneTransformValue(group, value) : value;
        

        if (isVirtualSelection) {
            if (['position', 'rotation', 'scale'].includes(group) && axis) {
                const latestSelectedEditorInstance = useGame.getState().selectedEditorInstance;
                const latestInstanceId = latestSelectedEditorInstance?.instanceId || activeInstanceId;
                const object = latestSelectedEditorInstance?.object || selectedEditorInstance?.object;
                const instanceAxis = object?.userData?.axis;
                const InstanceAngle = object?.userData?.angle;
                const isInstanceAngleRotation = group === 'rotation' && axis === 'y' && InstanceAngle !== undefined;
                const targetAxis = isInstanceAngleRotation ? getInstanceAxisKey(instanceAxis) : axis;
                const normalizedAngleValue = normalizeDegrees(value);
              

                if (object?.[group]?.[targetAxis] !== undefined) {
                    if (isInstanceAngleRotation) {
                        applyInstancedAngleRotation(object, instanceAxis, InstanceAngle, normalizedAngleValue);
                    } else if (group === 'rotation' && axis === 'y') {
                        object.rotation.set(0, sceneValue, 0);
                    } else {
                        object[group][targetAxis] = sceneValue;
                    }
                    if (isInstanceAngleRotation && object.userData) {
                        object.userData.angle = normalizedAngleValue;
                    }
                    object.updateMatrix?.();
                    object.updateMatrixWorld(true);
                    writeInstancedProxyMatrix(object, latestInstanceId);
                }

                const nextPosition = object?.position
                    ? { x: object.position.x, y: object.position.y, z: object.position.z }
                    : {
                        ...position,
                        ...(group === 'position' ? { [targetAxis]: sceneValue } : {}),
                    };
                const nextRotation = object?.rotation
                    ? {
                        x: group === 'rotation' && axis === 'y' ? 0 : object.rotation.x,
                        y: object.rotation.y,
                        z: group === 'rotation' && axis === 'y' ? 0 : object.rotation.z,
                    }
                    : {
                        ...rotation,
                        ...(group === 'rotation' && axis === 'y'
                            ? { x: 0, y: sceneValue, z: 0 }
                            : group === 'rotation'
                                ? { [targetAxis]: sceneValue }
                                : {}),
                    };
                const nextScale = object?.scale
                    ? { x: object.scale.x, y: object.scale.y, z: object.scale.z }
                    : {
                        ...scale,
                        ...(group === 'scale' ? { [targetAxis]: sceneValue } : {}),
                    };
                const dragObjectProperties = useGame.getState().dragObjectProperties || {};
                const nextDragObjectProperties = {
                    ...dragObjectProperties,
                    name: gameObjectJSON?.name || dragObjectProperties.name,
                    position: nextPosition,
                    rotation: group === 'rotation' && axis === 'y'
                        ? {
                            x: 0,
                            y: uiDegreesToRadians(normalizedAngleValue),
                            z: 0,
                        }
                        : nextRotation,
                    scale: nextScale,
                    distance: dragObjectProperties.distance,
                    interval: dragObjectProperties.interval,
                };

                updateSelectedEditorTransform({
                    instanceId: latestInstanceId,
                    object,
                    position: nextPosition,
                    rotation: nextRotation,
                    scale: nextScale,
                    dragObjectProperties: nextDragObjectProperties,
                });
                setDragObjectProperties(nextDragObjectProperties);

            }
            return;
        }

       // Update the corresponding GameObject being rendered in the MainArea
        window.postMessage({
            eventName: 'modifyGameObjectInMainArea',
            scenePath: filePath,
            indices,
            field,
            value: sceneValue
        });

        dispatch(modifyGameObject(filePath, indices, field, sceneValue));
    };

    const addComponent = () => {
        const params = {
            scenePath: filePath,
            gameObjectIndices: indices,
            existingComponents: gameObjectJSON.components || []
        };
        dispatch(currentModalSlice.actions.openModal({
            type: 'AddComponentModal',
            params
        }));
    };

    const removeComponent = componentIndex => {
        if (isVirtualSelection) {
            return;
        }

        const updateComponents = [...(gameObjectJSON.components || [])];
        updateComponents.splice(componentIndex, 1);

        dispatch(fileDataSlice.actions.modifyGameObject({
            scenefilePath: filePath,
            gameObjectIndices: indices,
            field: ['components'],
            value: updateComponents
        }));

        window.postMessage({
            eventName: 'modifyGameObjectInMainArea',
            scenePath: filePath,
            indices,
            field: ['components'],
            value: updateComponents
        });
    };

    return (
        <div className="inspector-object">
            <div className="inspector-object-head">
                <div className="inspector-object-kind">
                    <FaBox />
                    <span>{gameObjectJSON.type || 'Mesh'}</span>
                </div>
                <div className="inspector-head-actions">
                    <InspectorIconButton title="Metadata"><FaTag /></InspectorIconButton>
                    <InspectorIconButton title="Layers"><FaLayerGroup /></InspectorIconButton>
                    <InspectorIconButton title="Visible"><FaEye /></InspectorIconButton>
                    <InspectorIconButton title="Enabled"><FaPowerOff /></InspectorIconButton>
                </div>
                <TextInput
                    value={gameObjectJSON.name || ''}
                    readOnly={isVirtualSelection}
                    keyChange
                    onChange={value => changeProperty(['name'], value)}
                    class={['inspector-name-input', 'pcui-inspector-input']}
                />
            </div>

            <InspectorSection title="Transform" action={{ icon: <FaCog />, title: 'Transform settings', onClick: () => {} }}>
                <TransformRow
                    label="Position"
                    value={uiPosition}
                    readOnly={false}
                    onChange={(axis, val) => changeProperty(['position', axis], val)}
                />
                <div className="inspector-rotation-group">
                    <span className="inspector-row-label">Rotation</span>
                    <div className="inspector-rotation-fields">
                        <RotationRow axis="y" value={uiRotation.y} readOnly={false} onChange={val => changeProperty(['rotation', 'y'], val)} />
                    </div>
                </div>
                <TransformRow
                    label="Scale"
                    value={scale}
                    readOnly={false}
                    onChange={(axis, val) => changeProperty(['scale', axis], val)}
                />
            </InspectorSection>

            {apiObject ? (
                <InspectorSection title="Properties">
                    <PropertyRows data={apiObject} />
                </InspectorSection>
            ) : null}

            {gameObjectJSON.type ? (
                <>
                    <Divider
                        label={`Inherited from type: ${gameObjectJSON.type }`}
                    />

                    <GameObjectTypeProperties
                        type={gameObjectJSON.type}
                        dirHandle={dirHandle}
                    />
                </>
            ) : (
                <ComponentRows
                    componentsJSON={gameObjectJSON.components || []}
                    addComponent={addComponent}
                    removeComponent={removeComponent}
                    readOnly={isVirtualSelection}
                    droppedAssetActions={isDroppedAssetSelection ? (
                        <DroppedAssetActions
                            assetName={gameObjectJSON.name}
                            instanceId={activeInstanceId}
                        />
                    ) : null}
                />
            )}
        </div>
    );
};

export default GameObjectProperties
