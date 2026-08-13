import useGame from "../../../hooks/useGame";
import {Dialog} from 'primereact/dialog';
import QrReader from "../../../components/scanner/QrReader";

export default function QrPopup() {
    const scanner = useGame((state: any) => state.scanner);
    const setScanner = useGame((state: any) => state.setScanner);

    return (

        <Dialog header="Scanner" visible={scanner} position={'bottom-right'} style={{width: '100vw'}} modal={false} onHide={() => {
            if (!scanner) return;
            setScanner(false);
        }} draggable={false} resizable={false}>
            <QrReader/>
        </Dialog>
    )

}
