

import fetchAssetFields from "./FetchFields.jsx";

export default async function AssetDescription( mouse: any, size: any, projectId: number,setEditAssetId: any,instanceId: number,assetEdit: boolean,name: string,
                                                setEditPopup: any,setEditable: any,setSelectedAssetId: any,setSelectedAsset: any,setPopupInfo: any,mousePos: any,
                                                gl: any,categoryIndex: number,statusFieldId: number,inUse: boolean) {

    const getAssetObject = async () => {
      const assetObj = await fetchAssetFields(instanceId, name,setEditPopup,setEditable,setSelectedAssetId,setSelectedAsset, true);

      if(!assetObj){
          return
      }

        setPopupInfo({x: mouse.x, y: mouse.y, visible: true, size,mouse: mousePos,instanceId,assetObj,projectId, renderer: gl,categoryIndex,statusFieldId,inUse})

        return;
        const assetDesc = document.createElement('div');
        assetDesc.classList.add('assetDiscr');
        assetDesc.id = 'assetDescription'

        assetDesc.appendChild(createPortrait(assetObj));
        assetDesc.appendChild(await createTextDiv(assetObj));

        if(assetEdit) {
            const editButton = document.createElement('button');
            const iconElement = document.createElement('i'); // Create an <i> element for the icon
            iconElement.classList.add('pi', 'pi-pen-to-square');

            iconElement.classList.add('close-icon');
            iconElement.classList.add('visible-element');
            editButton.appendChild(iconElement);

            editButton.classList.add('close-button');
            editButton.addEventListener('click', () => {

                setEditAssetId(instanceId)

            })
            assetDesc.appendChild(editButton);
        }
        let left = mouse.x //* size.width + window.pageXOffset;
        let top = mouse.y// * size.height + window.pageYOffset;

        // Constrain left and top to ensure the div stays within the viewport
        left = Math.max(0, Math.min(left, size.width - assetDesc.offsetWidth));
        top = Math.max(0, Math.min(top, size.height - assetDesc.offsetHeight));

        // Update the position of the assetDesc element
        assetDesc.style.left = `${left + 50}px`;
        assetDesc.style.top = `${top - 200}px`;
        document.body.append(assetDesc)

        getHtmlData(instanceId)

    }

        const createPortrait = (assetObj: any) => {
        const portrait = document.createElement("DIV");
        portrait.classList.add('portrait');
        portrait.insertBefore(createImg(assetObj), portrait.firstChild);
        return portrait
    }

    const createImg = (assetObj: any) => {
        const portraitImg = document.createElement("img");
        portraitImg.classList.add('media-image');

        if (projectId > 0) {
            const { category_images, images } = assetObj;

            const setImageWithFallback = (imgElement: any, name: string) => {
                imgElement.src = `${import.meta.env.VITE_FILE_URL}/${name}`;

            };

            if (images.length > 0) {
                const { name } = images[0];
                setImageWithFallback(portraitImg, name); // Set image with fallback
            } else if (category_images.length > 0) {
                const { name } = category_images[0];

                if (name !== 'no_image.png') {
                    setImageWithFallback(portraitImg, name); // Set image with fallback
                } else {
                    // Use the fallback image if no valid image is found
                    portraitImg.src = `${import.meta.env.VITE_FILE_URL}/no_image.png`;
                }
            } else {
                // Use the fallback image if no images are available
                portraitImg.src = `${import.meta.env.VITE_FILE_URL}/no_image.png`;
            }
        }

        return portraitImg;
    };
    const createTextDiv = async (asset: any) => {
        const textDiv = document.createElement("DIV");
        textDiv.classList.add('textDiv');
        textDiv.innerHTML = await createAssetTable(asset);
        textDiv.style.paddingLeft = "20px";
        textDiv.style.maxWidth = "100%";
        textDiv.style.fontFamily = "Calibri";
        textDiv.style.fontStyle = "normal";
        textDiv.style.fontSize = "12px";
        textDiv.style.fontWeight = "400";
        return textDiv;
    }
    const getHtmlData = async (assetId: number) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/notes/${assetId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const docs = document.getElementById(`htmlData-${assetId}`)

            if (docs) {
                const lines = data.notes ? data.notes.split('\n') : [];
                const firstTwoLines = lines.slice(0, 2).join(' ');
                docs.innerHTML = firstTwoLines.slice(0, 100) + (firstTwoLines.length > 100 ? "..." : "");
            }


        } catch (error) {
            console.error('Failed to fetch devices:', error);
        }
    }

    const createAssetTable = async (asset: any) => {

        const {position,description,content,angle} = asset
        let tableString = "";
        tableString += "<table border='0' style='border-collapse: collapse;'>";
        const name = asset.description.join(' ') || asset.content || 'No Description';
        let htmlData = ''
        // const {position, angle} = sceneAssets[instanceId]

        tableString += "<tr class='t-header'><td  >" + name + "</td></tr>";
        tableString += "<tr class='t-details'><td >#" + instanceId+ " (" + ((position.x)*1).toFixed(1) + "," + ((position.y)*1).toFixed(1) + "," + ((position.z)*1).toFixed(1) + ") " + angle + "&deg;</td></tr>";
        tableString += `<tr class='t-details'><td id="htmlData-${instanceId}">${htmlData}</td></tr>`;
        tableString += "</table>";
        return tableString;

    }
    getAssetObject()



}
