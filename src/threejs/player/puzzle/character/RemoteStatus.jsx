import { Html } from "@react-three/drei";
import { memo } from "react";

function RemoteStatus({ userName, hpPct, enPct }) {


    return (
        <Html
            transform                      // ✅ scales with distance
            sprite                         // ✅ always face camera
            distanceFactor={0.1}            // ✅ adjust scaling responsiveness
            position={[0, 0.11, 0]}        // above head
            zIndexRange={[100, 0]}
            className="stat-ui"
            style={{ pointerEvents: "none", willChange: "transform" }} // ✅ GPU hint
        >
            <div className="stat-bars">
                <div className="stat-name" title={userName}>
                    {userName}
                </div>

                <div
                    className={`stat-bar stat-bar--health ${
                        hpPct <= 20 ? "is-empty" : ""
                    }`}
                >
                    <div
                        className="stat-bar__fill"
                        style={{ width: `${hpPct}%` }}
                    />
                </div>

                <div
                    className={`stat-bar stat-bar--energy ${
                        enPct <= 20 ? "is-empty" : ""
                    }`}
                >
                    <div
                        className="stat-bar__fill"
                        style={{ width: `${enPct}%` }}
                    />
                </div>
            </div>
        </Html>
    );
}

export default memo(RemoteStatus);
