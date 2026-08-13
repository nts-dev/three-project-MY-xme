
import React from 'react';
import { Sidebar } from 'primereact/sidebar';
import useGame from "../../hooks/useGame";
import ComponentTree from "./tree/ComponentTree";

export default function ComponentSideBar() {
    const isComponentTree = useGame((state: any) => state.isComponentTree);
    const setIsComponentTree = useGame((state: any) => state.setIsComponentTree);
    const customHeader = (
        <div className="flex align-items-center">
            <span style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center' }}>Component Tree</span>
        </div>
    );

    return (
            <Sidebar visible={isComponentTree}
                     onHide={() => setIsComponentTree(false)
            }
                     dismissable={false}
                     modal={false}
                     showCloseIcon={false}
                     header={customHeader}
            >
               <ComponentTree/>
            </Sidebar>

    )
}
