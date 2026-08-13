import React, { useState } from "react";
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import useGame from "../../../hooks/useGame";
import DetailGrid from "../grid/DetailGrid";
import DetailTree from "../grid/DetailTree";

export default function DetailPopup() {
    const showDetails = useGame((state) => state.showDetails);
    const setShowDetails = useGame((state) => state.setShowDetails);
    const indexId = useGame((state) => state.indexId);
    return (
        <div className="card flex justify-content-center">
            <Dialog header="Select Items" visible={showDetails} style={{ width: '50vw' }} onHide={() => {if (!showDetails) return; setShowDetails(false); }}>
                {indexId=='362' ?<DetailTree/>: <DetailGrid/> }
            </Dialog>
        </div>
    )
}
