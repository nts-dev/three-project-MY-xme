import React, { useEffect, useRef, useState } from 'react';
import * as Menubar from '@radix-ui/react-menubar';
import { FaCompress, FaExpand, FaPlay, FaStop } from 'react-icons/fa';
import useGame from '../hooks/useGame';
import { blurCurrentTarget, suppressSpaceButtonActivation } from '../utils/keyboardEvents';

const menuItems = ['Project', 'Edit', 'View', 'Node', 'Scene', 'Actions', 'Window', 'Help', 'About'];
const toolItems = [
    { icon: 'mini-icon-ball.png', label: 'Select', action: 'select' },
    { icon: 'mini-icon-refresh.png', label: 'Reload', action: 'reload' },
    
    { icon: 'mini-icon-tool.png', label: 'Tool' },
    { icon: 'mini-icon-local-coords.png', label: 'Local coordinates' },
    { icon: 'mini-icon-gizmo.png', label: 'Move' },
    { icon: 'mini-icon-fx.png', label: 'Effects' },
    { icon: 'mini-icon-light.png', label: 'Light' },
    { icon: 'mini-icon-gui.png', label: 'GUI' },
    { icon: 'mini-icon-grid.png', label: 'Show/hide grid', action: 'grid' },
    { icon: 'mini-icon-film.png', label: 'Timeline' },
    { icon: 'mini-icon-mesh.png', label: 'Mesh' },
    { icon: 'mini-icon-graph.png', label: 'Graph' },
    { icon: 'mini-icon-cube.png', label: 'Cube' },
    { label: 'Fullscreen', action: 'fullscreen', glyph: 'fullscreen' },
    { label: 'Play mode', action: 'play', glyph: 'play' },
];

const iconSrc = (icon) => `${import.meta.env.BASE_URL}webglstudio-icons/${icon}`;

const workspaceModes = [
    { value: 'canvas', label: '3D' },
    { value: 'code', label: 'Code' },
    { value: 'split', label: 'Split' },
];

const isUrlLevelProjectLaunch = () => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const skipMenu = params.get("skipMenu");
    const source = params.get("source");

    return /_L\d+$/i.test(params.get("projectId") || "")
        && mode !== "edit"
        && skipMenu !== "1"
        && source !== "theia";
};

const getFullscreenRoot = (isGameProject = false) => {
    if (isGameProject) {
        return document.documentElement;
    }

    return document.querySelector('.editor-app-root') || document.documentElement;
};

const setEditorFullscreenClass = (enabled, isGameProject = false) => {
    const root = getFullscreenRoot(isGameProject);
    const appRoot = document.querySelector('.editor-app-root');
    root.classList.toggle('is-editor-fullscreen', enabled);
    appRoot?.classList.toggle('is-editor-fullscreen', enabled);
    document.documentElement.classList.toggle('is-editor-fullscreen', enabled);
    document.body.classList.toggle('is-editor-fullscreen', enabled);
    document.documentElement.classList.toggle('is-game-project-fullscreen', enabled && isGameProject);
    document.body.classList.toggle('is-game-project-fullscreen', enabled && isGameProject);
    appRoot?.classList.toggle('is-game-project-fullscreen', enabled && isGameProject);
};

