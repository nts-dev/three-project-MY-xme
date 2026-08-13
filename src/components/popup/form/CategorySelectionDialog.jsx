import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import useGame from '../../../hooks/useGame';
import './CategorySelectionDialog.css';

const getRaw = (category) => category?._raw || category || {};

const getCategoryId = (category) => {
    const raw = getRaw(category);
    return raw.id ?? raw.category_id ?? raw.categoryIndex ?? raw.category_index ?? raw.asset_id;
};

const getTemplateId = (category) => {
    const raw = getRaw(category);
    return raw.template_id ?? raw.templ_id ?? raw.templateId;
};

const getCategoryName = (category, fallback) => {
    const raw = getRaw(category);
    return raw.name || raw.Assetname || raw.AssetInfo || fallback;
};

const getChildren = (category) => {
    const raw = getRaw(category);
    if (Array.isArray(category?.children)) return category.children;
    if (Array.isArray(raw.children)) return raw.children;
    if (Array.isArray(category?.items)) return category.items;
    if (Array.isArray(raw.items)) return raw.items;
    return [];
};

const buildTreeNodes = (categories = []) => {
    const addNode = (category, path) => {
        const categoryId = getCategoryId(category);
        const templateId = getTemplateId(category);
        const children = getChildren(category);
        const key = categoryId !== undefined && categoryId !== null
            ? String(categoryId)
            : path;

        return {
            key,
            label: getCategoryName(category, `Category ${key}`),
            data: {
                categoryIndex: categoryId,
                templateId,
                raw: category,
            },
            selectable: categoryId !== undefined && categoryId !== null,
            children: children.map((child, index) => addNode(child, `${path}-${index}`)),
        };
    };

    return (Array.isArray(categories) ? categories : []).map((category, index) => addNode(category, `category-${index}`));
};

const findNode = (nodes, key) => {
    for (const node of nodes || []) {
        if (String(node.key) === String(key)) {
            return node;
        }

        const child = findNode(node.children, key);
        if (child) {
            return child;
        }
    }

    return null;
};

