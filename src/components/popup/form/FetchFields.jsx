import database from "../../../database";
import {Q} from "@nozbe/watermelondb";
import {Vector3} from "three";
import {objects, sceneAssets} from "../../../threejs/player/puzzle/character/Constants.jsx";

const fetchAssetFields = async (instanceId, name, setEditPopup,setEditable,setSelectedAssetId,setSelectedAsset, isHover) => {

    const extractAngle = (angle)=> {
        try {
            const obj = JSON.parse(angle);
            if (typeof obj === 'object' && obj !== null) {
                return obj; // Return parsed object if valid
            }
        } catch (error) {
            console.log(error)
            // If parsing fails, return the original string
        }
        return {x: 0,y: angle || 0, z: 0 }; // Return original string if it's not a valid object
    }

    const fetchImages = async () => {
        try {

            if(!sceneAssets[instanceId]) {
                return {images: [], category_images: []}
            }

            // const response = await fetch(`${process.env.REACT_APP_API_URL}/documents`);
            const {assetID} = sceneAssets[instanceId];
            const response = await fetch(`${import.meta.env.VITE_API_URL}/getImages`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        assetID,
                        id: instanceId
                    })
                }
            );
            const data = await response.json();

            return  data;

            // const {category_images, images}: any = allImages
        }catch (error) {
            console.error('Failed to fetch documents:', error);
        }
    };

    if (!instanceId) return;
    const fieldsCollection = database.collections.get('fields');
    const fields = await fieldsCollection.query(Q.where('instance_id', instanceId), Q.sortBy('field_id', Q.asc)).fetch();
    let x, y, z, xId, yId, zId, angleId, angleValue;
    const descriptionText = []
    fields.map((field) => {

        if(field._raw.description=="1")
            descriptionText.push(field._raw.value)

        switch (field._raw.name) {
            case 'X-pos':
                x = field._raw.value
                xId = field._raw.valueId
                break;
            case 'Y-pos':
                y = field._raw.value
                yId = field._raw.valueId
                break;
            case 'Z-pos':
                z = field._raw.value
                zId = field._raw.valueId
                break;
            case 'Angle':
                angleValue = extractAngle(field._raw.value || 0)
                angleId = field._raw.valueId
                break;

        }

    })


    // const assetsCollection = database.collections.get('assets');
    // const existingAssets = await assetsCollection.query(Q.where('instance_id', parseInt(String(instanceId)))).fetch();
    // const assetRawObj: any = existingAssets[0];
    // if(assetRawObj==undefined){
    //     return
    // }
    // const image =  await fetchImages()
    // console.log(image)
    const {images, category_images} = await fetchImages()

    const position = new Vector3(x, y, z)
    const description = descriptionText // JSON.parse(assetRawObj._raw.description);
    
    console.log(objects[name])
    const categoryIndex = objects[name].categoryIndex
    const assetObj = {
        assetId: instanceId,
        category_images,
        images,
        content: fields['stacking']?.value,
        angle: angleValue?.y,
        position,
        description,
        categoryIndex

    }
    const instanceData = {
        id: instanceId + '_',
        assetId: instanceId,
        assetObject: assetObj,
        fileName: name,
        xId,
        yId,
        zId,
        angleId
    };

    if (instanceId && !isHover) {
        setEditPopup(true)
        setEditable(false);
        setSelectedAssetId(parseInt(String(instanceId)))
        setSelectedAsset(instanceData)
    }
    return assetObj
}
export default fetchAssetFields

