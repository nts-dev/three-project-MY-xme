import { Menubar } from "primereact/menubar";
import { Toast } from "primereact/toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import useGame from "../../hooks/useGame";

import {PrimeReactProvider} from "primereact/api";
import ColorPickerComponent from "./ColorPickerComponent";
import {objects} from "../../threejs/player/puzzle/character/Constants.jsx";

const MotionButton = motion.button;

export default function IconMenu({ scene }) {
    const toast = useRef();
    const loaded = useRef(false);
    const [items, setItems] = useState([]);
    const selectedItem = useRef(null);
    const [clicked,setClicked] = useState(false)

    const keyMaps = {
        main: useRef(new Map()).current,
        hAlign: useRef(new Map()).current,
        vAlign: useRef(new Map()).current,
    };

    const {
        selectedAssetName,
        setSelectedAssetName,
        reload,
        setReload,
        deleteObject,
        setDeleteObject,
        fbxNames,
        setVAlignValue,
        setRotationValue,
        setDeleteAssetId,
        isSelected,
        setIsSelected,
        setSelectedAssetIdNumber,
        mainIconMap,
        setMainIconMap
    } = useGame((state) => state);

    const renderIcon = (icon) => {


        const assetId = objects[icon] ? `id-${objects[icon]?.assetID}` : icon

        return (<div className={assetId} style={{ display: "flex", alignItems: "center", gap: "6px", padding:'0.2rem' }}>
            <img
                src={`/icons/${icon}.png`}
                alt={icon}
                style={{ width: "18px", height: "18px", maxWidth: "none" }}
                title={icon}
            />
            <span className="menuitem-text">{icon}</span>
        </div>)
    }

    const fireConfetti = () => {
        confetti({
            particleCount: 90,
            spread: 70,
            origin: { y: 0.12 },
            scalar: 0.9,
        });

        setTimeout(() => {
            confetti({
                particleCount: 45,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.18 },
            });
            confetti({
                particleCount: 45,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.18 },
            });
        }, 120);
    };

    const renderConfettiButton = () => (
        <MotionButton
            type="button"
            className="motion-confetti-button"
            title="Confetti"
            aria-label="Show confetti"
            onClick={fireConfetti}
            initial={false}
            animate={{ rotate: [0, -4, 4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            whileHover={{ scale: 1.08, rotate: 0 }}
            whileTap={{ scale: 0.92 }}
        >
            <i className="pi pi-sparkles" aria-hidden="true" />
        </MotionButton>
    );


    const updateKeyMap = (keyMap,title,  enable) => {

        keyMap.forEach((_, key) => {
            keyMap.set(key, false);
        });
        if (enable) {
            keyMap.set(title, true);
        }
        return keyMap

    };


    const toggleGlowingEffect = (keyMap, title, className, enable) => {
        // First remove the class from all elements in keyMap
        keyMap.forEach((_, key) => {
            const elements = document.querySelectorAll(`.${key}`);
            elements.forEach(el => {
                const parent = el;
                if (parent) parent.classList.remove(className);
            });

        });

        // Then add it back if "enable" is true
        if (enable) {
            const elements = document.querySelectorAll(`.${title}`);
            elements.forEach(el => {
                const parent = el;
                if (parent) parent.classList.add(className);
            });

        }
        updateKeyMap(keyMap, title, enable)
    };


    const onMenuClick = ({ item: { title } }) => {
        const assetIdVal = objects[title] ? `id-${objects[title]?.assetID}` : title;

        const wasSelected = mainIconMap.get(assetIdVal);

        const assetId = objects[title]?.assetID;
        const willBeSelected = !wasSelected;

        if (title === "Delete") {
            setDeleteObject(!deleteObject);

        } else {
            setDeleteObject(false);
            setDeleteAssetId(0);
        }


            setIsSelected(willBeSelected);
           const newMap = updateKeyMap(mainIconMap, assetIdVal, willBeSelected)
            setMainIconMap(newMap)
        setClicked(!clicked)


        // toggleGlowingEffect(keyMaps.main, title, "glowing-element", willBeSelected);
        selectedItem.current = willBeSelected ? title : null;

        if(willBeSelected && title !== "Delete"  ){
            setSelectedAssetName(title);
            setSelectedAssetIdNumber(assetId)
        }
        if(title === "Delete" && !willBeSelected){
            setDeleteObject(false);
            setDeleteAssetId(0);
        }

    };

    const orientationMenuClick = ( title, orientationKeyMap, orientation) => {
        const wasSelected = orientationKeyMap.get(title);
        const willBeSelected = !wasSelected;
        const className =
            orientation === "hAlign"
                ? "glowing-element-orientation"
                : "glowing-element-orientation-vertical";


        toggleGlowingEffect(orientationKeyMap, title, className, willBeSelected);

        if (willBeSelected && orientation === "hAlign") {
            const rotations = { right: 0, left: 180, up: 90, down: 270 };
            setRotationValue(rotations[title]);
        }else if (willBeSelected && orientation === "vAlign") {

            const movements = { top: 0.1, center: 0.05, bottom: 0};
            
            setVAlignValue(movements[title]);
        }

    };




    const orientationMenus =  useMemo(
        () => {
            const orientationMenu = (items, orientation, keyMap) =>{

                return items.map((name) => ({
                    label: "",
                    icon: renderIcon(name),
                    command: () => orientationMenuClick(name, keyMap, orientation),
                    title: name,
                }))
            }

            const hAlign = orientationMenu(["right", "left", "up", "down"], "hAlign", keyMaps.hAlign)
            const vAlign = orientationMenu(["top", "center", "bottom"], "vAlign", keyMaps.vAlign)
            return {
                hAlign: hAlign,
                vAlign: vAlign
            }
            } ,
        []
    );

    useEffect(() => {
       const assetId = objects[selectedAssetName] ? `id-${objects[selectedAssetName]?.assetID}` : selectedAssetName || 'Delete';

       setTimeout(()=> toggleGlowingEffect(mainIconMap, assetId, "glowing-element", isSelected),150)

    }, [selectedAssetName,isSelected,mainIconMap]);

    const baseItems = useMemo(() => [
        {
            label: "Confetti",
            template: renderConfettiButton,
            title: "Confetti",
            className: "menu-item motion-confetti-menu-item",
        },
        {
            label: "",
            icon: renderIcon("Reload"),
            command: () => setReload(!reload),
            title: "Reload",
            className: "menu-item",
        },
        {
            label: "",
            icon: renderIcon("Delete"),
            command: onMenuClick,
            title: "Delete",
            className: "menu-item",
        },
        {
            label: "Color Picker",
            template: () => (
                <ColorPickerComponent/>
            ),
            title: "Color Picker",
            className: "menu-item color-picker-menu-item",
        }
    ], [onMenuClick]);

    useEffect(() => {
        const itemsList = [
            ...fbxNames.filter((name) => !name.includes("Character") && !name.includes("platform"))
                .map((name) => ({
                    label: "",
                    icon: renderIcon(name),
                    command: onMenuClick,
                    title: name,
                    className: "menu-item",
                })),

        ];

        setItems([
            ...baseItems,
            ...itemsList,
            ...orientationMenus.hAlign,
            ...orientationMenus.vAlign,
        ]);


    }, [fbxNames,clicked, isSelected,mainIconMap]);


    useEffect(() => {
        if (!selectedAssetName) return;

        if(selectedAssetName !== "Delete"){
            setDeleteObject(false);

            const elements = document.querySelectorAll(`.Delete`);
            elements.forEach(el => {
                const parent = el?.parentElement?.parentElement;
                if (parent) parent.classList.remove("glowing-element")
            });

            keyMaps.main.set('Delete', false);
        }



        const setDefaultOrientation = (title, keyMap, className) => {

                keyMap.forEach((_, key) => {

                    const elements = document.querySelectorAll(`.${key}`);

                    elements.forEach(el => {
                        const parent = el;

                        if (parent) parent.classList.remove(className)
                    });

                    keyMap.set(key, false);
                });
       


            const item = items.find((item) => item.title === title);

            if (item) {

                const elements = document.querySelectorAll(`.${title}`);
                elements.forEach(el => {
                    const parent = el;
                    if (parent) parent.classList.add(className);
                });
                keyMap.set(title, true);

            }
        };

        setTimeout(()=>{
            setDefaultOrientation("bottom", keyMaps.vAlign, "glowing-element-orientation-vertical");
           setDefaultOrientation("right", keyMaps.hAlign, "glowing-element-orientation")
        },150);


    }, [selectedAssetName]);

    useEffect(() => {
        setTimeout(()=>{

 const button = document.querySelector('.p-menubar-button');
    
        if (button && !loaded.current) {
            loaded.current = true
            // Remove the existing SVG
            const svgIcon = button.querySelector('svg');
            if (svgIcon) {
                svgIcon.remove();
            }
            // Create a new icon element
            const newIcon = document.createElement('i');
            newIcon.className = 'pi pi-cog';
            newIcon.style.fontSize = '1rem'
            // Insert the new icon at the beginning of the button
            button.insertBefore(newIcon, button.firstChild);
        }

        }, 500)
       
    }, [])



    return (
       <PrimeReactProvider>
        <div className="menu-bar">
            <Menubar model={items} style={{ padding: "0px" }}  />
            <Toast ref={toast} />

        </div>
       </PrimeReactProvider>

    );
}
