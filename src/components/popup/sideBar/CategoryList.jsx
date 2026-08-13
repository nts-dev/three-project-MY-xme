import React, {useEffect, useMemo, useRef, useState} from "react";
import {
    Checkbox,
    Divider,
    Grid,
    Typography,
} from "@mui/material";

import {Accordion, AccordionTab} from 'primereact/accordion';

import useGame from "../../../hooks/useGame";
import * as THREE from "three";
import TileOverlay from "./TileOverlay";
import debounce from "lodash.debounce";
import { IconField } from "primereact/iconfield";
import {InputIcon} from "primereact/inputicon";
import {InputText} from "primereact/inputtext";
import {sceneAssets} from "../../../threejs/player/puzzle/character/Constants.jsx";

export default function CategoryList() {

    const checkedItems = useGame((state) => state.checkedItems);
    const setCheckedItems = useGame((state) => state.setCheckedItems);
    const setCatId = useGame((state) => state.setCatId);
    const setGridAssets = useGame((state) => state.setGridAssets);
    const rawCategories = useGame((state) => state.rawCategories);
    const op = useRef(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState([]);

    // Memoize filtered categories
    const categories = useMemo(() => {
        if (!searchTerm) return rawCategories;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return rawCategories
            .map((category) => {
                const filteredChildren = category.children?.filter((child) =>
                    child.name.toLowerCase().includes(lowerSearchTerm)
                );
                if (category.name.toLowerCase().includes(lowerSearchTerm) || filteredChildren?.length) {
                    return {...category, children: filteredChildren || category.children};
                }
                return null;
            })
            .filter(Boolean); // Remove null categories
    }, [rawCategories, searchTerm]);


    const handleSearchChange = useMemo(
        () =>
            debounce((event) => {
                const term = event.target.value.toLowerCase();
                setSearchTerm(term);
                // setExpandedCategories(term ? categories.map(cat => cat.name) : []); // Expand categories on search
            }, 300),
        [categories]
    );

    useEffect(() => () => handleSearchChange.cancel(), [handleSearchChange]);

    const turnOnOffSceneAssets = (itemId, isChecked) => {
        for (const i in sceneAssets) {
            const asset = sceneAssets[i]
            const {instance, scale, noInstbject, instanceData} = asset;
            const {assetObject} = instanceData || {};
            const {categoryIndex} = assetObject || {};
            if (itemId === Number(categoryIndex)) {
                const newScale = scale?.clone();
                if (isChecked) newScale?.multiplyScalar(1);
                else newScale?.multiplyScalar(0);

                if (noInstbject) noInstbject.scale.set(newScale);

                if (instance && asset?.quart) {
                    const matrix = new THREE.Matrix4();
                    matrix.compose(asset?.position, asset?.quart, newScale);
                    instance.setMatrixAt(asset?.index, matrix);
                    instance.instanceMatrix.needsUpdate = true;
                }
            }
        }
    }

    const handleCheckboxChange =
        (itemId, event) => {
            const isChecked = event.target.checked;
            const newArr = isChecked
                ? checkedItems.includes(itemId)
                    ? checkedItems // Don't add if it already exists
                    : [...checkedItems, itemId] // Add if it doesn't exist
                : checkedItems.filter((i) => i !== itemId); // Remove the item if unchecked

            setCheckedItems(newArr);
            turnOnOffSceneAssets(itemId, isChecked)

        }
    // useEffect(() => {
    //     console.log(checkedItems)
    // }, []);

    const showAssetGrid = (itemId) => {

        if (!checkedItems.includes(itemId)) return;

        setCatId(itemId);
        const assetsList = Object.values(sceneAssets)
            .filter((asset) => asset.instanceData?.assetObject?.categoryIndex == itemId)
            .map((asset) => ({
                id: asset.id,
                assetId: asset.id,
                description: asset.instanceData.description?.join(" ") || asset.instanceData.fileName.split(".")[0],
                room: `Floor ${asset.floor}`,
            }));

        setGridAssets(assetsList);
    }

    const onCategoryDoubleClick = (e, item) => {
        e.stopPropagation();

        if (item) {

            setSelectedCategory(item);
        }

        op.current?.show(e.target.parentNode);

    }

    return (
        <div>
            <TileOverlay
                op={op}
                selectedCategory={selectedCategory}
            />
            <div className="category-search">
                <IconField
                    iconPosition="right"
                    style={{width:'100%'}}
                >
                    <InputIcon className="pi pi-search"> </InputIcon>
                    <InputText
                        placeholder="Search category..."
                        className="category-search-text"
                        onChange={handleSearchChange}
                    />

                </IconField>

            </div>

            {categories.map((category) => (
                <Accordion
                    key={category.name}
                    style={{margin: "4px"}}
                >
                    <AccordionTab header={
                        <span className="flex align-items-center gap-2 w-full accordion-header"
                              onDoubleClick={e => onCategoryDoubleClick(e, category)}>
                          {category.name}
                         </span>
                    }
                    >
                        {category.children.map((child, index) => (
                            <div key={child.id}>
                                <Grid
                                    container
                                    alignItems="center"
                                    onClick={() => showAssetGrid(child.id)}
                                    style={{cursor: "pointer"}}
                                >
                                    <Grid item xs={10}
                                          style={{flexBasis: "83%"}}>
                                        <Typography
                                            style={{fontSize: "0.7rem", userSelect: "none"}}
                                            variant="body2"
                                            onDoubleClick={e => onCategoryDoubleClick(e, child)}
                                        >
                                            {child.name}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={2} style={{display: "flex", alignItems: "center"}}>
                                        <Checkbox
                                            checked={checkedItems.includes(child.id)}
                                            onChange={e => handleCheckboxChange(child.id, e)}
                                            onClick={e => e.stopPropagation()}
                                            style={{padding: "0.2rem"}}
                                        />
                                    </Grid>
                                </Grid>
                                {index < category.children.length - 1 && <Divider/>}
                            </div>
                        ))}

                    </AccordionTab>

                </Accordion>
            ))}
        </div>
    );
}
