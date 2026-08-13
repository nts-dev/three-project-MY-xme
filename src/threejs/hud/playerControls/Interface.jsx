import useInterface from '../../../hooks/stores/useInterface';
import { useEffect, useRef, useCallback } from 'react';
import { addEffect } from '@react-three/fiber';
import useGame from "../../../hooks/useGame";
import { useGame1 } from "../../../hooks/useGame1";
import { socket } from "../../../socket";
import confetti from 'canvas-confetti';

export default function Interface() {
    const time = useRef();
    const coins = useRef();
    const rLives = useRef();
    const restart = useInterface((state) => state.restart);
    const phase = useInterface((state) => state.phase);
    const setNoOfCoins = useGame((state) => state.setNoOfCoins);
    const timeout = useInterface((state) => state.timeout);
    const noOfCoins = useGame((state) => state.noOfCoins);
    const timeoutRef = useRef(null);
    const setHasDied = useGame((state) => state.setHasDied);
    const hasDied = useGame((state) => state.hasDied);
    const setHp = useGame((state) => state.setHp);
    const isRecovering = useGame((state) => state.isRecovering);
    const setIsRecovering = useGame((state) => state.setIsRecovering);
    const noOfLivesRemaining = useGame((state) => state.noOfLivesRemaining);
    const setNoOfLivesRemaining = useGame((state) => state.setNoOfLivesRemaining);
    const recover = useGame1((state) => state.recover);
    const userData = useGame((state) => state.userData);
    const clientId = useGame((state) => state.clientId);
    const setSoundUrl = useGame((state) => state.setSoundUrl);
    const totalCoins = useGame((state) => state.totalCoins) || 10;
    const keys = useGame((state) => state.keys);
    const pauseGame = useGame((state) => state.pauseGame);
    const toMainMenu = useGame((state) => state.toMainMenu);
    const pausedAtRef = useRef(null);   // when pause started
    const pausedAccumRef = useRef(0);                  // total ms paused so far
    const frozenElapsedRef = useRef(0);

    /** Celebration when the game ends */
    const startCelebration = useCallback(() => {
            confetti({
                particleCount: 200,
                startVelocity: 50,
                spread: 90,
                origin: { y: 0.8 }
            });


    }, []);

    /** Gold Coin Celebration when a coin is collected */
    const coinCelebration = useCallback(() => {
        const confettiContainer = document.getElementById('timer');
        if (!confettiContainer) return;
        const rect = confettiContainer.getBoundingClientRect();

        confetti({
            particleCount: 50,
            shapes: ['circle'],
            spread: 90,
            startVelocity: 25,
            scalar: 1.5,
            origin: {
                x: (rect.left + rect.width / 2) / window.innerWidth,
                y: (rect.top + rect.height / 2) / window.innerHeight,
            },
            colors: ['#FFD700', '#FFEC8B', '#DAA520'], // Gold color
        });
    }, []);

    useEffect(() => {
        const unsubscribeEffect = addEffect(() => {
            const state = useInterface.getState();
            const isPaused =
                state.phase === 'paused'  || pauseGame === true || toMainMenu === true;

            const TIMEOUT_MS = 12_000_000; // your 12000000
            let elapsedMs = 0;

            // --- END/FAIL phases -------------------------------------------------
            if (state.phase === 'ended') {
                setSoundUrl('game_over.mp3');
                // lock in final time (subtract any paused time that happened before end)
                elapsedMs = Math.max(0, (state.endTime - state.startTime) - pausedAccumRef.current);
                if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
            } else if (state.phase === 'timeout') {
                setSoundUrl('game_fail.mp3');
                if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
                // fall through to show whatever time is already frozen
            }

            // --- PLAYING / PAUSED handling --------------------------------------
            if (state.phase === 'playing') {
                if (isPaused) {
                    // first frame of pause
                    if (pausedAtRef.current == null) {
                        pausedAtRef.current = Date.now();
                        frozenElapsedRef.current =
                            Math.max(0, (Date.now() - state.startTime) - pausedAccumRef.current) / 1000;
                        // stop the timeout while paused
                        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
                    }
                    // show frozen time while paused
                    elapsedMs = (frozenElapsedRef.current * 1000);
                } else {
                    // resuming from pause
                    if (pausedAtRef.current != null) {
                        pausedAccumRef.current += Date.now() - pausedAtRef.current;
                        pausedAtRef.current = null;
                    }
                    // normal ticking time minus total paused duration
                    elapsedMs = Math.max(0, (Date.now() - state.startTime) - pausedAccumRef.current);

                    // (re)arm timeout for the remaining time
                    if (!timeoutRef.current) {
                        const remaining = Math.max(0, TIMEOUT_MS - elapsedMs);
                        timeoutRef.current = setTimeout(() => {
                            if (useInterface.getState().phase === 'playing') {
                                timeout(isRecovering);
                            }
                        }, remaining);
                    }
                }
            }

            // --- render the clock ------------------------------------------------
            const secs = elapsedMs / 1000;
            const minutes = Math.floor(secs / 60);
            const seconds = Math.floor(secs % 60);
            const milliseconds = (secs % 1).toFixed(1).slice(2);
            const formattedTime =
                `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${milliseconds}`;

            if (time.current) time.current.textContent = formattedTime;
        });

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            unsubscribeEffect();
        };
    }, [pauseGame, startCelebration,toMainMenu]);


    useEffect(() => {
        socket.emit("playerRank", {
            clientId,
            userName: userData.fullname,
            noOfLivesRemaining,
            status: phase,
            finishTime: time.current?.textContent,
            noOfCoins
        });

        if(phase=='ended'){

            startCelebration();
        }

    }, [noOfCoins, noOfLivesRemaining, phase]);

    useEffect(() => {
        if (noOfCoins > 0) coinCelebration();
    }, [noOfCoins, coinCelebration]);

    const onRestart = useCallback(() => {
        restart();
        // setNoOfCoins(0);
        setNoOfLivesRemaining(3);
        setHp(100);
        setHasDied(false);
    }, [restart, setNoOfCoins, setNoOfLivesRemaining, setHasDied, setHp]);

    const onContinue = useCallback(() => {
        if (noOfLivesRemaining < 1) return;

        setHasDied(false);
        setIsRecovering(true);
        timeout(true);
        recover();
        setNoOfLivesRemaining(noOfLivesRemaining - 1);

        setTimeout(() => {
            setIsRecovering(false);
        }, 1000);
    }, [noOfLivesRemaining, recover, setHasDied, setIsRecovering, setNoOfLivesRemaining, timeout]);

    return (
        <div>
            <div id='timer' className={phase === 'ended' ? "time finish" : phase === 'timeout' ? "time failed" : "time"}>
                <div className="interface">
                    <div className="header-section">
                        <div className="header">Time</div>
                        <div ref={time}>00:00:00</div>
                    </div>
                    <div className="header-section">
                        <div className="header">Coins</div>
                        <div ref={coins}>{noOfCoins}/{totalCoins}</div>
                    </div>
                    <div className="header-section">
                        <div className="header">Lives</div>
                        <div ref={rLives}>{noOfLivesRemaining}</div>
                    </div>
                    <div className="header-section">
                        <div className="header">Keys</div>
                        <div >{keys}</div>
                    </div>
                </div>
                {(phase === 'ended' || phase === 'timeout') && (
                    <div className="header">
                        {phase === 'timeout' ? "Failed!" : "Passed!"}
                    </div>
                )}
            </div>

            {(phase === 'ended' || phase === 'timeout') && (
                <div className="restart" onClick={onRestart}>
                    Restart
                </div>
            )}

            {hasDied && (
                <div
                    className={`restart life ${noOfLivesRemaining < 1 ? "disabled" : ""}`}
                    onClick={noOfLivesRemaining < 1 ? null : onContinue}
                >
                    {noOfLivesRemaining < 1
                        ? "You are out of lives, please restart"
                        : "Continue"}
                </div>
            )}
        </div>
    );
}
