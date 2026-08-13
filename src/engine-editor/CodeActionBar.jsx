import React from 'react';
import { FaBug, FaPlay, FaSave } from 'react-icons/fa';

const getSaveTooltip = status => (
    status === 'saving'
        ? 'Saving...'
        : status === 'saved'
            ? 'Saved'
            : status === 'error'
                ? 'Save failed'
                : 'Save'
);

const CodeActionBar = ({
    actionStatus,
    saveStatus,
    onSave,
    onRun,
    onDebug,
}) => (
    <div className="editor-code-actions" aria-label="Code actions">
        {actionStatus && (
            <span className={`editor-code-action-status is-${actionStatus.type}`}>
                {actionStatus.message}
            </span>
        )}
        <button
            type="button"
            className={`editor-code-action-button ${saveStatus === 'saved' ? 'is-saved' : ''} ${saveStatus === 'error' ? 'is-error' : ''}`}
            aria-label="Save DSL"
            data-tooltip={getSaveTooltip(saveStatus)}
            title={getSaveTooltip(saveStatus)}
            disabled={saveStatus === 'saving'}
            onClick={onSave}
        >
            <FaSave aria-hidden="true" />
        </button>
        <button
            type="button"
            className="editor-code-action-button"
            aria-label="Run DSL"
            data-tooltip="Run"
            title="Run"
            onClick={onRun}
        >
            <FaPlay aria-hidden="true" />
        </button>
        <button
            type="button"
            className="editor-code-action-button"
            aria-label="Debug DSL"
            data-tooltip="Debug"
            title="Debug"
            onClick={onDebug}
        >
            <FaBug aria-hidden="true" />
        </button>
    </div>
);

export default CodeActionBar;
