import React, {useEffect, useState} from "react";
import {Dialog} from 'primereact/dialog';
import useGame from "../../../hooks/useGame";
import {InputText} from "primereact/inputtext";
import {Dropdown} from "primereact/dropdown";
import {Button} from "primereact/button";
import {Calendar} from "primereact/calendar";
import UpdateAsset from "../../../threejs/scene/UpdateAsset";
import {Password} from "primereact/password";
import {Q} from "@nozbe/watermelondb";
import database from "../../../database";
import "./Popup.css";
import {socket} from "../../../socket";
import ImageAlbum from "./ImageAlbum-1";

export default function Popup() {

    const [rooms, setRooms] = useState<any>([]);
    const [selectedBId, setSelectedBId] = useState<any>([]);
    const [branches, setBranches] = useState<any>([]);
    const editPopup: any = useGame((state: any) => state.editPopup);
    const selectedAssetId: number = useGame((state: any) => state.selectedAssetId);
    const editable: boolean = useGame((state: any) => state.editable);
    const setEditable: any = useGame((state: any) => state.setEditable);
    const projectID: any = useGame((state: any) => state.projectID);
    const setEditPopup: any = useGame((state: any) => state.setEditPopup)
    const [fields, setFields] = useState<any>([]);
    const selectedAsset: any = useGame((state: any) => state.selectedAsset);
    const formStatus: any = useGame((state: any) => state.formStatus);
    // const setFieldsMap: any = useGame((state: any) => state.setFieldsMap);

    const [date, setDate] = useState<any>(null);

    const [fieldsMap, setFieldsMap] = useState<any>({});

    const updateField = async (id: string, data: any) => {
        // await db.fields.update(id, data)

        const fieldsCollection = database.collections.get('fields');

        // Query the record by value_id
        const fields = await fieldsCollection.query(Q.where('value_id', id)).fetch();

        if (fields.length === 0) {
            console.log(`No field found with id: ${id}`);
            return;
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

    const saveData = async () => {

        UpdateAsset(fieldsMap, selectedAssetId, selectedAsset);

        Object.values(fieldsMap).forEach((field: any, index) => {
            updateField(field.id, {value: field.value})
        });
        socket.emit('createMessage', {map: fieldsMap, assetId: selectedAssetId, asset: selectedAsset});
    };


    useEffect(() => {

        if (!editPopup || selectedAssetId == 0)
            return;
        fetchAssetFields();
    }, [selectedAssetId, editPopup, formStatus]);


    useEffect(() => {

        const fetchBranches = async () => {
            try {
                const branchCollection = database.collections.get('branches');
                const branches = await branchCollection.query().fetch();

                const branchList = [];
                for (const branch of branches) {
                    // @ts-ignore
                    branchList.push({label: branch.name, value: branch.branchId});
                }
                setBranches(branchList)

            } catch (error) {
                console.error('Failed to fetch data from IndexedDB:', error);
            }
        };

        fetchBranches()

    }, [projectID])


    useEffect(() => {

        const fetchRooms = async () => {
            try {
                const roomsCollection = database.collections.get('rooms');
                const rooms = await roomsCollection.query(Q.where('parent', parseInt(selectedBId))).fetch();
                const roomList = [];
                for (const room of rooms) {
                    // @ts-ignore
                    roomList.push({label: room.name, value: room.roomId});
                }
                setRooms(roomList)

            } catch (error) {
                console.error('Failed to fetch data from IndexedDB:', error);
            }
        };
        if (selectedBId)
            fetchRooms()

    }, [selectedBId]);

    const makeFieldsMap = (fields: any) => {

        let brId = 0;
        const fieldMap = fields.reduce((map: any, field: any) => {

            map[field.valueId] = {
                id: field.valueId,
                instanceId: field.instanceId,
                fieldId: field.fieldId,
                name: field.name,
                type: field.type,
                value: field.value
            };
            // console.log(field)

            if (field.name == 'Branch') {
                brId = field.value
            }
            return map;
        }, {});

        setSelectedBId(brId);
        setFieldsMap(fieldMap)
    };

    async function fetchAssetFields() {

        // console.log("=====" + selectedAssetId)
        // const fields: any = await AssetEndPoint.getAssetFieldsByAssetId(selectedAssetId);
        if (selectedAssetId == undefined)
            return

        const fieldsCollection = database.collections.get('fields');
        const fields = await fieldsCollection.query(Q.where('instance_id', selectedAssetId), Q.sortBy('field_id', Q.asc),).fetch() //db.fields.where({instanceId: selectedAssetId}).toArray()
        setFields(fields);
        makeFieldsMap(fields);
    }

    function convertStringToDate(dateString: string): Date {

        const date = new Date(dateString);

        // Check if the date is valid
        // @ts-ignore
        if (isNaN(date)) {
            throw new Error("Invalid date string");
        }
        return date;
    }

    const footerContent = (
        <div className="space-x-1 flex align-items-center gap-2">
            <Button style={{padding: '0.3em', background: '#dde0ea', fontSize: '0.8rem'}} label="Edit"
                    icon="pi pi-pen-to-square" onClick={() => setEditable(true)}/>
            <Button style={{padding: '0.3em', background: '#dde0ea', fontSize: '0.8rem'}} label="Save"
                    icon="pi pi-check" onClick={() => saveData()} autoFocus/>
        </div>
    );

    const handleInputChange = (key: any | undefined, value: any) => {
        if (key != undefined) {

            setFieldsMap((prevFieldsMap: any[]) => ({
                ...prevFieldsMap,
                [key]: {
                    ...prevFieldsMap[key],
                    value: value
                }
            }))
        }
    };


    return (
        <div>
            <Dialog
                header="Asset Details"
                visible={editPopup}
                modal={false}
                position='top-left'
                onHide={() => {
                    if (!editPopup) return;
                    setEditPopup(false);
                }}
                draggable={false}
                resizable={false}
                footer={footerContent}
                className="popup">

                <div className="card space-y-0.5 ">
                    {
                        Object.entries(fieldsMap).map(([key, field]: any) => {
                            if (field.name == "Room") {
                                return (
                                    <div key={key} className="flex justify-between items-center text-xs ">

                                        <label htmlFor="integer"
                                               className=" block mb-1 w-48  max-w-40 text-ellipsis text-nowrap overflow-hidden ">
                                            {field.name}
                                        </label>

                                        <Dropdown
                                            disabled={editable ? false : true}
                                            value={parseInt(field.value)}
                                            onChange={(e) => {
                                                handleInputChange(key, e.target.value)
                                            }}
                                            options={rooms}
                                            placeholder="Select a Room"/>
                                    </div>
                                )
                            }


                            if (field.name == "Branch") {
                                return (
                                    <div key={key} className="flex justify-between items-center text-xs ">
                                        <label htmlFor="integer"
                                               className=" block mb-1 w-48  max-w-40 text-ellipsis text-nowrap overflow-hidden ">
                                            {field.name}
                                        </label>

                                        <Dropdown
                                            disabled={editable ? false : true}
                                            value={parseInt(field.value)}
                                            onChange={(e) => {
                                                handleInputChange(key, e.target.value)
                                            }}
                                            options={branches}/>
                                    </div>
                                )
                            }

                            if (field.name == "Date In") {
                                return (
                                    <div key={key} className="flex justify-between items-center text-xs ">
                                        <label htmlFor="integer"
                                               className=" block mb-1 w-48  max-w-40 text-ellipsis text-nowrap overflow-hidden ">
                                            {field.name}
                                        </label>

                                        <Calendar
                                            disabled={editable ? false : true}
                                            value={date ? date : convertStringToDate(field.value)}
                                            onChange={(e) => {
                                                handleInputChange(key, e.target.value)
                                            }}
                                            dateFormat="yy-mm-dd"
                                            showIcon/>
                                    </div>
                                )
                            }

                            if (field.name == "Password") {
                                return (
                                    <div key={key} className="flex justify-between items-center text-xs ">
                                        <label htmlFor="integer"
                                               className=" block mb-1 w-48  max-w-40 text-ellipsis text-nowrap overflow-hidden ">
                                            {field.name}
                                        </label>

                                        <Password
                                            value={field.value}
                                            onChange={(e) => handleInputChange(key, e.target.value)}
                                            className=" "
                                            disabled={editable ? false : true}
                                            toggleMask/>
                                    </div>
                                )
                            }

                            // if (field.name.includes('Mobile') || field.name.includes('Telefoon')) {
                            //
                            //     return (
                            //         <div key={key} className="flex justify-between items-center text-xs ">
                            //             <label htmlFor="integer"
                            //                    className=" block mb-1 w-48  max-w-40 text-ellipsis text-nowrap overflow-hidden ">
                            //                 {field.name}
                            //             </label>
                            //             <InputMask id="phone"
                            //                        className=" max-w-48 rounded max-h-5 text-xs"
                            //                        disabled={editable ? false : true}
                            //                        value={field.value}
                            //                        mask="(999) 99-999-9999"
                            //                        onChange={(e) => handleInputChange(key, e.target.value)}/>
                            //         </div>
                            //
                            //     )
                            // }

                            return (
                                <div key={key} className="flex justify-between items-center text-xs ">
                                    <label htmlFor="integer"
                                           className=" block mb-1 w-48  max-w-40 text-ellipsis text-nowrap overflow-hidden ">
                                        {field.name}
                                    </label>

                                    <InputText
                                        id="integer"
                                        value={fieldsMap[key].value}
                                        onChange={(e) => handleInputChange(key, e.target.value)}
                                        disabled={editable ? false : true}
                                        className=" max-w-48 rounded max-h-5 text-xs"/>
                                </div>
                            )

                            return null;
                        })
                    }
                </div>
                <ImageAlbum/>
            </Dialog>
        </div>
    )
}
