import {useEffect, useRef} from 'react';
import database from './database';
import {Q} from '@nozbe/watermelondb';
import UpdateAsset from "./threejs/scene/UpdateAsset.jsx";
import {socket} from "./socket";
import useGame from "./hooks/useGame";
import {sceneAssets} from "./threejs/player/puzzle/character/Constants.jsx";
import { normalizeSceneAssetName } from "./threejs/generatedAssetPaths";

const LoadWatermelon = () => {

    const setFormStatus = useGame((state) => state.setFormStatus);
    const reload = useGame((state) => state.reload);

    const setCheckReload = useGame((state) => state.setCheckReload);
    const checkReload = useGame((state) => state.checkReload);
    const projectID = useGame((state) => state.projectID)
    const projectIdRef = useRef(projectID);

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

            if (triggerReload && targetProjectId > 0) {
                setCheckReload(checkReload + 1)
            }

        } catch (e) {
            console.error('Bulk insert failed', e)
        }
    };
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

    async function loadAssets(childId) {
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

        } catch (error) {
            console.error('Asset categories API failed:', error);

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
            loadAssets(projectID)

        }

    }, [projectID, reload])

    return null;

};

export default LoadWatermelon;



