import React from 'react';
import useGame from '../hooks/useGame';
import FloorItems from '../components/floor-items/FloorItems.jsx';
import ViewportLevelSelect from './viewport-levels/ViewportLevelSelect';
import { useViewportLevels } from './viewport-levels/useViewportLevels';

const GameLevelDropdown = () => {
    const levelProps = useViewportLevels();
    return <ViewportLevelSelect {...levelProps} onSelect={levelProps.selectLevel} />;
};

const ViewportLevelDropdown = () => {
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);

    if (!isPuzzleGame) {
        return (
            <div className="viewport-level-dropdown-shell viewport-floor-dropdown-shell">
                <FloorItems colorValue={false} independent panelClassName="viewport-floor-dropdown-panel" />
            </div>
        );
    }

    return <GameLevelDropdown />;
};

export default ViewportLevelDropdown;
