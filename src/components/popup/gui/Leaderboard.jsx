import React, { useCallback, useEffect,  useState } from "react";
import "./Leaderboard.css";
import { socket } from "../../../socket";
import { debounce } from "lodash";
import {useSelector} from "react-redux";
import useGame from "../../../hooks/useGame";
import useInterface from "../../../hooks/stores/useInterface.jsx";

export default function Leaderboard({ onClose }) {
    const playerRanks = useSelector((state) => state.menu.playerRanks);
    const [playerList, setPlayerList] = useState([]);
    const noOfLivesRemaining = useGame((state) => state.noOfLivesRemaining);
    const userData = useGame((state) => state.userData);
    const phase = useInterface((state) => state.phase);
    const noOfCoins = useGame((state) => state.noOfCoins);
    const clientId = useGame((state) => state.clientId);

    const rankUpdate = useCallback(
        debounce((data) => {

            setPlayerList((prevList) => {
                const updatedList = [...prevList];
                data.forEach((update) => {
                    const index = updatedList.findIndex((player) => player.clientId === update.clientId);
                    if (index > -1) {
                        updatedList[index] = { ...updatedList[index], ...update };
                    } else {
                        updatedList.push(update);
                    }
                });

                return updatedList;
            });
        }, 3),
        [playerRanks]
    );

    useEffect(() => {

        if (playerRanks) {
            const refreshRanks = () => {
                socket.emit("playerRank");
            };

            refreshRanks();
            socket.on("rankUpdate", rankUpdate);
            socket.on("playersUpdate", refreshRanks);
            socket.on("remotePlayers", refreshRanks);
            return () => {
                socket.off("rankUpdate", rankUpdate);
                socket.off("playersUpdate", refreshRanks);
                socket.off("remotePlayers", refreshRanks);
            };
        }
    }, [playerRanks, rankUpdate]);

    return (
        <div className="leaderboard-container">


            <div className="leaderboard-scroll-wrapper">
                <button className="close-button" onClick={onClose}>✕</button>
                <h1 className="leaderboard-title">LEADERBOARDS</h1>
                <div className="leaderboard-table-wrapper">
                    <table className="leaderboard-table">
                        <thead>
                        <tr>
                            <th>Ranking</th>
                            <th>Player</th>
                            <th>Level</th>
                            <th>BU</th>
                            <th>Points</th>
                        </tr>
                        </thead>
                        <tbody>
                        {playerList
                            .sort((a, b) => a.rank - b.rank)
                            .map((player, index) => (
                                <tr key={player.clientId || index}>
                                    <td>{player.rank}</td>
                                    <td>{player.name}</td>
                                    <td>{player.level}</td>
                                    <td>{player.bu*100}</td>
                                    <td>{player.points}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button className="back-button" onClick={onClose}>Back</button>
                </div>

            </div>
        </div>
    );
}
