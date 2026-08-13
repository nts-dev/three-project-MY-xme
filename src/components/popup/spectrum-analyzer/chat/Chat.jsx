import { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { socket } from "../../../../socket";
import useGame from "../../../../hooks/useGame";
import database from "../../../../database";
import HudFrame from "../../../../puzzleUi/HudFrame.jsx";
import AudioSpectrum from "../AudioSpectrum.jsx";
import ChatCommandInput from "./ChatCommandInput";
import { parseCommandText } from "./chatCommandParser";
import "../style.css";

const MotionDiv = motion.div;
const MotionButton = motion.button;

const hudPanelVariants = {
    hidden: { opacity: 0, x: -18, y: 16, scale: 0.97, filter: "blur(6px)" },
    visible: {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        transition: {
            type: "spring",
            stiffness: 260,
            damping: 25,
            staggerChildren: 0.045,
            delayChildren: 0.08,
        },
    },
};

const hudChildVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.98 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 300, damping: 24 },
    },
};

const messageVariants = {
    hidden: { opacity: 0, x: -10, filter: "blur(3px)" },
    visible: {
        opacity: 1,
        x: 0,
        filter: "blur(0px)",
        transition: { type: "spring", stiffness: 330, damping: 26 },
    },
    exit: { opacity: 0, x: 10, filter: "blur(3px)", transition: { duration: 0.16 } },
};

