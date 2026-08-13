import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addEffect } from "@react-three/fiber";
import { socket } from "../../../socket";
import useGame from "../../../hooks/useGame";
import { horizontalSpeed, realTimeChaPosition } from "../../../threejs/player/puzzle/character/Constants.jsx";

const formatScore = (value) => {
    const score = Number(value) || 0;
    return score >= 1000 ? (score / 1000).toFixed(3) : score.toFixed(0);
};

const formatRuntime = (elapsedMs) => {
    const totalCentiseconds = Math.floor(Math.max(0, elapsedMs) / 10);
    const centiseconds = totalCentiseconds % 100;
    const totalSeconds = Math.floor(totalCentiseconds / 100);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0"),
        String(centiseconds).padStart(2, "0"),
    ];
};

const TIMER_UPDATE_MS = 50;

const getPlayerRankKey = (player, index = 0) => {
    return (
        player?.clientId ||
        player?.name ||
        player?.userName ||
        player?.username ||
        `${player?.rank ?? "rank"}-${index}`
    );
};

export default function TopScoreboard() {
    const [playerList, setPlayerList] = useState([]);
    const timePartRefs = useRef([]);
    const lastPositionRef = useRef(realTimeChaPosition.clone());
    const startTimeRef = useRef(null);
    const lastTimerUpdateRef = useRef(0);

    const clientId = useGame((state) => state.clientId);
    const userData = useGame((state) => state.userData);
    const uName = useGame((state) => state.uName);
    const noOfCoins = useGame((state) => state.noOfCoins);
    const totalCoins = useGame((state) => state.totalCoins);
    const pauseGame = useGame((state) => state.pauseGame);
    const toMainMenu = useGame((state) => state.toMainMenu);

    const rankUpdate = useCallback((data = []) => {
        const updates = Array.isArray(data) ? data : [];
        setPlayerList((prevList) => {
            const updatedList = [...prevList];
            updates.forEach((update, updateIndex) => {
                const updateKey = getPlayerRankKey(update, updateIndex);
                const index = updatedList.findIndex((player, playerIndex) => {
                    return getPlayerRankKey(player, playerIndex) === updateKey;
                });
                if (index > -1) {
                    updatedList[index] = { ...updatedList[index], ...update };
                } else {
                    updatedList.push(update);
                }
            });
            return [...updatedList].sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0));
        });
    }, []);

    useEffect(() => {
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
    }, [rankUpdate]);

    useEffect(() => {
        const unsubscribe = addEffect(() => {
            if (pauseGame || toMainMenu) return;

            const now = performance.now();
            const positionDelta = realTimeChaPosition.distanceTo(lastPositionRef.current);
            const isMoving = horizontalSpeed.current > 0.01 || positionDelta > 0.0005;
            lastPositionRef.current.copy(realTimeChaPosition);

            if (!startTimeRef.current && isMoving) {
                startTimeRef.current = now;
            }

            if (!startTimeRef.current) return;

            if (now - lastTimerUpdateRef.current < TIMER_UPDATE_MS) return;
            lastTimerUpdateRef.current = now;

            const elapsedMs = now - startTimeRef.current;
            formatRuntime(elapsedMs).forEach((part, index) => {
                const node = timePartRefs.current[index];
                if (node && node.textContent !== part) {
                    node.textContent = part;
                }
            });
        });

        return () => unsubscribe();
    }, [pauseGame, toMainMenu]);

    const currentRow = useMemo(() => {
        const rows = [...playerList].sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0));
        const matchingPlayer = rows.find((player) => clientId && player.clientId === clientId);
        const row = matchingPlayer || rows[0] || {};

        return {
            rank: row.rank || 1,
            name: row.name || row.userName || row.username || uName || userData?.fullname || "",
            points: formatScore(row.points ?? noOfCoins * 100),
            objectives: Number(row.bu ?? row.objectives ?? totalCoins ?? 13),
        };
    }, [clientId, noOfCoins, playerList, totalCoins, uName, userData?.fullname]);

    return (
        <div className="game-top-scoreboard" aria-label="Scoreboard">
            <div className="game-top-scoreboard__title">Scoreboard</div>
            <div className="game-top-scoreboard__columns">
                <span>R.P.U Survivors</span>
                <span>Score</span>
                <span>Objectives</span>
            </div>
            <div className="game-top-scoreboard__row">
                <span className="game-top-scoreboard__rank">{currentRow.rank}</span>
                <span className="game-top-scoreboard__avatar" />
                <span className="game-top-scoreboard__name">{currentRow.name}</span>
                <span className="game-top-scoreboard__score">{currentRow.points}</span>
                <span className="game-top-scoreboard__objectives">{currentRow.objectives}</span>
            </div>
            {/* <div className="game-top-scoreboard__timer" aria-label="Elapsed movement time">
                {formatRuntime(0).map((part, index) => (
                    <span
                        key={index}
                        ref={(node) => {
                            timePartRefs.current[index] = node;
                        }}
                        className="game-top-scoreboard__time-part"
                    >
                        {part}
                    </span>
                ))}
            </div> */}
        </div>
    );
}
