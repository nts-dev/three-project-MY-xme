import React, {useEffect, useRef, useMemo, useState} from "react";
import { Pane } from "tweakpane";
import ImageAlbum from "./ImageAlbum.jsx";
import { createRoot } from "react-dom/client";
import Info from "./Info";
import store from "../../../store/store";
import { Provider } from "react-redux";
import Files from "./files/Files";
import Planning from "./planning/Planning";
import useGame from "../../../hooks/useGame";
import QRCode from "./QRCode";
import * as THREE from "three";
import database from "../../../database";
import {Q} from "@nozbe/watermelondb";
import {objects, sceneAssets} from "../../../threejs/player/puzzle/character/Constants.jsx";
import SaveFromTemplate from "./SaveFromTemplate.jsx";


function FormWithTWeakPane({ formData, branches, rooms, scene, refresh, handleInputChange, handleInfoClicked,selectedAssetId,selectedAsset,qrData,setSelectedAssetId}) {
    const containerRef = useRef(null);
    const folderStatesRef = useRef({}); // Store folder expanded/collapsed states
    const selectedTabRef = useRef(0); // Store the selected tab index
    const pane = useMemo(() => new Pane(), []); // Ensure the pane is only created once
    const folderRefs =  useRef({}); // Store folder
    const [filesTab, setFilesTab] = useState()
    const [planningTab, setPlanningTab] = useState()
    const setSelectedFormTab = useGame((state) => state.setSelectedFormTab);
    const [assetOptions, setAssetOptions] = useState([])
    // const [assetName, setAssetName] = useState()
    const showQR = useGame((state) => state.showQR);
    const assetName = useGame((state) => state.assetName);
    const setAssetName = useGame((state) => state.setAssetName);
    const setComboAssetID = useGame((state) => state.setComboAssetID);
    const templateAssetProps = useGame((state) => state.templateAssetProps);
    const scan = useGame((state) => state.scan);

    const defaultInstanceId = useGame((state) => state.defaultInstanceId);
    const selectedAssetName = useGame((state) => state.selectedAssetName);
    const projectId = useGame((state) => state.projectID);
    const setLazy = useGame((state) => state.setLazy)
    const setRemovedObject = useGame((state) => state.setRemovedObject);
    const rotationValue = useGame((state) => state.rotationValue);
    const setRotationValue =      useGame((state) => state.setRotationValue);
    const assetSettings = useGame((state) => state.assetSettings);
    const setAssetSettings = useGame((state) => state.setAssetSettings);
    const setAssetClone = useGame((state) => state.setAssetClone);
    const vAlignValue = useGame((state) => state.vAlignValue);
    const formState = {};
    const formatDate = (dateStr) => {
        const [dd, mm, yyyy] = dateStr.split("-");
        return `${yyyy}-${mm}-${dd}`;
    };

    const formatDateIn = (dateStr) => {
        const [yyyy, mm, dd] = dateStr.split("-");
        return `${yyyy}-${mm}-${dd}`;
    };

    useEffect(() => {


        //
        const options = []
        const selectedSceneAsset = sceneAssets[selectedAssetId]

        if (!selectedSceneAsset) {
            setAssetOptions(options)
            return;
        }

        const  assetID = selectedSceneAsset.assetID

        for(const i in objects){
            const asset = objects[i]

            if(asset.assetID==assetID){
                setAssetName(i)


            }
            options.push({name: i, value: asset.assetID})
        }

        setAssetOptions(options)

    }, [scan, selectedAssetId, selectedAssetName]);

    const cloneAsset = (name,position, isTemplate,oldName, rotation) =>{

        const {object,scale,assetID} = objects[name]
        if(!scale){
            return
        }

        if(object && scene){


            const  cloneObj = object.clone(true);

            if(assetID==8743){
                cloneObj.name = 'character1'
                position.y+=0.05

                cloneObj.position.copy(position)
            }
            else {
                cloneObj.name = selectedAssetId
                cloneObj.position.copy(position)
            }

            cloneObj.scale.set(scale.x,scale.y,scale.z)

            setAssetClone(cloneObj)

            if(oldName){
                setRemovedObject({name: oldName, id: selectedAssetId})
            }

        }
    }



    const onAssetChange = (e,oldName)=>{

        const {assetID} = objects[e.value]
        setAssetName(e.value)

        if(assetID==8743){
            setRemovedObject({name: oldName, id: selectedAssetId})
            return
        }

        const asset = objects[e.value]

        if(!asset.assetID || asset.assetID===0 || asset.assetID===8725) return


        handleInputChange(asset.assetID, 33168)
        setLazy(true)

        if(selectedAssetId !== defaultInstanceId){
            setComboAssetID(asset.assetID)

            const selectedSceneAsset = sceneAssets[selectedAssetId]
            if (!selectedSceneAsset) return

            const { position, categoryIndex } = selectedSceneAsset
            cloneAsset(e.value,position,false,oldName,parseFloat(rotationValue))

            if(asset.assetID > 0){
                const props = {
                    categoryIndex,
                    position,
                    rotation: new THREE.Euler(0,parseFloat(rotationValue),0),
                    projectId,
                    textures: [],
                };
                SaveFromTemplate(props, e.value, selectedAssetId,setLazy,setSelectedAssetId,vAlignValue);

            }
        } else {
            const {position} = templateAssetProps
             if(position){
                 cloneAsset(e.value,position, true,null,parseFloat(rotationValue))
             }

            SaveFromTemplate(templateAssetProps,e.value,null,setLazy,setSelectedAssetId,vAlignValue)
        }


    }

    useEffect(() => {
        if (!formData || !containerRef.current || Object.values(formData).length===0) return;
        const previousTabIndex = selectedTabRef.current;

        // Clear the container and append the Tweakpane element
        containerRef.current.innerHTML = "";
        pane.element.style.width = "100%";
        containerRef.current.appendChild(pane.element);

        // Remove all existing children from the pane
        while (pane.children.length) {
            pane.remove(pane.children[0]);
        }

        // Create Tabs
        const tab = pane.addTab({
            pages: [
                { title: "Specification" },
                { title: "Info" },
                { title: "Media" },
                { title: "Files" },
                { title: "Logs" },
            ],
        });

        // Alternative: Listen for clicks on tab elements
        tab.pages.forEach((page, index) => {
            page.controller?.ic_.view.element.addEventListener("click",()=>{
                selectedTabRef.current = index;
                setSelectedFormTab(index)
            })
            tab.pages[previousTabIndex].controller.onItemClick_();
        });

        const specTab = tab.pages[0];
        setFilesTab(tab.pages[3])
        setPlanningTab(tab.pages[4])
        Object.keys(folderRefs.current).forEach((folderName) => {
            const folder = folderRefs.current[folderName];
            if (folder) {
                folderStatesRef.current[folderName] = folder.expanded;
            }
        });

        const onRotationChange = (e)=>{

             setRotationValue(e.value)
        }
        Object.values(formData).forEach((field, index) => {
            if (!field || !field.name) return;

            if (field.children && field.children.length > 0) {
                const folder = specTab.addFolder({title: field.name});
                // Store folder reference
                folderRefs.current[field.name] = folder;

                folder.expanded = folderStatesRef.current[field.name] ?? (index === 0);

                setSelectedFormTab(previousTabIndex)

                field.children.forEach((child) => {
                    if (child.name === "Date In" || child.name === "Day of birth") {
                        const dateBlade = folder.addBlade({
                            view: "text",
                            label: child.name,
                            parse: (v) => String(v),
                            value: child.name === "Date In" ? formatDateIn(child.value) : formatDate(child.value),
                        });

                        setTimeout(() => {
                            const inputElement = dateBlade.controller.view.element.querySelector("input");
                            if (inputElement) {
                                inputElement.type = "date";
                                inputElement.addEventListener("change", (e) => handleInputChange(e.target.value, child.fieldId));
                            }
                        }, 100);
                        return;
                    }

                    if (child.indexId) {
                        const button = folder.addBlade({
                            view: "text",
                            label: child.name,
                            parse: (v) => String(v),
                            value: child.value,
                        });

                        setTimeout(() => {
                            const inputWrapper = button.controller.view.element;
                            const inputElement = inputWrapper.querySelector("input");

                            if (inputElement) {
                                inputElement.readOnly = true;
                                inputElement.style.pointerEvents = "none";
                                inputElement.style.cursor = "crosshair";
                                inputWrapper.style.display = "flex";
                                inputWrapper.style.position = "relative";
                                inputElement.style.paddingRight = "1.45rem";
                                inputElement.style.flexGrow = "1";

                                const iconButton = document.createElement("button");
                                iconButton.innerHTML = '<i class="pi pi-info-circle" style="font-size: 0.75rem" ></i>';
                                iconButton.style.border = "none";
                                iconButton.style.background = "transparent";
                                iconButton.style.cursor = "pointer";
                                iconButton.style.position = "absolute";
                                iconButton.style.right = "0.5rem";
                                iconButton.style.fontSize = "0.75rem";
                                iconButton.style.display = "flex";

                                iconButton.addEventListener("click", () => {
                                    handleInfoClicked(child.fieldId, child.indexId, child.value);
                                });

                                inputWrapper.appendChild(iconButton);
                            }
                        }, 100);
                        return;
                    }

                    if (child.name === "Branch" || child.name === "Room") {
                        folder.addBlade({
                            view: "list",
                            label: child.name,
                            options: (child.name === "Branch" ? branches : rooms).map(option => ({
                                text: option.label,
                                value: option.value,
                            })),
                            value: parseInt(child.value),
                        }).on("change", (e) => handleInputChange(e.value, child.fieldId));
                        return;
                    }

                    if (child.type === "combo" && child.name !== "Branch" && child.name !== "Room") {
                        folder.addBlade({
                            view: "list",
                            label: child.name,
                            options: child.children.map(option => ({
                                text: option.name,
                                value: option.name,
                            })),
                            value: child.value,
                        }).on("change", (e) => handleInputChange(e.value, child.fieldId));
                        return;
                    }
                    if (child.name === "AssetName" && assetOptions.length > 0 && assetName) {
                        folder.addBlade({
                            view: "list",
                            label: child.name,
                            options: assetOptions.map(option => ({
                                text: option.name,
                                value: option.name,
                            })),
                            value: assetName,
                        }).on("change", (e) => onAssetChange(e, assetName));
                        return;
                    }
                    const normalBlade = folder.addBlade({
                        view: "text",
                        label: child.name,
                        parse: (v) => String(v),
                        value: child.value || "",
                    }).on("change", (e) => handleInputChange(e.value, child.fieldId));

                    if (child.name === "ID" || child.name === "Description" || child.name?.includes('ID')) {
                        const inputWrapper = normalBlade.controller.view.element;
                        const inputElement = inputWrapper.querySelector("input");

                        if (inputElement) {
                            inputElement.readOnly = true;
                            inputElement.style.cursor = "not-allowed";
                        }
                    }
                });

                folder.addBlade({
                    view: "list",
                    label: 'Rotation',
                    options: [{name: '0', value: '0'}, {name: '90', value: '90'}, {
                        name: '180',
                        value: '180'
                    }, {name: '270', value: '270'}].map(option => ({
                        text: option.name,
                        value: option.name,
                    })),
                    value: rotationValue,
                }).on("change", (e) => onRotationChange(e));

                const settingObj = assetSettings?.settingObj

                if (settingObj) {
                    const sFolder = folder.addFolder({title: settingObj.category});

                    settingObj.variables.forEach(variable => {
                        // Set initial value
                        formState[variable.name] = variable.default;
                        // Create dropdown options from range
                        const options = variable.range.values.map(value => ({
                            text: String(value),
                            value: value
                        }));

                        sFolder.addBlade({
                            view: 'list',
                            label: variable.name,
                            options,
                            value: variable.default
                        }).on('change', (e) => {
                            const newValue = e.value;
                            formState[variable.name] = newValue;

                            // Update variables with the new value
                            const updatedVariables = assetSettings.settingObj.variables.map(v =>
                                v.name === variable.name
                                    ? {...v, default: newValue}
                                    : v
                            );

                            const category = assetSettings.settingObj.category;

                            // 🔁 Reconstruct string
                            const updatedString = updatedVariables
                                .map(v => `${category}|${v.name}=${v.default};${v.range.start}-${v.range.end};${v.range.step}`)
                                .join('\n');

                            // ✅ Update local state
                            setAssetSettings({
                                field_id: assetSettings.field_id,
                                id: assetSettings.id,
                                dbFieldId: assetSettings.dbFieldId,
                                settingObj: {
                                    category,
                                    variables: updatedVariables
                                }
                            });

                            // ✅ Update remote or parent
                            updateSettings({
                                field_id: assetSettings.field_id,
                                dbFieldId: assetSettings.dbFieldId,
                                value: updatedString
                            });
                        });
                    })
                }
            }

        });

        const qrContainer = document.createElement("div");
        qrContainer.style.padding = "10px";
        qrContainer.style.width = "100%";
        specTab.element.appendChild(qrContainer);

        createRoot(qrContainer).render(
           <>
           { showQR && selectedAsset?.assetObject && (
               <QRCode id={selectedAssetId} name={selectedAsset.assetObject.description?.join(' ') || 'Name not defined'} qrData={qrData}/>
           )}
           </>
        );


        // Media Tab Content
        const mediaTab = tab.pages[2];
        const mediaContainer = document.createElement("div");
        mediaContainer.style.padding = "10px";
        mediaContainer.style.width = "100%";
        mediaTab.element.appendChild(mediaContainer);

        createRoot(mediaContainer).render(<ImageAlbum key="image-album" />);

        // Info Tab Content
        const infoTab = tab.pages[1];
        const infoContainer = document.createElement("div");
        infoContainer.style.padding = "10px";
        infoContainer.style.width = "100%";
        infoTab.element.appendChild(infoContainer);

        createRoot(infoContainer).render(
            <Provider store={store}>
                <Info key="info-component" />
            </Provider>
        );

    }, [formData, refresh,showQR,assetName,assetOptions]);

    const fetchCategoryId = async (id) => {

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/getTemplateId/${id}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            return data[0].id

        } catch (error) {
            console.error("Failed to fetch categories:", error);
        }
    };


    const updateSettings = async (field) => {
        const formData = new FormData();
        formData.append(`form_${field.dbFieldId}`, field.value);
        const selectedSceneAsset = sceneAssets[selectedAssetId]
        if (!selectedSceneAsset) return

        const {  categoryIndex } = selectedSceneAsset
        const templ_id = await fetchCategoryId(categoryIndex)
        if (templ_id > 0) {
            try {
                const response = await fetch(
                    `${import.meta.env.VITE_DATA_URL}/Controller/php/data_devices.php?action=24&id=${selectedAssetId}&templ_id=${templ_id}&cat_id=${categoryIndex}`,
                    {
                        method: "POST",
                        body: formData,
                    }
                );
                const result = await response.json();
                if (result.data.success) {
                    bulkInsertFields(field)
                    // showMessage("info", "Fields Saved", result.data.text);

                } else {
                    // showMessage("error", "Error Saving", result.data.text);
                }

            } catch (error) {
                console.log(error)
                // showMessage("error", "Error Saving", "Failed to complete request.");
            }
        }
    }
    const bulkInsertFields = async (field) => {
        const fieldsCollection = database.collections.get('fields');
        const operations = [];
        try {
                const existingFields = await fieldsCollection.query(
                    Q.where('value_id', `${selectedAssetId}_${field.field_id}`)
                ).fetch();

                if (existingFields.length > 0 ) {
                    const existingField = existingFields[0];
                    const update = existingField.prepareUpdate(record => {
                        record.value = field.value;
                    });
                    operations.push(update);
                }

            await database.write(async () => {
                await database.batch(operations);
            });
        } catch (error) {
            console.log('Error in bulkInsertFields:', error);
        }
    };












    return (

        <div ref={containerRef}>
            {filesTab && <Files key="files-component" id={selectedAssetId} filesTab={filesTab}/>}
            {planningTab && <Planning key="planning-component" id={selectedAssetId} planningTab={planningTab}/>}

        </div>
    );
}

export default FormWithTWeakPane;
