import {Toast} from "primereact/toast";
import  {useEffect, useRef,useCallback} from "react";
import HelperMessage from "../hud/inventory/HelperMessage";
import useGame from "../../hooks/useGame";
import "../../components/popup/gui/confirm.css";
import confetti from 'canvas-confetti';

export default function Notification() {
    const msgs: any = useRef(null);
    const { id, header,text, htmlCode,position, timeout } = useGame((state: any) => state.notification)

    

  const coinCelebration = useCallback(() => {
        const confettiContainer = document.getElementById('notification');
        if (!confettiContainer) return;
        const rect = confettiContainer.getBoundingClientRect();

        confetti({
            particleCount: 50,
            shapes: ['circle'],
            spread: 90,
            startVelocity: 25,
            scalar: 1.5,
            origin: {
                x: (rect.left + rect.width / 2) / window.innerWidth,
                y: (rect.top + rect.height / 2) / window.innerHeight,
            },
            colors: ['#FFD700', '#FFEC8B', '#DAA520'], // Gold color
        });
        
    }, []);

    useEffect(() => {
        if(header && text  && position){
            HelperMessage(msgs, header, text, htmlCode,timeout);

            setTimeout(()=>{

                coinCelebration()
            }, 1000)
        }
            

    }, [ id, header, text, htmlCode, position, timeout, coinCelebration]);

    if(header && text  && position){
        return (
            <Toast
                ref={msgs}
                position={position}

            />
        )
    }

    return null
}
