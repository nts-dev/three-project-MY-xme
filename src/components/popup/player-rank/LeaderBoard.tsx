import React, { useMemo } from 'react';
import { AnimatePresence, motion } from "motion/react";
import HudFrame from '../../../puzzleUi/HudFrame.jsx';

const MotionDiv = motion.div;
const MotionButton = motion.button;
const MotionLi = motion.li;

const panelVariants = {
    hidden: { opacity: 0, x: 20, y: -10, scale: 0.96, filter: "blur(6px)" },
    visible: {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        transition: {
            type: "spring",
            stiffness: 290,
            damping: 28,
            staggerChildren: 0.045,
            delayChildren: 0.08,
        },
    },
    exit: { opacity: 0, x: 20, scale: 0.96, filter: "blur(6px)", transition: { duration: 0.16 } },
};

const rowVariants = {
    hidden: { opacity: 0, x: 14 },
    visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
    exit: { opacity: 0, x: 14, transition: { duration: 0.14 } },
};

const formatScore = (value: number) => {
    const score = Number(value) || 0;
    return score >= 1000 ? (score / 1000).toFixed(3) : score.toFixed(0);
};

const getPlayerRankKey = (row: any, index: number) => {
    return row.clientId || row.name || row.userName || row.username || `${row.rank ?? "rank"}-${index}`;
};

const normalizeRows = (data: any[]) => {
    const rows = Array.isArray(data) ? data : [];
    return [...rows]
        .sort((a: any, b: any) => Number(a.rank || 0) - Number(b.rank || 0))
        .map((row: any, index: number) => ({
            rank: row.rank || index + 1,
            name: row.name || row.userName || row.username || "",
            points: formatScore(row.points),
            objectives: Number(row.bu ?? row.objectives ?? 13),
            clientId: getPlayerRankKey(row, index),
        }));
};

const LeaderBoard = ({ data, onClose }: any) => {
    const rows = useMemo(() => normalizeRows(data), [data]);

    const closeLeaderboard = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
    };

    return (
        <HudFrame
            as={MotionDiv}
            className="game-leaderboard"
            contentClassName="game-leaderboard__content"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
        >
            <div className="game-leaderboard__chrome">
                <div className="game-leaderboard__title">
                    <span className="game-leaderboard__glyph" />
                    <span>Ranked: LeaderBoard</span>
                </div>
                <div className="game-leaderboard__scope">Global</div>
                <MotionButton
                    type="button"
                    className="game-leaderboard__close"
                    onClick={closeLeaderboard}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.92 }}
                    aria-label="Close leaderboard"
                >
                    x
                </MotionButton>
            </div>

            <div className="game-leaderboard__columns">
                <span>R.P.U Survivors</span>
                <span>Score</span>
                <span>Objectives</span>
            </div>

            <ol className="game-leaderboard__rows">
                <AnimatePresence initial={false}>
                    {rows.map((row) => (
                        <MotionLi
                            key={row.clientId}
                            className="game-leaderboard__row"
                            variants={rowVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout
                            whileHover={{ x: -3, scale: 1.01 }}
                        >
                            <span className="game-leaderboard__rank">{row.rank}</span>
                            <span className="game-leaderboard__avatar" />
                            <span className="game-leaderboard__name">{row.name}</span>
                            <span className="game-leaderboard__score">{row.points}</span>
                            <span className="game-leaderboard__objectives">{row.objectives}</span>
                        </MotionLi>
                    ))}
                </AnimatePresence>
            </ol>
        </HudFrame>
    );
};

export default LeaderBoard;
