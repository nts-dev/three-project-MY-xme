import React, {useEffect, useRef, useState} from "react";
import { Grid, Typography} from "@mui/material";
import {Accordion, AccordionTab} from 'primereact/accordion';
import {IconField} from "primereact/iconfield";
import {InputIcon} from "primereact/inputicon";
import {InputText} from "primereact/inputtext";
import PuzzleTiles from "./PuzzleTiles.jsx";

export default function PuzzleCategoryList({currentMenu}) {
    const op = useRef(null);
    const [selectedCategory, setSelectedCategory] = useState([]);
    const [categories, setCategories] = useState([]);
    const [filteredCategories, setFilteredCategories] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    const [activeIndex, setActiveIndex] = useState(null); // control Accordion state

    const getCategories = async () => {
        try {
            const response = await fetch(
                `${import.meta.env.VITE_API_URL}/getFilesWithCategory/1630`
            );
            const result = await response.json();

            if (result.success) {
                setCategories(result.data);
                setFilteredCategories(result.data); // initialize with full list
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    useEffect(() => {
        getCategories();
    }, []);

    const onCategoryDoubleClick = (e, item) => {
        e.stopPropagation();
        if (item) {
            setSelectedCategory(item);
        }
        op.current?.show(e.target.parentNode);
    };

    // 🔍 Search logic
    const handleSearchChange = (e) => {
        const term = e.target.value.toLowerCase();
        setSearchTerm(term);

        if (!term) {
            setFilteredCategories(categories);
            setActiveIndex(null); // close accordion when search cleared
            return;
        }

        // filter categories
        const filtered = {};
        for (const [category, assets] of Object.entries(categories)) {
            const matches = Object.values(assets).filter(
                (asset) =>
                    asset.AssetID?.toString().toLowerCase().includes(term) ||
                    asset.AssetInfo?.toLowerCase().includes(term)
            );

            if (matches.length > 0) {
                filtered[category] = {};
                matches.forEach((asset) => {
                    filtered[category][asset.device_id] = asset;
                });
            }
        }

        setFilteredCategories(filtered);

        // 👉 open accordion automatically when results found
        setActiveIndex(0);
    };

    return (
        <div>
            <PuzzleTiles
                op={op}
                selectedCategory={selectedCategory}
                currentMenu={currentMenu}
            />

            <div className="category-search">
                <IconField iconPosition="right" style={{width: '100%'}}>
                    <InputIcon className="pi pi-search"/>
                    <InputText
                        placeholder="Search category..."
                        className="category-search-text"
                        value={searchTerm}
                        onChange={handleSearchChange}
                    />
                </IconField>
            </div>

            <Accordion
                key="parent"
                style={{margin: "4px"}}
                activeIndex={activeIndex}       // ✅ control open state
                onTabChange={(e) => setActiveIndex(e.index)} // allow manual open/close
            >
                <AccordionTab
                    header={
                        <span className="flex align-items-center gap-2 w-full accordion-header">
                            Puzzle Game Assets
                        </span>
                    }
                >
                    {Object.keys(filteredCategories).map((categoryName, index) => (
                        <div key={index}>
                            <Grid container alignItems="center" style={{cursor: "pointer"}}>
                                <Grid item xs={8} style={{flexBasis: "83%"}}>
                                    <Typography
                                        style={{fontSize: "0.7rem", userSelect: "none", padding: "0.2rem"}}
                                        variant="body2"
                                        onDoubleClick={(e) =>
                                            onCategoryDoubleClick(e, categories[categoryName])
                                        }
                                    >
                                        {categoryName}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </div>
                    ))}
                </AccordionTab>
            </Accordion>
        </div>
    );
}
