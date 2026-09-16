import {useEffect, useMemo, useRef} from 'react';
import database from './database';
import {Q} from '@nozbe/watermelondb';
import UpdateAsset from "./threejs/scene/UpdateAsset.jsx";
import {socket} from "./socket";
import projectsData from "./projects.json";
import useGame from "./hooks/useGame";
import pako from 'pako';
import {sceneAssets} from "./threejs/player/puzzle/character/Constants.jsx";
import { normalizeSceneAssetName } from "./threejs/generatedAssetPaths";

const LoadWatermelon = () => {

    const branchList = [];
    const rooms = [];
    const setFormStatus = useGame((state) => state.setFormStatus);
    const reload = useGame((state) => state.reload);

    const setCheckReload = useGame((state) => state.setCheckReload);
    const checkReload = useGame((state) => state.checkReload);
    const projectID = useGame((state) => state.projectID)
    const setLazy = useGame((state) => state.setLazy)
    const setIframeLazy = useGame((state) => state.setIframeLazy)
    const searchParams = new URLSearchParams(window.location.search);
    const prId = searchParams.get('projectId');
    const projectIdRef = useRef(projectID);

    const set = useMemo(()=>new Set(),[])



    async function fetchAssets(input) {
        try {
            const obj = await fetch(input)
            return obj.json();
        } catch (error) {
             console.error('Error fetching assets:', error);
            return null;
        }
    }

    async function updateDBAsset(assetId, newItem) {

        const fieldsCollection = database.collections.get('fields');
        const assetsCollection = database.collections.get('assets');

        // Query the record by value_id
        const assets = await assetsCollection.query(Q.where('instance_id', assetId)).fetch();

        if (assets.length === 0) {
            return;
        }

        await database.write(async () => {
            assets.forEach(asset => {
                asset.update(record => {
                    // @ts-ignore
                    record.description = newItem.description;
                    record.images = newItem.images;
                    record.categoryImages = newItem.categoryImages;
                });
            });
        });

        for (const j in newItem.fields) {

            const data = newItem.fields[j];

            // Query the record by value_id
            const fields = await fieldsCollection.query(Q.where('value_id', newItem.instanceId + "_" + data.fieldId)).fetch();

            if (fields.length === 0) {
                continue;
            }

            await database.write(async () => {
                fields.forEach(field => {
                    field.update(record => {
                        // @ts-ignore
                        record.value = data.value;
                    });
                });
            });
        }

        await makeFieldsMap(assetId);
    }

    const makeFieldsMap = async (assetId) => {


        const fieldsCollection = database.collections.get('fields');
        const fields = await fieldsCollection.query(Q.where('instance_id', assetId), Q.sortBy('field_id', Q.asc),).fetch();
        const fieldMap = fields.reduce((map, field) => {
         const valueId = field.valueId.split('_')[1]

            map[valueId] = {
                id: valueId,
                instanceId: field.instanceId,
                fieldId: field.fieldId,
                name: field.name,
                value: field.value
            };


            return map;
        }, {});

        // console.log(fieldMap);
        if (sceneAssets[assetId]) {
            // console.log(fieldMap);
            UpdateAsset(fieldMap, assetId, sceneAssets[assetId].instanceData);
        }


        setFormStatus(Math.random().toString(36).substring(2, 7))

    };

    const bulkInsertCategories = async (categories) => {

        const categoriesCollection = database.collections.get('categories');

        for (const category of categories) {
           //console.log(category)
            const existingCategories = await categoriesCollection.query(Q.where('category_id', category.categoryId)).fetch();
            if (existingCategories.length > 0 && projectID > 0) {
                const operations = [];
                const existingCategory = existingCategories[0];
                const update = existingCategory.prepareUpdate(record => {
                    record.categoryId = category.categoryId;
                    record.categoryIndex = category.categoryIndex;
                    record.projectId = category.projectId;
                    record.name = category.name;
                    record.fbx = category.fbx;
                    record.textures = category.textures;
                    record.instances = category.instances;
                    record.properties = category.properties;
                    record.defaultColor = category.defaultColor;

                });
                operations.push(update);
                await database.write(async () => {
                    await database.batch(operations);
                });

            } else {
                // Prepare insert operation
                const operations = [];
                const create = categoriesCollection.prepareCreate(record => {
                    record.categoryId = category.categoryId;
                    record.categoryIndex = category.categoryIndex;
                    record.projectId = category.projectId;
                    record.name = category.name;
                    record.fbx = category.fbx;
                    record.textures = category.textures;
                    record.instances = category.instances;
                    record.properties = category.properties;
                    record.defaultColor = category.defaultColor;

                });
                operations.push(create);
                await database.write(async () => {
                    await database.batch(operations);
                });
            }
        }


    };

    const bulkInsertAssets = async (assets) => {
        const assetsCollection = database.collections.get('assets');
        const operations = [];

        for (const asset of assets) {
            const existingAssets = await assetsCollection.query(Q.where('instance_id', parseInt(asset.instanceId))).fetch();

            if (existingAssets.length > 0 && projectID > 0) {
                const existingCategory = existingAssets[0];
                const update = existingCategory.prepareUpdate(record => {
                    record.instanceId = asset.instanceId;
                    record.category = asset.category;
                    record.assetId = asset.assetId;
                    record.categoryIndex = asset.categoryIndex;
                    record.description = asset.description;
                    record.images = asset.images;
                    record.categoryImages = asset.categoryImages;
                });
                operations.push(update);
                // Prepare insert operation

            } else {
                const create = assetsCollection.prepareCreate(record => {
                    record.instanceId = asset.instanceId;
                    record.category = asset.category;
                    record.assetId = asset.assetId;
                    record.categoryIndex = asset.categoryIndex;
                    record.description = asset.description;
                    record.images = asset.images;
                    record.categoryImages = asset.categoryImages;
                });
                operations.push(create);
            }
        }

        await database.write(async () => {
            await database.batch(operations);
        });
    };


    const bulkInsertBranches = async (branches) => {
        const branchesCollection = database.collections.get('branches');
        const operations = [];

        for (const branch of branches) {

            const existingBranches = await branchesCollection.query(Q.where('branch_id', parseInt(branch.branchId))).fetch();
            // console.log(existingBranches);

            if (existingBranches.length > 0) {
                // Prepare update operation

            } else {
                // Prepare insert operation
                const create = branchesCollection.prepareCreate(record => {
                    record.branchId = branch.branchId;
                    record.name = branch.name;
                });
                operations.push(create);
            }
        }
        await database.write(async () => {
            await database.batch(operations);
        });
    };

    const bulkInsertRooms = async (rooms) => {
        const roomsCollection = database.collections.get('rooms');
        const operations = [];

        const existingRooms = await roomsCollection.query().fetch();
        if (existingRooms.length == 0) {
            for (const room of rooms) {
                const create = roomsCollection.prepareCreate(record => {
                    record.roomId = room.roomId;
                    record.parent = room.parent;
                    record.name = room.name;
                    record.floors = room.floors? JSON.stringify(room.floors): '';
                    record.landingPoint = room.landingPoint ? JSON.stringify(room.landingPoint): '';
                });
                operations.push(create);
            }
        }

        await database.write(async () => {
            await database.batch(operations);
        });
    };

    const bulkInsertCategoryTemplates = async (categoryValue, projectid) => {
        const CategoryTemplatesCollection = database.collections.get('category_templates');
        const operations = [];

        const existingCategoryTemplates = await CategoryTemplatesCollection.query(Q.where('project_id', parseInt(projectid))).fetch();

        if (existingCategoryTemplates.length > 0 && projectID > 0) {
            const existingCategory = existingCategoryTemplates[0];
            const update = existingCategory.prepareUpdate(record => {
                record.projectId = parseInt(projectid);
                record.categoryValue = categoryValue;
            });
            operations.push(update);
            // Prepare insert operation

        } else {
            const create = CategoryTemplatesCollection.prepareCreate(record => {
                record.projectId = parseInt(projectid);
                record.categoryValue = categoryValue;
            });
            operations.push(create);
        }

        await database.write(async () => {
            await database.batch(operations);
        });
    };
    const bulkInsertTemplateFiles = async (templateId, templateList) => {

        const TemplatesFilesCollection = database.collections.get('template_files');
        const operations = [];

        for (const i in templateList) {
            const templateValue = templateList[i];

            const existingTemplatesFiles = await TemplatesFilesCollection.query(Q.where('template_id', parseInt(templateId))).fetch();
            if (existingTemplatesFiles.length > 0 && projectID > 0) {
                const existingCategory = existingTemplatesFiles[0];
                const update = existingCategory.prepareUpdate(record => {
                    record.assetId = parseInt(templateValue.assetId);
                    record.assetName = templateValue.assetName;
                    record.fbx = templateValue.fbx;
                    record.textures = JSON.stringify(templateValue.textures);
                });
                operations.push(update);
                // Prepare insert operation

            } else {
                const create = TemplatesFilesCollection.prepareCreate(record => {
                    record.assetId = parseInt(templateValue.assetId);
                    record.templateId = parseInt(templateId);
                    record.assetName = templateValue.assetName;
                    record.fbx = templateValue.fbx;
                    record.textures = JSON.stringify(templateValue.textures);
                });
                operations.push(create);
            }

        }
        await database.write(async () => {
            await database.batch(operations);
        });


    }

    const bulkInsertOptions = async (fields) => {
        const optionsCollection = database.collections.get('options');

        const operations = [];

        for (const field of fields) {
            const existingOptions = await optionsCollection.query(Q.where('value_id', field.valueId)).fetch();

            if (existingOptions.length > 0 && projectID > 0) {
                const existingOption = existingOptions[0];
                const update = existingOption.prepareUpdate(record => {
                    record.valueId = field.valueId;
                    record.sortId = field.sortId;
                    record.fieldId = field.fieldId;
                    record.name = field.name;
                    record.parentId = field.parentId;
                });
                operations.push(update);

            } else {
                // Prepare insert operation
                const create = optionsCollection.prepareCreate(record => {
                    record.valueId = field.valueId;
                    record.sortId = field.sortId;
                    record.fieldId = field.fieldId;
                    record.name = field.name;
                    record.parentId = field.parentId;
                });
                operations.push(create);
            }
        }

        await database.write(async () => {
            await database.batch(operations);
        });
    };

    const bulkInsertFields = async (fields) => {
        const fieldsCollection = database.collections.get('fields');

        const operations = [];

        for (const field of fields) {

            const existingFields = await fieldsCollection.query(Q.where('value_id', field.valueId)).fetch();

            if (existingFields.length > 0 && projectID > 0) {
                const existingCategory = existingFields[0];

                const update = existingCategory.prepareUpdate(record => {
                    record.valueId = field.valueId;
                    record.instanceId = field.instanceId;
                    record.fieldId = Number(field.fieldId);
                    record.name = field.name;
                    record.description =  field.description;
                    record.value = field.value;
                    record.readOnly = field?.readOnly || 0;
                    record.visible = field.visible;
                    record.indexId = field.indexId;
                    record.showExtra = parseInt(field?.showExtra || 0);
                });
                operations.push(update);

            } else {
                // Prepare insert operation


                const create = fieldsCollection.prepareCreate(record => {
                    record.valueId = field.valueId;
                    record.instanceId = field.instanceId;
                    record.fieldId = Number(field.fieldId);
                    record.name = field.name;
                    record.description =  field.description;
                    record.value = field.value;
                    record.readOnly = field?.readOnly || 0;
                    record.visible = field.visible;
                    record.indexId = field.indexId;
                    record.showExtra = parseInt(field?.showExtra || 0);
                });
                operations.push(create);
            }
        }

        await database.write(async () => {
            await database.batch(operations);
        });
    };


    const bulkInsertTemplates = async (templates,projectid) => {
        const templatesCollection = database.collections.get('templates');
        const operations = [];

        // First, find existing templates for the given projectID and delete them if any are found
        const existingTemplates = await templatesCollection.query().fetch();
        if (existingTemplates.length > 0) {
            const deleteOperations = existingTemplates.map(record => record.prepareDestroyPermanently());
            operations.push(...deleteOperations);
        }
        // Then, prepare insert operations for the new templates
        for (const template of templates) {
            const create = templatesCollection.prepareCreate(record => {

                record.fieldId = template.fieldId;
                record.name = template.name;
                record.parentId = template.parentId;
                record.type = template.type;
                record.description = template.description;
                record.categoryId = template.categoryId.toString();
                record.viewer = template.viewer;
                record.indexId = template.indexId?.toString();
                record.projectId = projectid.toString();
            });
            operations.push(create);
        }

        // Execute all operations in a single batch
        await database.write(async () => {
            await database.batch(operations);
        });
    };

    const loadOptions = async (options) => {
        const optionData = []

        for (const option of options) {
            optionData.push(
                {
                    fieldId: option.field_id,
                    name: option.name,
                    parentId: option.parent_id,
                    sortId: option.sort_id,
                    valueId: option.id,

                }
            )
        }
        await bulkInsertOptions(optionData)
    }

    const loadDB = async (files, targetProjectId = projectID, { triggerReload = true } = {}) => {
        const categories = [];
        const assets = [];
        const fields = [];

        if (files !== undefined) {
             
            for (const category of files) {

                let fbx = '';
                let fbxName ='composite'
                let fileName = ''
                if (typeof category.fbx === 'object' && !Array.isArray(category.fbx) && category.fbx !== null) {
                    // If it's an object (but not an array), convert it to a string
                    fbx = JSON.stringify(category.fbx);
                } else if (typeof category.fbx === 'string') {
                    // If it's already a string, just use it
                    fbx = category.fbx;

                    fileName = normalizeSceneAssetName(fbx).toLowerCase()
                    fbxName = category.assetName || fileName

                }
                const instances = category?.assets ? Object.keys(category.assets).map(Number): [];

                categories.push({
                    categoryId: `${category.projectId}_${fileName}`,
                    categoryIndex: category.id.toString(),
                    projectId: parseInt(category.projectId),
                    name: fbxName,
                    fbx: fbx,
                    textures: category.textures,
                    instances: JSON.stringify(instances),
                    properties:category.properties? JSON.stringify(category.properties) : '',
                    defaultColor: category.defaultColor,

                });

                for (const i in category.assets) {
                    const asset = category.assets[i];


                    // if(asset.instanceId===628756){
                    //     console.log(asset)
                    // }

                    assets.push({
                        instanceId: parseInt(asset.instanceId),
                        category: `${category.projectId}-${fileName}-${asset.category}`,
                        assetId: parseInt(asset.assetId),
                        categoryIndex: parseInt(asset.category),
                        description: asset.description,
                        images: asset.images,
                        categoryImages: asset.categoryImages
                    });


                    for (const j in asset.fields) {

                        const field = asset.fields[j];
                        // if(parseInt(asset.instanceId)===556734){
                        //     console.log(field.name, field.value)
                        // }
                        fields.push({
                            valueId: asset.instanceId + "_" + field.fieldId,
                            instanceId: parseInt(asset.instanceId),
                            fieldId: parseInt(field.fieldId),
                            name: field.name,
                            description: field.description,
                            value: field.value,
                            type: field.type,
                            indexId: field.indexId,
                            visible: field.visible,
                            readOnly: field.readOnly,
                            showExtra: field.showExtra
                        });

                    }
                }
            }
        }

        try {

            await bulkInsertCategories(categories);
            await bulkInsertAssets(assets);
            await bulkInsertFields(fields);


            // await bulkInsertTemplates(templateData,Pid);
            if (triggerReload && targetProjectId > 0) {
                setCheckReload(checkReload + 1)
            }

        } catch (e) {
            console.error('Bulk insert failed', e)
        }
    };
    const  sortByKey = (arr, key)=> {
        if(!key) return arr

        return arr.sort((a, b) => {
            const hasKeyA = a.children && a.children[key] ? -1 : 1;
            const hasKeyB = b.children && b.children[key] ? -1 : 1;
            return hasKeyA - hasKeyB;
        }).map(obj => {
            if (obj.children) {
                obj.children = Object.fromEntries(
                    Object.entries(obj.children).sort(([k1], [k2]) => (k1 == key ? -1 : k2 == key ? 1 : 0))
                );
            }
            return obj;
        });
    }
    async function generateJsonFromArray() {
       const newList = sortByKey(projectsData,prId)
        setLazy(true)
        for (const i in newList) {
            const obj = projectsData[i]
            branchList.push({branchId: parseInt(obj.branch_id), name: obj.branch_name});

            for (const childKey of Object.keys(obj.children)) {
                const child = obj.children[childKey];
                rooms.push({
                    roomId: parseInt(child.id),
                    parent: parseInt(child.branch_id),
                    name: child.name,
                    floors: child.floors,
                    landingPoint: child.landing_point
                });
            }

        }
        const options = await fetchAssets(`${import.meta.env.VITE_JSON_URL}/options.json`);
        loadOptions(options)
        await bulkInsertBranches(branchList);
        await bulkInsertRooms(rooms);
        await getTemplateData();

        for (const id of [1634, 1628]) {
            const tResult = await fetchAssets(`${import.meta.env.VITE_JSON_URL}/${id}.json`);
            await bulkInsertTemplateFiles(id,tResult)
        }
        for (const i in newList) {
            const obj = projectsData[i]
            await generateJsonFromChildren(obj.children, obj.id)

        }
        setLazy(false)
    }

    async function deleteAssets(projectId) {
        const categoriesCollection = database.collections.get('categories');
        const assetsCollection = database.collections.get('assets');
        const fieldsCollection = database.collections.get('fields');

        await database.write(async () => {
            // ── Phase 1: Mark everything as deleted (fast + sync-safe) ────────────────

            const categories = await categoriesCollection
                .query(Q.where('project_id', Number(projectId)))
                .fetch();

            const markBatch = [];

            // We'll collect all instance_ids for assets & fields in one go
            const allInstanceIds = new Set();

            for (const category of categories) {
                markBatch.push(category.prepareMarkAsDeleted());

                const instancesRaw = category._raw?.instances ?? '[]';
                let instanceIds;
                try {
                    instanceIds = JSON.parse(instancesRaw);
                } catch {
                    instanceIds = [];
                }

                instanceIds.forEach(id => allInstanceIds.add(Number(id)));
            }

            // Load assets (only once)
            const assets = allInstanceIds.size > 0
                ? await assetsCollection
                    .query(Q.where('instance_id', Q.oneOf([...allInstanceIds])))
                    .fetch()
                : [];

            // Mark assets + collect field queries
            for (const asset of assets) {


                markBatch.push(asset.prepareMarkAsDeleted());
            }

            if (markBatch.length > 0) {
                await database.batch(markBatch);
            }

            // ── Phase 2: Really destroy (only what's marked deleted) ─────────────────────

            // Fields – most numerous, destroy first
            if (allInstanceIds.size > 0) {
                await fieldsCollection
                    .query(
                        Q.where('instance_id', Q.oneOf([...allInstanceIds])),
                        Q.where('_status', Q.eq('deleted'))
                    )
                    .destroyAllPermanently();
            }

            // Assets
            if (allInstanceIds.size > 0) {
                await assetsCollection
                    .query(
                        Q.where('instance_id', Q.oneOf([...allInstanceIds])),
                        Q.where('_status', Q.eq('deleted'))
                    )
                    .destroyAllPermanently();
            }

            // Categories (usually few)
            await categoriesCollection
                .query(
                    Q.where('project_id', Number(projectId)),
                    Q.where('_status', Q.eq('deleted'))
                )
                .destroyAllPermanently();
        });
    }

    async function offLineFetchAssets(input) {
        try {

            const response = await fetch(input);

            if (!response.ok) {
                throw new Error(`Offline fetch failed: ${response.status}`);
            }

            // Check Content-Encoding header
            const contentEncoding = response.headers.get('Content-Encoding');

            let data;

            if (contentEncoding === 'gzip') {

                data = await response.json();
            } else {
                // No auto-decompression - check if file is compressed
                const arrayBuffer = await response.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);


                if (uint8Array[0] === 31 && uint8Array[1] === 139) {

                    const jsonString = pako.ungzip(uint8Array, { to: 'string' });
                    data = JSON.parse(jsonString);
                } else {
                    // File is uncompressed

                    const jsonString = new TextDecoder().decode(uint8Array);
                    data = JSON.parse(jsonString);
                }
            }



            return data;

        } catch (error) {
            console.error('Error fetching offline assets:', error);
            return null;
        }
    }


    async function loadAssets(childId, loadOnline) {
        if (!loadOnline) {
            const files = await offLineFetchAssets(`${import.meta.env.VITE_LOCAL_FILE_URL}/json_mongo_${childId}.json`)// fetchAssets(`${import.meta.env.VITE_JSON_URL}/json_mongo_${childId}.json`);
            if(files && files.data){
                await loadDB(files.data,childId);

                if(prId==childId ){
                    setLazy(false)
                    setIframeLazy(false)
                }
            }

            if (files && files.categories) {
                await bulkInsertCategoryTemplates(JSON.stringify(files.categories), childId)
            }
            return;
        }

        try {

            await deleteAssets(childId)
            const result = await fetch(`${import.meta.env.VITE_API_URL}/assetCategories`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ roomId: childId }),
            });

            if (!result.ok) {
                throw new Error(`Categories API failed: ${result.status}`);
            }

            const data = await result.json();

               await loadDB(data.data, childId);

                if (data.categories) {
                  await bulkInsertCategoryTemplates(JSON.stringify(data.categories), childId)
              }


                for (const id of [1634, 1628]) {
                    const tResult = await fetch(`${import.meta.env.VITE_API_URL}/getCategoryFiles/${id}/1630`)
                    await bulkInsertTemplateFiles(id,tResult.data)
                }

        } catch (error) {
            console.error('Both API calls failed:', error);

        }
    }

    const syncSceneUpdateToDb = async ({ data, dslProjectId }) => {
        const normalizedProjectId = parseInt(String(dslProjectId || "").split('_')[0], 10);
        const categories = Array.isArray(data?.categories) ? data.categories : [];

        if (!Number.isFinite(normalizedProjectId) || normalizedProjectId <= 0) {
            return;
        }

        try {
            await deleteAssets(normalizedProjectId);

            await loadDB(categories, normalizedProjectId, { triggerReload: false });
        } catch (error) {
            console.error('Failed to sync WatermelonDB from updateScene:', error);
        }
    }

    const generateJsonFromChildren = async (children) => {
        if (!children || Object.keys(children).length === 0) {
            return [];
        }
        for (const childKey of Object.keys(children)) {

            const child = children[childKey];
            if ([125, 115,120, 48, 132, 135, 32, 139,137,142,144,145,147,148,150].includes(parseInt(child.id))) {

                if(!set.has(child.id)){
                    set.add(child.id)
                    await loadAssets(child.id, false);
                }

            }
        }

    }

    // function getJumPoints(){
    //     const URL = process.env.NODE_ENV === 'production' ? 'https://bo.nts.nl/three-api' : 'http://localhost:4000/api';
    //     fetch(`${URL}/jumpPoints/125/`)
    //         .then(response => response.json()).then((subCatData) => {
    //         console.log(subCatData)
    //
    //     });
    // }


    const getTemplateData = async () => {
        await fetchAssets(`${import.meta.env.VITE_API_URL}/getTemplates`).then(
            async (data) => {
                if(!data || !Array.isArray(data) || data.length === 0){
                    return;
                }
                await insertTemplates(data)

            })
    }

    const insertTemplates = async (templates)=>{

    
        const templateData = []
        if (templates !== undefined) {

            for (const template of templates) {

                templateData.push(
                    {
                        fieldId: template.field,
                        name: template.name,
                        parentId: template.parent_id,
                        type: template.type,
                        description: template.description,
                        categoryId: template.categoryId,
                        viewer: template.viewer,
                        indexId: template.index_id

                    }
                )
            }
        }
        await bulkInsertTemplates(templateData,0)
    }
    useEffect(() => {
        projectIdRef.current = projectID;
    }, [projectID]);

    useEffect(() => {
        const onAssetUpdatedEvent = (value) => {
            const {assetId, asset} = JSON.parse(value);
            updateDBAsset(assetId, asset);
        };

        socket.on('assetUpdated', onAssetUpdatedEvent);

        return () => {
            socket.off('assetUpdated', onAssetUpdatedEvent);
        }
    }, [])

    useEffect(() => {
        const onSceneUpdated = async (payload) => {
            const normalizedProjectId = parseInt(String(payload?.dslProjectId || "").split('_')[0], 10);
            if (!Number.isFinite(normalizedProjectId)) {
                return;
            }

            if (projectIdRef.current && normalizedProjectId !== Number(projectIdRef.current)) {
                return;
            }

            await syncSceneUpdateToDb(payload);
        };

        socket.on('updateScene', onSceneUpdated);

        return () => {
            socket.off('updateScene', onSceneUpdated);
        }
    }, [])

    useEffect(() => {

        if (projectID) {
            // setLazy(true)

            loadAssets(projectID, true)

            getTemplateData()

        }

    }, [reload])


    useEffect(() => {
        const roomsCollection = database.collections.get('rooms');

        const fetchRooms = async () => {
            const existingRooms = await roomsCollection.query().fetch();

            if (existingRooms.length === 0) {
                    await generateJsonFromArray();
                // setLazy(false)
                // setIframeLazy(false)
            }

        }
        fetchRooms();


    }, [])

    return null;

};

export default LoadWatermelon;



