import {Avatar} from "primereact/avatar";
import {OverlayPanel} from "primereact/overlaypanel";
import {Button} from "primereact/button";
import * as React from "react";
import {useEffect, useRef, useState} from "react";
import {Badge} from "primereact/badge";
import { toggle } from '../../features/menuBar/menuSlice';
import {useDispatch} from "react-redux";
import useGame from "../../hooks/useGame";

export default function UserProfile() {
    const op = useRef<OverlayPanel>(null);
    const dispatch = useDispatch();
    const [profile, setProfile] = useState(false)
    const [msg, setMgg] = useState(false)
    const branch = useGame((state: any) => state.branch) || 'No branch selected';

    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    useEffect(() => {
        let timer: NodeJS.Timeout | null | undefined = null
        // if(profile){
        //     timer = setTimeout(() => {
        //         dispatch(toggle('isUserProfile'));
        //     }, 6000);
        // }
        if(msg){
            timer = setTimeout(() => {
                dispatch(toggle('isMessage'));
            }, 6000);
        }

        // Cleanup the timer if component unmounts or scannedId changes
        return () => {
            if(timer){
                clearTimeout(timer)
                setMgg(false)
                // setProfile(false)
            }


        };
    }, [profile,msg]);

    return (

        <div className="flex align-items-center gap-2 mr-2 ">
            <div className="project-header">
                {!isMobileDevice() && branch}
            </div>

            <Avatar
                image={`${import.meta.env.VITE_JSON_URL}/icons/avatar.PNG`}
                shape="circle"
                style={{borderRadius: '6rem', cursor: 'pointer'}}
                onClick={(e) => op.current?.toggle(e)} // Toggle overlay panel on click
            />
            <OverlayPanel ref={op} style={{minWidth: '12rem'}}>
                <div className="flex flex-column p-2">
                    <Button
                        label="Profile"
                        icon="pi pi-user"
                        className="p-button-text p-button-plain text-left"
                        style={{justifyContent: 'flex-start'}} // Align icon and text left
                        onClick={()=>{
                            dispatch(toggle('isUserProfile'))
                            setProfile(true)
                        }}
                    />
                    <Button
                        label="Messages"
                        icon="pi pi-envelope"
                        className="p-button-text p-button-plain text-left"
                        style={{justifyContent: 'flex-start'}}
                        onClick={()=>{
                            dispatch(toggle('isMessage'))
                            setMgg(true)
                    }
                        }

                    >
                        <Badge value="9+" severity="danger"></Badge>
                    </Button>
                    <Button
                        label="Logout"
                        icon="pi pi-sign-out"
                        className="p-button-text p-button-plain  text-left"
                        style={{justifyContent: 'flex-start'}}
                    />
                </div>
            </OverlayPanel>

        </div>


    );

}
