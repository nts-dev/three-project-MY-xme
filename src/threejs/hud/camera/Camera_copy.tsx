import React, {useEffect, useRef, useState} from 'react';
import { SpeedDial } from 'primereact/speeddial';
import { Toast } from 'primereact/toast';
import { MenuItem } from 'primereact/menuitem';
import useGame from "../../../hooks/useGame";
import { useClickOutside } from 'primereact/hooks';


export default function Camera() {
    const toast = useRef<Toast>(null);
    const speedDialRef: any = useRef(null);
    const wrapperRef = useRef(null);
    const setCamera = useGame((state: any) => state.setCamera);
    const setCharacter = useGame((state: any) => state.setCharacter);
    const setFirstPerson = useGame((state: any) => state.setFirstPerson);
    const [enabled, setEnabled] = useState(false);

    const selectedPlayer = (cameraType: string) => {
        setCamera(cameraType);
        if (cameraType === "Third Person") {
            setCharacter(true);
            setFirstPerson(false);
        } else if (cameraType === "First Person") {
            setFirstPerson(true);
            setCharacter(false);
        } else {
            setCharacter(false);
            setFirstPerson(false);
        }
    };

    const items: MenuItem[] = [
        {
            label: 'Third Person',
            icon: <i className="pi pi-users visible-element" style={{ fontSize: '1rem' }} title="Third Person"></i>,
            command: (e) => {

                selectedPlayer('Third Person')

            }
        },
        {
            label: 'First Person',
            icon: <i className="pi pi-user visible-element" style={{ fontSize: '1rem' }} title="First Person"></i>,
            command: () => selectedPlayer('First Person')
        },
        {
            label: 'Camera',
            icon: <i className="pi pi-video visible-element" style={{ fontSize: '1rem' }} title="Camera"></i>,
            command: () => selectedPlayer('Camera')
        },
    ];
    //
    // useClickOutside(wrapperRef, () => {
    //           setEnabled(false);
    // });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if(enabled) {
            // Block everything while SpeedDial is visible
                e.stopPropagation();
                e.preventDefault();
            }
        };

        // Capture phase = true to block early
        document.addEventListener("keydown", handleKeyDown, true);

        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
        };
    }, [enabled]);

    const keyDownHandler = () => {

        speedDialRef.current?.hide();
    }
    return (
        <div className="camera-buttons visible-element"
             ref={wrapperRef}
        >
            <Toast ref={toast} />
            <SpeedDial
                ref={speedDialRef}
                model={items}
                direction="up"
                showIcon="pi pi-video"
                hideIcon="pi pi-spin pi-cog"
                buttonClassName="visible-element"
                onKeyDown={()=>keyDownHandler()}
                onShow={() => setEnabled(true)}
                onHide={() => setEnabled(false)}

            />
        </div>
    );
}
