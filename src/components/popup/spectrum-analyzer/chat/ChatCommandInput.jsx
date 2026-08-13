import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { socket } from "../../../../socket";
import useGame from "../../../../hooks/useGame";
import { realTimeChaPosition } from "../../../../threejs/player/puzzle/character/Constants.jsx";
import { isCommandText, parseAnimateMotionArgs, parseCommandText, parsePlaceObjectArgs } from "./chatCommandParser";
import { animateMotionFromDsl, placeObjectFromDsl } from "./dslSceneCommands";
import { dispatchGameTrigger, DSL_COMMAND_REQUESTED } from "../../../../threejs/dslGameTriggers";

const MotionButton = motion.button;
const MotionDiv = motion.div;
const DSL_SCENE_COMMAND_APPLIED = "dsl-scene-command-applied";

function ChatCommandInput({ value, onValueChange, onClear, onSendChat, variants }) {
    const [findRemotePlayers, setFindRemotePlayers] = useState(false);
    const projectID = useGame((state) => state.projectID);
    const selectedLevel = useGame((state) => state.selectedLevel);
    const userData = useGame((state) => state.userData);
    const uName = useGame((state) => state.uName);
    const setControlClose = useGame((state) => state.setControlClose);
    const setTerminalMessage = useGame((state) => state.setTerminalMessage);
    const setDslSceneCommand = useGame((state) => state.setDslSceneCommand);

    const writeTerminal = (command, message) => {
        setTerminalMessage({ command, message });
    };

    const notifySceneRenderers = (commandPayload) => {
        setDslSceneCommand(commandPayload);
        window.dispatchEvent(new CustomEvent(DSL_SCENE_COMMAND_APPLIED, { detail: commandPayload }));
        socket.emit("terminalMessage", {
            command: "placeobject",
            message: "Transient scene command",
            userName: uName || "Unknown",
            relationId: userData?.relationId || 0,
            projectId: commandPayload.projectId,
            transientSceneCommand: true,
            suppressTerminal: true,
            sceneCommand: commandPayload,
        });
    };

    const buildAtomicSceneCommand = ({ result, assetId, source, saved, commandId }) => ({
        data: result.delta?.category ? { categories: [result.delta.category] } : result.data || { categories: [] },
        projectId: result.projectId,
        assetId,
        source,
        saved,
        delta: result.delta,
        commandId,
        createdAt: Date.now(),
    });

    const getActiveProjectId = () => {
        const params = new URLSearchParams(window.location.search);
        const urlProjectId = params.get("projectId");
        if (urlProjectId && /_L\d+$/i.test(urlProjectId)) {
            return urlProjectId;
        }

        const levelCode = Number.parseInt(String(selectedLevel?.code ?? ""), 10);
        if (Number.isFinite(levelCode) && Number(projectID) > 0) {
            return `${projectID}_L${Math.max(0, levelCode)}`;
        }

        return projectID;
    };

    const runOnlineCommand = () => {
        socket.emit("getPlayers", "");
        const handleRemotePlayers = (data) => {
            const message = data.length
                ? data.map((player, i) => `${i + 1}. ${player.userName}, Lives: ${player.noOfLivesRemaining}`).join("\n")
                : "No players found.";

            writeTerminal("online", message);
            socket.off("remotePlayers", handleRemotePlayers);
        };

        socket.once("remotePlayers", handleRemotePlayers);
        setFindRemotePlayers(!findRemotePlayers);
    };

    const runLocationCommand = () => {
        if (!realTimeChaPosition) {
            writeTerminal("mylocation", "No location data available.");
            return;
        }

        const coords = realTimeChaPosition
            .clone()
            .multiplyScalar(100)
            .toArray()
            .map((n) => n.toFixed(1))
            .join(", ");

        navigator.clipboard?.writeText(coords).catch(() => {});
        writeTerminal("mylocation", `Current location: ${coords}`);
    };

    const runPlaceObjectCommand = async (args) => {
        const parsed = parsePlaceObjectArgs(args);
        const activeProjectId = getActiveProjectId();
        const result = await placeObjectFromDsl({
            projectId: activeProjectId,
            source: parsed.source,
            position: parsed.position,
            save: parsed.save,
        });
        const { asset, meta } = result;
        const commandPayload = buildAtomicSceneCommand({
            result,
            assetId: asset.instanceId,
            source: parsed.source,
            saved: result.saved,
            commandId: `${result.projectId}:${asset.instanceId}:${Date.now()}`,
        });

        console.warn("[placeobject] chat command applied; sending renderer trigger", commandPayload);
        writeTerminal("placeobject", result.saved ? "Object shown; saving scene data..." : "Object shown locally and broadcast; not saved");
        notifySceneRenderers(commandPayload);

        if (result.savePromise) {
            result.savePromise
                .then(() => writeTerminal("placeobject", "Scene data saved."))
                .catch((error) => writeTerminal("placeobject", error?.message || "Save failed."));
        }

        writeTerminal(
            "placeobject",
            `Placed ${meta.name || parsed.source} (local instance ${asset.instanceId}) at pos(${parsed.position.x},${parsed.position.y},${parsed.position.z})${result.saved ? " [saved]" : " [temporary]"}`
        );
    };

    const runAnimateMotionCommand = async (args) => {
        const parsed = parseAnimateMotionArgs(args);
        console.log("[animateMotion parsed]", {
            target: parsed.target,
            property: parsed.property,
            from: parsed.from,
            to: parsed.to,
            duration: parsed.duration,
            ease: parsed.ease,
            yoyo: parsed.yoyo,
            repeat: parsed.repeat,
        });
        const result = await animateMotionFromDsl({
            projectId: getActiveProjectId(),
            ...parsed,
        });
        const commandPayload = buildAtomicSceneCommand({
            result,
            assetId: result.animation.id,
            source: parsed.target,
            saved: false,
            commandId: `${result.projectId}:${result.animation.id}:${Date.now()}`,
        });

        notifySceneRenderers(commandPayload);
        result.savePromise
            ?.then(() => writeTerminal("animateMotion", "Animation command saved."))
            ?.catch((error) => writeTerminal("animateMotion", error?.message || "Animation save failed."));
        writeTerminal(
            "animateMotion",
            `Animated ${parsed.target} ${parsed.property} from(${parsed.from.join(",")}) to(${parsed.to.join(",")})`
        );
    };

    const runDoorOpenCommand = (args) => {
        const instanceId = args.match(/instance\s*\(\s*([^)]+?)\s*\)/i)?.[1]?.trim()
            || args.match(/^(\S+)/)?.[1]?.trim();

        if (!instanceId) {
            throw new Error("Use: #door.open instance(id)");
        }

        dispatchGameTrigger("door.open", { instanceId });
        writeTerminal(`door.open instance(${instanceId})`, `Opening door instance ${instanceId}`);
    };

    const runCommand = async (rawText) => {
        const command = parseCommandText(rawText);
        if (!command?.name) {
            writeTerminal("", "Empty command.");
            return;
        }

        const staticCommands = {
            control: () => {
                setControlClose(true);
                writeTerminal("control", "Controls open");
            },
            time: () => writeTerminal("time", new Date().toLocaleString()),
            online: runOnlineCommand,
            mylocation: runLocationCommand,
        };

        try {
            if (command.name === "placeobject") {
                await runPlaceObjectCommand(command.args);
                return;
            }

            if (command.name === "animatemotion") {
                await runAnimateMotionCommand(command.args);
                return;
            }

            if (command.name === "door.open" || command.name === "dooropen") {
                runDoorOpenCommand(command.args);
                return;
            }

            const action = staticCommands[command.name];
            if (!action) {
                writeTerminal(command.name, `Unknown command: ${command.name}`);
                return;
            }

            action();
        } catch (error) {
            writeTerminal(command.name, error?.message || "Command failed.");
        }
    };

    const runCommandScript = async (rawText) => {
        const script = String(rawText || "").trim();
        if (!script) return;

        const commands = script
            .split(/\n|;/)
            .map((item) => item.trim())
            .filter(Boolean);

        for (const item of commands) {
            await runCommand(item.startsWith("#") ? item : `#${item}`);
        }
    };

    useEffect(() => {
        const handleDslCommandRequest = (event) => {
            const commandText = event.detail?.command;
            if (!commandText) return;

            writeTerminal("dsl.command", commandText);
            runCommandScript(commandText);
        };

        window.addEventListener(DSL_COMMAND_REQUESTED, handleDslCommandRequest);
        return () => window.removeEventListener(DSL_COMMAND_REQUESTED, handleDslCommandRequest);
    }, [projectID, selectedLevel]);

    const submit = async () => {
        const raw = value.trim();
        if (!raw) return;

        if (isCommandText(raw)) {
            await runCommand(raw);
            return;
        } else {
            onSendChat(raw);
        }

        onValueChange("");
    };

    const handleChange = (event) => {
        const nextValue = event.target.value.slice(0, 180);
        if (nextValue.length === 180) {
            writeTerminal("", "You've reached the character limit");
        }
        onValueChange(nextValue);
    };

    return (
        <MotionDiv className="chat-input" variants={variants}>
            <input
                type="text"
                className="chat-input-field"
                placeholder="Type a message...."
                value={value}
                maxLength={180}
                onChange={handleChange}
                onKeyDown={(event) => event.key === "Enter" && submit()}
            />
            <MotionButton
                className="chat-send-button chat-clear-button"
                onClick={onClear}
                whileHover={{ y: -2, scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                aria-label="Clear chat"
            >
                Clear
            </MotionButton>
            <MotionButton
                className="chat-send-button"
                onClick={submit}
                whileHover={{ y: -2, scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                aria-label="Send message"
            >
                &gt;
            </MotionButton>
        </MotionDiv>
    );
}

export default ChatCommandInput;
