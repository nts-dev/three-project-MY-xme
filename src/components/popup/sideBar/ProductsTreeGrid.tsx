import React, {useEffect, useRef, useState} from 'react';
import { TreeTable } from 'primereact/treetable';
import { Column } from 'primereact/column';
import { Dialog } from "primereact/dialog";
import useGame from "../../../hooks/useGame";
import {Toast} from "primereact/toast";

const ProductsTreeGrid = () => {
    const locationId = useGame((state: any) => state.locationId);
    const setisProductsOpen = useGame((state: any) => state.setisProductsOpen);
    const isProductsOpen = useGame((state: any) => state.isProductsOpen);
    const [globalFilter, setGlobalFilter] = useState(null);
    const [products, setProducts] = useState<any>([])
    const [selectedNodeKey, setSelectedNodeKey] = useState(null);
    const toast = useRef(null);
    useEffect(() => {

        if(locationId){
            fetch(`${import.meta.env.VITE_API_URL}/products/${locationId}`)
                .then(response => response.json())
                .then((data) => {
                 if(data[0]?.children){
                     setProducts(data[0].children)
                 }
                 else{
                     setProducts([])
                 }
                })
                .catch((error) => {
                    console.error('Error fetching paths:', error);
                });
        }

    }, [locationId]);

    const renderHeader = () => {
        return (
            <div className="flex justify-between align-items-center">
                <h5 className="m-2">Products in location {locationId} </h5>

            </div>
        );
    };

    const addToast = (description: string) =>{
        if (toast.current) { // @ts-ignore
            toast.current.show({
                severity: 'info',
                summary: 'Product Selected',
                detail: `Name: ${description}`,
                life: 3000
            });

        }
    }

    const onSelectionChanged = (e: any) =>{
        const selectedKey = e.value;
        // Find the selected node data by key
        const findNodeByKey = (nodes: any, key: any): any => {
            for (let node of nodes) {
                if (node.key === key) {
                    return node.data; // Return the data of the matched node
                }
                if (node.children) {
                    const found = findNodeByKey(node.children, key);
                    if (found) return found;
                }
            }
            return null;
        };
        const selectedData = findNodeByKey(products, selectedKey);

        if(selectedData?.Location){
            addToast(selectedData.Productname)
        }

        setSelectedNodeKey(selectedKey)
    }
    const header = renderHeader();

    return (
        <>
            <Toast ref={toast}/>

        <Dialog
            header={header}
            modal={false}
            visible={isProductsOpen}
            position="bottom"
            style={{ width: '68vw', height: '20rem' }}
            onHide={() => setisProductsOpen(false)}
            draggable={false}
            resizable={false}

        >
            <TreeTable value={products}
                       globalFilter={globalFilter}
                       scrollable
                       selectionMode="single"
                       selectionKeys={selectedNodeKey}
                       onSelectionChange={onSelectionChanged}
                       scrollHeight="200px" className="p-treetable-striped p-treetable-gridlines">
                <Column field="NTS" header="NTS_SKU" expander className='p_column'/>
                <Column field="NTSSerialno" header="NTS Serialno" className='p_column'/>
                <Column field="VendorSerialno" header="Vendor Serialno" filter filterPlaceholder="search..." className='p_column'/>
                <Column field="VendorPartno" header="Vendor Partno" className='p_column'/>
                <Column field="Productname" header="Productname" className='p_column'/>
                <Column field="Grade" header="Grade" className='p_column'/>
                <Column field="Location" header="Location" filter filterPlaceholder="search..." className='p_column'/>
                <Column field="Qty" header="Qty" className='p_column'/>
            </TreeTable>
        </Dialog>
        </>
    );
};

export default ProductsTreeGrid;
