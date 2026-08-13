import React, { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "primereact/confirmdialog";
import { Toast } from "primereact/toast";
import "./confirm.css";
import useGame from "../../../hooks/useGame";

export default function ConfirmationDialog() {
    const confirmationObj = useGame((state) => state.confirmationObj);
    const [visibility, setVisibility] = useState(false);
    const [message, setMessage] = useState("");
    const [response, setResponse] = useState(null);
    const setIsPuzzleGame = useGame((state) => state.setIsPuzzleGame);
    const setProjectID = useGame((state) => state.setProjectID);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setCharacter = useGame((state) => state.setCharacter);
    const setShowInventory = useGame((state) => state.setShowInventory);
    const toast = useRef(null);

    useEffect(() => {

        const { visible, message, response } = confirmationObj;
        if (visible === undefined || visible === null || visible === false) {
            setVisibility(false); // Ensure visibility is false when confirmationObj.visible is false
            return;
        }
        setVisibility(visible);
        setMessage(message);
        setResponse(response);
    }, [confirmationObj]);

    const accept = () => {
        toast.current?.show({
            severity: "info",
            summary: "Confirmed",
            detail: "You have accepted",
            life: 3000,
        });
        confirmationObj?.setResponse(!response);
        if (confirmationObj.quit) {
            setFirstPerson(false)
            setCharacter(false)
            setIsPuzzleGame(false);
            setProjectID(0)
            setShowInventory(false)
        }
        setVisibility(false); // Reset visibility after accept
    };

    const reject = () => {
        toast.current?.show({
            severity: "warn",
            summary: "Rejected",
            detail: "You have rejected",
            life: 3000,
        });
        setVisibility(false); // Reset visibility after reject
    };

    return (
        <>
            <Toast ref={toast} />
            <ConfirmDialog

                visible={visibility}
                closable={false}

                className="game-dialog"
                message={<div className="game-message">{message}?</div>}
                accept={accept}
                reject={reject}
                acceptLabel="YES"
                rejectLabel="NO"
                headerClassName={"game-header"}
                acceptClassName="p-button-sm game-btn"
                rejectClassName="p-button-sm game-btn"
            />
        </>
    );
}