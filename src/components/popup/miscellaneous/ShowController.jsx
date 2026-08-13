import React from "react";
import useGame from "../../../hooks/useGame";

const ShowController = () => {

    const setControlClose= useGame((state) => state.setControlClose);
    const controlClose= useGame((state) => state.controlClose);

    if (!controlClose) return null;

    return (
        <div className="controlKeys-wrap">
            <img
                className="controlKeys"
                src={`${import.meta.env.VITE_FILE_URL}/keyControls.png`}
                alt="control keys"
                draggable="false"
            />
            <button
                className="controlKeys-close"
                aria-label="Close controls"
                onClick={() => setControlClose(false)}
            >
                ✕
            </button>
        </div>
    );
};

export default ShowController;