const EditorTopBar = ({ workspaceMode = 'canvas', setWorkspaceMode }) => {
    const grid = useGame((state) => state.grid);
    const setGrid = useGame((state) => state.setGrid);
    const reload = useGame((state) => state.reload);
    const setReload = useGame((state) => state.setReload);
    const character = useGame((state) => state.character);
    const firstPerson = useGame((state) => state.firstperson);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setCharacter = useGame((state) => state.setCharacter);
    const projectId = useGame((state) => state.projectID);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const buttonMode = useGame((state) => state.buttonMode);
    const setPauseGame = useGame((state) => state.setPauseGame);
    const editorSelectionEnabled = useGame((state) => state.editorSelectionEnabled);
    const setEditorSelectionEnabled = useGame((state) => state.setEditorSelectionEnabled);
    const setSelectedEditorInstance = useGame((state) => state.setSelectedEditorInstance);
    
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const [isFullscreen, setIsFullscreen] = useState(() => (
        typeof document !== 'undefined' && Boolean(document.fullscreenElement)
    ));
    const buttonModeRef = useRef(buttonMode);
    const isPuzzleGameRef = useRef(isPuzzleGame);

    useEffect(() => {
        buttonModeRef.current = buttonMode;
    }, [buttonMode]);

    useEffect(() => {
        isPuzzleGameRef.current = isPuzzleGame;
    }, [isPuzzleGame]);

    const exitPlayMode = () => {
        setPauseGame(false);
        setFirstPerson(false);
        setCharacter(false)
        setButtonMode('Edit Mode');
    };

    useEffect(() => {
        const requestViewportResize = () => {
            window.dispatchEvent(new Event('resize'));
            requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
            window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
        };

        const handleFullscreenChange = () => {
            const enabled = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
            setIsFullscreen(enabled);
            setEditorFullscreenClass(enabled, Boolean(isPuzzleGameRef.current));

            if (!enabled && isPuzzleGameRef.current && buttonModeRef.current === 'Play mode') {
                exitPlayMode();
            }

            requestViewportResize();
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            if (!isUrlLevelProjectLaunch()) {
                setEditorFullscreenClass(false, Boolean(isPuzzleGame));
            }
        };
    }, [isPuzzleGame, setButtonMode, setFirstPerson, setPauseGame,setCharacter]);

    const toggleFullscreen = async () => {
        const gameProjectFullscreen = Boolean(isPuzzleGame);
        const fullscreenTarget = getFullscreenRoot(gameProjectFullscreen);

        try {
            if (document.fullscreenElement) {
                exitPlayMode();
                setEditorFullscreenClass(false, gameProjectFullscreen);
                await document.exitFullscreen();
            } else {
                setEditorFullscreenClass(true, gameProjectFullscreen);
                await fullscreenTarget.requestFullscreen();
            }
        } catch (error) {
            setEditorFullscreenClass(Boolean(document.fullscreenElement), gameProjectFullscreen);
            console.warn('Fullscreen toggle failed:', error);
        }
    };

    const enterFullscreen = async () => {
        if (document.fullscreenElement) {
            return;
        }

        const gameProjectFullscreen = Boolean(isPuzzleGame);
        const fullscreenTarget = getFullscreenRoot(gameProjectFullscreen);

        try {
            setEditorFullscreenClass(true, gameProjectFullscreen);
            await fullscreenTarget.requestFullscreen();
        } catch (error) {
            setEditorFullscreenClass(Boolean(document.fullscreenElement), gameProjectFullscreen);
            console.warn('Fullscreen request failed:', error);
        }
    };

    const togglePlayMode = async () => {
     
        if(String(projectId).includes('137')) {
              const nextFirstPerson = !firstPerson;
               setGrid(false);
              setFirstPerson(nextFirstPerson)
               setButtonMode(nextFirstPerson  ? 'Play mode' : 'Edit Mode');

                if (nextFirstPerson) {
            await enterFullscreen();
        }
            return;
        }
        const nextCharacter = !character;
              setCharacter(nextCharacter)
        
        setButtonMode(nextCharacter  ? 'Play mode' : 'Edit Mode');

        if (nextCharacter) {
            await enterFullscreen();
        }
    };

    const toggleSelectionMode = () => {
        const nextEnabled = !editorSelectionEnabled;
        setEditorSelectionEnabled(nextEnabled);

        if (!nextEnabled) {
            setSelectedEditorInstance(null);
            window.dispatchEvent(new CustomEvent('editor-detach-transform-controls'));
        }
    };

    const handleToolClick = (item, event) => {
        //console.log('Tool clicked:', item);
        blurCurrentTarget(event);

        if (item.action === 'select') {
            toggleSelectionMode();
            return;
        }

        if (item.action === 'grid') {
            setGrid(!grid);
            return;
        }

        if (item.action === 'fullscreen') {
            toggleFullscreen();
            return;
        }

        if (item.action === 'reload') {
            setReload(!reload);
            return;
        }

        if (item.action === 'play') {
            void togglePlayMode();
        }
    };

    const isToolActive = (item) => (
        (item.action === 'select' && editorSelectionEnabled) ||
        (item.action === 'grid' && grid) ||
        (item.action === 'play' && firstPerson) ||
        (item.action === 'fullscreen' && isFullscreen)
    );

    const renderToolIcon = (item) => {
        if (item.glyph === 'fullscreen') {
            return isFullscreen ? <FaCompress aria-hidden="true" /> : <FaExpand aria-hidden="true" />;
        }

        if (item.glyph === 'play') {
            return firstPerson ? <FaStop aria-hidden="true" /> : <FaPlay aria-hidden="true" />;
        }

        return <img src={iconSrc(item.icon)} alt="" />;
    };

    return (
        <header className="webglstudio-topbar">
            <Menubar.Root className="webglstudio-menu">
                {menuItems.map(item => (
                    <Menubar.Menu key={item}>
                        <Menubar.Trigger className="webglstudio-menu-trigger">
                            {item}
                        </Menubar.Trigger>
                    </Menubar.Menu>
                ))}
            </Menubar.Root>

            <div className="webglstudio-top-toolstrip" aria-label="Editor tools">
                {toolItems.map(item => (
                    <button
                        key={item.label}
                        className={`webglstudio-tool-button ${isToolActive(item) ? 'is-active' : ''}`}
                        type="button"
                        aria-label={item.label}
                        data-tooltip={item.label}
                        data-tooltip-placement="bottom"
                        aria-pressed={item.action ? isToolActive(item) : undefined}
                        onClick={(event) => handleToolClick(item, event)}
                        onKeyDown={suppressSpaceButtonActivation}
                        onKeyUp={suppressSpaceButtonActivation}
                    >
                        {renderToolIcon(item)}
                    </button>
                ))}
            </div>

            <div className="webglstudio-workspace-switch" aria-label="Workspace view">
                {workspaceModes.map(item => (
                    <button
                        key={item.value}
                        type="button"
                        className={workspaceMode === item.value ? 'is-active' : ''}
                        aria-pressed={workspaceMode === item.value}
                        onClick={(event) => {
                            blurCurrentTarget(event);
                            setWorkspaceMode?.(item.value);
                        }}
                        onKeyDown={suppressSpaceButtonActivation}
                        onKeyUp={suppressSpaceButtonActivation}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="webglstudio-play-controls">
                <button
                    type="button"
                    aria-label={firstPerson ? 'Exit play mode' : 'Play mode'}
                    data-tooltip={firstPerson ? 'Exit play mode' : 'Play mode'}
                    data-tooltip-placement="bottom"
                    aria-pressed={firstPerson}
                    className={firstPerson ? 'is-active' : ''}
                    onClick={(event) => {
                        blurCurrentTarget(event);
                        void togglePlayMode();
                    }}
                    onKeyDown={suppressSpaceButtonActivation}
                    onKeyUp={suppressSpaceButtonActivation}
                >
                    {firstPerson ? <FaStop aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
                </button>
                <button
                    type="button"
                    aria-label="Pause"
                    data-tooltip="Pause"
                    data-tooltip-placement="bottom"
                    onClick={blurCurrentTarget}
                    onKeyDown={suppressSpaceButtonActivation}
                    onKeyUp={suppressSpaceButtonActivation}
                >
                    <span className="pause-glyph" />
                </button>
            </div>
        </header>
    );
};

export default EditorTopBar;
