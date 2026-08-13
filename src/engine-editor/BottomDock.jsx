import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useSelector } from 'react-redux';
import useGame from '../hooks/useGame';
import {
    collectCategoryModelReferences,
    collectFiles,
    collectModelReferences,
    getAssetSearchText,
    getBaseProjectKey,
    reorderAssetFiles,
    uniqueByPath,
} from './bottom-dock/assetUtils.js';
import {
    getGameFilesEndpoint,
    getGameFilesTemplateId,
    normalizeGameFileCatalog,
} from './bottom-dock/apiCatalog.js';
import { MODEL_EXTENSIONS } from './bottom-dock/constants.js';
import { AssetFolderTree, AssetGrid, AssetSearch } from './bottom-dock/AssetGrid.jsx';
import ConsolePanel from './bottom-dock/ConsolePanel.jsx';
import {
    ensureBottomDockObject,
    getBottomDockAssetKey,
    getBottomDockMapKey,
} from './bottom-dock/modelAssets.js';

const BottomDock = () => {
    const projectFiles = useSelector(store => store.projectFiles);
    const fileData = useSelector(store => store.fileData.files);
    const {
        projectID: projectId,
        selectedAssetName,
        setSelectedAssetName,
        setSelectedAssetIdNumber,
        setIsSelected,
        mainIconMap,
        setMainIconMap,
        fbxNames,
        setFbxNames,
        deleteObject,
        setDeleteObject,
        setDeleteAssetId,
        isPuzzleGame,
    } = useGame((state) => state);
    const [prompt, setPrompt] = useState('');
    const [search, setSearch] = useState('');
    const [apiCatalogFiles, setApiCatalogFiles] = useState([]);
    const [apiCatalogLoading, setApiCatalogLoading] = useState(false);
    const deferredSearch = useDeferredValue(search);

    const baseProjectKey = useMemo(
        () => getBaseProjectKey(projectId, projectFiles?.name),
        [projectId, projectFiles?.name]
    );

    const gameFilesTemplateId = useMemo(
        () => baseProjectKey ? getGameFilesTemplateId(isPuzzleGame) : 0,
        [baseProjectKey, isPuzzleGame]
    );

    const projectModelFiles = useMemo(() => {
        if (!projectFiles?.name) {
            return [];
        }

        return collectFiles(projectFiles)
            .filter(file => file.name !== projectFiles.name)
            .filter(file => MODEL_EXTENSIONS.includes(file.extension));
    }, [projectFiles]);

    const sceneModelFiles = useMemo(() => {
        const files = Array.isArray(fileData) ? fileData : [];

        return uniqueByPath(
            files.flatMap(file => {
                const gameObjects = file?.data?.gameObjects;
                const sceneCategories = file?.metaData?.originalData?.categories
                    || file?.data?.source?.originalData?.categories
                    || file?.data?.categories;

                return [
                    ...collectCategoryModelReferences(sceneCategories, file.path),
                    ...(Array.isArray(gameObjects) ? collectModelReferences(gameObjects, file.path) : []),
                ];
            })
        );
    }, [fileData]);

    useEffect(() => {
        if (!gameFilesTemplateId) {
            setApiCatalogFiles([]);
            setApiCatalogLoading(false);
            return undefined;
        }

        let cancelled = false;

        const loadGameFiles = async () => {
            setApiCatalogLoading(true);

            try {
                const response = await fetch(getGameFilesEndpoint(gameFilesTemplateId));
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                
                const files = normalizeGameFileCatalog(data, gameFilesTemplateId, isPuzzleGame);

                if (!cancelled) {
                    setApiCatalogFiles(uniqueByPath(files));
                }
            } catch (error) {
                console.warn('Failed to load bottom dock game files:', error);

                if (!cancelled) {
                    setApiCatalogFiles([]);
                }
            } finally {
                if (!cancelled) {
                    setApiCatalogLoading(false);
                }
            }
        };

        loadGameFiles();

        return () => {
            cancelled = true;
        };
    }, [gameFilesTemplateId]);

    const allAssetFiles = useMemo(() => (
        reorderAssetFiles(uniqueByPath([
            ...apiCatalogFiles,
            ...projectModelFiles,
            ...sceneModelFiles,
        ]))
    ), [apiCatalogFiles, projectModelFiles, sceneModelFiles]);

    const searchableAssetFiles = useMemo(() => (
        allAssetFiles.map(file => ({
            file,
            searchText: getAssetSearchText(file),
        }))
    ), [allAssetFiles]);

    const visibleFiles = useMemo(() => {
        const query = deferredSearch.trim().toLowerCase();
       
        if (!query) {
            return allAssetFiles;
        }
       
        return searchableAssetFiles
            .filter(({ searchText }) => searchText.includes(query))
            .map(({ file }) => file);
    }, [allAssetFiles, searchableAssetFiles, deferredSearch]);

    const setOnlySelectedMapItem = useCallback((mapKey, enable) => {
        const nextMap = new Map(mainIconMap);
        nextMap.forEach((_, key) => {
            nextMap.set(key, false);
        });

        if (enable) {
            nextMap.set(mapKey, true);
        }

        setMainIconMap(nextMap);
    }, [mainIconMap, setMainIconMap]);

    const handleSelectAsset = useCallback(async (file) => {
        const assetKey = getBottomDockAssetKey(file);
        const mapKey = getBottomDockMapKey(file);
        const wasSelected = Boolean(mainIconMap?.get?.(mapKey)) || selectedAssetName === assetKey;
        const willBeSelected = !wasSelected;

        if (deleteObject) {
            setDeleteObject(false);
            setDeleteAssetId(0);
        }

        setIsSelected(willBeSelected);
        setOnlySelectedMapItem(mapKey, willBeSelected);

        if (!willBeSelected) {
            setSelectedAssetName(null);
            setSelectedAssetIdNumber(0);
            return;
        }

        try {
            const selectedKey = await ensureBottomDockObject(file);
            setSelectedAssetName(selectedKey);
            setSelectedAssetIdNumber(file.assetID || 0);

            if (!fbxNames.includes(selectedKey)) {
                setFbxNames([...fbxNames, selectedKey]);
            }
        } catch (error) {
            console.warn('Failed to select bottom dock asset:', file.path, error);
            setIsSelected(false);
            setOnlySelectedMapItem(mapKey, false);
        }
    }, [
        deleteObject,
        fbxNames,
        mainIconMap,
        selectedAssetName,
        setDeleteAssetId,
        setDeleteObject,
        setFbxNames,
        setIsSelected,
        setOnlySelectedMapItem,
        setSelectedAssetIdNumber,
        setSelectedAssetName,
    ]);

    const handleStartDragAsset = useCallback(async (file) => {
        try {
            await ensureBottomDockObject(file);
        } catch (error) {
            console.warn('Failed to prepare bottom dock asset for drag:', file.path, error);
        }
    }, []);

    return (
        <Tabs.Root className="editor-bottom-dock" defaultValue="files">
            <Tabs.List className="editor-tabs-list" aria-label="Editor bottom panels">
                <Tabs.Trigger className="editor-tabs-trigger" value="files">
                    Project
                </Tabs.Trigger>

                <Tabs.Trigger className="editor-tabs-trigger" value="console">
                    Console
                </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content className="editor-tabs-content" value="files">
                <AssetFolderTree />

                <div className="asset-browser">
                    <div className="asset-browser-header">
                        <span>3D Assets</span>
                        <AssetSearch value={search} onChange={setSearch} />
                    </div>

                    {visibleFiles.length ? (
                        <AssetGrid
                            files={visibleFiles}
                            selectedAssetName={selectedAssetName}
                            mainIconMap={mainIconMap}
                            onSelectAsset={handleSelectAsset}
                            onStartDrag={handleStartDragAsset}
                        />
                    ) : (
                        <div className="empty-dock-state">
                            {apiCatalogLoading ? 'Loading 3D assets...' : 'No 3D assets loaded'}
                        </div>
                    )}
                </div>
            </Tabs.Content>

            {/* <Tabs.Content className="editor-tabs-content console-content" value="console">
                <ConsolePanel
                    fileData={fileData}
                    prompt={prompt}
                    onPromptChange={setPrompt}
                />
            </Tabs.Content> */}
        </Tabs.Root>
    );
};

export default BottomDock;
