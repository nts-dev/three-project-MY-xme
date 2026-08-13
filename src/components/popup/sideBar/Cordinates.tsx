import * as React from 'react';
import {Dialog} from "primereact/dialog";
import useGame from "../../../hooks/useGame";

export default function Cordinates() {
    const dots = useGame((state:any)  => state.dots);
    const setDots = useGame((state:any)  => state.setDots);
    const cordinates = useGame((state:any)  => state.cordinates);

    return (
        <div >
            <Dialog  header="Dot Cordinates"  modal={false}   visible={dots} position='bottom' style={{ width: '50vw' }}
                     onHide={() => {if (!dots) return; setDots(false); }}
                     draggable={false} resizable={false}
                     className='popup-player-list'>

                {cordinates.map((coordinate:string, index: number) => (
                    <div  key={index}>
                        <p>{coordinate}</p>
                        {index < cordinates.length - 1 && <div className="fade-line"></div>}
                    </div>
                ))}

            </Dialog>
        </div>
    );
}
