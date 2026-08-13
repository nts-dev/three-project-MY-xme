import React, { useState } from 'react';
import { Tooltip } from 'react-tooltip';

const TreeView = ({ icon, label, children, initiallyExpanded, onClick, expandOnClick, errorMessage, isSelected, maxChildrenHeight, onContextMenu, actions }) => {
    const [expanded, setExpanded] = useState(initiallyExpanded || false);
    const hasChildren = Boolean(children && !errorMessage);

    const onTreeViewClick = event => {
        event.stopPropagation();
        expandOnClick ? setExpanded(!expanded) : onClick();
    };

    return (
        <div className='tree-view'>
            <div
                className={`tree-view-header${isSelected ? ' is-selected' : ''}`}
                onClick={onTreeViewClick}
                onContextMenu={onContextMenu}
                title={typeof label === 'string' ? label : undefined}
            >
                {hasChildren ? (
                    <span
                        className="tree-view-expand-button"
                        onClick={event => {
                            event.stopPropagation();
                            setExpanded(!expanded);
                        }}
                    >
                        {expanded ? '-' : '+'}
                    </span>
                ) : (
                    <span className="tree-view-expand-placeholder" />
                )}

                {icon ? <span className="tree-view-icon">{icon}</span> : null}
                <span className="tree-view-label">
                    {label}
                </span>

                {actions ? (
                    <span className="tree-view-actions">
                        {actions.map((action, index) => (
                            <span key={index} onClick={event => { event.stopPropagation(); action.onClick() }}>
                                {action.icon}
                            </span>
                        ))}
                    </span>
                ) : null}

                {errorMessage ? (
                    <div className="error-badge" data-tooltip-id="error-tooltip" data-tooltip-content={errorMessage}>
                        {'!'} <Tooltip id="error-tooltip" />
                    </div>
                ) : null}
            </div>            

            {children && expanded &&
                <div className="tree-view-children" style={{ maxHeight: maxChildrenHeight }}>
                    {children || children?.length ? children : '(none)'}
                </div>
            }  
        </div>
    );
};

export default TreeView;
