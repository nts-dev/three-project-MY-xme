import React from 'react';
import { Dropdown } from 'primereact/dropdown';
import { suppressSpaceButtonActivation } from '../../utils/keyboardEvents';
import { DEFAULT_LEVEL_CODE } from './levelUtils';

const DEFAULT_LEVELS = [{ name: `L ${DEFAULT_LEVEL_CODE}`, code: DEFAULT_LEVEL_CODE }];

const ViewportLevelSelect = ({ levels, loading, selectedLevelCode, onSelect }) => {
    const options = levels?.length ? levels : DEFAULT_LEVELS;

    return (
        <div className="viewport-level-dropdown-shell">
            <Dropdown
                value={selectedLevelCode}
                onChange={(event) => onSelect(event.value)}
                options={options}
                optionLabel="name"
                optionValue="code"
                placeholder={loading ? 'Loading...' : 'Level'}
                emptyMessage="No levels found"
                className="viewport-level-dropdown"
                panelClassName="viewport-level-dropdown-panel"
                disabled={loading}
                appendTo={typeof document !== 'undefined' ? document.body : undefined}
                onKeyDown={suppressSpaceButtonActivation}
                onKeyUp={suppressSpaceButtonActivation}
            />
        </div>
    );
};

export default ViewportLevelSelect;
