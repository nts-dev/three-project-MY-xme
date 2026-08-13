import React, { useEffect, useMemo, useState } from 'react';
import * as Menubar from '@radix-ui/react-menubar';
import { useDispatch, useSelector } from 'react-redux';
import projectFilesSlice from '../../Redux/ProjectFilesSlice.js';
import fileDataSlice from '../../Redux/FileDataSlice.js';
import * as FileHelpers from '../../util/FileHelpers.js'
import TreeView from '../Hierarchy/TreeView.jsx';
import { getSelectedItem } from '../../Redux/SelectedItemSlice.js';
import selectedItemSlice from '../../Redux/SelectedItemSlice.js';
import currentModalSlice from '../../Redux/CurrentModalSlice.js';
import { FaCaretRight, FaFile, FaFolder } from 'react-icons/fa';
import projects from '../../../projects.json';
import useGame from '../../../hooks/useGame';

const projectTree = {
    kind: 'directory',
    name: 'NTS Projects',
    files: projects.map(project => ({
        kind: 'directory',
        name: `${project.branch_name} - ${project.name}`,
        projectId: project.id,
        project,
        files: Object.values(project.children || {}).map(child => ({
            kind: Object.keys(child.children || {}).length ? 'directory' : 'file',
            name: child.name,
            projectId: child.id,
            project: child,
            files: Object.values(child.children || {}).map(grandChild => ({
                kind: 'file',
                name: grandChild.name,
                projectId: grandChild.id,
                project: grandChild
            }))
        }))
    }))
};

const getNodePath = (node, parentPath = '') => parentPath ? `${parentPath}/${node.name}` : node.name;

