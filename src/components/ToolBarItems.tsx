import React from 'react';
import { Menubar } from 'primereact/menubar';
import { InputText } from 'primereact/inputtext';
import { Badge } from 'primereact/badge';



export default function ToolBarItems() {
    const itemRenderer = (item: { icon: string | undefined; label: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; badge: any; shortcut: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; }) => (
        <a className="flex align-items-center p-menuitem-link">
            <span className={item.icon} />
            <span className="mx-2">{item.label}</span>
            {item.badge && <Badge className="ml-auto" value={item.badge} />}
            {item.shortcut && <span className="ml-auto border-1 surface-border border-round surface-100 text-xs p-1">{item.shortcut}</span>}
        </a>
    );
    const items: any = [
        {
            label: '',
            icon: 'pi pi-image'
        },
        {
            label: '',
            icon: 'pi pi-map-marker'
        },

        {
            label: '',
            icon: 'pi pi-table',
            template: itemRenderer
        },
        {
            label: 'Camera',
            icon: 'pi pi-camera',
            items: [
                {
                    label: 'Free Camera',
                    template: itemRenderer
                },
                {
                    label: 'First Person',
                    template: itemRenderer
                },
                {
                    label: 'Top View',
                    template: itemRenderer
                }
            ]
        }
    ];

    const end = (
        <div className="flex align-items-center gap-2" >
            <InputText placeholder="Search" type="text" className="w-8rem sm:w-auto"  style={{fontSize: '1em', borderRadius: '0.5em'}}/>
        </div>
    );

    return (
        <div className="card">
            <Menubar model={items} end={end}  style={{fontSize: '0.8em', background: 'white'}}/>
        </div>
    )
}
