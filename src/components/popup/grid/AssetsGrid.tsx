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

export default function AssetsGrid() {
    const catId = useGame((state: any) => state.catId);
    const [showGrid, setShowGrid] = useState(false);
    const gridAssets = useGame((state: any) => state.gridAssets);

    const [rows, setRows] = useState<any>([]);
    const [globalFilter, setGlobalFilter] = useState<string>('');
    const toast = useRef(null);
    const  setSearchItem : any = useGame((state: any) => state.setSearchItem);

    const onRowSelect = (event: any) => {
        setSearchItem({id:event.data.assetId,type: null})
        // @ts-ignore
        if (toast.current) { // @ts-ignore
            toast.current.show({
                severity: 'info',
                summary: 'Asset Selected',
                detail: `Name: ${event.data.description}`,
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
                summary: 'Asset Unselected',
                detail: `Name: ${event.data.description}`,
                life: 3000
            });

        }

    };

    useEffect(() => {
        if (catId > 0) {
            setRows(gridAssets);
            setShowGrid(true);
        } else {
            setShowGrid(false);
        }
    }, [catId]);

    const renderHeader = () => {
        return (
            <div className="flex justify-between align-items-center">
                <h5 className="m-2">Assets</h5>
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
                key={'assetGrid'}
                header={header}
                modal={false}
                visible={showGrid}
                position='bottom'
                style={{width: '50vw', height: '20rem', background: '#282c34', color: '#fff'}}
                onHide={() => {
                    if (!showGrid) return;
                    setShowGrid(false);
                }}
                draggable={false}
                resizable={false}
                className='popup-asset-list'
            >
                <DataTable
                    value={rows}
                    key="assetId" // ✅ This ensures unique row keys
                    globalFilter={globalFilter}
                    emptyMessage="No asset found."
                    className="p-datatable-sm custom-datatable"
                    scrollable
                    scrollHeight="calc(100% - 40px)"
                    stripedRows selectionMode="single"
                    onRowSelect={onRowSelect} onRowUnselect={onRowUnselect}
                    metaKeySelection={false}// Adjust the height as needed
                >
                    <Column field="assetId" header="AssetID" sortable style={{width: '25%'}}/>
                    <Column field="description" header="Description" sortable style={{width: '50%'}}/>
                    <Column field="room" header="Room" sortable style={{width: '25%'}}/>
                </DataTable>
            </Dialog>
        </>
    );
}
