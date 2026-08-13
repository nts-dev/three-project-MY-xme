import saveSceneAsset from "./SaveSceneAsset";
import DB from "../../../threejs/hud/inventory/IndexedDbFactory";

export default async function   RefreshAsset(selectedAssetId,selectedAsset,dragObjectProp, scene, projectId, categoryIndex, formValues){
    const updateFormValues = async (newField,description)=>{

        for(const i in formValues){
            const parentNode = formValues[i]
            if( parentNode.name.includes('Description')){
                parentNode.value = description.join(' ')
            }
            else{
                const fieldId = parentNode.fieldId
                const newValue = newField[fieldId];
                if(newValue){
                    parentNode.value = newValue.value
                }
            }

            for (const j in parentNode.children){
                const childNode = parentNode.children[j]
                if( childNode.name.includes('Description')){
                    childNode.value = description.join(' ')
                }else {
                    const fieldId = childNode.fieldId
                    const newValue = newField[fieldId];
                    if(newValue){
                        childNode.value = newValue.value
                    }
                }
                parentNode.children[j] = childNode
            }
            formValues[i] = parentNode
        }
      return formValues

    }


    const getSingleAsset = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/asset/${selectedAssetId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const {rawFields,textures, images,description, categoryImages} = data

            if(rawFields){
                saveSceneAsset(selectedAssetId,rawFields,dragObjectProp,selectedAsset,scene)

                DB(projectId,
                    textures,
                    rawFields,
                    description,
                    images,
                    categoryImages,
                    categoryIndex,
                    null,
                    selectedAssetId,
                    null
                )
              return await updateFormValues(rawFields,description);
            }


        } catch (error) {
            console.error('Failed to fetch devices:', error);
        }
    }
 return await getSingleAsset()
}