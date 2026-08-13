import React, { useEffect, useState } from 'react';
import { MultiSelect } from 'primereact/multiselect';
import useGame from '../hooks/useGame';
import { suppressSpaceButtonActivation } from '../utils/keyboardEvents';

const ViewportPathAnimationDropdown = () => {
    const setDevicePath = useGame((state) => state.setDevicePath);
    const [selectedPaths, setSelectedPaths] = useState([]);
    const [devices, setDevices] = useState([]);

    useEffect(() => {
        let isMounted = true;

        fetch(`${import.meta.env.VITE_API_URL}/devices`)
            .then(response => response.json())
            .then((data) => {
                if (isMounted) {
                    setDevices(Array.isArray(data) ? data : []);
                }
            })
            .catch((error) => {
                console.error('Error fetching devices:', error);
                if (isMounted) {
                    setDevices([]);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const selectDevice = (event) => {
        const nextSelectedPaths = Array.isArray(event.value) ? event.value : [];
        const ids = nextSelectedPaths.map((value) => value.code).filter(Boolean);

        if (ids.length === 0) {
            setDevicePath([]);
            setSelectedPaths(nextSelectedPaths);
            return;
        }

        fetch(`${import.meta.env.VITE_API_URL}/paths/${ids.join(',')}`)
            .then(response => response.json())
            .then((pathData) => {
                setDevicePath(pathData);
            })
            .catch((error) => {
                console.error('Error fetching paths:', error);
            });

        setSelectedPaths(nextSelectedPaths);
    };

    return (
        <div className="viewport-path-dropdown-shell">
            <MultiSelect
                value={selectedPaths}
                onChange={selectDevice}
                options={devices}
                optionLabel="name"
                placeholder="Path Animations"
                maxSelectedLabels={1}
                emptyMessage="No paths found"
                className="viewport-path-dropdown"
                panelClassName="viewport-path-dropdown-panel"
                appendTo="self"
                onKeyDown={suppressSpaceButtonActivation}
                onKeyUp={suppressSpaceButtonActivation}
            />
        </div>
    );
};

export default ViewportPathAnimationDropdown;
