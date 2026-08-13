import * as THREE from "three";
import { Vector3 } from "three";
import { apiData } from "../../../threejs/player/puzzle/character/Constants.jsx";

const makeGameFieldMap = async (id, position, halfWidth, halfLength, rotation, vAlignValue, assetID, color,projectId,assetName,categoryStructure) => {



    const mergeFieldsIntoAsset = ( assetRowIdOrAssetId, fieldsObj) => {
        const categories = Array.isArray(apiData.current.categories) ? apiData.current.categories : [];

        const nextCategories = categories.map((cat) => {
            const assets = Array.isArray(cat.assets) ? cat.assets : [];
            const nextAssets = assets.map((a) => {
                const hit =
                    String(a.id) === String(assetRowIdOrAssetId) ||
                    String(a.asset_id) === String(assetRowIdOrAssetId);

                if (!hit) return a;

                return {
                    ...a,
                    fields: {
                        ...(a.fields || {}),
                        ...(fieldsObj || {}),
                    },
                };
            });

            return { ...cat, assets: nextAssets };
        });

        apiData.current = { ...apiData.current, categories: nextCategories };
    };


    const cPosition = position.clone().multiplyScalar(100);

    const normalRotation = new Vector3(
        0,
        THREE.MathUtils.radToDeg(rotation.z),
        THREE.MathUtils.radToDeg(rotation.y)
    )
    const formData = new FormData();
    const vAlign = vAlignValue === 0.1 ? 'top' : vAlignValue === 0.05 ? 'center' : 'bottom'
    formData.append("instance_id", id);
    formData.append(`X-pos`, cPosition.x.toFixed(1));
    formData.append(`Y-pos`, cPosition.z.toFixed(1));
    formData.append(`Z-pos`, cPosition.y.toFixed(1));
    formData.append(`Angle`, JSON.stringify(normalRotation));
    formData.append(`assetID`, assetID);
    formData.append(`V-align`, vAlign);
    formData.append(`Color`, color);

    const res = await fetch(`${import.meta.env.VITE_API_URL}/insert-fields`, {
        method: "POST",
        body: formData,
    });

    const apiResult = await res.json();
    // Build a local "fields" map matching your JSON screenshot
    const localFields = {
        "X-pos": { instance_id: id, name: "X-pos", value: cPosition.x.toFixed(1) },
        "Y-pos": { instance_id: id, name: "Y-pos", value: cPosition.z.toFixed(1) },
        "Z-pos": { instance_id: id, name: "Z-pos", value: cPosition.y.toFixed(1) },
        "Angle": { instance_id: id, name: "Angle", value: JSON.stringify(normalRotation) },
        "assetID": { instance_id: id, name: "assetID", value: String(assetID) },
        "V-align": { instance_id: id, name: "V-align", value: vAlign },
        "Color": { instance_id: id, name: "Color", value: color || '#fff' },
    };
    mergeFieldsIntoAsset(id, localFields);

    const newApiData = apiData.current
    const level = projectId.split('_')[1]
    
     
     const response =  await fetch(`${import.meta.env.VITE_API_URL}/save-project-scene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, data: newApiData, assetName, localFields,level,categoryStructure}),
        });

       
        const results = await response.json()

       

        return apiResult;

};

export default makeGameFieldMap;
