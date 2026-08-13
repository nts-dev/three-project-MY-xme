

import  {Fragment, useEffect, useRef, useState} from 'react'
import {Transition} from '@headlessui/react'
import useGame from "../hooks/useGame";
import {useClickOutside} from 'primereact/hooks';
import database from '../database';
import {Q} from '@nozbe/watermelondb';

export const ThreeViewProjectPicker = () => {
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const setProjectID = useGame((state) => state.setProjectID)
    const dropDownRef = useRef(null)
    const setToggleSideBar = useGame((state) => state.setToggleSideBar)
    const [projectsList, setProjectsList] = useState([])
    const toggleSideBar= useGame((state) => state.toggleSideBar)
    const overlayRef= useRef(null);
    const [pIcon, setPicon] = useState('pi pi-angle-down');
    const darkTheme = useGame((state) => state.darkTheme);
    const lazy = useGame((state) => state.lazy)
    const setIsPackage = useGame((state) => state.setIsPackage)
    const setPackageControl = useGame((state) => state.setPackageControl);
    const setBranch = useGame((state) => state.setBranch);


    useClickOutside(overlayRef, () => {
        if (toggleSideBar == '')
            setToggleSideBar('-translate-x-full')
        setPicon('pi pi-angle-down')

        setDropdownOpen(false)
    });


    useEffect(() => {

        const fetchData = async () => {
            try {
                const branchCollection = database.collections.get('branches');
                const roomsCollection = database.collections.get('rooms');

                const projects = [];

                const branches = await branchCollection.query().fetch();

                for (const branch of branches) {
                    // @ts-ignore
                    let rooms = await roomsCollection.query(Q.where('parent', branch.branchId)).fetch();

                    // Sort rooms by roomId
                    rooms.sort((a, b) => a.roomId - b.roomId); // Ascending numeric sort

                    for (const room of rooms) {
                        // @ts-ignore
                        projects.push({ id: room.roomId, name: `${branch.name} ${room.name}` });
                    }
                }

                const flatProjects = projects.flat(); // Flatten the array of arrays

                // @ts-ignore
                setProjectsList(flatProjects);
            } catch (error) {
                console.error('Failed to fetch data from IndexedDB:', error);
            }
        };

        fetchData();

    }, [dropdownOpen, lazy]);

    const closeDropdown = () => {
        (document.activeElement)?.blur?.()
        setDropdownOpen(!dropdownOpen)
    }

    const toggleDropdown = (currentValue) => {
        const newValue = !currentValue
        if (!newValue) {
            closeDropdown()
            setPicon('pi pi-angle-down')

        } else {

            setPicon('pi pi-angle-right')
            setDropdownOpen(newValue)
        }
    }

    const goToDetails = (projectId) => {
        setDropdownOpen(true)
        setPicon('pi pi-angle-down')
        setToggleSideBar('-translate-x-full')
        if (parseInt(projectId) == 140) {
            setPackageControl(true)
            setIsPackage(true)
            setProjectID(0)
            setBranch('Packaging')
            return
        }

        setProjectID(parseInt(projectId))


    }

    return (
        <div ref={overlayRef} className="block py-2.5 px-1" key='proj'>
            <p className="text-xs text-gray-400" style={{fontVariant: 'small-caps'}}></p>
            <div ref={dropDownRef} className="relative">
                <button onClick={() => toggleDropdown(dropdownOpen)}
                        className=" relative w-full flex justify-between text-left z-99999 py-2 transition-all focus:px-2 hover:px-2 ">
                    <span> NTS Projects</span>
                    <i className={pIcon}/>

                </button>
                <Transition
                    key='pr'
                    as={Fragment}
                    show={!dropdownOpen}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                >
                    <div
                        className="absolute left-0 mt-2 w-80 rounded-md overflow-y-auto shadow-xl z-20  border-bg-500 max-h-screen"
                        style={{background: darkTheme ? '#282c34' : '#fff', maxHeight: '70vh'}}
                    >

                        {projectsList.map((project, index) => {
                            return (
                                <button key={index}
                                        className="flex items-center w-full text-left px-4 py-2 text-sm border-b hover:bg-gray-200"
                                        onClick={() => goToDetails(project.id)}>
                                    {project.name}
                                </button>
                            );
                        })}

                    </div>

                </Transition>
            </div>
        </div>
    )
}
