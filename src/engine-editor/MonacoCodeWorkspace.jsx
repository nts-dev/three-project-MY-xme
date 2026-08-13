import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useSelector } from 'react-redux';
import useGame from '../hooks/useGame';
import CodeActionBar from './CodeActionBar';
import { DSL_LANGUAGE_BY_EXTENSION, registerDslMonacoLanguages } from './dsl/monacoDsl';
import { DSL_LANGUAGE_IDS, DSL_MARKER_OWNER, analyzeDslContent, hasDslErrors } from './dsl/analyzeDsl';
import { runDslDocument } from './dsl/dslRunnerClient';

loader.config({ monaco });

const FALLBACK_CODE = `// Select or load a project file to edit here.
// The 3D canvas stays live, so Split mode is useful while testing changes.
`;

const LANGUAGE_BY_EXTENSION = {
    ...DSL_LANGUAGE_BY_EXTENSION,
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    mjs: 'javascript',
    css: 'css',
    html: 'html',
};

const getExtension = (path = '') => path.split('.').pop()?.toLowerCase() || 'txt';

const getDslLanguageFromContent = (value = '') => {
    const text = value.trim();
    if (!text) {
        return null;
    }

    if (/^\s*(?:LINE|RECTANG|ARC|boxArray|arcByLength)\b/im.test(text)) {
        return 'nts';
    }

    if (/^\s*level\s+L?\d+\b/im.test(text)) {
        return 'gdsl';
    }

    if (/^\s*(?:project|shapeAsset|morph(?:Cloud)?|placeObject|placeObjectArea|mysqlQuery|queryMysql|animate|animateGsap|animateMotion|timeline|timelineGsap|timelineMotion)\b/im.test(text)) {
        return 'odsl';
    }

    return null;
};

const getFileLanguage = (path, value = '') => (
    DSL_LANGUAGE_BY_EXTENSION[getExtension(path)]
    || getDslLanguageFromContent(value)
    || LANGUAGE_BY_EXTENSION[getExtension(path)]
    || 'plaintext'
);

const getDslProjectId = (value = '', selectedProjectId = 125) => {
    const projectMatch = /^\s*project\s+([^\s]+)/im.exec(value);
    const projectId = projectMatch?.[1] || selectedProjectId || 125;
    return String(projectId).replace(/[^A-Za-z0-9_-]/g, '');
};

const getDslLevel = (value = '') => {
    const levelMatch = /^\s*level\s+L?(\d+)/im.exec(value);
    return levelMatch?.[1] || '0';
};

const getDslFileExtension = (language) => {
    if (language === 'gdsl') return 'gdsl';
    if (language === 'nts') return 'nts';
    if (language === 'sdsl') return 'sdsl';
    return 'odsl';
};

const getDslFileUrl = (fileName, language) => {
    const params = new URLSearchParams({
        fileName,
        extension: getDslFileExtension(language),
    });
    return `${import.meta.env.VITE_API_URL}/dsl-file?${params.toString()}`;
};

const getEditorDocumentPath = (sourcePath, value, language, selectedProjectId) => {
    if (language === 'odsl') {
        return `template ${getDslProjectId(value, selectedProjectId)}.odsl`;
    }

    if (language === 'gdsl') {
        return `RoguePlayer L${getDslLevel(value)}.gdsl`;
    }

    if (language === 'nts') {
        return sourcePath?.replace(/\.[^/.]+$/, '.nts') || 'Dsl Template.nts';
    }

    if (language === 'sdsl') {
        return sourcePath?.replace(/\.[^/.]+$/, '.sdsl') || 'Shape Template.sdsl';
    }

    return sourcePath;
};

const stringifyFileData = (file) => {
    if (file?.error) {
        return `// Unable to load ${file.path}\n// ${file.error.message || file.error}`;
    }

    if (typeof file?.data === 'string') {
        return file.data;
    }

    if (file?.data !== undefined && file?.data !== null) {
        return JSON.stringify(file.data, null, 2);
    }

    return FALLBACK_CODE;
};

