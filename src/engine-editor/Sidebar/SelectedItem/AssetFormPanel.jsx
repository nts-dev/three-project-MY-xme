import React, { useEffect, useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Panel as PcPanel, SelectInput, TextInput } from '@playcanvas/pcui/react';
import { FaBoxOpen, FaCamera, FaEdit, FaFileAlt, FaInfoCircle, FaPrint, FaQrcode, FaRedo, FaSave, FaTrash } from 'react-icons/fa';
import { Q } from '@nozbe/watermelondb';
import database from '../../../database';
import useGame from '../../../hooks/useGame';
import { sceneAssets } from '../../../threejs/player/puzzle/character/Constants.jsx';
import ImageAlbum from '../../../components/popup/form/ImageAlbum.jsx';
import FileTable from '../../../components/popup/form/files/FileTable.jsx';
import PlanningContent from '../../../components/popup/form/planning/PlanningContent.jsx';
import AssetDeleteConfirmDialog from '../../../threejs/hud/inventory/AssetDeleteConfirmDialog.jsx';

const TAB_ITEMS = [
    { value: 'spec', label: 'Spec', icon: FaEdit },
    { value: 'info', label: 'Info', icon: FaInfoCircle },
    { value: 'media', label: 'Media', icon: FaCamera },
    { value: 'files', label: 'Files', icon: FaFileAlt },
    { value: 'logs', label: 'Logs', icon: FaBoxOpen },
];

const EMPTY_GROUPS = [];

const fieldValue = (field) => field?.value ?? '';

const getEditorInstanceId = (selectedEditorInstance) => (
    selectedEditorInstance?.instanceId
    || selectedEditorInstance?.apiObject?.device_id
    || selectedEditorInstance?.apiObject?.instance_id
    || selectedEditorInstance?.gameObject?.source?.instanceId
    || selectedEditorInstance?.gameObject?.source?.instance_id
);

const getEditorCategoryIndex = (selectedEditorInstance) => (
    selectedEditorInstance?.apiObject?.categoryIndex
    || selectedEditorInstance?.apiObject?.category_index
    || selectedEditorInstance?.apiObject?.category
    || selectedEditorInstance?.gameObject?.source?.categoryIndex
    || selectedEditorInstance?.gameObject?.source?.category_index
);

const getAssetCategoryIndex = (selectedAssetId, selectedAsset, selectedEditorInstance) => (
    selectedAsset?.assetObject?.categoryIndex
    || sceneAssets?.[selectedAssetId]?.categoryIndex
    || selectedAsset?.categoryIndex
    || getEditorCategoryIndex(selectedEditorInstance)
);

const getAssetDisplayName = (selectedAssetId, selectedAsset, selectedEditorInstance) => (
    selectedAsset?.assetObject?.description?.join?.(' ')
    || sceneAssets?.[selectedAssetId]?.name
    || sceneAssets?.[selectedAssetId]?.description?.join?.(' ')
    || selectedEditorInstance?.gameObject?.name
    || selectedEditorInstance?.apiObject?.Assetname
    || selectedEditorInstance?.apiObject?.name
    || `Asset ${selectedAssetId}`
);

const normalizeDateValue = (value) => {
    if (!value) {
        return '';
    }

    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }

    const slashMatch = text.match(/^(\d{2})\s*\/\s*(\d{2})\s*\/\s*(\d{4})$/);
    if (slashMatch) {
        return `${slashMatch[3]}-${slashMatch[1]}-${slashMatch[2]}`;
    }

    const dashMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dashMatch) {
        return `${dashMatch[3]}-${dashMatch[2]}-${dashMatch[1]}`;
    }

    return text;
};

