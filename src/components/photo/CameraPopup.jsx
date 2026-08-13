import useGame from "../../hooks/useGame";
import {Dialog} from 'primereact/dialog';

import CaptureCamera from "./CaptureCamera";

export default function CameraPopup() {
    const isCamera = useGame((state) => state.isCamera);
    const setIsCamera = useGame((state) => state.setIsCamera);

    return (
        <Dialog header="Camera" visible={isCamera} position={'bottom-right'} style={{width: '100%',maxHeight: '100%'}} modal={false} onHide={() => {
            if (!isCamera) return;
            setIsCamera(false);
        }} draggable={false} resizable={false}>
            <CaptureCamera/>
        </Dialog>
    )

}
