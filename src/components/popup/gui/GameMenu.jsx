import React, { useState, useEffect, useRef } from "react";
import "./style.css";
import { ProgressBar } from "primereact/progressbar";
import { Toast } from "primereact/toast";
import useGame from "../../../hooks/useGame";
import Leaderboard from "./Leaderboard.jsx";
import Options from "./Options.jsx"; // 👈 import your leaderboard component

function shouldSkipMenuFromUrl() {
    if (typeof window === "undefined") {
        return false;
    }

    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("projectId") || window.__NTS_RESOLVED_LAUNCH_PARAMS?.projectId || "";
    const isLevelProject = typeof projectId === "string" && /_L\d+$/i.test(projectId);

    if (isLevelProject) {
        return true;
    }

    return params.get("mode") === "edit"
        || params.get("skipMenu") === "1"
        || params.get("source") === "theia";
}

const GameMenu = () => {
    const setCharacter = useGame((state) => state.setCharacter);
    const branch = useGame((state) => state.branch);
    const toMainMenu = useGame((state) => state.toMainMenu)
    const setButtonMode = useGame((state) => state.setButtonMode);
    const projectId = useGame((state) => state.projectID);


    const [click, setClick] = useState(false);
    const [progress, setProgress] = useState(0);
    const [loaded, setLoaded] = useState(true);
    const [showLeaderboard, setShowLeaderboard] = useState(false); // 👈 new state
    const [showOptions, setShowOptions] = useState(false); // 👈 new state
    const toast = useRef(null);
    const interval = useRef(null);
    const setConfirmationObj = useGame((state) => state.setConfirmationObj);

    const menuItems = [
        "START GAME",
        "EDIT MODE",
        "MULTIPLAYER",
        "LEADERBOARDS",
        "OPTIONS",
        "CREDITS",
        "ENTER VR",
        "CONTINUE",
        "QUIT GAME",
    ];

    const handleClick = (item) => {
        if (item === "START GAME") {
            setClick(true);
        }
        else if (item === "LEADERBOARDS") {
            setShowLeaderboard(true);
        }
        else if (item === "OPTIONS") {
            setShowOptions(true);
        }
        else if (item === "EDIT MODE") {

            setLoaded(true);
            setButtonMode('Edit Mode')
        }
         else if (item === "CONTINUE") {

            setLoaded(true);
            // setButtonMode('Edit Mode')
        }
        else if (item === "QUIT GAME") {

            const obj = {
                visible:true,
                message:"Do you want to quit the game",
                response:false,
                setResponse:setLoaded,
                quit:true
            }
            setConfirmationObj(obj)

        }
    };

    useEffect(() => {
        if (!click) return;

        const duration = 2000; // 2 seconds
        const intervalMs = 50; // update every 50ms
        const steps = duration / intervalMs;
        let currentStep = 0;

        interval.current = setInterval(() => {
            currentStep++;
            const newProgress = Math.min((currentStep / steps) * 100, 100);
            setProgress(newProgress);

            if (newProgress >= 100) {
                clearInterval(interval.current);
                toast.current.show({
                    severity: "info",
                    summary: "Success",
                    detail: "Game Loaded",
                });
                setTimeout(() => {
                    setButtonMode('Play mode');
                    setCharacter(true);
                    setLoaded(true);
                }, 500);
            }
        }, intervalMs);

        return () => {
            if (interval.current) {
                clearInterval(interval.current);
                interval.current = null;
            }
        };
    }, [click, setButtonMode, setCharacter]);

    const onClose = () => {
        setShowLeaderboard(false); // This will return to the main menu
        setShowOptions(false)
    };
    useEffect(() => {
        if (!shouldSkipMenuFromUrl()) {
            return;
        }

        setLoaded(true);
    }, [projectId]);

    useEffect(() => {
        if (toMainMenu) {
            setClick(false);
            setLoaded(false);
            setShowLeaderboard(false);
            setShowOptions(false);
        }
    }, [toMainMenu]);

   if (loaded) return null;

    if (click) {
        return (
            <div className="game-loading-panel">
                <Toast ref={toast} />
                <div className="loading-title">{branch}</div>
                <div className="loading-bar">
                    <ProgressBar value={progress} style={{ height: "10px" }} />
                </div>
                <div className="circular-loading-screen">
                    <div className="loading-ring">
                        <div className="ring ring-blue outer"></div>
                        <div className="ring ring-orange middle"></div>
                        <div className="ring ring-blue inner"></div>
                    </div>
                    <div className="loading-text">LOADING...</div>
                </div>
            </div>
        );
    }

    if (showLeaderboard) {
        return <Leaderboard onClose={onClose} />; // Pass onClose to Leaderboard
    }
    if (showOptions) {
        return <Options onClose={onClose} />; // Pass onClose to Leaderboard
    }

    return (
        <div className="game-menu-panel">
            <h1 className="game-title">{branch}</h1>
            <ul className="menu-list">
                {menuItems.map((item, index) => (
                    <li key={index} className="menu-item">
                        <div
                            onClick={() => handleClick(item)}
                            aria-label={item}
                            className="menu-button"
                        >
                            {item}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default GameMenu;
