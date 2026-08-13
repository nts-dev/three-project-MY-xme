
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import useGame from "../hooks/useGame";
import AppInventory from "./AppInventory.jsx";
import HudFrame from "./HudFrame.jsx";
import { publicAssetCssUrl } from "./publicAssetUrl";
import './index.css'
import { enPc } from "../threejs/player/puzzle/character/Constants.jsx";

const MotionDiv = motion.div;
const buttonBgUrl = publicAssetCssUrl("button-bg.svg");

const toastVariants = {
    hidden: { opacity: 0, y: 14, scale: 0.96, filter: "blur(5px)" },
    visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, y: 10, scale: 0.96, filter: "blur(5px)" },
};

const HudMeter = ({ value, variant }) => {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

    return (
        <div className={`game-bottom-meter game-bottom-meter--${variant}`}>
            <div className="game-bottom-meter__track">
                <span className="game-bottom-meter__fill" style={{ width: `${safeValue}%` }} />
            </div>
        </div>
    );
};

const PlayerStatusHud = () => {
    const hp = useGame((state) => state.hp);
    const [energy, setEnergy] = useState(enPc.current);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setEnergy(enPc.current);
        }, 250);

        return () => window.clearInterval(timer);
    }, []);

    return (
        <div className="game-bottom-status">
            <div className="game-bottom-status__header">
                <span className="game-bottom-meter__label">HEALTH</span>
                <span className="game-bottom-status__value">{Math.round(Math.max(0, Math.min(100, Number(hp) || 0)))}</span>
                <span className="game-bottom-status__value">{Math.round(Math.max(0, Math.min(100, Number(energy) || 0)))}</span>
                <span className="game-bottom-meter__label game-bottom-meter__label--right">ENERGY</span>
            </div>
            <div className="game-bottom-status__tracks">
                <HudMeter value={hp} variant="health" />
                <HudMeter value={energy} variant="energy" />
            </div>
        </div>
    );
};

const HudButton = ({ children, onClick }) => (
    <button
        type="button"
        className="game-bottom-action"
        onClick={(event) => {
            event.currentTarget.blur();
            onClick?.();
        }}
    >
        {children}
    </button>
);

const HudActions = () => {
    const restart = useGame((state) => state.restart);
    const resetGame = useGame((state) => state.resetGame);
    const setRestart = useGame((state) => state.setRestart);
    const setResetGame = useGame((state) => state.setResetGame);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const setPauseGame = useGame((state) => state.setPauseGame);

    return (
        <HudFrame className="game-bottom-actions" contentClassName="game-bottom-actions__content">
            <HudButton
                onClick={() => {
                    setButtonMode("Play mode");
                    setPauseGame(false);
                }}
            >
                PLAY MODE
            </HudButton>
            <HudButton onClick={() => setResetGame(!resetGame)}>NEW GAME</HudButton>
            <HudButton onClick={() => setRestart(!restart)}>RESTART</HudButton>
        </HudFrame>
    );
};

const MotionHudToasts = ({ messages }) => (
    <div className="game-hud-toasts" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
            {messages.map((message) => (
                <MotionDiv
                    key={message.id}
                    className={`game-hud-toast game-hud-toast--${message.severity || "info"}`}
                    variants={toastVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ type: "spring", stiffness: 330, damping: 26 }}
                    layout
                >
                    {message.summary && <span className="game-hud-toast__summary">{message.summary}</span>}
                    {message.detail && <span className="game-hud-toast__detail">{message.detail}</span>}
                </MotionDiv>
            ))}
        </AnimatePresence>
    </div>
);

export default function InventoryUi() {

    const itemsDictionary = useGame((state) => state.itemsDictionary);
    const firstPerson = useGame((state) => state.firstPerson);
    const character = useGame((state) => state.character);
    const hasDied = useGame((state) => state.hasDied);
    // const clicked = useGame((state) => state.clicked);

    const itemList = useMemo(() =>
        Object.values(itemsDictionary).filter(item => item.active !== false),
        [itemsDictionary]
    );
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (firstPerson || character || hasDied) {
            setVisible(true);
        } else {
            setVisible(false);
        }
    }, [firstPerson, character, hasDied]);

    const [toastMessages, setToastMessages] = useState([]);
    const toastTimers = useRef(new Map());

    const showToast = useCallback((message) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const life = Number(message?.life) || 2400;
        const nextMessage = { ...message, id };

        setToastMessages((current) => [...current.slice(-2), nextMessage]);

        const timer = window.setTimeout(() => {
            setToastMessages((current) => current.filter((item) => item.id !== id));
            toastTimers.current.delete(id);
        }, life);

        toastTimers.current.set(id, timer);
    }, []);

    useEffect(() => {
        return () => {
            toastTimers.current.forEach((timer) => window.clearTimeout(timer));
            toastTimers.current.clear();
        };
    }, []);

    const toast = useMemo(() => ({ current: { show: showToast } }), [showToast]);

    if (!visible) {
        return null;
    }

    return (
        <div
            className="game-bottom-hud popup-player-inventory-max"
            style={{ "--game-button-bg-url": buttonBgUrl }}
        >
            <div className="game-bottom-hud__inventory">
                <span className="game-bottom-hud__title">INVENTORY</span>
                <AppInventory itemList={itemList} toast={toast}/>
            </div>
            <PlayerStatusHud />
            <HudActions />
            <MotionHudToasts messages={toastMessages}/>
        </div>
    )
}
