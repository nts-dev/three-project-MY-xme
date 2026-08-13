import database from "../../../database";
import { Q } from "@nozbe/watermelondb";

import PQueue from "p-queue";
import {objects, sceneAssets} from "../../player/puzzle/character/Constants.jsx";

const dbWriteQueue = new PQueue({ concurrency: 1 }); // Serialize all DB calls

export default function DB(projectID, textures, fields, description, images, categoryImages, index, assetName, instanceId, assetIDs, assetNameN = null,setLazy=null) {
    // Add DB task to the queue
    return dbWriteQueue.add(() =>
        internalDB(projectID, textures, fields, description, images, categoryImages, index, assetName, instanceId, assetIDs, assetName,setLazy)
    );
}

async function internalDB(projectID, textures, fields, description, images, categoryImages, index, assetName, instanceId, assetIDs, assetNameN = null,setLazy=null) {
    let fbxName = 'composite';
    let name = null;

    if (instanceId) {
        name = sceneAssets[instanceId]?.name;
        fbxName = sceneAssets[instanceId]?.fileName;
    }

    let assetID = assetIDs;
    if (assetName) {
        assetID = objects[assetName]?.assetID;
        fbxName = objects[assetName]?.fileName;
        name = assetName;
    }

    if(fbxName===undefined) return
    const idFileName = fbxName.replace(/\.fbx$/i, '').toLowerCase();

    const bulkInsertCategories = async () => {
        const categoriesCollection = database.collections.get('categories');
        const operations = [];

        const existingCategories = await categoriesCollection.query(
            Q.where('category_id', `${projectID}_${idFileName}`)
        ).fetch();

        //console.log(`${projectID}_${idFileName}`, existingCategories);
        const fbxNewName = name;

        if (existingCategories.length > 0 && projectID > 0) {
            const existingCategory = existingCategories[0];

            const update = existingCategory.prepareUpdate(record => {
                if (fbxNewName) {
                    record.categoryId = `${projectID}_${idFileName}`;
                    record.name = name;
                    record.fbx = fbxName;
                }

                if (index) {
                    record.categoryIndex = index.toString();
                }

                record.projectId = parseInt(projectID);

                if (textures?.length > 0) {
                    record.textures = textures;
                }
            });

            operations.push(update);
        } else {
            const create = categoriesCollection.prepareCreate(record => {
                if (idFileName) {
                    record.categoryId = `${projectID}_${idFileName}`;
                    record.name = name;
                    record.fbx = fbxName;
                }

                if (index) record.categoryIndex = index.toString();

                record.projectId = parseInt(projectID);
                record.textures = textures;
            });

            operations.push(create);
        }

        await database.write(async () => {
            await database.batch(operations);
        });
    };

    const bulkInsertAssets = async () => {
        const assetsCollection = database.collections.get('assets');
        const operations = [];

        const existingAssets = await assetsCollection.query(
            Q.where('instance_id', parseInt(instanceId))
        ).fetch();



        if (existingAssets.length > 0 && projectID > 0) {
            const existingAsset = existingAssets[0];
            const update = existingAsset.prepareUpdate(record => {
                record.instanceId = instanceId;

                if (idFileName) {
                    record.category = `${projectID}-${idFileName}`;
                }

                if (assetID) {
                    record.assetId = assetID;
                }

                if (description) {
                    record.description = description;
                }

                if (images) {
                    record.images = images;
                }

                if (categoryImages) {
                    record.categoryImages = categoryImages;
                }
            });

            operations.push(update);
        } else {

            const create = assetsCollection.prepareCreate(record => {
                record.instanceId = parseInt(instanceId);
                record.category = `${projectID}-${idFileName}`;
                record.assetId = assetID;
                record.description = description;
                record.images = images;
                record.categoryImages = categoryImages;
            });

            operations.push(create);
        }

        await database.write(async () => {
            await database.batch(operations);
        });
    };

    const bulkInsertFields = async () => {
        const fieldsCollection = database.collections.get('fields');
        const operations = [];
        const idSet = new Set();

        try {
            for (const i in fields) {
                const field = fields[i];

                if (idSet.has(field.fieldId)) continue;
                idSet.add(field.fieldId);

                const existingFields = await fieldsCollection.query(
                    Q.where('value_id', `${instanceId}_${field.fieldId}`)
                ).fetch();

                if (existingFields.length > 0 && projectID > 0) {
                    const existingField = existingFields[0];

                    const update = existingField.prepareUpdate(record => {
                        record.fieldId = Number(field.fieldId);
                        record.name = field.name;
                        record.description = field.description;
                        record.value = field.value;
                        record.readOnly = field.readOnly;
                        record.visible = field.visible;
                        record.indexId = field.indexId;
                        record.showExtra = parseInt(field.showExtra);
                    });

                    operations.push(update);
                } else {
                    const create = fieldsCollection.prepareCreate(record => {
                        record.valueId = `${instanceId}_${field.fieldId}`;
                        record.instanceId = parseInt(instanceId);
                        record.fieldId = Number(field.fieldId);
                        record.name = field.name;
                        record.description = field.description;
                        record.value = field.value;
                        record.readOnly = field.readOnly;
                        record.visible = field.visible;
                        record.indexId = field.indexId;
                        record.showExtra = parseInt(field.showExtra);
                    });

                    operations.push(create);
                }
            }

            await database.write(async () => {
                await database.batch(operations);
            });
        } catch (error) {
            console.log('Error in bulkInsertFields:', error);
        }
    };

    try {

        await bulkInsertCategories();
        await bulkInsertAssets();
        await bulkInsertFields();
        if(setLazy != null){

            setLazy(false)
        }

    } catch (error) {
        console.log('DB write error:', error);
    }
}
