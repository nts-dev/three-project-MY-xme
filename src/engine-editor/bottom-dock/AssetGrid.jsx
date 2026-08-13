import React, { useEffect, useMemo, useRef } from 'react';
import { TextInput } from '@playcanvas/pcui/react';
import { FaFolder } from 'react-icons/fa';
import { useDrag } from 'react-dnd';
import tippy, { followCursor } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { EDITOR_ASSET_DND_TYPE } from '../dndTypes.js';
import { normalizeTextureList } from './assetUtils.js';
import {
    getBottomDockAssetKey,
    getBottomDockMapKey,
    getDragAssetName,
} from './modelAssets.js';
import AssetThumbnail from './AssetThumbnail.jsx';

export const createAssetDragPayload = (file) => ({
    source: 'editor-bottom-dock',
    type: 'model-asset',
    name: getDragAssetName(file),
    fbxName: file.name,
    assetPath: file.path,
    path: file.path,
    extension: file.extension,
    textures: normalizeTextureList(file.textures),
    assetID: file.assetID,
    categoryIndex: file.categoryIndex,
    template_id: file.template_id,
    assetKey: file.assetKey || file.nameKey,
    nameKey: file.nameKey || file.assetKey,
});

const getTooltipContent = (file) => (
    file.assetInfo
    || file.asset_info
    || `${file.assetID ? `${file.assetID} ` : ''}${file.assetName || file.name || file.path}`
);

const handleAssetDragStart = (event, file, onStartDrag) => {
    const payload = createAssetDragPayload(file);

    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', payload.name);
    onStartDrag?.(file);
};

const DraggableAssetThumb = ({ file, selected, onSelect, onStartDrag }) => {
    const buttonRef = useRef(null);
    const payload = useMemo(() => createAssetDragPayload(file), [file]);
    const [{ isDragging }, dragRef] = useDrag(() => ({
        type: EDITOR_ASSET_DND_TYPE,
        item: () => {
            onStartDrag?.(file);
            return payload;
        },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }), [file, onStartDrag, payload]);

    useEffect(() => {
        if (!buttonRef.current) {
            return undefined;
        }

        const instance = tippy(buttonRef.current, {
            content: getTooltipContent(file),
            plugins: [followCursor],
            followCursor: true,
            animation: 'perspective-extreme',
            inertia: true,
            theme: 'small',
            appendTo: () => document.body,
            zIndex: 1000005,
        });

        return () => instance.destroy();
    }, [file]);

    const setRefs = (node) => {
        buttonRef.current = node;
        dragRef(node);
    };

    return (
        <button
            ref={setRefs}
            key={file.path}
            className={`asset-thumb${isDragging ? ' is-dragging' : ''}${selected ? ' is-selected' : ''}`}
            type="button"
            draggable
            data-editor-asset-thumb="true"
            title={file.path}
            aria-pressed={selected}
            onClick={() => onSelect(file)}
            onDragStart={(event) => handleAssetDragStart(event, file, onStartDrag)}
        >
            <span className="asset-thumb-preview">
                <AssetThumbnail file={file} />
            </span>

            <span className="asset-thumb-label">
                {file.name}
            </span>
        </button>
    );
};

export const AssetSearch = ({ value, onChange }) => (
    <TextInput
        value={value}
        placeholder="Search"
        keyChange
        onChange={onChange}
        class={['pcui-asset-browser-search']}
    />
);

export const AssetFolderTree = () => (
    <aside className="asset-folder-list pcui-asset-folder-list">
        <div className="asset-folder-row is-active">
            <FaFolder />
            <span>3D Assets</span>
        </div>
    </aside>
);

export const AssetGrid = ({ files, selectedAssetName, mainIconMap, onSelectAsset, onStartDrag }) => (
    <div className="pcui-gridview pcui-asset-grid">
        {files.map(file => (
            <div
                key={file.path}
                className="pcui-gridview-item pcui-asset-grid-item"
            >
                <DraggableAssetThumb
                    file={file}
                    selected={
                        Boolean(mainIconMap?.get?.(getBottomDockMapKey(file))) ||
                        selectedAssetName === getBottomDockAssetKey(file)
                    }
                    onSelect={onSelectAsset}
                    onStartDrag={onStartDrag}
                />
            </div>
        ))}
    </div>
);
