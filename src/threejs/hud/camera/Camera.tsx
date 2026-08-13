import React, { useState, useRef, useEffect } from 'react';

import './CustomDial.css';
import useGame from "../../../hooks/useGame"; // Create this CSS file for styling

const Camera = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dialRef: any = useRef(null);
    const buttonRef = useRef(null);
    const setCamera = useGame((state: any) => state.setCamera);
    const setCharacter = useGame((state:any) => state.setCharacter);
    const setFirstPerson = useGame((state:any) => state.setFirstPerson);

    const selectedPlayer = (cameraType:any) => {
        setCamera(cameraType);
        if (cameraType === 'Third Person') {
            setCharacter(true);
            setFirstPerson(false);
        } else if (cameraType === 'First Person') {
            setFirstPerson(true);
            setCharacter(false);
        } else {
            setCharacter(false);
            setFirstPerson(false);
        }
        setIsOpen(false); // Close the dial after selection
    };

    const items = [
        {
            label: 'Third Person',
            icon: 'pi pi-users',
            action: () => selectedPlayer('Third Person'),
        },
        {
            label: 'First Person',
            icon: 'pi pi-user',
            action: () => selectedPlayer('First Person'),
        },
        {
            label: 'Camera',
            icon: 'pi pi-video',
            action: () => selectedPlayer('Camera'),
        },
    ];

    // Handle click outside to close the dial
    useEffect(() => {
        const handleClickOutside = (event: any) => {
            if (dialRef.current && !dialRef.current?.contains(event.target) && event.target !== buttonRef.current) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    return (
        <div className="custom-speed-dial camera-buttons visible-element" ref={dialRef}>
            <div
                ref={buttonRef}
                className="speed-dial-button"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle camera options"
                title="Toggle camera options"
            >
                <i className={isOpen ? 'pi pi-spin pi-cog' :  "pi pi-video" }/> {/* Show icon */}
            </div>
            {isOpen && (
                <div className="speed-dial-items">
                    {items.map((item, index) => (
                        <div
                            key={item.label}
                            className="speed-dial-item"
                            onClick={item.action}

                            aria-label={item.label}
                            title={item.label}
                        >
                            <i className={`pi ${item.icon}`} />

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Camera;