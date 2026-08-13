import {Tree} from 'primereact/tree';
import * as React from 'react';
import useGame from "../../../hooks/useGame";

interface DocumentTreeProps {
    nodes: any[];
}

export default function DocumentTree({nodes}: DocumentTreeProps) {
    const expandedKeys = useGame((state: any) => state.expandedKeys);

    const onSelect = (event: any) => {
        if (event.node && event.node.data) {
            window.open(event.node.data, '_blank');
        }
    };

    const nodeTemplate = (node: any) => {
        const isThirdLevel = node.key.split('_').length === 3;


        // Function to determine if the icon is a PrimeReact icon or a custom image
        const renderIcon = (icon: string) => {
            if (icon && icon.endsWith('.png')) {
                return <img src={`./icons/${icon}`}
                            style={{width: '18px', height: '18px', marginRight: '8px', verticalAlign: 'middle'}}
                            alt={icon}/>;
            }
            return <span className={`pi pi-fw ${icon}`} style={{marginRight: '8px', verticalAlign: 'middle'}}/>;
        };
        return (
            <span
                title={node.info || ''}
                style={isThirdLevel ? {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'inline-block',
                    maxWidth: '100%'
                } : {}}
            >
            {/* Render only one icon */}
                <div  style={ {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'flex',
                    flexDirection: 'row',
                    maxWidth: '100%',

                } }>
                {renderIcon(node.icon)}
                    <span style={{verticalAlign: 'middle'}}>{node.label}</span>
                    </div>
        </span>
        );
    };


    return (
        <div className="card flex justify-content-center channel">
            <Tree
                key={JSON.stringify(expandedKeys)} // Force re-render when expandedKeys changes
                value={nodes}
                nodeTemplate={nodeTemplate}
                selectionMode="single"
                filterPlaceholder="Search documents..."
                expandedKeys={expandedKeys}
                onSelect={onSelect}
                className="w-full md:w-30rem document-tree"
            />
        </div>
    );

}