const buildGroupsFromTemplate = async (selectedAssetId, categoryIndex) => {
    if (!selectedAssetId || !categoryIndex) {
        return EMPTY_GROUPS;
    }

    const fieldsCollection = database.collections.get('fields');
    const templatesCollection = database.collections.get('templates');
    const optionsCollection = database.collections.get('options');
    const [fields, templates] = await Promise.all([
        fieldsCollection.query(Q.where('instance_id', selectedAssetId), Q.sortBy('field_id', Q.asc)).fetch(),
        templatesCollection.query(Q.where('category_id', String(categoryIndex))).fetch(),
    ]);

    const fieldsById = new Map(fields.map((item) => [item._raw.field_id, item._raw]));
    const visibleTemplates = templates
        .map((item) => {
            const template = { ...item._raw };
            const field = fieldsById.get(template.field_id);
            const value = field?.value ?? template.value ?? '';

            return {
                ...template,
                value: typeof value === 'string' ? value.replace('[]undefined', 'Not connected') : value,
                instance_id: field?.instance_id,
                read_only: field?.read_only ?? template.read_only,
                visible: field?.visible ?? template.visible,
                index_id: field?.index_id,
            };
        })
        .filter((item) => item.viewer === '1');

    const fieldMap = new Map();
    const descriptions = [];

    visibleTemplates.forEach((item) => {
        if (item.description === '1' && item.value) {
            descriptions.push(item.value);
        }

        fieldMap.set(item.field_id, {
            fieldId: item.field_id,
            parentId: item.parent_id,
            name: item.name,
            value: item.value || '',
            type: item.type || 'input',
            readOnly: item.read_only,
            visible: item.visible,
            indexId: item.index_id,
            isDescription: item.description,
            children: [],
            options: [],
        });
    });

    for (const field of fieldMap.values()) {
        if (field.name === 'Description') {
            field.value = descriptions.join(' ');
        }

        if (field.type === 'combo') {
            const options = await optionsCollection.query(Q.where('field_id', parseInt(field.fieldId, 10))).fetch();
            field.options = options.map((option) => ({
                id: option._raw.field_id,
                name: option._raw.name,
            }));
            field.value = field.value || field.options[0]?.name || '';
        }
    }

    const groupsByName = new Map();
    const assetName = visibleTemplates.find((item) => item.name === 'AssetName');
    groupsByName.set('Specifications', {
        fieldId: 'specifications',
        name: 'Specifications',
        children: [
            { fieldId: 'selected-id', name: 'ID', value: selectedAssetId, type: 'input', readOnly: '1' },
            { fieldId: assetName?.field_id || 'asset-name', name: assetName?.name || 'AssetName', value: assetName?.value || 'Not Defined', type: 'input' },
        ],
    });

    for (const field of fieldMap.values()) {
        if (field.type === 'label' && field.parentId === 0) {
            groupsByName.set(field.name, { ...field, children: [] });
        }
    }

    for (const field of fieldMap.values()) {
        if (field.type === 'label') {
            continue;
        }

        if (field.parentId && fieldMap.has(field.parentId)) {
            const parent = fieldMap.get(field.parentId);
            const group = groupsByName.get(parent.name) || parent;
            group.children.push(field);
            groupsByName.set(group.name, group);
            continue;
        }

        if (field.value !== '' && !groupsByName.get('Specifications').children.some((item) => item.fieldId === field.fieldId)) {
            groupsByName.get('Specifications').children.push(field);
        }
    }

    return Array.from(groupsByName.values()).filter((group) => group.children?.length);
};

const AssetField = ({ field, value, onChange }) => {
    const readOnly = field.readOnly === '1' || field.name === 'ID' || field.name?.includes('ID') || field.name === 'Description';
    const currentValue = value ?? '';

    if (field.type === 'combo' && field.options?.length) {
        return (
            <SelectInput
                value={currentValue}
                options={field.options.map((option) => ({
                    v: option.name,
                    t: option.name,
                }))}
                readOnly={readOnly}
                onChange={(nextValue) => onChange(field.fieldId, nextValue)}
                class={['pcui-asset-input']}
            />
        );
    }

    if (field.name === 'Date In' || field.name === 'Day of birth') {
        return (
            <TextInput
                value={normalizeDateValue(currentValue)}
                readOnly={readOnly}
                keyChange
                onChange={(nextValue) => onChange(field.fieldId, nextValue)}
                class={['pcui-asset-input']}
            />
        );
    }

    return (
        <TextInput
            value={String(currentValue)}
            readOnly={readOnly}
            keyChange
            onChange={(nextValue) => onChange(field.fieldId, nextValue)}
            class={['pcui-asset-input']}
        />
    );
};

