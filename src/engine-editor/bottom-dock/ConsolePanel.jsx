import React from 'react';
import { FaRobot, FaTerminal } from 'react-icons/fa';

const ConsolePanel = ({ fileData, prompt, onPromptChange }) => (
    <>
        <div className="log-panel">
            <div className="log-line">
                <FaTerminal /> Editor ready
            </div>

            <div className="log-line">
                Loaded files: {Array.isArray(fileData) ? fileData.length : 0}
            </div>

            <div className="log-line">
                Asset thumbnails are generated from real 3D files.
            </div>
        </div>

        <div className="prompt-panel">
            <label>
                <FaRobot />
                Prompt editor
            </label>

            <textarea
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                placeholder="Describe an editor action or scene change..."
            />
        </div>
    </>
);

export default ConsolePanel;
