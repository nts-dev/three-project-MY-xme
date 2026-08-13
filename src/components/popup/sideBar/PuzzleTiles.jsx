import {OverlayPanel} from "primereact/overlaypanel";
import React, {useEffect, useState} from "react";
import {IconField} from "primereact/iconfield";
import {InputIcon} from "primereact/inputicon";
import {InputText} from "primereact/inputtext";
import useGame from "../../../hooks/useGame";
import {Skeleton} from 'primereact/skeleton';
import LoadPuzzleObjects from "./LoadPuzzleObjects.jsx";
import PuzzleTileColumn from "./PuzzleTileColumn.jsx";

export default function PuzzleTiles({op, selectedCategory,currentMenu}) {
    const [objectList, setObjectList] = useState([]);
    const [initObjectList, setInitObjectList] = useState([]);
    const [isLoading, setIsLoading] = useState(true)
    const projectId = useGame((state) => state.projectID)
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);


    useEffect(() => {
        if (selectedCategory === undefined || Object.keys(selectedCategory).length === 0 ) {
            return;
        }

        const fetchObjects = async () => {
            setIsLoading(true)
            const allObjectsMap = new Map(); // Use Map to store objects with unique names


                const objects = await LoadPuzzleObjects(selectedCategory,projectId,isPuzzleGame);

                if (objects) {

                    for (const obj of objects) {

                        if (!allObjectsMap.has(obj.name)) {
                            allObjectsMap.set(obj.name, obj);
                        }
                    }

                }


            const allObjects = Array.from(allObjectsMap.values()); // Convert Map back to an array
            setIsLoading(false)

            setObjectList(allObjects);
            // console.log(allObjects)
            setInitObjectList(allObjects);
        };


        fetchObjects();


        return () => {
            setInitObjectList([])
            setObjectList([])
        }

    }, [selectedCategory]);


    // Handle drag start

    const handleHide = () => {
        const menuItem = document.querySelector('.edit-asset');
        if (menuItem) {
            menuItem.classList.remove('glowing-element')
        }
    }
    const filterTiles = (event) => {
        const term = event.target.value.toLowerCase();

        if (term.length === 0) {
            setObjectList(initObjectList)
        } else {
            const filteredObjects = initObjectList.filter((obj) => {
                const termLower = term.toLowerCase();

                return (
                    obj.name?.toLowerCase().includes(termLower) ||
                    obj.assetId?.toString().toLowerCase().includes(termLower) ||
                    obj.asset_info?.toLowerCase().includes(termLower)
                );
            });

            setObjectList(filteredObjects)
        }


    }
    const PlaceHolder = () => {
        const [list, setList] = useState(0);

        // Define the skeleton height in px (1rem = 16px by default)
        const skeletonHeight = 7 * 16; // 7rem = 112px

        useEffect(() => {
            // Calculate the number of skeletons that can fit in the screen height
            const screenHeight = window.innerHeight;
            const numberOfSkeletons = Math.floor(screenHeight / skeletonHeight);
            setList(numberOfSkeletons);
        }, []);

        // Generate the skeletons
        const skeletonArray = Array.from({length: list - 1}, (_, index) => (
            <div className="list-item" key={index}>
                <Skeleton width="100%" height="7rem" borderRadius="0.2rem"/>
            </div>
        ));

        return <>{skeletonArray}</>;
    };


    return (
        <div className="card flex justify-content-center">

            <OverlayPanel ref={op}
                          dismissable={false}
                          showCloseIcon className="tile-window"
                          onHide={handleHide}
                          // style={{padding: "0.5rem 0 0.5rem 0.5rem"}}
            >

                <div className="tile-search">
                    <IconField iconPosition="right">
                        <InputIcon className="pi pi-search"> </InputIcon>
                        <InputText
                            placeholder="Search..."
                            className="tile-search-text"
                            onChange={filterTiles}
                        />

                    </IconField>

                </div>

                <div id="t-column" className="tile-column">
                    {objectList.length == 0 && isLoading &&
                        <div className="tile-grid flex flex-column ">
                            <PlaceHolder key={'p-holder'}/>
                        </div>
                    }
                    {objectList.length > 0 &&
                        <>
                            <canvas id="tile-canvas"/>
                            <div id="tile-container">
                                <PuzzleTileColumn key={'t-column'} objectList={objectList} currentMenu={currentMenu}/>
                            </div>

                        </>
                    }

                    {objectList.length == 0 && !isLoading &&

                        <div className="tile-grid-no-asset flex flex-column ">
                            No Assets found!
                        </div>
                    }

                </div>

            </OverlayPanel>
        </div>
    );
}
