import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import {Menubar} from 'primereact/menubar';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import useGame from "../hooks/useGame";
import {Toast} from 'primereact/toast';
import {MultiSelect} from "primereact/multiselect";
import { useSelector,useDispatch } from 'react-redux';
import { toggle } from '../features/menuBar/menuSlice';
import {useGetDataQuery} from "../features/data/data";
import UserProfile from "./user-profile/UserProfile";
import FloorItems from "./floor-items/FloorItems.jsx";
import Profile from "./user-profile/Profile";
import Message from "./messages/Message";

export default function MenuBar() {
    const dispatch = useDispatch();

    const fps = useGame((state: any) => state.fps);
    const setFps = useGame((state: any) => state.setFps);
    const walls = useSelector((state: any) => state.menu.walls);
    const anims = useSelector((state: any) => state.menu.anims);
    const playersList = useSelector((state: any) => state.menu.playersList);
    const grid = useGame((state: any) => state.grid);
    const setGrid = useGame((state: any) => state.setGrid);
    const isMap = useGame((state: any) => state.map);
    const setMap = useGame((state: any) => state.setMap);
    const roof = useGame((state: any) => state.roof);
    const setRoof = useGame((state: any) => state.setRoof);
    const multiplayer = useGame((state: any) => state.multiplayer);
    const setMultiplayer = useGame((state: any) => state.setMultiplayer);
    const info = useSelector((state: any) => state.menu.info);
    const channel = useGame((state: any) => state.channel);
    const setChannel = useGame((state: any) => state.setChannel);
    const setChannelEvent = useGame((state: any) => state.setChannelEvent);
    const setGridlEvent = useGame((state: any) => state.setGridlEvent);
    const setDotEvent = useGame((state: any) => state.setDotEvent);
    const setDevicePath = useGame((state: any) => state.setDevicePath);
    const location = useGame((state: any) => state.location);
    const setLocation= useGame((state: any) => state.setLocation);
    const jumpPoints= useGame((state: any) => state.jumpPoints);
    const setJumpPoints= useGame((state: any) => state.setJumpPoints);
    const setJumpPointsEvent = useGame((state: any) => state.setJumpPointsEvent);
    const reload = useGame((state: any) => state.reload);
    const setReload= useGame((state: any) => state.setReload);
    const dot = useGame((state: any) => state.dots);
    const label = useGame((state: any) => state.label);
    const setLabel = useGame((state: any) => state.setLabel);
    const setDots = useGame((state: any) => state.setDots);
    const toast = useRef<Toast>(null);
    const projectID = useGame((state: any) => state.projectID);
    const [selectedPaths, setSelectedPaths] = useState([]);
    const [devices, setDevices] = useState<any>([])
    const setDisplayDialog = useGame((state: any) => state.setDisplayDialog);
    const displayDialog = useGame((state: any) => state.displayDialog);
    const assetEdit = useGame((state: any) => state.assetEdit);
    const setEditEvent = useGame((state: any) => state.setEditEvent);
    const setAssetEdit = useGame((state: any) => state.setAssetEdit);
    const documents = useGame((state: any) => state.documents);
    const setDocuments = useGame((state: any) => state.setDocuments);
    const setDocumentsEvent = useGame((state: any) => state.setDocumentsEvent);
    const annotations = useGame((state: any) => state.annotations);
    const setAnnotations = useGame((state: any) => state.setAnnotations);
    const setSound = useGame((state: any) => state.setSound);
    const sound = useGame((state: any) => state.sound);
    const lights = useGame((state: any) => state.lights);
    const setLights = useGame((state: any) => state.setLights);
    const hideAssets = useGame((state: any) => state.hideAssets);
    const setHideAssets = useGame((state: any) => state.setHideAssets);
    const searchQrCode = useGame((state: any) => state.searchQrCode);
    const setSearchQrCode = useGame((state: any) => state.setSearchQrCode);
    const showCamControls = useGame((state: any) => state.showCamControls);
    const setShowCamControls = useGame((state: any) => state.setShowCamControls);

    const insertLocations = useGame((state: any) => state.insertLocations);
    const setInsertLocations = useGame((state: any) => state.setInsertLocations);
    const { data, error, isLoading } = useGetDataQuery(`/devices`)


    useEffect(() => {

        setLabel(false)
        setGrid(false)
        setLabel(false)
        setMap(false)
        setRoof(false)

    }, [projectID]);
    useEffect(() => {
        setDevices(data);
    }, [data]);

    const selectDevice = (event: any) => {
        if(event.value.length==0){
            setDevicePath([])

        }
        const ids = event.value.map((value: any) => value.code);

        if(ids.length>0){
            fetch(`${import.meta.env.VITE_API_URL}/paths/${ids.join(',')}`)
                .then(response => response.json())
                .then((data) => {
                    setDevicePath(data)
                })
                .catch((error) => {
                    console.error('Error fetching paths:', error);
                });
        }
        setSelectedPaths(event.value)

    }



    const handleItemClick = (event: any) => {
        if (event.originalEvent.target.parentNode.tagName != "DIV") {
            return
        }


        const {title} = event.item;

        switch (title) {

            case 'Walls':
                // renderAnimIcon(event.originalEvent.target.parentNode, walls)
                if (toast.current)
                    toast.current.show({
                        severity: 'success',
                        summary: 'Success',
                        detail: !walls ? 'Showing Walls' : 'Walls Hidden',
                        life: 3000
                    });
                dispatch(toggle('walls'));
                // setWalls(!walls);

                break;
            case 'Animations':
                dispatch(toggle('anims'));
                // setAnims(!anims);
                // renderAnimIcon(event.originalEvent.target.parentNode, anims)
                break;
            case 'Fps':
                // renderAnimIcon(event.originalEvent.target.parentNode, fps)
                setFps(!fps)
                break;
            case 'Players':
                // renderAnimIcon(event.originalEvent.target.parentNode, playersList)
                if (toast.current)
                    toast.current.show({
                        severity: 'success',
                        summary: 'Success',
                        detail: !playersList ? 'Showing players list' : 'Players list Hidden',
                        life: 3000
                    });
                dispatch(toggle('playersList'));
                //setPlayersGrid(!players)
                setGridlEvent(event)
                break;
            case 'Grid':
                // renderAnimIcon(event.originalEvent.target.parentNode, grid)
                setGrid(!grid)
                break;

            case 'Map':
                // renderAnimIcon(event.originalEvent.target.parentNode, isMap)
                setMap(!isMap)
                break;

            case 'Roof':
                // renderAnimIcon(event.originalEvent.target.parentNode, roof)
                setRoof(!roof)
                break;

            case 'Multiplayer':
                // renderAnimIcon(event.originalEvent.target.parentNode, multiplayer)
                setMultiplayer(!multiplayer)
                break;
            case 'Lights':
                // renderAnimIcon(event.originalEvent.target.parentNode, lights)
                setLights(!lights)
                break;

            case 'Info':
                // renderAnimIcon(event.originalEvent.target.parentNode, info)
                dispatch(toggle('info'));
                break;

            case 'Channels':
                // renderAnimIcon(event.originalEvent.target.parentNode, channel)
                setChannel(!channel)
                setChannelEvent(event)
                break;

            case 'Sound':
                // renderAnimIcon(event.originalEvent.target.parentNode, sound)
                setSound(!sound)
                // setCategoryEvent(event)
                break;

            case 'Reload':
                // setCheckReload(!checkReload)
                setReload(!reload)
                break;

            case 'Dots':
                // renderAnimIcon(event.originalEvent.target.parentNode, dot)
                setDots(!dot)
                setDotEvent(event)
                break;
            case 'Labels':
                // renderAnimIcon(event.originalEvent.target.parentNode, label)
                setLabel(!label)
                break;
            case 'Playback':
                // renderAnimIcon(event.originalEvent.target.parentNode, displayDialog)
                setDisplayDialog(!displayDialog)
                break;

            case 'JumpPoints':
                // renderAnimIcon(event.originalEvent.target.parentNode, jumpPoints)
                setJumpPoints(!jumpPoints)
                setJumpPointsEvent(event)
                break;
            case 'Location':
                // renderAnimIcon(event.originalEvent.target.parentNode, location)
                setLocation(!location)
                // setJumpPointsEvent(event)
                break;
            case 'AssetEdit':
                // renderAnimIcon(event.originalEvent.target.parentNode, darkTheme)
                setAssetEdit(!assetEdit)
                setEditEvent(event)
                break;
            case 'Documents':
                // renderAnimIcon(event.originalEvent.target.parentNode, documents)
                setDocuments(!documents)
                setDocumentsEvent(event)
                break;

            case 'Annotations':
                // renderAnimIcon(event.originalEvent.target.parentNode, annotations)
                setAnnotations(!annotations)

                break;

            case 'Show All Assets':
                // renderAnimIcon(event.originalEvent.target.parentNode, annotations)
                setHideAssets(!hideAssets)

                break;
            case 'Camera Controls':
                // renderAnimIcon(event.originalEvent.target.parentNode, annotations)
                setShowCamControls(!showCamControls)

                break;
            default:
                break;
        }
    };




    const renderIcon = (isTrue: boolean, icon0: string, icon1: string, text: string) => {
        const image = isTrue ? <img src={`./icons/${icon1}.png`} alt={`${text}`} style={{width: '18px', height: '18px'}}
                                    title={`Hide ${text}`}/> :
            <img src={`./icons/${icon0}.png`} alt={`${text}`} style={{width: '18px', height: '18px'}}
                 title={`Show ${text}`}/>
        return <div style={{display: 'flex'}}>
            {image}
            <span className='menuitem-text'>{text}</span>
        </div>

    };

    const items: any =  [
        {
            label: (
                <div className='camera'>
                    <MultiSelect value={selectedPaths} onChange={selectDevice} options={devices} optionLabel="name"
                                 style={{minWidth: '4rem'}} placeholder="Path Animations" maxSelectedLabels={1} />
                </div>
            )

        },
        {
            label: (
                <FloorItems colorValue={false}/>

            )
        },

        {
            label: '',
            icon: renderIcon(walls, 'wall0', 'wall1', 'Walls'),
            command: handleItemClick,
            title: 'Walls',
            Tooltip: 'Test',
            className: 'menu-item'
        },
        {
            label: '',
            icon: renderIcon(playersList, 'player0', 'player1', 'Players'),
            command: handleItemClick,
            title: 'Players',
            className: 'menu-item'
        },
        {
            label: '',
            icon: renderIcon(lights, 'light0', 'light1', 'Lights'),
            command: handleItemClick,
            title: 'Lights',
            className: 'menu-item'
        },
        {
            label: '',
            icon: renderIcon(anims, 'Animations', 'Animations', 'Animations'),
            command: handleItemClick,
            title: 'Animations',
        },
        {
            label: '',
            icon: renderIcon(info, 'info0', 'info1', 'Info'),
            command: handleItemClick,
            title: 'Info'
        },
        {
            label: '',
            icon: renderIcon(jumpPoints, 'jump1', 'jump1', 'JumpPoints List'),
            command: handleItemClick,
            title: 'JumpPoints',
            className: 'menu-item'
        },
        {
            label: '',
            icon: renderIcon(location, 'location0', 'location1', 'Pin Locations'),
            command: handleItemClick,
            title: 'Location'
        },
        {
            label: '',
            icon: renderIcon(hideAssets, 'hideAssets0', 'hideAssets1', 'Show All Assets'),
            command: handleItemClick,
            title: 'Show All Assets',
        },
        {
            label: '',
            icon: renderIcon(documents, 'document0', 'document1', 'Documents'),
            command: handleItemClick,
            title: 'Documents',
        },
        {
            label: '',
            icon: renderIcon(sound, 'sound0', 'sound1', 'Sound'),
            command: handleItemClick,
            title: 'Sound',
        },
        {
            label: '',
            icon: renderIcon(channel, 'tv0', 'tv1', 'Channels'),
            command: handleItemClick,
            title: 'Channels',
        },
        {
            label: '',
            icon: renderIcon(annotations, 'annotation0', 'annotation1', 'Annotations'),
            command: handleItemClick,
            title: 'Annotations',
        },

        {
            label: '',
            icon: renderIcon(dot, 'dot1', 'dot1', 'Dots'),
            command: handleItemClick,
            title: 'Dots',
        },

        {
            label: '',
            icon: renderIcon(reload, 'Reload', 'Reload', 'Reload'),
            command: handleItemClick,
            title: 'Reload',
            className: 'menu-item'
        },
        {
            label: '',
            icon: renderIcon(displayDialog, 'navigate', 'navigate', 'Playback'),
            command: handleItemClick,
            title: 'Playback'
        },
        {
            label: '',
            icon: renderIcon(assetEdit, 'edit0', 'edit1', 'Edit Asset'),
            command: handleItemClick,
            title: 'AssetEdit',
            className: 'edit-asset'
        },
        {
            label: '',
            icon: renderIcon(showCamControls, 'cam0', 'cam1', 'Camera Controls'),
            command: handleItemClick,
            title: 'Camera Controls',
            className: 'menu-item'
        },
        {
            label: '',
            icon: renderIcon(grid, 'hide', 'show', 'Grid'),
            command: handleItemClick,
            title: 'Grid',
            className: 'menu-item'
        },
        {
            label: '',
            icon: renderIcon(label, 'hide', 'show', 'Labels'),
            command: handleItemClick,
            title: 'Labels',
            className: 'menu-item'
        },
        {
            label: '',
            icon: renderIcon(isMap, 'hide', 'show', 'Map'),
            command: handleItemClick,
            title: 'Map',
            className: 'menu-item'
        },
        {
            label: '',
            icon: renderIcon(roof, 'hide', 'show', 'Roof'),
            command: handleItemClick,
            title: 'Roof',
            className: 'menu-item'
        },

    ]




    // useEffect(() => {
    //     if (projectID==147) {
    //         // Add Roof button if it's not already there
    //         setItems((prevItems:any) => {
    //             const hasNew = prevItems.some((item: any) => item.title === 'New');
    //             if (!hasNew) {
    //                 return [
    //                     ...prevItems,
    //                     {
    //                         label: '',
    //                         icon: renderIcon(true, 'new', 'new', 'New'),
    //                         command: handleItemClick,
    //                         title: 'New'
    //                     },
    //                     {
    //                         label: '',
    //                         icon: renderIcon(true, 'new', 'save', 'Save'),
    //                         command: handleItemClick,
    //                         title: 'Save'
    //                     }
    //                 ];
    //             }
    //             return prevItems;
    //         });
    //     } else {
    //         // Remove Roof button
    //         setItems((prevItems: any) => prevItems.filter((item: { title: string; }) => item.title !== 'New'));
    //     }
    // }, [projectID]);


    const handleKeyDown = (event: any) => {
        // Check if the pressed key is an arrow key
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    useEffect(() => {
        const button = document.querySelector('.p-menubar-button');
        if (button) {
            // Remove the existing SVG
            const svgIcon = button.querySelector('svg');
            if (svgIcon) {
                svgIcon.remove();
            }
            // Create a new icon element
            const newIcon = document.createElement('i');
            newIcon.className = 'pi pi-cog';
            // Insert the new icon at the beginning of the button
            button.insertBefore(newIcon, button.firstChild);
        }
    }, [])


    return (
        <div className='menu-bar' >
            <Menubar model={items} style={{padding: "0px"}} onKeyDown={handleKeyDown} end={UserProfile()}/>
            <Toast ref={toast}/>
            <Profile/>
            <Message/>
        </div>
    );
}