const PcuiDirectoryNode = ({ node, path = '', selectedPath, openNodes, onToggle, onSelect, root = false }) => {
    const nodePath = getNodePath(node, path);
    const isFile = node.kind === 'file';
    const children = node.files || [];
    const isOpen = root || openNodes.has(nodePath);

    return (
        <div className={`pcui-treeview-item pcui-project-node${isFile ? ' is-file' : ' is-folder'}${isOpen ? ' pcui-treeview-item-open' : ''}${!children.length ? ' pcui-treeview-item-empty' : ''}`}>
            <button
                type="button"
                className={`pcui-treeview-item-contents pcui-project-node-row${isFile && nodePath === selectedPath ? ' pcui-treeview-item-selected' : ''}`}
                onClick={() => isFile ? onSelect(node, nodePath) : onToggle(nodePath)}
            >
                <span className="pcui-project-disclosure">
                    {children.length ? <FaCaretRight /> : null}
                </span>
                <span className="pcui-treeview-item-icon pcui-project-node-icon">
                    {isFile ? <FaFile /> : <FaFolder />}
                </span>
                <span className="pcui-treeview-item-text">{node.name}</span>
            </button>
            {children.length && isOpen ? (
                <div className="pcui-project-node-children">
                    {children.map((child) => (
                        <PcuiDirectoryNode
                            key={`${nodePath}/${child.name}/${child.projectId || ''}`}
                            node={child}
                            path={nodePath}
                            selectedPath={selectedPath}
                            openNodes={openNodes}
                            onToggle={onToggle}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
};

const PcuiProjectTree = ({ root, selectedPath, openNodes, onToggle, onSelect }) => (
    <div className="pcui-treeview pcui-project-tree">
        <PcuiDirectoryNode
            node={root}
            selectedPath={selectedPath}
            openNodes={openNodes}
            onToggle={onToggle}
            onSelect={onSelect}
            root
        />
    </div>
);

const ProjectFiles = ({ setDirHandle }) => {
    const dispatch = useDispatch();

    const projectFiles = useSelector(store => store.projectFiles);
    const setProjectID = useGame(state => state.setProjectID);
    const setPackageControl = useGame(state => state.setPackageControl);
    const setIsPackage = useGame(state => state.setIsPackage);
    const setBranch = useGame(state => state.setBranch);

    const [selectedProjectFilePath, setSelectedProjectFilePath] = useState(null);
    const [openProjectNodes, setOpenProjectNodes] = useState(() => new Set([projectTree.name]));
    const selectedItem = useSelector(getSelectedItem());

    useEffect(() => {
        // Update selectedProjectFilePath componenent state, to match newly selected hierarchy item if its associated with a file
        if (selectedItem && selectedItem.filePath && selectedItem.filePath !== selectedProjectFilePath) {
            setSelectedProjectFilePath(selectedItem.filePath)
        }
    }, [selectedItem])

    const createNewProject = () => {
        dispatch(currentModalSlice.actions.openModal({
            type: 'CreateProjectModal'
        }));
    };

    const selectProjectFolder = async () => {
        if (!FileHelpers.isDirectoryPickerSupported()) {
            alert(FileHelpers.directoryPickerUnsupportedMessage());
            return;
        }

        const directoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        }).catch(error => {
            if (error.name === 'AbortError') {
                console.log('User abored window.showDirectoryPicker()');
            } else {
                alert(`Error occured while trying to pick a folder: ${error.message}`);
            }
            return null;
        });
    
        if (directoryHandle) {
            dispatch(fileDataSlice.actions.clear());
            dispatch(selectedItemSlice.actions.unSelectItem());
            setDirHandle(directoryHandle);

            const fileInfo = await FileHelpers.openProjectFolder(directoryHandle);
            dispatch(projectFilesSlice.actions.setState(fileInfo));
        }
    };

    const openSettingsModal = () => {
        dispatch(currentModalSlice.actions.openModal({ type: 'SettingsModal' }));
    };

    const selectProjectInfo = (fileInfo, filePath) => {
        if (fileInfo.kind !== 'file' && !fileInfo.selectable) {
            return;
        }

        setSelectedProjectFilePath(filePath);

        if (fileInfo.projectId) {
            const rawProjectId = fileInfo.projectId;
            const projectId = Number(rawProjectId);
            
            if (projectId === 140) {
                setPackageControl(true);
                setIsPackage(true);
                setProjectID(0);
                setBranch('Packaging');
                // console.log('Selected project ID:', projectId);
                return;
            }

            setPackageControl(false);
            setIsPackage(false);
            setProjectID(rawProjectId);
        }
    };

    const projectPickerTree = useMemo(() => projectTree, []);
    const toggleProjectNode = (nodePath) => {
        setOpenProjectNodes((previous) => {
            const next = new Set(previous);
            if (next.has(nodePath)) {
                next.delete(nodePath);
            } else {
                next.add(nodePath);
            }
            return next;
        });
    };

    const renderFileInfo = (fileInfo, initiallyExpanded = false, index = 0, path = '') => {   
        let filePath = path === '' ? fileInfo.name : `${path}${fileInfo.name}`;
        const rootName = projectFiles.name || projectTree.name;
        filePath = filePath.startsWith(rootName) ? filePath.slice(rootName.length, filePath.length) : filePath;
        filePath = filePath.startsWith('/') ? filePath.slice(1, filePath.length) : filePath;

        const onClick = () => {
            if (fileInfo.kind === 'file') {
                selectProjectInfo(fileInfo, filePath);
            }
        };

        return (
            <TreeView
                key={index}
                icon={fileInfo.kind === 'file' ? <FaFile color="rgb(239 236 236)" /> : <FaFolder color="#d5c25c" />}
                label={fileInfo.name}
                initiallyExpanded={initiallyExpanded}
                expandOnClick={fileInfo.kind === 'directory'}
                onClick={onClick}
                isSelected={filePath === selectedProjectFilePath}
            >
                {fileInfo.kind === 'file' ? (
                    null
                ) : (fileInfo.files || []).length ? (
                    <>
                        {fileInfo.files.map((childFileInfo, i) => renderFileInfo(childFileInfo, false, i, path + fileInfo.name + '/'))}
                    </>
                ) : (
                    '(Empty folder)'
                )}
            </TreeView>
        );
    };

    return (
        <div className="sidebar-panel project-files-panel">
            <Menubar.Root className="project-menubar">
                <Menubar.Menu>
                    <Menubar.Trigger className="project-menubar-trigger" onClick={createNewProject}>
                        New project
                    </Menubar.Trigger>
                </Menubar.Menu>

                <Menubar.Menu>
                    <Menubar.Trigger className="project-menubar-trigger">Open project</Menubar.Trigger>
                    <Menubar.Portal>
                        <Menubar.Content className="project-menubar-content project-menu-projects" align="start" sideOffset={6}>
                            <Menubar.Item className="project-menubar-item project-open-folder-item" onSelect={selectProjectFolder}>
                                Open local folder
                            </Menubar.Item>
                            <div className="project-complex-tree pcui-project-tree-shell">
                                <PcuiProjectTree
                                    root={projectPickerTree}
                                    selectedPath={selectedProjectFilePath}
                                    openNodes={openProjectNodes}
                                    onToggle={toggleProjectNode}
                                    onSelect={(node, filePath) => selectProjectInfo({
                                        ...node,
                                        filePath,
                                        selectable: true,
                                    }, filePath)}
                                />
                            </div>
                        </Menubar.Content>
                    </Menubar.Portal>
                </Menubar.Menu>

                <Menubar.Menu>
                    <Menubar.Trigger className="project-menubar-trigger" onClick={openSettingsModal}>
                        Settings
                    </Menubar.Trigger>
                </Menubar.Menu>
            </Menubar.Root>
        </div>
    );
};

export default ProjectFiles;
