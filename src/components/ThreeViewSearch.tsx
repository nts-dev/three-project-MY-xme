import * as React from 'react';
import { useRef, useState, useCallback } from 'react';
import useGame from '../hooks/useGame';
import database from '../database';
import { Q } from '@nozbe/watermelondb';
import { Toast } from 'primereact/toast';
import SearchComponent from '../threejs/search/SearchComponent.jsx';
import {Autocomplete, Button, InputAdornment, TextField, Tooltip} from '@mui/material';

import Box from "@mui/material/Box";
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';


export default function Search() {
    const projectId = useGame((state: any) => state.projectID);
    const [filteredAsset, setFilteredAssets] = useState<any>([]);
    const setSearchItem = useGame((state: any) => state.setSearchItem);
    const setProjectID = useGame((state: any) => state.setProjectID);
    const setScannedId = useGame((state: any) => state.setScannedId);
    const setEditPopup = useGame((state: any) => state.setEditPopup);
    const setScan = useGame((state: any) => state.setScan);
    const scan = useGame((state: any) => state.scan);
    const toast = useRef(null);
    const searchList = useGame((state: any) => state.searchList);
    const searchTimeout: any = useRef(null);
    const setCategory = useGame((state: any) => state.setCategory);

    const searchProducts = async (searchText: string) => {
        try {
            const searchTextLower = searchText.toLowerCase();
            const searchTextAsNumber = parseInt(searchTextLower, 10);

            const categories: any = await database.collections.get('categories')
                .query(Q.where('project_id', projectId))
                .fetch();

            const categoryMatches = categories.map((category: { _raw: { fbx: string; }; }) => `${projectId}-${category._raw.fbx?.split('.')[0]}`);

            const [catAssets, assetsByInstanceId, rooms, fields] = await Promise.all([
                database.collections.get('assets')
                    .query(Q.where('category', Q.oneOf(categoryMatches)))
                    .fetch(),
                !isNaN(searchTextAsNumber) ?
                    database.collections.get('assets')
                        .query(Q.where('instance_id', searchTextAsNumber))
                        .fetch() :
                    Promise.resolve([]),
                database.collections.get('rooms').query().fetch(),
                database.collections.get('fields')
                    .query(Q.where('value', Q.like(`%${searchTextLower}%`)))
                    .fetch()
            ]);

            const allResults = [...rooms, ...categories, ...catAssets, ...assetsByInstanceId, ...fields, ...searchList];

            return allResults.filter((item) => {
                const raw = item._raw || item;
                return ['name', 'instance_id', 'value', 'description']
                    .some((key) => raw[key]?.toString().toLowerCase().includes(searchTextLower));
            });
        } catch (error) {
            console.error('Error searching products:', error);
            return [];
        }
    };

    const cleanUpResult = (text: string) => {
        try {
            const parsedText = JSON.parse(text);
            if (Array.isArray(parsedText)) {
                return parsedText.join(' ');
            }
        } catch (_) {}
        return text;
    };

    const search = useCallback((event: any) => {
        const query = event.target.value.trim();
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (query.length === 0) {
            setFilteredAssets([]);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            try {
                const results = await searchProducts(query);
                const formattedResults = results.flatMap((item) => {
                    if (item.assets?.length > 0) {
                        return item.assets.map((asset: { _raw: { category: string; instance_id: any; asset_id: any; }; }) => ({
                            name: cleanUpResult(asset._raw?.category?.split('-')[1] || 'Unknown'),
                            id: asset._raw?.instance_id || asset._raw?.asset_id,
                        }));
                    } else {
                        let name = item._raw?.value || item._raw?.name || item._raw?.description || 'Unknown';
                        name = cleanUpResult(name) || item._raw?.instance_id;
                        return [{
                            name,
                            id: item._raw?.instance_id || item._raw?.category_id || item._raw?.value_id || item._raw?.room_id || item.id,
                            type: item._raw?.room_id ? 'project' : 'asset',
                        }];
                    }
                });

                const uniqueResults = Array.from(new Map(formattedResults.map((item) => [item.id, item])).values());
                setFilteredAssets(uniqueResults);
            } catch (error) {
                console.error('Error during search:', error);
            }
        }, 300);
    }, []);

    const handleSelect = async (e: { id: any; type: any; }, zoom: any) => {
        const { id, type } = e;
        if (type === 'project') {
            setProjectID(parseInt(id));
            return;
        }
        const assetCollection = database.collections.get('assets');
        const asset: any = await assetCollection.query(Q.where('instance_id', id)).fetch();
        const pId = asset[0]?.category.split('-')[0];

        if (parseInt(pId) > 0) {
            setProjectID(parseInt(pId));
        }

        if (zoom) {
            setSearchItem({ id, noZoom: false });
            setEditPopup(false);
        } else {
            setScannedId(`${id}_click`);
            setSearchItem({ noZoom: true });
            setScan(!scan);
        }
    };



    return (
        <>
            <Toast ref={toast} />

            <Autocomplete
                className="search"
                options={filteredAsset}
                disableCloseOnSelect
                freeSolo
                getOptionLabel={(option: any) => option.name || ''}
                renderOption={(props, option: any) => (
                    <li {...props} key={option.id} style={{ width: '100%' }}>
                        <SearchComponent item={option} handleSelect={handleSelect} />
                    </li>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="What are you looking for..."
                        variant="outlined"
                        onChange={search}
                        className="autocomplete-field"
                        InputProps={{
                            ...params.InputProps,
                            // startAdornment: (
                            //     <InputAdornment
                            //         position="start"
                            //         sx={{ '&:hover': { cursor: 'pointer' } }}
                            //         onClick={() => console.log('SearchIcon clicked')}
                            //     >
                            //         <Tooltip title="Search" arrow>
                            //             <div>
                            //                 <SearchIcon />
                            //             </div>
                            //         </Tooltip>
                            //     </InputAdornment>
                            // ),
                            endAdornment: projectId > 0 ? ( // Simplified conditional rendering
                                //@ts-ignore
                                <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                    {params.InputProps.endAdornment ? (
                                        <Box
                                            sx={{
                                                '& > button': {
                                                    position: 'relative',
                                                    marginRight: '50px',
                                                },
                                            }}
                                        >
                                            {params.InputProps.endAdornment}
                                        </Box>
                                    ) : null}
                                    <InputAdornment
                                        position="end"
                                        sx={{ '&:hover': { cursor: 'pointer' } }}
                                        onClick={() => setCategory(true)}
                                    >
                                        <Tooltip title="Show Categories" arrow>
                                            <div>
                                                <FormatListBulletedIcon />
                                            </div>
                                        </Tooltip>
                                    </InputAdornment>
                                </Box>
                            ) : null,
                        }}
                    />
                )}
            />
        </>
    );
}
