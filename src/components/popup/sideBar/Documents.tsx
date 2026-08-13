import * as React from 'react';
import { Sidebar } from 'primereact/sidebar';
import { useEffect, useState } from 'react';
import useGame from '../../../hooks/useGame';
import DocumentTree from './DocumentTree';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import {useGetDataQuery} from "../../../features/data/data";
import { Button } from 'primereact/button';

export default function Documents() {
    const documents = useGame((state: any) => state.documents);
    const setDocuments = useGame((state: any) => state.setDocuments);
    const [isSOP, setIsSOP] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [nodes, setNodes] = useState<any>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    // const { data, error, isLoading } = useGetDataQuery(`/documents`)


    const documentsEvent = useGame((state: any) => state.documentsEvent);
    const setExpandedKeys = useGame((state: any) => state.setExpandedKeys);
    const [reLoading, setReloading] = useState(false);
    // const [loading, setLoading] = useState(false);


    const load = () => {
        setReloading(!reLoading)
        setLoading(true)

    };
    // @ts-ignore
    function filterTree(nodes: any[], searchQuery: string, isVisible: boolean, isSOP: boolean, level: number = 1) {
        if (!searchQuery && !isVisible && !isSOP) return nodes;

        return nodes
            .map((node: any) => {
                // Recursively filter the children
                const filteredChildren: any = filterTree(node.children || [], searchQuery, isVisible, isSOP, level + 1);

                // Check if the node matches the visibility and SOP conditions
                const matchesVisibility = level === 3 ? (isVisible ? node.isVisible : true) : true;
                const matchesSOP = level === 3 ? (isSOP ? node.sop : true) : true;

                // Check if the node matches the search query or has children that match
                const matchesQuery = node.label.toLowerCase().includes(searchQuery.toLowerCase()) || filteredChildren.length > 0;

                // If the node is at level 1 or 2 and has no children, filter it out
                const shouldKeepNode = (level === 1 || level === 2) ? filteredChildren.length > 0 : true;

                // Return the node if it matches all conditions, otherwise return null
                return matchesQuery && matchesVisibility && matchesSOP && shouldKeepNode ? { ...node, children: filteredChildren } : null;
            })
            .filter(node => node !== null);
    }

    const filteredNodes = filterTree(nodes, searchQuery, isVisible, isSOP);


const shouldExpandNode = (node: any): boolean => {
    const label = (node?.label ?? '').toString().toLowerCase();
    const query = (searchQuery ?? '').toString().toLowerCase();

    if (node?.children?.length > 0) {
        const shouldExpandChildren = node.children.some((child: any) =>
            shouldExpandNode(child)
        );

        return shouldExpandChildren || label.includes(query);
    }

    return label.includes(query);
};

    useEffect(() => {
        const newExpandedKeys: any = {};

        const traverseAndExpand = (nodes: any[]) => {
            nodes.forEach((node: any) => {
                if (shouldExpandNode(node) && searchQuery.length > 0) {
                    newExpandedKeys[node.key] = true;
                }
                if (node.children) {
                    traverseAndExpand(node.children);
                }
            });
        };
        //
        traverseAndExpand(filteredNodes);
        setExpandedKeys(newExpandedKeys);

    }, [nodes, searchQuery]);

    useEffect(() => {
        if (documentsEvent == null) return;

        const event = documentsEvent.originalEvent.target.parentNode;

        if (event.parentNode.tagName === "LI") {
            documents ? event.classList.add('box-shadow') : event.classList.remove('box-shadow');
        } else {
            documents ? event.parentNode.parentNode.classList.add('box-shadow') : event.parentNode.parentNode.classList.remove('box-shadow');
        }
    }, [documents, documentsEvent]);

    useEffect(() => {

        const fetchDocuments = async () => {
            try {

                const response = await fetch(`${import.meta.env.VITE_API_URL}/documents`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();

                setNodes(data);
                setLoading(false)

            } catch (error) {
                console.error('Failed to fetch documents:', error);
            }
        };

        fetchDocuments();

    }, [documents,reLoading]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const setSOP = (event: any) => {
        setIsSOP(event.value);
    };

    const setVisibility = (event: any) => {
        setIsVisible(event.value);
    };

    const customHeader = () => {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>
                    NTS Documents
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', width: '100%' }}>
                        <IconField style={{ flex: '1', width: '100%' }}>
                            <InputIcon className="pi pi-search" />
                            <InputText
                                value={searchQuery}
                                onChange={handleSearchChange}
                                placeholder="Search Documents..."
                                style={{ width: '100%' }}
                            />
                        </IconField>
                    </div>
                    <div style={{
                        display: 'flex',
                        fontSize: '0.8rem',
                        justifyContent: 'space-evenly',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <InputSwitch checked={isSOP} onChange={setSOP} className="custom-switch"/>
                        <label className='t_label'>SOP</label>
                        <InputSwitch checked={isVisible} onChange={setVisibility} className="custom-switch"/>
                        <label className='t_label'>Visible</label>
                        <Button label="Refresh" icon={`pi pi-sync ${loading ? 'pi-spin' : ''}`} severity="secondary"
                                text onClick={load}/>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="card flex justify-content-center">
            <Sidebar
                className="categories"
                header={customHeader}
                visible={documents}
                position="right"
                onHide={() => setDocuments(false)}
                showCloseIcon={false}
            >
                <DocumentTree nodes={filteredNodes}/>
            </Sidebar>
        </div>
    );
}
