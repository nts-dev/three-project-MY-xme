import React, { useEffect, useState } from "react";
import useGame from "../../../hooks/useGame";
import { ProgressBar } from "primereact/progressbar";
import {socket} from "../../../socket";
import {Dialog} from "primereact/dialog";

export default function WaitingScreen() {
    const branch = useGame((state) => state.branch);
    const TOTAL_TIME = 90; // seconds
    const [time, setTime] = useState(TOTAL_TIME);
    const [progress, setProgress] = useState(0);
    const [pulse, setPulse] = useState(false);
    const waiting = useGame((state) => state.waiting);
    const setWaiting = useGame((state) => state.setWaiting);
    const [menuItems, setMenuItems] = useState([]); // now dynamic
    const [visible, setVisible] = useState(false); // now dynamic

    // 🔹 Listen to backend events instead of running local timer



    useEffect(() => {
        console.log(waiting)
        if(waiting==='true'){
            setVisible(true)
        }else {
            setVisible(false)
        }

    }, [waiting]);



    useEffect(() => {
        // Timer updates from backend
        socket.on("timerUpdate", ({ timeLeft }) => {
            console.log(timeLeft)
            setTime(timeLeft);
            setPulse(true);
            setTimeout(() => setPulse(false), 300);

            const newProgress = ((TOTAL_TIME - timeLeft) / TOTAL_TIME) * 100;
            setProgress(newProgress.toFixed(0));
        });

        // Player list updates
        socket.on("playerList", ({ players }) => {
            // players expected as array of usernames from backend
            setMenuItems(players || []);
        });

        // When game starts or fails
        socket.on("startGame", ({ message }) => {
            console.log(message || "Game starting!");
            setWaiting('false')
            setProgress(100);
        });

        socket.on("notEnoughPlayers", ({ message }) => {
            console.warn(message || "Not enough players, restarting...");
            setProgress(0);
            setTime(TOTAL_TIME);
        });

        return () => {
            socket.off("timerUpdate");
            socket.off("playerList");
            socket.off("startGame");
            socket.off("notEnoughPlayers");
        };
    }, []);

    const title =
        time > 10
            ? `Waiting for other ${Math.max(6 - menuItems.length, 0)} players...`
            : `Game starting in ${time} seconds...`;

    return (

        <div className="game-confirm-wrapper">
            <Dialog
                visible={visible}
                modal
                className={"game-dialog-waiting"}
                content={({ hide }) => {
                    return (
                    <div className="circular-loading-screen-waiting">
                        <div className="u-waiting-screen">
                            <h1 className="game-title">{branch}</h1>

                            <div className="m-waiting-screen">
                                <div>
                                    <h2>{title}</h2>
                                </div>

                                <div className="countdown-circle bubble">
                        <span className={`count-text ${pulse ? "pulse" : ""}`}>
                            {time}
                        </span>
                                </div>

                                <div>
                                    <button className="p-button-waiting">Leave Game</button>
                                </div>
                            </div>
                        </div>

                        <div className="t-waiting-screen">
                            <div className="b-waiting-screen">
                                <ul className="menu-list">
                                    <div className="elements list-header">Joined Players</div>
                                    {menuItems.map((item, index) => (
                                        <li key={index} className="menu-item">
                                            <div className="elements ">{`${index + 1}. ${item}`}</div>
                                        </li>
                                    ))}

                                    {/* Fill remaining slots with Skeletons */}
                                    {Array.from({length: 6 - menuItems.length}).map((_, i) => {
                                        const number = menuItems.length + i + 1;
                                        return (
                                            <li key={`skeleton-${i}`} className="menu-item">
                                                <div className="elements ">
                                                    <div className={"player-record"}>{`${number}.`}</div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>

                            <div className="loading-bar">
                                <ProgressBar value={progress} style={{height: "10px"}}/>
                            </div>

                            <div className="loading-ring">
                                <div className="ring ring-blue outer"></div>
                                <div className="ring ring-orange middle"></div>
                                <div className="ring ring-blue inner"></div>
                            </div>
                        </div>
                    </div>
                    )
                }}
            ></Dialog>
        </div>
    );
}
