import React, {memo} from 'react'
import useGame from "../hooks/useGame";
import {ThreeViewSidebarMenu} from "./ThreeViewSidebarMenu";

export const ThreeViewSidebar: React.FC = memo(function Sidebar() {
    const toggleSideBar: string = useGame((state: any) => state.toggleSideBar)
    const darkTheme = useGame((state: any) => state.darkTheme);
    const isPackage = useGame((state: any) => state.isPackage);

    if (isPackage) {
        return null;
    }

    return (
        <div className="py-5 z-10"
             style={{position: 'absolute', height: '100%', zIndex: toggleSideBar != '' ? '-1' : '999'}}>
            <div
                className={`${toggleSideBar}  sidebar h-full  shadow rounded-xs  w-64 space-y-6 pt-1 pb-7 px-2 absolute inset-y-0 left-0 md:relative  transform transition duration-200 ease-in-out`}
                style={{background: darkTheme?'#282c34': '#fff', width: '420px'}}
            >
                <nav>
                    <ThreeViewSidebarMenu/>
                </nav>

            </div>
        </div>
    )
})
