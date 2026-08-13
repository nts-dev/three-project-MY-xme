
import React, { useState, useEffect } from 'react';
import { TreeTable } from 'primereact/treetable';
import { Column } from 'primereact/column';
import useGame from "../../../hooks/useGame";
import { Checkbox } from 'primereact/checkbox';
export default function DetailTree() {
    const indexId = useGame((state) => state.indexId);
    const fieldId = useGame((state) => state.fieldId);
    const setFormValues = useGame((state) => state.setFormValues);
    const formValues = useGame((state) => state.formValues);
    const assetIndexArray = useGame((state) => state.assetIndexArray);
    const setSelectedTableIds = useGame((state) => state.setSelectedTableIds);
    const setTableFieldId = useGame((state) => state.setTableFieldId);
    const [nodes, setNodes] = useState([]);

    const transformDataToTreeNodes = (data) => {
        return Object.entries(data).map(([branchId, branchData]) => ({
            key: `branch-${branchId}`,
            data: { name: branchData.branch_name },
            children: Object.entries(branchData.cat).map(([catId, catData]) => ({
                key: `cat-${catId}`,
                data: { name: catData.cat_name },
                children: Object.entries(catData.sub).map(([subId, subData]) => ({
                    key: `sub-${subId}`,
                    data: { name: subData.sub_name },
                    children: Object.entries(subData.items).map(([itemId, itemName]) => ({
                        key: itemId,
                        data: { name: itemName, checked: assetIndexArray.includes(Number(itemId)) }, // Add a "checked" property
                    }))
                }))
            }))
        }));
    };

    const getSelectedRowIds = (nodes) => {
        const selectedIds = [];
        const selectedValues = [];

        const traverse = (nodes) => {
            nodes.forEach((node) => {
                if (node.data?.checked) {
                    selectedIds.push(node.key); // Collect the key or rowid of the selected node
                    selectedValues.push(`[${node.key}] ${node.data?.name}`)
                }
                if (node.children) {
                    traverse(node.children); // Recursively check children
                }
            });
        };

        traverse(nodes);
        return {selectedIds,selectedValues};
    };

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
            // console.log(result)
            // Update the field's value in formValues
            result.value = newValue;  // Update the field value
            return { ...formValues }; // Return the updated formValues
        }
        return formValues; // Return original formValues if no field was found
    };

    const handleCheckboxChange = (node, checked) => {

        setTableFieldId(fieldId)
        const updateNodes = (nodes) =>
            nodes.map((n) => {
                if (n.key === node.key) {

                    return {
                        ...n,
                        data: { ...n.data, checked }, // Update the "checked" property
                    };
                }
                if (n.children) {
                    return { ...n, children: updateNodes(n.children) };
                }
                return n;
            });


        setNodes(updateNodes(nodes));

        const selectedData = getSelectedRowIds(updateNodes(nodes));
        const selectedRowIds = selectedData.selectedIds
        const selectedValues = selectedData.selectedValues

        const newFormValues = updateFormValue(formValues, fieldId, selectedValues.join(' '))
        setFormValues(newFormValues)
        setSelectedTableIds(selectedRowIds.toString())


    };
    useEffect(() => {
        // Fetch data from the API and transform it to TreeTable nodes
        fetch(`${import.meta.env.VITE_API_URL}/assetDetailConnection/${indexId}`)
            .then(response => response.json())
            .then(data => {
                const treeNodes = transformDataToTreeNodes(data);
                setNodes(treeNodes);
            })
            .catch(error => console.error('Error fetching data:', error));
    }, [indexId]);

    const checkboxTemplate = (node) => {
        if (!node.children) {
            return (
                <Checkbox

                    checked={node.data.checked}
                    onChange={(e) => handleCheckboxChange(node, e.checked)}
                />
            );
        }
        return null;
    };
    return (
        <div className="card">
            <TreeTable
                value={nodes}
                responsiveLayout="scroll"
                // scrollHeight="200px"
                selectionMode="single"
                scrollable
                className="p-treetable-striped p-treetable-gridlines custom-datatable "
            >
                <Column field="name" header="Name" expander className="p_column" />
                <Column
                    body={checkboxTemplate}
                    header="Select"

                />
            </TreeTable>
        </div>
    );
}
