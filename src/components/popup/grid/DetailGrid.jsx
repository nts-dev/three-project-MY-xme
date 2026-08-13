import React, { useState, useEffect } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import useGame from "../../../hooks/useGame";
import { Checkbox } from 'primereact/checkbox';

export default function DetailGrid() {
    const indexId = useGame((state) => state.indexId);
    const fieldId = useGame((state) => state.fieldId);
    const [data, setData] = useState([]);
    const assetIndexArray = useGame((state) => state.assetIndexArray);
    const setFormValues = useGame((state) => state.setFormValues);
    const setGridFieldId = useGame((state) => state.setGridFieldId);
    const formValues = useGame((state) => state.formValues);
    const setSelectedGridIds = useGame((state) => state.setSelectedGridIds);
    useEffect(() => {
        // Fetch data from API
        fetch(`${import.meta.env.VITE_API_URL}/assetDetailConnection/${indexId}`)
            .then(response => response.json())
            .then(jsonData => {
                const transformedData = Object.entries(jsonData).map(([id, name]) => ({
                    id,
                    name: name.trim(),
                    checked:  assetIndexArray.includes(Number(id)) // Add checked property to each row
                }));
                setData(transformedData);
            })
            .catch(error => console.error('Error fetching data:', error));
    }, [indexId]);


    const findFieldById = (fields, fieldId) => {

        for (let key in fields) {
            if (fields[key] && fields[key].fieldId === fieldId) {
                return fields[key];
            }
            if (fields[key] && fields[key].children && fields[key].children.length > 0) {
                const childField = findFieldById(fields[key].children, fieldId);
                if (childField) {
                    return childField;
                }
            }
        }
        return null;
    };

    const updateFormValue = (formValues, fieldId, newValue) => {
        // Find the field by its fieldId in formValues
        const result = findFieldById(formValues, fieldId);

        if (result) {
            result.value = newValue;  // Update the field value
           return { ...formValues }; // Return the updated formValues
        }
        return formValues; // Return original formValues if no field was found
    };
    const handleCheckboxChange = async (rowData, isChecked) => {
        setGridFieldId(fieldId)
        const updatedData = data.map((row) =>
            row.id === rowData.id ? {...row, checked: isChecked} : row
        );
        const selectedRows = updatedData
            .filter(row => row.checked)
            .map(row => `[${row.id}] ${row.name}`);

        setData(updatedData);
        const newFormValues = updateFormValue(formValues, fieldId, selectedRows.join(' '))
        setFormValues(newFormValues)


        const selectedRowIds = updatedData.filter(row => row.checked).map(row => row.id);
        setSelectedGridIds(selectedRowIds.toString())
    };

    const checkboxTemplate = (rowData) => {
        return (
            <Checkbox
                checked={rowData.checked}
                onChange={(e) => handleCheckboxChange(rowData, e.checked)}
            />
        );
    };

    return (
        <div className="card">
            <DataTable
                value={data}
                tableStyle={{ minWidth: '30rem' }}
                scrollable
                scrollHeight="400px"
                paginator
                rows={10}
                className="custom-datatable"
                filterDisplay="row"
            >
                <Column
                    field="id"
                    header="ID"
                    filter
                    filterPlaceholder="Search by ID"
                    showFilterMatchModes={false}

                />
                <Column
                    field="name"
                    header="Description"
                    filter
                    filterPlaceholder="Search by Description"
                    showFilterMatchModes={false}

                />
                <Column body={checkboxTemplate} header="Select" />
            </DataTable>
        </div>
    );
}
