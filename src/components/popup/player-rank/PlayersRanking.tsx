import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { debounce } from 'lodash';
import { AnimatePresence, motion } from 'motion/react';
import { toggle } from '../../../features/menuBar/menuSlice';
import { socket } from '../../../socket';
import LeaderBoard from "./LeaderBoard";

const MotionButton = motion.button;
const MotionDiv = motion.div;

const getPlayerRankKey = (player: any, index?: number) => {
    return (
        player?.clientId ||
        player?.name ||
        player?.userName ||
        player?.username ||
        `${player?.rank ?? "rank"}-${index ?? 0}`
    );
};

const sortPlayerRanks = (players: any[]) => {
    return [...players].sort((a: any, b: any) => Number(a.rank || 0) - Number(b.rank || 0));
};

export default function PlayersRanking() {
    const dispatch = useDispatch();
    const playerRanks = useSelector((state: any) => state.menu.playerRanks);
    const [playerList, setPlayerList] = useState<any[]>([]);

    const rankUpdate = useCallback(
        debounce((data: any[]) => {
            const updates = Array.isArray(data) ? data : [];
            setPlayerList((prevList) => {
                const updatedList = [...prevList];
                updates.forEach((update: any, updateIndex: number) => {
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
                return sortPlayerRanks(updatedList);
            });
        }, 3),
        []
    );

    useEffect(() => {
        const refreshRanks = () => {
            socket.emit("playerRank");
        };

        refreshRanks();
        socket.on('rankUpdate', rankUpdate);
        socket.on('playersUpdate', refreshRanks);
        socket.on('remotePlayers', refreshRanks);

        return () => {
            socket.off('rankUpdate', rankUpdate);
            socket.off('playersUpdate', refreshRanks);
            socket.off('remotePlayers', refreshRanks);
        };
    }, [rankUpdate]);

    const closeLeaderboard = useCallback(() => {
        if (playerRanks) {
            dispatch(toggle('playerRanks'));
        }
    }, [dispatch, playerRanks]);

    const openLeaderboard = useCallback(() => {
        if (!playerRanks) {
            dispatch(toggle('playerRanks'));
        }
    }, [dispatch, playerRanks]);

    return (
        <MotionDiv className="game-leaderboard-host">
            <AnimatePresence>
                {!playerRanks && (
                    <MotionButton
                        type="button"
                        className="game-leaderboard-restore"
                        onClick={openLeaderboard}
                        initial={{ opacity: 0, x: 22, scale: 0.88, filter: "blur(5px)" }}
                        animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, x: 22, scale: 0.88, filter: "blur(5px)" }}
                        whileHover={{ y: -2, scale: 1.04 }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ type: "spring", stiffness: 360, damping: 24 }}
                    >
                        Ranked: LeaderBoard
                    </MotionButton>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {playerRanks && (
                    <LeaderBoard data={playerList} onClose={closeLeaderboard} />
                )}
            </AnimatePresence>
        </MotionDiv>
    );
}