const createCommonDslTemplate = (selectedProjectId = 125) => {
    const projectId = selectedProjectId || 125;
    return [
        `project ${projectId}`,
        '',
        `mysqlQuery "queryAllAssets" roomId(${projectId})`,
        '',
    ].join('\n');
};

const isDslLanguage = (language) => DSL_LANGUAGE_IDS.has(language);

const getEditorFiles = (fileDataFiles = [], selectedProjectId = 125) => {
    const files = fileDataFiles
        .filter(file => file?.path)
        .map((file) => {
            const value = stringifyFileData(file);
            const language = getFileLanguage(file.path, value);
            return {
                path: file.path,
                language,
                value,
            };
        })
        .filter(file => isDslLanguage(file.language) || getExtension(file.path) !== 'json');

    return files.length
        ? files
        : [{
            path: `template ${selectedProjectId || 125}.odsl`,
            language: 'odsl',
            value: createCommonDslTemplate(selectedProjectId),
        }];
};

const MIN_WORKSPACE_WIDTH = 360;
const MIN_WORKSPACE_HEIGHT = 240;

const getEditorMetric = (shell, name) => {
    const value = getComputedStyle(shell).getPropertyValue(name);
    return Number.parseFloat(value) || 0;
};

const getDefaultWorkspaceRect = (mode) => {
    const shell = document.querySelector('.rogue-editor-shell');
    const shellRect = shell?.getBoundingClientRect() || {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
    };
    const editorTop = shell ? getEditorMetric(shell, '--editor-top') : 0;
    const editorLeft = shell ? getEditorMetric(shell, '--editor-left') : 0;
    const editorRight = shell ? getEditorMetric(shell, '--editor-right') : 0;
    const editorBottom = shell ? getEditorMetric(shell, '--editor-bottom') : 0;
    const availableWidth = Math.max(MIN_WORKSPACE_WIDTH, shellRect.width - editorLeft - editorRight);
    const height = Math.max(MIN_WORKSPACE_HEIGHT, shellRect.height - editorTop - editorBottom);
    const width = mode === 'split'
        ? Math.max(MIN_WORKSPACE_WIDTH, availableWidth * 0.5)
        : availableWidth;

    return {
        left: mode === 'split' ? editorLeft + (availableWidth * 0.5) : editorLeft,
        top: editorTop,
        width,
        height,
    };
};

const clampWorkspaceRect = (rect) => {
    const shell = document.querySelector('.rogue-editor-shell');
    const shellRect = shell?.getBoundingClientRect() || {
        width: window.innerWidth,
        height: window.innerHeight,
    };
    const width = Math.min(Math.max(rect.width, MIN_WORKSPACE_WIDTH), shellRect.width);
    const height = Math.min(Math.max(rect.height, MIN_WORKSPACE_HEIGHT), shellRect.height);

    return {
        left: Math.min(Math.max(rect.left, 0), Math.max(0, shellRect.width - width)),
        top: Math.min(Math.max(rect.top, 0), Math.max(0, shellRect.height - height)),
        width,
        height,
    };
};

const defineEditorTheme = (monacoInstance) => {
    monacoInstance.editor.defineTheme('nts-playcanvas', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '7d8f94' },
            { token: 'keyword', foreground: 'ffb86c' },
            { token: 'keyword.control', foreground: '8ed0dd', fontStyle: 'bold' },
            { token: 'dsl.function', foreground: '82e6c8' },
            { token: 'type.identifier', foreground: '82e6c8' },
            { token: 'identifier', foreground: 'dfecef' },
            { token: 'variable', foreground: 'f4c56a' },
            { token: 'string', foreground: 'a8d982' },
            { token: 'number', foreground: '84c7f5' },
            { token: 'number.hex', foreground: 'f6a36c' },
            { token: 'operator', foreground: '8ed0dd' },
            { token: 'delimiter', foreground: 'a9c3c9' },
        ],
        colors: {
            'editor.background': '#1a282c',
            'editor.foreground': '#dfecef',
            'editorLineNumber.foreground': '#6f8388',
            'editorLineNumber.activeForeground': '#c6d7db',
            'editorCursor.foreground': '#f47b20',
            'editor.selectionBackground': '#35505a',
            'editor.inactiveSelectionBackground': '#2b3f45',
            'editor.lineHighlightBackground': '#22343a',
            'editorGutter.background': '#1a282c',
            'minimap.background': '#172326',
        },
    });
};