const AssetFormSection = ({ title, defaultOpen, children }) => (
    <PcPanel
        headerText={title}
        collapsible
        collapsed={!defaultOpen}
        headerSize={24}
        class={['pcui-asset-section']}
    >
        <div className="asset-form-fields">
            {children}
        </div>
    </PcPanel>
);

const AssetFilesTab = ({ selectedAssetId }) => {
    const setFiles = useGame((state) => state.setFiles);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        let cancelled = false;

        const loadFiles = async () => {
            if (!selectedAssetId) {
                setFiles([]);
                setStatus('idle');
                return;
            }

            try {
                setStatus('loading');
                const response = await fetch(`${import.meta.env.VITE_API_URL}/getDocumentFiles/${selectedAssetId}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                if (cancelled) {
                    return;
                }

                setFiles((Array.isArray(data) ? data : []).map((fileData) => ({
                    url: `${import.meta.env.VITE_FILE_URL}/${fileData.name}`,
                    capturedImage: fileData.name,
                    type: fileData.type?.split('/')[1] || fileData.type || '',
                    date: fileData.date,
                    id: fileData.id,
                    name: fileData.name,
                })));
                setStatus('ready');
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load asset files:', error);
                    setFiles([]);
                    setStatus('error');
                }
            }
        };

        loadFiles();

        return () => {
            cancelled = true;
        };
    }, [selectedAssetId, setFiles]);

    if (status === 'loading') {
        return <div className="asset-form-empty">Loading files...</div>;
    }

    if (status === 'error') {
        return <div className="asset-form-empty">Unable to load files</div>;
    }

    return <FileTable />;
};

const AssetInfoTab = ({ selectedAssetId }) => {
    const setHtmlData = useGame((state) => state.setHtmlData);
    const [status, setStatus] = useState('loading');
    const [htmlContent, setHtmlContent] = useState('');

    useEffect(() => {
        let cancelled = false;

        const loadInfo = async () => {
            if (!selectedAssetId) {
                setHtmlContent('');
                setHtmlData('');
                setStatus('idle');
                return;
            }

            try {
                setStatus('loading');
                const response = await fetch(`${import.meta.env.VITE_API_URL}/notes/${selectedAssetId}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                const notes = data?.notes || '';
                if (cancelled) {
                    return;
                }

                setHtmlContent(notes);
                setHtmlData(notes);
                setStatus('ready');
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load asset info:', error);
                    setHtmlContent('');
                    setHtmlData('');
                    setStatus('error');
                }
            }
        };

        loadInfo();

        return () => {
            cancelled = true;
        };
    }, [selectedAssetId, setHtmlData]);

    if (status === 'loading') {
        return <div className="asset-form-empty">Loading info...</div>;
    }

    if (status === 'error') {
        return <div className="asset-form-empty">Unable to load info</div>;
    }

    if (!htmlContent || htmlContent === 'undefined' || !String(htmlContent).trim()) {
        return <div className="asset-form-empty">No info data</div>;
    }

    return (
        <div
            className="popup-html"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
    );
};

