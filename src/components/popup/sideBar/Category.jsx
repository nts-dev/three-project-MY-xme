import * as React from 'react';
import { Sidebar } from 'primereact/sidebar';
import { useEffect, useState } from "react";
import useGame from "../../../hooks/useGame";
import CategoryList from "./CategoryList";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {FormControlLabel, Switch, Tooltip} from "@mui/material";

import * as THREE from "three";
import PuzzleCategoryList from "./PuzzleCategoryList";
import {sceneAssets} from "../../../threejs/player/puzzle/character/Constants";

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

export default function Category({currentMenu}) {
    const category = useGame((state) => state.category);
    const setCategory = useGame((state) => state.setCategory);
    const setCheckedItems = useGame((state) => state.setCheckedItems);
    const [selectAll, setSelectAll] = useState(true);
    const [prevItems, setPrevItems] = useState([]);
    const projectId = useGame((state) => state.projectID);
    const baseProjectId = String(projectId || "").split("_")[0];
    const checkReload = useGame((state) => state.checkReload);
    const setTemplate = useGame((state) => state.setTemplate);
    const setRawCategories = useGame((state) => state.setRawCategories);
    const isGame = useGame((state) => state.isGame) || baseProjectId == 147;
    const checkedItems = useGame((state) => state.checkedItems);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);

    const checkItems =  (data) => {

        const templates = {}
        const categoryIdList = []

            for( const i in data){

                const category = data[i].children
                //
                for(const j in  category){

                    const template = category[j];

                    templates[template.id] = template.template_id
                    categoryIdList.push(template.id)

                }
            }
            setTemplate(templates)

        // console.log(categoryIdList)
        //     setCheckedItems(categoryIdList);  // Set the object of objects structure

    };

    const fetchCategories = async () => {

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/getCategories/${isGame}/${baseProjectId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setRawCategories(data);
            checkItems(data)


        } catch (error) {
            console.error("Failed to fetch categories:", error);
        }
    };

    const turnOnOffAllAssets = (isOn) => {
        for (const i in sceneAssets) {
            const asset = sceneAssets[i];
            const { instance, index, position, quart, scale, noInstbject } = asset;

            const newScale = scale?.clone();
            isOn ? newScale?.multiplyScalar(1) : newScale?.multiplyScalar(0);

            if (noInstbject != undefined) {
                noInstbject.scale.set(newScale);
            }
            if (instance != undefined) {
                const matrix = new THREE.Matrix4();
                if (position && matrix)
                    matrix.compose(position, quart, newScale);
                instance.instanceMatrix.needsUpdate = true;
                instance.setMatrixAt(index, matrix);
            }
        }
    };

    useEffect(() => {
        if(selectAll){
            setCheckedItems(prevItems);
        }
        else{
            setCheckedItems([])
        }


        turnOnOffAllAssets(selectAll);

    }, [selectAll]);

    useEffect(() => {
        if(checkedItems.length>0)
           setPrevItems(checkedItems)
    }, [checkedItems]);

    useEffect(() => {
        if(Number(baseProjectId)>0){
            setRawCategories([]);
            // fetchAssetFields();
            fetchCategories()
        }

    }, [baseProjectId, checkReload, isGame]);


    useEffect(() => {
        const menuItem = document.querySelector('.edit-asset');
        if(menuItem && !category){
            menuItem.classList.remove('glowing-element')
        }
    }, [category]);

    const handleSelectAll = (event) => {
        setSelectAll(event.target.checked);
    };

    const customHeader = (
        <div className="flex align-items-center gap-8 justify-between">
            <span className="category-header" style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center' }}>Categories</span>

                <Tooltip title="Select All">
                <FormControlLabel
                    className='text-header'
                    control={<Switch checked={selectAll} onChange={handleSelectAll} />}
                    label=""

                />
                </Tooltip>

        </div>
    );

    return (
        <ThemeProvider theme={darkTheme}>
            <Sidebar className="categories" header={customHeader} modal={false} visible={category} position="left"
                     onHide={() => setCategory(false)}
                     dismissable={false} >
                {isPuzzleGame ? <PuzzleCategoryList currentMenu={currentMenu}/> : <CategoryList/>}
            </Sidebar>
        </ThemeProvider>
    );
}
