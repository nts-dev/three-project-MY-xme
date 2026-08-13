import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import {Dialog} from "primereact/dialog";
import {DataTable} from 'primereact/datatable';
import {Column} from 'primereact/column';
import {InputText} from 'primereact/inputtext';
import useGame from "../../../hooks/useGame";
import {IconField} from "primereact/iconfield";
import {InputIcon} from "primereact/inputicon";
import {Toast} from "primereact/toast";

export default function ProductsGrid() {

    const [products, setProducts] = useState<any>([])
    const locationId = useGame((state: any) => state.locationId);

    const [globalFilter, setGlobalFilter] = useState<string>('');
    const toast = useRef(null);
    const  setSearchItem : any = useGame((state: any) => state.setSearchItem);
    const setisProductsOpen = useGame((state: any) => state.setisProductsOpen);
    const isProductsOpen = useGame((state: any) => state.isProductsOpen);

    const onRowSelect = (event: any) => {
        setSearchItem({id:event.data.assetId,type: null})
        // @ts-ignore
        if (toast.current) { // @ts-ignore
            toast.current.show({
                severity: 'info',
                summary: 'Product Selected',
                detail: `Name: ${event.data.Description}`,
                life: 3000
            });

        }
    };

    const onRowUnselect = (event: any) => {
        // @ts-ignore
        if (toast.current) {
            // @ts-ignore
            toast.current.show({
                severity: 'warn',
                summary: 'Product Unselected',
                detail: `Name: ${event.data.Description}`,
                life: 3000
            });

        }

    };

    useEffect(() => {

        if(locationId){
        fetch(`${import.meta.env.VITE_API_URL}/products/${locationId}`)
            .then(response => response.json())
            .then((data) => {
                setProducts(data)
            })
            .catch((error) => {
                console.error('Error fetching paths:', error);
            });
    }

    }, [locationId]);

    const renderHeader = () => {
        return (
            <div className="flex justify-between align-items-center">
                <h5 className="m-2">Products in location {locationId}</h5>
                <span className=" p-input-icon-right">
                    <IconField>
                        <InputIcon className="pi pi-search"/>
                        <InputText
                            onChange={(e) => setGlobalFilter((e.target as HTMLInputElement).value)}
                            placeholder="Search Assets..."
                            style={{width: '100%'}}
                        />
                    </IconField>
                </span>
            </div>
        );
    };

    const header = renderHeader();

    return (
        <>
            <Toast ref={toast}/>
            <Dialog
                header={header}
                modal={false}
                visible={isProductsOpen}
                position='bottom'
                style={{width: '50vw', height: '20rem', background: '#282c34', color: '#fff'}}
                onHide={() => {
                    if (!isProductsOpen) return;
                    setisProductsOpen(false);
                }}
                draggable={false}
                resizable={false}
                className='popup-asset-list'
            >
                <DataTable
                    value={products}
                    // header={header}
                    globalFilter={globalFilter}
                    emptyMessage="No product found."
                    dataKey="NTS_Partno"
                    className="p-datatable-sm custom-datatable"
                    scrollable
                    scrollHeight="calc(100% - 40px)"
                    stripedRows selectionMode="single"
                    onRowSelect={onRowSelect} onRowUnselect={onRowUnselect}
                    metaKeySelection={false}// Adjust the height as needed
                >
                    <Column field="NTS_Partno" header="NTS_Partno" sortable style={{width: '25%'}}/>
                    <Column field="Description" header="Description" sortable style={{width: '50%'}}/>
                    <Column field="State_cond" header="State_cond" sortable style={{width: '50%'}}/>
                    <Column field="Quantity_Int" header="Quantity_Int" sortable style={{width: '25%'}}/>
                </DataTable>
            </Dialog>
        </>
    );
}
