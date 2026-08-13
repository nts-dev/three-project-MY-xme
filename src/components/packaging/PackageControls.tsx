import React, { useState } from 'react';
import { PanelMenu } from 'primereact/panelmenu';
import { InputSwitch } from 'primereact/inputswitch';
import { Button } from 'primereact/button';
import useGame from "../../hooks/useGame";

export default function PackageControls() {
    const [expandedKeys, setExpandedKeys] = useState({ 0: true });
    const setIsPackage = useGame((state: any) => state.setIsPackage);
    const setPackageControl = useGame((state: any) => state.setPackageControl);
    const setPause = useGame((state: any) => state.setPause);
    const setShowBdims = useGame((state: any) => state.setShowBdims);
    const setShowFdims = useGame((state: any) => state.setShowFdims);
    const setShowOdims = useGame((state: any) => state.setShowOdims);
    const setIsComponentTree = useGame((state: any) => state.setIsComponentTree);
    const setShowObject = useGame((state: any) => state.setShowObject);
    const setShowBox = useGame((state: any) => state.setShowBox);
    const setShowFoam = useGame((state: any) => state.setShowFoam);
    const setPlayBackward = useGame((state: any) => state.setPlayBackward);
    const setLabelRenderer = useGame((state: any) => state.setLabelRenderer);
    const pause = useGame((state: any) => state.pause);
    const isComponentTree = useGame((state: any) => state.isComponentTree);
    const showBdims = useGame((state: any) => state.showBdims);
    const showFdims = useGame((state: any) => state.showFdims);
    const showOdims = useGame((state: any) => state.showOdims);
    const showBox = useGame((state: any) => state.showBox);
    const showFoam = useGame((state: any) => state.showFoam);
    const showObject = useGame((state: any) => state.showObject);

    const switches: any = {
        tree: isComponentTree,
        bDims: showBdims,
        fDims: showFdims,
        oDims: showOdims,
        box: showBox,
        foam: showFoam,
        object: showObject
    };


    // Handle switch toggle
    const handleSwitchToggle = (key: string, value: boolean) => {
        switch (key) {
            case 'tree':
                setIsComponentTree(value);
                break;
            case 'bDims':
                setShowBdims(value);
                break;
            case 'fDims':
                setShowFdims(value);
                break;
            case 'oDims':
                setShowOdims(value);
                break;
            case 'box':
                setShowBox(value);
                break;
            case 'foam':
                setShowFoam(value);
                break;
            case 'object':
                setShowObject(value);
                break;
            default:
                break;
        }
    };

    const closePackage = () => {
        setIsPackage(false);
        setPackageControl(false);
        setIsComponentTree(false);
        setShowBdims(false)
        setShowFdims(false)
        setShowOdims(false)
        setLabelRenderer(null)

    };

    const itemRenderer = (item: {
        label: string;
        switchKey?: string; // Key for identifying the switch
    }, options: { onClick?: React.MouseEventHandler<HTMLAnchorElement> }) => (
        <a className="flex align-items-center px-3 py-2 cursor-pointer model-options" onClick={options.onClick}>
            <span className="content-center">{item.label}</span>
            {item.switchKey && (
                <InputSwitch
                    className="ml-auto"
                    checked={switches[item.switchKey]}
                    onChange={(e) => {
                        e.originalEvent?.stopPropagation?.();
                        handleSwitchToggle(item.switchKey!, e.value);
                    }}
                />
            )}
        </a>
    );

    const togglePlayPause = () => {
        setPause(!pause); // Toggle pause based on play/pause state
        setPlayBackward(false)
    };

    const items: any = [
        {
            key: '0',
            label: 'Model Settings',
            template: (item: any) => (
                <div className="flex items-center px-3">
                    <span>{item.label}</span>
                    <Button tooltip="Exit Packaging" icon="pi pi-times"
                            className="p-button-text p-button-sm ml-auto"
                            tooltipOptions={{ position: 'left' }}
                            onClick={closePackage} />
                </div>
            ),
            items: [
                {
                    key: '0_0',
                    label: 'Model Tree',
                    switchKey: 'tree',
                    template: (item: any, options: any) => itemRenderer({ ...item, switchKey: 'tree' }, options)
                },
                {
                    key: '0_1',
                    label: 'Animation',
                    template: (item: any, options: any) => (
                        <div className="flex items-center  px-3 py-2 model-options">
                            <span>{item.label}</span>

                            <div className="flex ml-auto">
                            <Button
                                icon="pi pi-step-backward"
                                className="p-btn"
                                onClick={() => {
                                    setPlayBackward(true)
                                    setPause(false)
                                }}
                            />

                            <Button
                                icon={!pause ? "pi pi-pause" : "pi pi-play"}
                                className="p-btn"
                                onClick={togglePlayPause}

                            />

                            <Button
                                icon="pi pi-step-forward"
                                className="p-btn"
                                onClick={() => {
                                    setPause(false)
                                    setPlayBackward(false)
                                }}
                            />
                            </div>
                        </div>
                    )
                },
                {
                    key: '0_2',
                    label: 'Show Box',
                    switchKey: 'box',
                    template: (item: any, options: any) => itemRenderer({ ...item, switchKey: 'box' }, options)
                },
                {
                    key: '0_3',
                    label: 'Show Foam',
                    switchKey: 'foam',
                    template: (item: any, options: any) => itemRenderer({ ...item, switchKey: 'foam' }, options)
                },
                {
                    key: '0_4',
                    label: 'Show Object',
                    switchKey: 'object',
                    template: (item: any, options: any) => itemRenderer({ ...item, switchKey: 'object' }, options)
                },
                // {
                //     key: '0_5',
                //     label: 'Pause Animation',
                //     switchKey: 'pause',
                //     template: (item: any, options: any) => itemRenderer({ ...item, switchKey: 'pause' }, options)
                // },
                {
                    key: '0_7',
                    label: 'Box Dimensions',
                    switchKey: 'bDims',
                    template: (item: any, options: any) => itemRenderer({ ...item, switchKey: 'bDims' }, options)
                },{
                    key: '0_8',
                    label: 'Foam Dimensions',
                    switchKey: 'fDims',
                    template: (item: any, options: any) => itemRenderer({ ...item, switchKey: 'fDims' }, options)
                },{
                    key: '0_9',
                    label: 'Object Dimensions',
                    switchKey: 'oDims',
                    template: (item: any, options: any) => itemRenderer({ ...item, switchKey: 'oDims' }, options)
                }
            ]
        }
    ];

    return (
        <div className=" flex justify-content-center package-controls">
            <PanelMenu model={items} expandedKeys={expandedKeys} onExpandedKeysChange={setExpandedKeys} className="w-full md:w-20rem" />
        </div>
    );
}