export default function CategorySelectionDialog() {
    const rawCategories = useGame((state) => state.rawCategories);
    const [request, setRequest] = useState(null);
    const [selectedKey, setSelectedKey] = useState(null);
    const [expandedKeys, setExpandedKeys] = useState({});
    const [treeOpen, setTreeOpen] = useState(true);
    const [query, setQuery] = useState('');
    const nodes = useMemo(() => buildTreeNodes(rawCategories), [rawCategories]);
    const selectedNode = useMemo(() => findNode(nodes, selectedKey), [nodes, selectedKey]);
    const selectedCategoryIndex = Number.parseInt(selectedNode?.data?.categoryIndex, 10);
    const canConfirm = Number.isFinite(selectedCategoryIndex) && selectedCategoryIndex > 0;
    const filteredNodes = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) {
            return nodes;
        }

        const filterNode = (node) => {
            const children = (node.children || []).map(filterNode).filter(Boolean);
            const matches = String(node.label || '').toLowerCase().includes(normalizedQuery);
            if (!matches && !children.length) {
                return null;
            }

            return {
                ...node,
                children,
            };
        };
        return nodes.map(filterNode).filter(Boolean);
    }, [nodes, query]);

    useEffect(() => {
        if (!query.trim()) {
            return;
        }

        const nextExpanded = {};
        const collectExpanded = (node) => {
            if (node.children?.length) {
                nextExpanded[node.key] = true;
                node.children.forEach(collectExpanded);
            }
        };

        filteredNodes.forEach(collectExpanded);
        setExpandedKeys(nextExpanded);
    }, [filteredNodes, query]);

    useEffect(() => {
        const handleRequest = (event) => {
            setSelectedKey(null);
            setExpandedKeys({});
            setTreeOpen(true);
            setQuery('');
            setRequest(event.detail || {});
        };

        window.addEventListener('asset-category-selection-request', handleRequest);
        return () => window.removeEventListener('asset-category-selection-request', handleRequest);
    }, []);

    const close = useCallback((value) => {
        request?.resolve?.(value);
        setRequest(null);
        setSelectedKey(null);
        setExpandedKeys({});
        setTreeOpen(true);
        setQuery('');
    }, [request]);

    const toggleNode = (key) => {
        setExpandedKeys((previous) => ({
            ...previous,
            [key]: !previous[key],
        }));
    };

    const selectNode = (node) => {
        const categoryIndex = Number.parseInt(node?.data?.categoryIndex, 10);
        if (!Number.isFinite(categoryIndex) || categoryIndex <= 0) {
            return;
        }

        setSelectedKey(node.key);
    };

    const renderNode = (node, depth = 0) => {
        const hasChildren = Boolean(node.children?.length);
        const expanded = Boolean(expandedKeys[node.key]);
        const selected = String(selectedKey) === String(node.key);

        return (
            <div className="asset-category-tree-node" key={node.key}>
                <div
                    className={`asset-category-tree-row${selected ? ' is-selected' : ''}`}
                    style={{ paddingLeft: `${8 + depth * 16}px` }}
                >
                    <button
                        type="button"
                        className="asset-category-tree-toggle"
                        onClick={() => hasChildren && toggleNode(node.key)}
                        aria-label={expanded ? 'Collapse category' : 'Expand category'}
                        disabled={!hasChildren}
                    >
                        {hasChildren ? (
                            <i className={`pi ${expanded ? 'pi-chevron-down' : 'pi-chevron-right'}`} />
                        ) : (
                            <span />
                        )}
                    </button>
                    <button
                        type="button"
                        className="asset-category-tree-label"
                        onClick={() => selectNode(node)}
                    >
                        <i className={`asset-category-node-icon pi ${hasChildren ? 'pi-folder' : 'pi-file'}`} />
                        {node.label}
                    </button>
                </div>
                {hasChildren && expanded ? (
                    <div className="asset-category-tree-children">
                        {node.children.map((child) => renderNode(child, depth + 1))}
                    </div>
                ) : null}
            </div>
        );
    };

    const confirm = () => {
        const node = findNode(nodes, selectedKey);
        const categoryIndex = Number.parseInt(node?.data?.categoryIndex, 10);
        if (!Number.isFinite(categoryIndex) || categoryIndex <= 0) {
            return;
        }

        close({
            categoryIndex,
            templateId: node?.data?.templateId,
            category: node?.data?.raw,
        });
    };

    const footer = (
        <div className="asset-category-dialog-actions">
            <Button label="Cancel" text onClick={() => close(null)} />
            <Button label="Use Category" onClick={confirm} disabled={!canConfirm} />
        </div>
    );

    return (
        <Dialog
            visible={Boolean(request)}
            header="Choose Asset Category"
            modal
            position="top"
            draggable={false}
            resizable={false}
            className="asset-category-dialog"
            footer={footer}
            onHide={() => close(null)}
        >
            <div className="asset-category-dialog-body">
                <p className="asset-category-dialog-message">
                    Select the category to save {request?.assetName ? `"${request.assetName}"` : 'this asset'}.
                </p>
                <div className="asset-category-select-shell">
                    <button
                        type="button"
                        className="asset-category-select-button"
                        onClick={() => setTreeOpen((open) => !open)}
                    >
                        <span>{selectedNode?.label || 'Select category'}</span>
                        <i className={`pi ${treeOpen ? 'pi-chevron-up' : 'pi-chevron-down'}`} />
                    </button>
                    {treeOpen ? (
                        <div className="asset-category-tree-panel">
                            <div className="asset-category-search-row">
                                <div className="asset-category-search-box">
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Search categories"
                                        aria-label="Search categories"
                                    />
                                    <i className="pi pi-search" />
                                </div>
                                {query ? (
                                    <button
                                        type="button"
                                        className="asset-category-search-clear"
                                        onClick={() => setQuery('')}
                                        aria-label="Clear search"
                                    >
                                        <i className="pi pi-times" />
                                    </button>
                                ) : null}
                            </div>
                            <div className="asset-category-tree-scroll" role="tree">
                                {filteredNodes.length ? filteredNodes.map((node) => renderNode(node)) : (
                                    <div className="asset-category-empty">No categories found</div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </Dialog>
    );
}
