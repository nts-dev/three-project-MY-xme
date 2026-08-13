import React, { useEffect, useRef } from "react";
import { motion } from "motion/react";
import useGame from "../../../hooks/useGame";
import { socket } from "../../../socket";

const MotionDiv = motion.div;

const terminalPanelVariants = {
    hidden: { opacity: 0, x: -16, y: 18, scale: 0.97, filter: "blur(6px)" },
    visible: {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        transition: {
            type: "spring",
            stiffness: 240,
            damping: 25,
            delay: 0.08,
            staggerChildren: 0.05,
        },
    },
};

const terminalChildVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

const SystemTerminal = ({ isMinimized = false }) => {
    const terminalContentRef = useRef(null);
    const typingLineRef = useRef(null);
    const terminalMessage = useGame((state) => state.terminalMessage);
    const setTerminalMessage = useGame((state) => state.setTerminalMessage);
    const lastMessageRef = useRef(null); // Track the last message for reference

    const scrollToBottom = () => {
        if (terminalContentRef.current) {
            terminalContentRef.current.scrollTop =
                terminalContentRef.current.scrollHeight;
        }
    };

    const addTerminalMessage = ({ command, message }) => {
        if (!terminalContentRef.current || !typingLineRef.current) return;

        // Helper function for typing animation
        const typeText = (element, text, callback) => {
            let index = 0;
            const typeChar = () => {
                if (index < text.length) {
                    element.textContent += text[index];
                    index++;
                    scrollToBottom();
                    setTimeout(typeChar, 30);
                } else if (callback) {
                    callback();
                }
            };
            typeChar();
        };

        if (command) {
            const formattedCommand = String(command).trim().replace(/^#\s*/, "");

            // Create new line for the command
            const commandLine = document.createElement("div");
            commandLine.className = "terminal-line command-line";
            commandLine.textContent = "";
            terminalContentRef.current.insertBefore(commandLine, typingLineRef.current);

            // Type command, then type response
            typeText(commandLine, `#${formattedCommand}`, () => {
                const responseLine = document.createElement("div");
                responseLine.className = "terminal-line response-line";
                responseLine.textContent = "";
                terminalContentRef.current.insertBefore(responseLine, typingLineRef.current);
                typeText(responseLine, message);
            });
        } else {
            // If no command, only type the message
            const responseLine = document.createElement("div");
            responseLine.className = "terminal-line response-line";
            responseLine.textContent = "";
            terminalContentRef.current.insertBefore(responseLine, typingLineRef.current);
            typeText(responseLine, message);
        }
    };

    useEffect(() => {
        const { command, message } = terminalMessage;

        // Only add the message if it exists
        if (message && lastMessageRef.current?.id !== terminalMessage.id) {
            addTerminalMessage({ command, message });
            lastMessageRef.current = terminalMessage; // Update the last message
        }
    }, [terminalMessage]);

    useEffect(() => {
        const handleRemoteTerminalMessage = (message) => {
            if (message?.suppressTerminal) {
                return;
            }
            setTerminalMessage({ ...message, remote: true });
        };

        socket.on("terminalMessage", handleRemoteTerminalMessage);
        return () => socket.off("terminalMessage", handleRemoteTerminalMessage);
    }, [setTerminalMessage]);

    return (
        <MotionDiv
            className={`terminal-panel motion-hud-panel ${isMinimized ? "hud-minimized" : ""}`}
            variants={terminalPanelVariants}
            initial="hidden"
            animate="visible"
            layout
        >
            <MotionDiv className="terminal-header motion-hud-header" variants={terminalChildVariants}>
                <span>SYSTEM TERMINAL</span>
            </MotionDiv>
            {!isMinimized && (
                <MotionDiv className="terminal-content" ref={terminalContentRef} variants={terminalChildVariants}>
                    <div className="terminal-line">
                        INITIALIZED. SECURE CONNECTION ESTABLISHED.
                    </div>
                    <div className="terminal-line typing" ref={typingLineRef}></div>
                </MotionDiv>
            )}
        </MotionDiv>
    );
};

export default SystemTerminal;
