import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { Menu } from "primereact/menu";
import useGame from "../../hooks/useGame";
import EnvSetting from "./environment/EnvSetting";
import { motion } from "motion/react";

const MotionDiv = motion.div;

const hudToolVariants = {
    hidden: { opacity: 0, x: 18, scale: 0.94, filter: "blur(5px)" },
    visible: {
        opacity: 1,
        x: 0,
        scale: 1,
        filter: "blur(0px)",
        transition: {
            type: "spring",
            stiffness: 280,
            damping: 24,
            staggerChildren: 0.05,
            delayChildren: 0.08,
        },
    },
};

export default function Hud({ camera }: any) {
    const setCategory = useGame((state: any) => state.setCategory);
    const setScanner = useGame((state: any) => state.setScanner);
    const op: any = useRef(null);
    const [istools, setIsTool] = useState(true)
    const toolsButtonRef = useRef(null); // Reference for the "Tools" button

    const handleZoomIn = () => {
        if (!camera.current) return;
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.current.quaternion);
        camera.current.position.add(direction.multiplyScalar(0.3));
    };

    const handleZoomOut = () => {
        if (!camera.current) return;
        const direction = new THREE.Vector3(0, 0, 1);
        direction.applyQuaternion(camera.current.quaternion);
        camera.current.position.add(direction.multiplyScalar(0.3));
    };

    const addToolsWindow = (event: any) => {
        if (op.current) {
            op.current.toggle(event, toolsButtonRef.current); // Use the ref as the target for positioning
            setIsTool(!istools)
        }
    };

    const handleItemClick = (event: any) => {
        const { title } = event.item;
        switch (title) {
            case 'ZoomIn':
                handleZoomIn();
                break;
            case 'ZoomOut':
                handleZoomOut();
                break;
            case 'Categories':
                setCategory(true);
                break;
            case 'Scanner':
                setScanner(true);
                break;
            case 'Tools':
                addToolsWindow(event);
                break;
            default:
                break;
        }
    };

    const items = [
        {
            label: '',
            icon: <i className={`pi  visible-element ${istools ? 'pi-wrench' : 'pi-spin pi-spinner'}`} style={{ fontSize: '1rem' }} title="Tools"></i>,
            command: handleItemClick,
            title: 'Tools',
            ref: toolsButtonRef // Attach the ref here
        },
        {
            label: '',
            icon: <i className="pi pi-qrcode visible-element" style={{ fontSize: '1rem' }} title="Scanner"></i>,
            command: handleItemClick,
            title: 'Scanner'
        },
        // {
        //     label: '',
        //     icon: <i className="pi pi-list visible-element" style={{ fontSize: '1rem' }} title="Categories"></i>,
        //     command: handleItemClick,
        //     title: 'Categories'
        // },
        {
            label: '',
            icon: <i className="pi pi-plus-circle visible-element" style={{ fontSize: '1.3rem' }} title="Zoom in"></i>,
            command: handleItemClick,
            title: 'ZoomIn'
        },
        {
            label: '',
            icon: <i className="pi pi-minus-circle visible-element" style={{ fontSize: '1.3rem', color: 'rgb(208, 208, 208)' }} title="Zoom Out"></i>,
            command: handleItemClick,
            title: 'ZoomOut',
        }
    ];

    return (
        <MotionDiv
            className='zoom motion-right-hud-panel motion-tools-panel'
            variants={hudToolVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ x: -2 }}
        >
           <EnvSetting op={op} />
            <Menu model={items} style={{ width: 'auto', background: 'transparent', border: 0, boxShadow: 'none' }} />
        </MotionDiv>
    );
}
