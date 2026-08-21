import React, { useCallback, useEffect, useState } from "react";
import { FaVrCardboard } from "react-icons/fa";
import useGame from "../../../../hooks/useGame";
import { xrStore } from "../../../../threejs/xr/xrStore";

const getXrSession = () => xrStore.getState?.().session || null;

export default function VrViewButton() {
    const [isSupported, setIsSupported] = useState(false);
    const [isPresenting, setIsPresenting] = useState(Boolean(getXrSession()));
    const setButtonMode = useGame((state) => state.setButtonMode);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setCharacter = useGame((state) => state.setCharacter);

    useEffect(() => {
        let isMounted = true;

        const supportPromise = navigator.xr?.isSessionSupported?.("immersive-vr");
        if (supportPromise) {
            supportPromise
                .then((supported) => {
                    if (isMounted) setIsSupported(Boolean(supported));
                })
                .catch(() => {
                    if (isMounted) setIsSupported(false);
                });
        } else {
            setIsSupported(false);
        }

        const unsubscribe = xrStore.subscribe((state) => {
            setIsPresenting(Boolean(state.session));
        });

        return () => {
            isMounted = false;
            unsubscribe?.();
        };
    }, []);

    const toggleVr = useCallback(async () => {
        const session = getXrSession();
        if (session) {
            await session.end();
            return;
        }

        setButtonMode("Play mode");
        setFirstPerson(true);
        setCharacter(false);
        await xrStore.enterVR();
    }, [setButtonMode, setCharacter, setFirstPerson]);

    return (
        <button
            type="button"
            className={`play-view-controls__button play-view-controls__button--vr${isPresenting ? " is-active" : ""}`}
            aria-label={isPresenting ? "Exit VR" : "Enter VR"}
            aria-checked={isPresenting}
            data-tooltip={isSupported ? (isPresenting ? "Exit VR" : "Enter VR") : "VR unavailable"}
            disabled={!isSupported}
            role="radio"
            onClick={toggleVr}
        >
            <FaVrCardboard className="play-view-controls__svg-icon play-view-controls__svg-icon--vr" aria-hidden="true" />
        </button>
    );
}
