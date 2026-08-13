import * as React from 'react';
import {useEffect, useState} from 'react';
import {Field, FieldWrapper, Form, FormElement} from '@progress/kendo-react-form';
import {Label, Error} from '@progress/kendo-react-labels';
import {Input} from '@progress/kendo-react-inputs';
// import {Button} from '@progress/kendo-react-buttons';
import {Button} from "primereact/button";
import useGame from "../../../hooks/useGame";
import database from "../../../database";
import {Q} from "@nozbe/watermelondb";
import {Dialog} from "primereact/dialog";


const emailRegex = new RegExp(/\S+@\S+\.\S+/);

const emailValidator = value => emailRegex.test(value) ? "" : "Please enter a valid email.";

const LabelInput = (fieldRenderProps) => {
    const {label, id, ...others} =
        fieldRenderProps;

    return (
        <FieldWrapper>
            <Label editorId={id}>
                {label}
            </Label>
            <div className={"k-form-field-wrap"}>
                <Input type={"text"} id={id} {...others} />
            </div>
        </FieldWrapper>
    );
};

const KendoForm = (props) => {
    const handleSubmit = dataItem => alert(JSON.stringify(dataItem, null, 2));
    return <Form
        onSubmit={handleSubmit}
        initialValues={props.initialValues}
        render={formRenderProps =>
            <FormElement horizontal={true} style={{maxWidth: 750}} size="small">
                {/*<fieldset className={'k-form-fieldset'}>*/}
                {/*<legend className={'k-form-legend'}>Please fill in the fields:</legend>*/}
                {/*<FieldWrapper>*/}
                {/*    <div className='k-form-field-wrap'>*/}
                {/*<Field name={'firstName'} component={Input} labelClassName={'k-form-label'} label={'First name'}/>*/}
                {/*</div>*/}
                {/*</FieldWrapper>*/}

                {/*<FieldWrapper>*/}
                {/*    <div className='k-form-field-wrap'>*/}
                {/*<Field name={'lastName'} component={Input} labelClassName={'k-form-label'} label={'Last name'}/>*/}
                {/*</div>*/}
                {/*</FieldWrapper>*/}

                {/*<FieldWrapper>*/}
                {/*<Field name={"email"} type={"email"} component={EmailInput} label={"Email"} validator={emailValidator}/>*/}
                {/*</FieldWrapper>*/}

                {props.fields?.map((field) => {
                    if (field.type == 'input') {

                        return (
                            <Field
                                id={`field_${field.fieldId}`}
                                name={`field_${field.fieldId}`}
                                component={LabelInput}
                                label={field.name}
                            />

                        )
                    }
                })}
                {/*</fieldset>*/}
                {/*<div className="k-form-buttons">*/}
                {/*    <Button disabled={!formRenderProps.allowSubmit}>*/}
                {/*        Submit*/}
                {/*    </Button>*/}
                {/*</div>*/}


            </FormElement>}/>;
};

const footerContent = () => (
    <div className="space-x-1 flex align-items-center gap-2">
        <Button style={{padding: '0.3em', background: '#dde0ea', fontSize: '0.8rem'}} label="Edit"
                icon="pi pi-pen-to-square"/>
        <Button style={{padding: '0.3em', background: '#dde0ea', fontSize: '0.8rem'}} label="Save"
                icon="pi pi-check" autoFocus/>
    </div>
);


const Popup = () => {

    const editPopup = useGame((state) => state.editPopup);
    const setEditPopup = useGame((state => state.setEditPopup));
    const [fields, setFields] = useState([]);
    const [initialValues, setInitialValues] = useState({});

    const selectedAssetId = useGame((state) => state.selectedAssetId);

    async function fetchAssetFields() {

        const fieldsCollection = database.collections.get('fields');
        const fields = await fieldsCollection.query(Q.where('instance_id', selectedAssetId), Q.sortBy('field_id', Q.asc),).fetch();

        const fieldsList = [];
        const initialValues = {};
        let fieldName;
        for (const field of fields) {
            // console.log(room)
            // @ts-ignore
            fieldName = `field_${field.fieldId}`;
            fieldsList.push({fieldId: field.fieldId, name: field.name, type: field.type, value: field.value});
            initialValues[fieldName] = field.value;
        }
        setFields(fieldsList);
        setInitialValues(initialValues);
    }

    useEffect(() => {
        fetchAssetFields().then(() => console.log('form reloaded!'));
    }, [selectedAssetId]);

    if (!editPopup)
        return null;

    if (!selectedAssetId)
        return null;

    return (
        <div>
            <Dialog header="Asset Details" visible={editPopup} position='top-left' onHide={() => {
                if (!editPopup) return;
                setEditPopup(false);
            }} draggable={false} resizable={false} footer={footerContent} className="popup">
                <KendoForm fields={fields} initialValues={initialValues}/>
            </Dialog>
        </div>
    )
};


export default Popup;
