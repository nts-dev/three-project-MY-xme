import React, {useEffect, useState} from "react";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Form from "react-bootstrap/Form";

import {Dialog} from "primereact/dialog";
import useGame from "../../../hooks/useGame";
import {Button} from "primereact/button";
// Importing the Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css';

import "./BPopup.css";
import database from "../../../database";
import {Q} from "@nozbe/watermelondb";

export default function BPopup() {


    const editPopup = useGame((state) => state.editPopup);
    const setEditPopup = useGame((state => state.setEditPopup));
    const [fields, setFields] = useState([]);

    const selectedAssetId = useGame((state) => state.selectedAssetId);

    async function fetchAssetFields() {

        const fieldsCollection = database.collections.get('fields');
        const fields = await fieldsCollection.query(Q.where('instance_id', selectedAssetId), Q.sortBy('field_id', Q.asc),).fetch();
        setFields(fields);
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
                <ExampleForm fields={fields}/>
            </Dialog>
        </div>
    )
};

const footerContent = () => (
    <div className="space-x-1 flex align-items-center gap-2">
        <Button style={{padding: '0.3em', background: '#dde0ea', fontSize: '0.8rem'}} label="Edit"
                icon="pi pi-pen-to-square"/>
        <Button style={{padding: '0.3em', background: '#dde0ea', fontSize: '0.8rem'}} label="Save"
                icon="pi pi-check" autoFocus/>

    </div>
);

const ExampleForm = (props) => {

    // const selectedAssetId = 1690;


    return (

        <Form>

            {props.fields?.map((field) => {

                if (field.type == 'combo' && field.name == "Branch") {

                    return (
                        <Form.Group as={Row} className="mb-1" controlId={`field_${field.fieldId}`}>
                            <Form.Label column="sm" xs={4}>
                                {field.name}
                            </Form.Label>
                            <Col xs={8}>
                                <Form.Select size="sm" defaultValue="Tradestar" readOnly>
                                    <option value="Tradestar">Tradestar</option>
                                    <option value="2">NTS</option>
                                </Form.Select>
                            </Col>
                        </Form.Group>
                    )
                }

                if (field.type == 'combo' && field.name == "Room") {

                    return (
                        <Form.Group as={Row} className="mb-1" controlId={`field_${field.fieldId}`}>
                            <Form.Label column="sm" xs={4}>
                                {field.name}
                            </Form.Label>
                            <Col xs={8}>
                                <Form.Select size="sm" defaultValue="1" readOnly>
                                    <option value="1">Floor 1</option>
                                    <option value="2">Two</option>
                                    <option value="3">Three</option>
                                </Form.Select>
                            </Col>
                        </Form.Group>
                    )
                }

                if (field.type == 'combo') {

                    return (
                        <Form.Group as={Row} className="mb-1" controlId={`field_${field.fieldId}`}>
                            <Form.Label column="sm" xs={4}>
                                {field.name}
                            </Form.Label>
                            <Col xs={8}>
                                <Form.Select size="sm" defaultValue="Choose..." readOnly>
                                    <option>Choose...</option>
                                    <option value="1">One</option>
                                    <option value="2">Two</option>
                                    <option value="3">Three</option>
                                </Form.Select>
                            </Col>
                        </Form.Group>
                    )
                }

                if (field.type == 'combo' && field.name == "Room") {

                    return (
                        <Form.Group as={Row} className="mb-1" controlId={`field_${field.fieldId}`}>
                            <Form.Label column="sm" xs={4}>
                                {field.name}
                            </Form.Label>
                            <Col xs={8}>
                                <Form.Select size="sm" defaultValue="1" readOnly>
                                    <option value="1">Floor 1</option>
                                    <option value="2">Two</option>
                                    <option value="3">Three</option>
                                </Form.Select>
                            </Col>
                        </Form.Group>
                    )
                }

                if (field.type == 'calender' || (field.type == 'input' && field.name == "Date In") || (field.type == 'input' && field.name == "Date") || (field.type == 'input' && field.name == "Date Out")) {

                    return (
                        <Form.Group as={Row} className="mb-1 " controlId={`field_${field.fieldId}`}>
                            <Form.Label column="sm" xs={4}>
                                {field.name}
                            </Form.Label>
                            <Col xs={8}>
                                <Form.Control size="sm" type="date" value={field.value} className="bpopup"
                                              dateFormat="YYYY-MM-DD"/>
                            </Col>
                        </Form.Group>
                    )
                }

                if (field.type == 'input') {

                    return (
                        <Form.Group as={Row} className="mb-1" controlId={`field_${field.fieldId}`}>
                            <Form.Label column="sm" xs={4}>
                                {field.name}
                            </Form.Label>
                            <Col xs={8}>
                                <Form.Control size="sm" value={field.value} readOnly/>
                            </Col>
                        </Form.Group>
                    )
                }

                return (

                    <Form.Group as={Row} className="mb-1" controlId={`field_${field.fieldId}`}>
                        <Form.Label column="sm" xs={4}>
                            {field.name}
                        </Form.Label>
                        <Col xs={8}>
                            <Form.Control size="sm" value={field.value} readOnly/>
                        </Col>
                    </Form.Group>

                )

            })}
        </Form>

    );
};


// const BPopup = () => (
//     <Container style={{width: "30%", backgroundColor: "white", margin: "10px", paddingTop: "20px", overflow: "auto"}}>
//         <Row>
//             <ExampleForm/>
//         </Row>
//     </Container>
// );


// export default BPopup;
