
import * as React from 'react';
import { Sidebar } from 'primereact/sidebar';
import {useEffect} from "react";
import useGame from "../../../hooks/useGame";
import JumpPointTree from './JumpPointTree.jsx';

export default function Jumpoints() {
    const jumpPoints: boolean =  useGame((state: any) => state.jumpPoints)
    const setJumpPoints: any =  useGame((state: any) => state.setJumpPoints)
    const jumpPointsEvent: any =  useGame((state: any) => state.jumpPointsEvent)

    useEffect(()=>{
        if(jumpPointsEvent==null){
            return
        }
            const event = jumpPointsEvent.originalEvent.target.parentNode

        if( event.parentNode.tagName=="LI" ){
            jumpPoints? event.classList.add('box-shadow'): event.classList.remove('box-shadow')
        } else{
            jumpPoints? event.parentNode.parentNode.classList.add('box-shadow'): event.parentNode.parentNode.classList.remove('box-shadow')
        }
    },[jumpPoints])



    const customHeader = (
        <div className="flex align-items-center gap-2">
               <span style={{fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px'}}>
                   Jump Points
                </span>
        </div>
    );

    return (
        <div className="card flex justify-content-center">
            <Sidebar
                className="jump-points categories"
                header={customHeader}
                visible={jumpPoints}
                position="right"

                onHide={() => setJumpPoints(false)}>
                <JumpPointTree/>
            </Sidebar>
        </div>
    )
}
