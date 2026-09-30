import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { socket } from "../../socket";
import { RtlsLiveMotion } from "./rtlsLiveMotion";

const baseProject = (value: any) => String(value ?? "").replace(/_L\d+$/i, "");

export default function useLiveRtlsMotion(projectID: any, enabled = true) {
    const motions = useMemo(() => new Map<string, RtlsLiveMotion>(), [projectID]);

    useEffect(() => {
        if (!enabled) return;
        const receive = (payload: any) => {
            const players: any[] = Array.isArray(payload) ? payload : Object.values(payload || {});
            const ids = new Set<string>();
            const now = performance.now();
            for (const player of players) {
                if (!player?.rtls || !player.clientId) continue;
                const project = player.projectID ?? player.project;
                if (project != null && baseProject(project) !== baseProject(projectID)) continue;
                const id = String(player.clientId);
                ids.add(id);
                if (!motions.has(id)) motions.set(id, new RtlsLiveMotion());
                motions.get(id)!.push(player, now);
            }
            for (const id of motions.keys()) if (!ids.has(id)) motions.delete(id);
        };
        socket.on("playersUpdate", receive);
        socket.on("remotePlayers", receive);
        const clear = () => motions.clear();
        socket.on("disconnect", clear);
        socket.emit("getPlayers", "");
        return () => {
            socket.off("playersUpdate", receive);
            socket.off("remotePlayers", receive);
            socket.off("disconnect", clear);
            motions.clear();
        };
    }, [motions, projectID, enabled]);

    useFrame((_, delta) => {
        if (!enabled) return;
        const now = performance.now();
        for (const [id, motion] of motions) {
            if (now - motion.lastReceived > 10000) motions.delete(id);
            else motion.update(delta, now);
        }
    }, -1);
    return motions;
}