const AssetLogsTab = ({ selectedAssetId }) => {
    const setLogs = useGame((state) => state.setLogs);
    const refreshPlanning = useGame((state) => state.refreshPlanning);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        let cancelled = false;

        const loadPlanning = async () => {
            if (!selectedAssetId) {
                setLogs([]);
                setStatus('idle');
                return;
            }

            try {
                setStatus('loading');
                const response = await fetch(`${import.meta.env.VITE_API_URL}/getPlanning/${selectedAssetId}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                if (cancelled) {
                    return;
                }

                setLogs((Array.isArray(data) ? data : []).map((dto) => ({
                    eventId: dto.event_id,
                    id: dto.id,
                    name: dto.event_name,
                    details: dto.details,
                    enteredBy: dto.entered_by,
                    assignedTo: dto.assigned_eid,
                    startDate: dto.start_date,
                    endDate: dto.end_date,
                    freq: dto.event_length,
                    variable: dto.is_variable,
                    reoccur_map: dto.reoccur_map,
                    period: dto.duration,
                    rec_type: dto.rec_type,
                    info: dto.info,
                    approved_by: dto.approved_by,
                    map: dto.map,
                })));
                setStatus('ready');
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load asset logs:', error);
                    setLogs([]);
                    setStatus('error');
                }
            }
        };

        loadPlanning();

        return () => {
            cancelled = true;
        };
    }, [refreshPlanning, selectedAssetId, setLogs]);

    if (status === 'loading') {
        return <div className="asset-form-empty">Loading logs...</div>;
    }

    if (status === 'error') {
        return <div className="asset-form-empty">Unable to load logs</div>;
    }

    return <PlanningContent />;
};

const AssetFormPanel = () => {
    const selectedAssetId = useGame((state) => state.selectedAssetId);
    const selectedAsset = useGame((state) => state.selectedAsset);
    const selectedEditorInstance = useGame((state) => state.selectedEditorInstance);
    const formStatus = useGame((state) => state.formStatus);
    const scan = useGame((state) => state.scan);
    const editable = useGame((state) => state.editable);
    const setEditable = useGame((state) => state.setEditable);
    const setShowQR = useGame((state) => state.setShowQR);
    const showQR = useGame((state) => state.showQR);
    const setEditAssetId = useGame((state) => state.setEditAssetId);
    const setDeleteAssetId = useGame((state) => state.setDeleteAssetId);
    const setDeleteAssetConfirmed = useGame((state) => state.setDeleteAssetConfirmed);
    const unsavedAssetSaveHandler = useGame((state) => state.unsavedAssetSaveHandler);
    const [groups, setGroups] = useState(EMPTY_GROUPS);
    const [values, setValues] = useState({});
    const [status, setStatus] = useState('idle');
    const [refreshTick, setRefreshTick] = useState(0);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const activeSelectedAssetId = selectedAssetId || getEditorInstanceId(selectedEditorInstance);
    const categoryIndex = getAssetCategoryIndex(activeSelectedAssetId, selectedAsset, selectedEditorInstance);
    const title = useMemo(
        () => getAssetDisplayName(activeSelectedAssetId, selectedAsset, selectedEditorInstance),
        [activeSelectedAssetId, selectedAsset, selectedEditorInstance]
    );
    const isDroppedAssetSelection = selectedEditorInstance?.scenePath === 'dropped-assets' ||
        selectedEditorInstance?.apiObject?.source === 'editor-bottom-dock' ||
        selectedEditorInstance?.gameObject?.source?.apiObject?.source === 'editor-bottom-dock';

    useEffect(() => {
        let cancelled = false;
           // console.log(sceneAssets?.[selectedAssetId]);
        const load = async () => {
            if (!activeSelectedAssetId || !categoryIndex) {
                setGroups(EMPTY_GROUPS);
                setValues({});
                setStatus('idle');
                return;
            }

            try {
                setStatus('loading');
                const nextGroups = await buildGroupsFromTemplate(activeSelectedAssetId, categoryIndex);
                if (cancelled) {
                    return;
                }

                setGroups(nextGroups);
                setValues(Object.fromEntries(
                    nextGroups.flatMap((group) => group.children || []).map((field) => [field.fieldId, fieldValue(field)])
                ));
                setStatus('ready');
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load asset form:', error);
                    setGroups(EMPTY_GROUPS);
                    setValues({});
                    setStatus('error');
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [activeSelectedAssetId, categoryIndex, formStatus, refreshTick, scan]);

    const handleValueChange = (fieldId, value) => {
        setValues((previous) => ({
            ...previous,
            [fieldId]: value,
        }));
    };

    const handleSave = async () => {
        if (typeof unsavedAssetSaveHandler !== 'function') {
            console.warn('Asset save handler is not registered.');
            return;
        }

        await unsavedAssetSaveHandler(activeSelectedAssetId);
    };

    const handleDeleteConfirm = () => {
        setDeleteConfirmVisible(false);
        setEditAssetId(activeSelectedAssetId);
        setDeleteAssetConfirmed(true);
        setDeleteAssetId(activeSelectedAssetId);
    };

    if (isDroppedAssetSelection) {
        return null;
    }

    if (!activeSelectedAssetId) {
        return (
            <section className="editor-asset-form-panel">
                <div className="asset-form-empty">Select an asset instance to view fields</div>
            </section>
        );
    }

    return (
        <section className="editor-asset-form-panel">
            <div className="asset-form-header">
                <div className="asset-form-title">
                    <span>{title}</span>
                    <small>{categoryIndex ? `Category ${categoryIndex}` : 'No category'}</small>
                </div>
                <div className="asset-form-actions">
                    <button type="button" aria-label="Refresh asset fields" data-tooltip="Refresh" onClick={() => setRefreshTick((tick) => tick + 1)}><FaRedo /></button>
                    <button type="button" aria-label="Save asset fields" data-tooltip="Save" onClick={handleSave}><FaSave /></button>
                    <button
                        type="button"
                        aria-label="Delete asset"
                        data-tooltip="Delete"
                        className="is-danger"
                        onClick={() => setDeleteConfirmVisible(true)}
                    >
                        <FaTrash />
                    </button>
                    <button type="button" aria-label="Toggle QR code" data-tooltip="QR code" onClick={() => setShowQR(!showQR)} className={showQR ? 'is-active' : ''}><FaQrcode /></button>
                    <button
                        type="button"
                        aria-label="Print QR code"
                        data-tooltip="Print"
                        onClick={() => {
                            const targetUrl = `https://bo.nts.nl/scanner-info/?asset=${activeSelectedAssetId}`;
                            const qrServerUrl = `https://api.qrserver.com/v1/create-qr-code/?size=189x189&data=${encodeURIComponent(targetUrl)}`;
                            const printWindow = window.open('', '', 'width=700,height=600,top=150');
                            printWindow?.document.write(`<img src="${qrServerUrl}" onload="window.print(); window.close();">`);
                            printWindow?.document.close();
                        }}
                    >
                        <FaPrint />
                    </button>
                </div>
            </div>
            <AssetDeleteConfirmDialog
                visible={deleteConfirmVisible}
                assetName={title}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteConfirmVisible(false)}
            />

            <Tabs.Root defaultValue="spec" className="asset-form-tabs">
                <Tabs.List className="asset-form-tab-list" aria-label="Asset fields">
                    {TAB_ITEMS.map(({ value, label, icon: Icon }) => (
                        <Tabs.Trigger className="asset-form-tab-trigger" value={value} key={value}>
                            <Icon />
                            <span>{label}</span>
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>

                <Tabs.Content className="asset-form-tab-content" value="spec">
                    {status === 'loading' ? (
                        <div className="asset-form-empty">Loading fields...</div>
                    ) : status === 'error' ? (
                        <div className="asset-form-empty">Unable to load fields</div>
                    ) : groups.length ? (
                        groups.map((group, index) => (
                            <AssetFormSection title={group.name} defaultOpen={index < 2} key={`${group.name}-${group.fieldId}`}>
                                {group.children.map((field) => (
                                    <label className="asset-form-row" key={`${group.fieldId}-${field.fieldId}`}>
                                        <span>{field.name}</span>
                                        <AssetField field={field} value={values[field.fieldId]} onChange={handleValueChange} />
                                    </label>
                                ))}
                            </AssetFormSection>
                        ))
                    ) : (
                        <div className="asset-form-empty">No fields available</div>
                    )}
                </Tabs.Content>

                <Tabs.Content className="asset-form-tab-content asset-form-rich-content" value="info">
                    <AssetInfoTab selectedAssetId={activeSelectedAssetId} />
                </Tabs.Content>

                <Tabs.Content className="asset-form-tab-content asset-form-rich-content" value="media">
                    <ImageAlbum key={`${activeSelectedAssetId}-media`} />
                </Tabs.Content>

                <Tabs.Content className="asset-form-tab-content asset-form-rich-content" value="files">
                    <AssetFilesTab selectedAssetId={activeSelectedAssetId} />
                </Tabs.Content>

                <Tabs.Content className="asset-form-tab-content asset-form-rich-content" value="logs">
                    <AssetLogsTab selectedAssetId={activeSelectedAssetId} />
                </Tabs.Content>
            </Tabs.Root>
        </section>
    );
};

export default AssetFormPanel;