const beforeMountEditor = (monacoInstance) => {
    defineEditorTheme(monacoInstance);
    registerDslMonacoLanguages(monacoInstance);
};

const getMonacoSeverity = (monacoInstance, severity) => (
    severity === 'error'
        ? monacoInstance.MarkerSeverity.Error
        : monacoInstance.MarkerSeverity.Warning
);

const validateDslModel = (monacoInstance, model, language) => {
    if (!model || !DSL_LANGUAGE_IDS.has(language)) {
        if (model) {
            monacoInstance.editor.setModelMarkers(model, DSL_MARKER_OWNER, []);
        }
        return [];
    }

    const diagnostics = analyzeDslContent(model.getValue(), language);
    const markers = diagnostics.map(item => ({
        severity: getMonacoSeverity(monacoInstance, item.severity),
        message: item.message,
        startLineNumber: item.lineNumber,
        startColumn: item.startColumn,
        endLineNumber: item.lineNumber,
        endColumn: item.endColumn,
    }));

    monacoInstance.editor.setModelMarkers(model, DSL_MARKER_OWNER, markers);
    return diagnostics;
};

const MonacoCodeWorkspace = ({ mode, onClose }) => {
    const fileDataFiles = useSelector(store => store.fileData.files);
    const selectedProjectId = useGame(state => state.projectID);
    const gridVisible = useGame(state => state.grid);
    const files = useMemo(
        () => getEditorFiles(fileDataFiles, selectedProjectId),
        [fileDataFiles, selectedProjectId],
    );
    const [selectedPath, setSelectedPath] = useState(files[0]?.path || 'example.mjs');
    const [drafts, setDrafts] = useState({});
    const [dslSaveStatus, setDslSaveStatus] = useState('idle');
    const [dslActionStatus, setDslActionStatus] = useState(null);
    const [workspaceRect, setWorkspaceRect] = useState(() => getDefaultWorkspaceRect(mode));
    const interactionRef = useRef(null);
    const editorRef = useRef(null);
    const monacoRef = useRef(null);

    useEffect(() => {
        if (!files.some(file => file.path === selectedPath)) {
            setSelectedPath(files[0]?.path || 'example.mjs');
        }
    }, [files, selectedPath]);

    useEffect(() => {
        setWorkspaceRect(clampWorkspaceRect(getDefaultWorkspaceRect(mode)));
    }, [mode]);

    useEffect(() => {
        const handleResize = () => {
            setWorkspaceRect((current) => clampWorkspaceRect(current));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const startWorkspaceInteraction = useCallback((event, type, edge = '') => {
        if (event.button !== 0 || event.target.closest('button')) {
            return;
        }

        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        interactionRef.current = {
            type,
            edge,
            startX: event.clientX,
            startY: event.clientY,
            startRect: workspaceRect,
        };
    }, [workspaceRect]);

    const updateWorkspaceInteraction = useCallback((event) => {
        const interaction = interactionRef.current;
        if (!interaction) {
            return;
        }

        const dx = event.clientX - interaction.startX;
        const dy = event.clientY - interaction.startY;
        const nextRect = { ...interaction.startRect };

        if (interaction.type === 'drag') {
            nextRect.left += dx;
            nextRect.top += dy;
        } else {
            if (interaction.edge.includes('e')) {
                nextRect.width += dx;
            }

            if (interaction.edge.includes('s')) {
                nextRect.height += dy;
            }

            if (interaction.edge.includes('w')) {
                nextRect.left += dx;
                nextRect.width -= dx;
            }

            if (interaction.edge.includes('n')) {
                nextRect.top += dy;
                nextRect.height -= dy;
            }
        }

        setWorkspaceRect(clampWorkspaceRect(nextRect));
    }, []);

    const stopWorkspaceInteraction = useCallback(() => {
        interactionRef.current = null;
    }, []);

    const selectedFile = files.find(file => file.path === selectedPath) || files[0];
    const value = drafts[selectedFile.path] ?? selectedFile.value;
    const selectedLanguage = getFileLanguage(selectedFile.path, value);
    const editorDocumentPath = getEditorDocumentPath(selectedFile.path, value, selectedLanguage, selectedProjectId);
    const resizeHandles = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'];

    useEffect(() => {
        if (!selectedFile || !DSL_LANGUAGE_IDS.has(selectedLanguage) || drafts[selectedFile.path] !== undefined) {
            return undefined;
        }

        const controller = new AbortController();

        const loadSavedDslDocument = async () => {
            try {
                const response = await fetch(getDslFileUrl(editorDocumentPath, selectedLanguage), {
                    signal: controller.signal,
                });

                if (response.status === 404) {
                    return;
                }

                const result = await response.json().catch(() => ({}));
                if (!response.ok || result?.ok === false || typeof result?.content !== 'string') {
                    throw new Error(result?.error || `Load failed (${response.status})`);
                }

                setDrafts(previous => (
                    previous[selectedFile.path] === undefined
                        ? { ...previous, [selectedFile.path]: result.content }
                        : previous
                ));
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('DSL load failed', error);
                }
            }
        };

        loadSavedDslDocument();
        return () => controller.abort();
    }, [drafts, editorDocumentPath, selectedFile, selectedLanguage]);

    const saveDslDocument = useCallback(async () => {
        if (!DSL_LANGUAGE_IDS.has(selectedLanguage)) {
            return;
        }

        setDslSaveStatus('saving');
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/dsl-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: editorDocumentPath,
                    content: value,
                    language: selectedLanguage,
                    extension: getDslFileExtension(selectedLanguage),
                    projectId: getDslProjectId(value, selectedProjectId),
                    level: getDslLevel(value),
                }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result?.ok === false) {
                throw new Error(result?.error || `Save failed (${response.status})`);
            }
            setDslSaveStatus('saved');
            window.setTimeout(() => setDslSaveStatus('idle'), 1600);
        } catch (error) {
            console.error('DSL save failed', error);
            setDslSaveStatus('error');
            window.setTimeout(() => setDslSaveStatus('idle'), 2600);
        }
    }, [editorDocumentPath, selectedLanguage, selectedProjectId, value]);

    const runDslAction = useCallback(async (action) => {
        const editor = editorRef.current;
        const monacoInstance = monacoRef.current;
        const model = editor?.getModel?.();

        if (!editor || !monacoInstance || !model || !DSL_LANGUAGE_IDS.has(selectedLanguage)) {
            return;
        }

        const diagnostics = validateDslModel(monacoInstance, model, selectedLanguage);
        const errors = diagnostics.filter(item => item.severity === 'error');

        if (hasDslErrors(diagnostics)) {
            const firstError = errors[0];
            editor.revealLineInCenter(firstError.lineNumber);
            editor.setPosition({
                lineNumber: firstError.lineNumber,
                column: firstError.startColumn,
            });
            editor.focus();
            setDslActionStatus({ type: 'error', message: `${action === 'debug' ? 'Debug' : 'Run'} blocked: ${errors.length} syntax error${errors.length === 1 ? '' : 's'}.` });
            return;
        }

        setDslActionStatus({ type: 'warning', message: `${action === 'debug' ? 'Debugging' : 'Running'} DSL...` });
        try {
            const result = await runDslDocument({
                content: model.getValue(),
                fileName: editorDocumentPath,
                language: selectedLanguage,
                projectId: getDslProjectId(model.getValue(), selectedProjectId),
                level: getDslLevel(model.getValue()),
                gridVisible,
            });
            const warningCount = diagnostics.filter(item => item.severity === 'warning').length;
            setDslActionStatus({
                type: warningCount ? 'warning' : 'success',
                message: `${action === 'debug' ? 'Debug' : 'Run'} complete: project ${result.projectId}${result.level != null ? ` L${result.level}` : ''}${warningCount ? `, ${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}.`,
            });
            window.setTimeout(() => setDslActionStatus(null), 2800);
        } catch (error) {
            console.error('DSL run failed', error);
            setDslActionStatus({ type: 'error', message: error.message || 'Run failed.' });
        }
    }, [editorDocumentPath, gridVisible, selectedLanguage, selectedProjectId]);

    useEffect(() => {
        const editor = editorRef.current;
        const monacoInstance = monacoRef.current;
        const model = editor?.getModel?.();

        if (!editor || !monacoInstance || !model) {
            return;
        }

        if (model.getLanguageId?.() !== selectedLanguage) {
            monacoInstance.editor.setModelLanguage(model, selectedLanguage);
        }
        validateDslModel(monacoInstance, model, selectedLanguage);
    }, [selectedLanguage, editorDocumentPath, value]);

    if (mode === 'canvas') {
        return null;
    }

    return (
        <section
            className={`editor-code-workspace is-${mode}`}
            style={{
                left: `${workspaceRect.left}px`,
                top: `${workspaceRect.top}px`,
                width: `${workspaceRect.width}px`,
                height: `${workspaceRect.height}px`,
                right: 'auto',
                bottom: 'auto',
            }}
            onPointerMove={updateWorkspaceInteraction}
            onPointerUp={stopWorkspaceInteraction}
            onPointerCancel={stopWorkspaceInteraction}
        >
            <header
                className="editor-code-header"
                onPointerDown={(event) => startWorkspaceInteraction(event, 'drag')}
            >
                <span>Code</span>
                <CodeActionBar
                    actionStatus={dslActionStatus}
                    saveStatus={dslSaveStatus}
                    onSave={saveDslDocument}
                    onRun={() => runDslAction('run')}
                    onDebug={() => runDslAction('debug')}
                />
                <button
                    type="button"
                    className="editor-code-close-button"
                    aria-label="Close code editor"
                    data-tooltip="Close"
                    onClick={onClose}
                >
                    x
                </button>
            </header>

            <div className="editor-code-body">
                <Editor
                    path={editorDocumentPath}
                    language={selectedLanguage}
                    value={value}
                    theme="nts-playcanvas"
                    beforeMount={beforeMountEditor}
                    onMount={(editor, monacoInstance) => {
                        editorRef.current = editor;
                        monacoRef.current = monacoInstance;
                        const model = editor.getModel();
                        if (model && model.getLanguageId?.() !== selectedLanguage) {
                            monacoInstance.editor.setModelLanguage(model, selectedLanguage);
                        }
                        validateDslModel(monacoInstance, model, selectedLanguage);
                    }}
                    onChange={(nextValue) => {
                        setDslActionStatus(null);
                        setDrafts(previous => ({
                            ...previous,
                            [selectedFile.path]: nextValue ?? '',
                        }));
                    }}
                    options={{
                        automaticLayout: true,
                        fontFamily: 'Roboto Mono, Consolas, monospace',
                        fontSize: 13,
                        minimap: { enabled: true },
                        padding: { top: 8, bottom: 8 },
                        scrollBeyondLastLine: false,
                        tabSize: 4,
                        wordWrap: 'off',
                    }}
                    loading={<div className="editor-code-loading">Loading code editor...</div>}
                />
            </div>
            {resizeHandles.map(edge => (
                <span
                    key={edge}
                    className={`editor-code-resize-handle is-${edge}`}
                    aria-hidden="true"
                    onPointerDown={(event) => startWorkspaceInteraction(event, 'resize', edge)}
                />
            ))}
        </section>
    );
};

export default MonacoCodeWorkspace;
