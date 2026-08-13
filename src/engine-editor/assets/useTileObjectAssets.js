import {useEffect, useMemo, useState} from 'react';
import useGame from '../../hooks/useGame';
import LoadObjects from '../../components/popup/sideBar/LoadObjects';
import {objects} from '../../threejs/player/puzzle/character/Constants.jsx';
import {shouldDisableGridByDefault} from '../../utils/gridVisibility';
import {getExtension, isModelFile, normalizeModelPath, normalizeProjectId, uniqueByPath} from './assetFileUtils';

const getLeafCategories = (categories = []) => (
    (Array.isArray(categories) ? categories : [])
        .flatMap((category) => category?.children?.length ? category.children : [category])
        .filter(Boolean)
);

const toAssetFile = (asset) => {
    const name = asset?.name || asset?.asset_name || asset?.assetName;
    const meta = objects[name] || {};
    const path = meta.fileName || asset?.fileName || asset?.fbxName || asset?.path;

    if (!path || !isModelFile(path)) {
        return null;
    }

    const normalizedPath = normalizeModelPath(path);

    return {
        name: normalizedPath.split('/').pop(),
        path: normalizedPath,
        extension: getExtension(normalizedPath),
        textures: meta.textures || asset?.textures || [],
        assetName: meta.name || name || normalizedPath.split('/').pop(),
        assetID: meta.assetID || asset?.assetId || asset?.assetID,
        categoryIndex: meta.categoryIndex || asset?.categoryIndex,
        template_id: meta.template_id || asset?.template_id || 0,
        sourcePath: 'tile-overlay-loader',
    };
};

const toCatalogAssetFile = (asset, categoryName) => {
    const path = asset?.Assetname || asset?.assetName || asset?.asset_name || asset?.name;

    if (!path || !isModelFile(path)) {
        return null;
    }

    const normalizedPath = normalizeModelPath(path);

    return {
        name: normalizedPath.split('/').pop(),
        path: normalizedPath,
        extension: getExtension(normalizedPath),
        textures: [],
        assetName: normalizedPath.replace(/\.[^.]+$/, ''),
        assetID: asset?.AssetID || asset?.assetID || asset?.assetId,
        categoryIndex: 1494,
        template_id: 1630,
        sourcePath: `asset-catalog:${categoryName || 'uncategorized'}`,
    };
};

const flattenCatalogFiles = (groupedAssets = {}) => (
    Object.entries(groupedAssets).flatMap(([categoryName, categoryAssets]) => (
        Object.values(categoryAssets || {})
            .map((asset) => toCatalogAssetFile(asset, categoryName))
            .filter(Boolean)
    ))
);

const fetchEditorCategories = async ({projectId, isGame}) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/getCategories/${isGame}/${projectId}`);
    if (!response.ok) {
        throw new Error(`Failed to load categories: HTTP ${response.status}`);
    }

    return response.json();
};

const fetchPuzzleCategories = async (templateId) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/getFilesWithCategory/${templateId}`);
    if (!response.ok) {
        throw new Error(`Failed to load puzzle categories: HTTP ${response.status}`);
    }

    const result = await response.json();
    return result?.success ? result.data : {};
};

export const useTileObjectAssets = () => {
    const projectId = useGame((state) => state.projectID);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const firstPerson = useGame((state) => state.firstPerson);
    const character = useGame((state) => state.character);
    const isGame = useGame((state) => state.isGame);
    const rawCategories = useGame((state) => state.rawCategories);
    const setRawCategories = useGame((state) => state.setRawCategories);
    const checkReload = useGame((state) => state.checkReload);
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const baseProjectId = useMemo(() => normalizeProjectId(projectId), [projectId]);
    const usePuzzleLoader = useMemo(() => (
        shouldDisableGridByDefault({character, firstPerson, isPuzzleGame})
    ), [projectId, isPuzzleGame]);

    useEffect(() => {
        if (!baseProjectId) {
            setFiles([]);
            return undefined;
        }

        let cancelled = false;

        const loadAssets = async () => {
            setIsLoading(true);

            try {
                const loadedAssets = [];

                if (usePuzzleLoader) {
                    const groupedAssets = await fetchPuzzleCategories(1630);
                    loadedAssets.push(...flattenCatalogFiles(groupedAssets));
                } else {
                    const categories = rawCategories?.length
                        ? rawCategories
                        : await fetchEditorCategories({projectId: baseProjectId, isGame});

                    if (!rawCategories?.length && Array.isArray(categories)) {
                        setRawCategories(categories);
                    }

                    for (const category of getLeafCategories(categories)) {
                        if (cancelled) return;
                        const categoryAssets = await LoadObjects(category, baseProjectId, false);
                        loadedAssets.push(...(categoryAssets || []));
                    }
                }

                if (!cancelled) {
                    setFiles(uniqueByPath(loadedAssets.map(toAssetFile).filter(Boolean)));
                }
            } catch (error) {
                console.error('Failed to load bottom dock object assets:', error);
                if (!cancelled) {
                    setFiles([]);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadAssets();

        return () => {
            cancelled = true;
        };
    }, [baseProjectId, checkReload, isGame, rawCategories, setRawCategories, usePuzzleLoader]);

    return {files, isLoading, isCatalogOnly: usePuzzleLoader};
};