function Chat({ isMinimized = false, onToggleHud }) {
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState("");

    const userData = useGame((state) => state.userData);
    const uName = useGame((state) => state.uName);
    const terminalMessage = useGame((state) => state.terminalMessage);

    const chatRef = useRef(null);
    const lastTerminalMessageRef = useRef(null);
    const userChatsCollection = useMemo(
        () => database.collections.get("user_chats"),
        []
    );

    // Helper to validate and convert timestamp
    const getValidDate = (timestamp) => {
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? new Date() : date; // Fallback to current time if invalid
    };

    // 1) Load full chat history (all users)
    useEffect(() => {
        const loadHistory = async () => {
            const allChats = await userChatsCollection.query().fetch();
            const formattedChats = allChats.map((chat) => ({
                userId: chat._raw.user_id,
                text: chat._raw.text,
                userName: chat._raw.user_name,
                timestamp: getValidDate(chat.timestamp),
                isCommand: chat._raw.is_command === "true",
            }));
            setMessages(formattedChats);
        };
        loadHistory();
    }, [userChatsCollection]);

    // 2) Listen for incoming messages (broadcast)
    useEffect(() => {
        const onMessage = (msg) => {
            if (msg.relationId === userData.relationId || msg.userId === userData.relationId) {
                return;
            }
            const formattedMsg = {
                ...msg,
                timestamp: getValidDate(msg.timestamp),
                isCommand: msg.isCommand === "true",
            };
            setMessages((prev) => [...prev, formattedMsg]);
        };
        socket.on("message", onMessage);
        return () => socket.off("message", onMessage);
    }, [userData.relationId]);

    // 3) Scroll to bottom + insert to DB
    useEffect(() => {
        if (messages.length === 0) return;
        const last = messages[messages.length - 1];

        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
        if (last.relationId > 0 && !last._raw?.id) {
            insertMessageInDb(last);
        }
    }, [messages]);

    useEffect(() => {
        if (!terminalMessage?.message || lastTerminalMessageRef.current?.id === terminalMessage.id) {
            return;
        }

        const command = terminalMessage.command
            ? `#${String(terminalMessage.command).trim().replace(/^#\s*/, "")} `
            : "";

        setMessages((prev) => [
            ...prev,
            {
                text: `${command}${terminalMessage.message}`,
                timestamp: new Date(),
                userName: terminalMessage.userName || "system",
                relationId: terminalMessage.relationId || 0,
                isCommand: Boolean(terminalMessage.command),
                isTerminal: true,
            },
        ]);
        lastTerminalMessageRef.current = terminalMessage;
    }, [terminalMessage]);

    const insertMessageInDb = async (message) => {
        await database.write(async () => {
            await userChatsCollection.create((record) => {
                record.userId = message.relationId;
                record.text = message.text;
                record.timestamp = message.timestamp.toISOString();
                record.userName = message.userName;
                record.isCommand = message.isCommand.toString();
            });
        });
    };

    const sendChatMessage = (raw) => {
        const msg = {
            text: raw,
            timestamp: new Date(),
            userName: uName || "Unknown",
            relationId: userData.relationId || 0,
            isCommand: false,
        };

        socket.emit("message", msg);
        setMessages((prev) => [...prev, msg]);
    };

    const handleClear = async () => {
        setMessages([]);
        const userMessages = await userChatsCollection.query().fetch();
        await database.write(async () => {
            await Promise.all(userMessages.map((record) => record.markAsDeleted()));
        });
    };

    if (isMinimized) {
        return (
            <MotionButton
                className="hud-toggle-icon-btn hud-toggle-icon-btn--floating"
                onClick={onToggleHud}
                title="Maximize HUDs"
                aria-label="Maximize HUDs"
                initial={{ opacity: 0, x: -14, scale: 0.82, filter: "blur(5px)" }}
                animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -14, scale: 0.82, filter: "blur(5px)" }}
                whileHover={{ y: -2, scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 360, damping: 22 }}
            >
                <span className="hud-toggle-icon">&gt;</span>
            </MotionButton>
        );
    }

    return (
        <HudFrame
            as={MotionDiv}
            className="chat-panel motion-hud-panel"
            contentClassName="chat-panel__content"
            variants={hudPanelVariants}
            initial="hidden"
            animate="visible"
        >
            <MotionDiv className="terminal-header motion-hud-header" variants={hudChildVariants}>
                <div className="chat-header-left">
                    <MotionButton
                        className="hud-toggle-icon-btn"
                        onClick={onToggleHud}
                        title="Minimize HUDs"
                        aria-label="Minimize HUDs"
                        whileHover={{ x: -2, scale: 1.12 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <span className="hud-toggle-icon">&lt;</span>
                    </MotionButton>
                    <span>SYSTEM TERMINAL</span>
                </div>
            </MotionDiv>

               <MotionDiv className="chat-audio-controls" variants={hudChildVariants}>
                <AudioSpectrum />
            </MotionDiv>
            <MotionDiv ref={chatRef} className="data-readouts chat-messages" variants={hudChildVariants}>
                <AnimatePresence initial={false}>
                    {messages.map((msg, i) => {
                        const dt = getValidDate(msg.timestamp);
                        const stamp = dt.toLocaleTimeString([], {
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                        });
                        const relationId = Number(msg.relationId || msg.userId || 0);
                        const isOwnMessage = relationId > 0 && relationId === Number(userData.relationId || 0);

                        return (
                            <MotionDiv
                                key={`${stamp}-${msg.relationId || msg.userId}-${i}`}
                                className={`data-row message-row${msg.isCommand ? " message-row--cmd" : ""}${isOwnMessage ? " message-row--own" : ""}`}
                                title={msg.isCommand ? "Command" : "Message"}
                                variants={messageVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                layout
                            >
                                <span className="data-label message-time">[{stamp}]</span>
                                <span className="data-label message-name">{msg.userName}:</span>
                                {msg.isCommand ? (
                                    <>
                                        <span className="data-label message-command-tag">[CMD]</span>
                                        <span className="data-value">{parseCommandText(msg.text)?.name || msg.text}</span>
                                    </>
                                ) : (
                                    <span className="data-value">{msg.text}</span>
                                )}
                            </MotionDiv>
                        );
                    })}
                </AnimatePresence>
            </MotionDiv>

            

            <ChatCommandInput
                value={messageInput}
                onValueChange={setMessageInput}
                onClear={handleClear}
                onSendChat={sendChatMessage}
                variants={hudChildVariants}
            />
        </HudFrame>
    );
}

export default Chat;
