import {useEffect, useState, useMemo, useRef} from "react";
import {socket} from "../../socket";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";
import * as THREE from "three";
import RemotePlayer from "./RemotePlayer";
import useGame from "../../hooks/useGame";
import usePlayerTrackReplay from "./usePlayerTrackReplay";
import type { PlayerTrackPathGroup } from "./usePlayerTrackReplay";
import useLiveRtlsMotion from "./useLiveRtlsMotion";

function TrackPathDotGroup({ points, color = "#ff1f2f" }: { points: any[]; color?: string }) {
    const geometry = useMemo(
  () => new THREE.SphereGeometry(0.44, 10, 8),
  []
);
    const material = useMemo(() => new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.9,
    }), [color]);
    const matrices = useMemo(() => {
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();

        return points.map((point: any) => {
            position.set(
                Number(point?.position?.x ?? point?.posX / 100 ?? 0),
                Number(point?.position?.y ?? point?.posY / 100 ?? 0) + 0.08,
                Number(point?.position?.z ?? point?.posZ / 100 ?? 0)
            );
            return matrix.clone().setPosition(position);
        });
    }, [points]);

    if (matrices.length === 0) return null;

    return (
        <instancedMesh
            args={[geometry, material, matrices.length]}
            frustumCulled={false}
            renderOrder={20}
            onUpdate={(mesh) => {
                matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
                mesh.instanceMatrix.needsUpdate = true;
            }}
        />
    );
}

function TrackPathDots({ groups }: { groups: PlayerTrackPathGroup[] }) {
    return (
        <>
            {groups.map((group) => (
                <TrackPathDotGroup key={`track-path-${group.id}`} points={group.points} color={group.color} />
            ))}
        </>
    );
}

function normalizePlayersPayload(players: any) {
    if (Array.isArray(players)) return players;
    if (players && typeof players === "object") return Object.values(players);
    return [];
}

function hasGpsFix(player: any) {
    return Boolean(player?.rtls) || player?.gps !== null;
}

/** Shown in the scene: RTLS tags, GPS devices and avatars walked in character mode (a position, no GPS). */
function hasScenePosition(player: any) {
    if (hasGpsFix(player)) return true;
    return player?.mType === "player" && Number.isFinite(Number(player?.posX)) && Number.isFinite(Number(player?.posZ));
}

const STAGGER_FRAMES = 2; // frames between two new remote avatars

const baseProject = (value: any) => String(value ?? "").replace(/_L\d+$/i, "");

/**
 * What a remote player component renders from (it re-renders only when this changes): the
 * animation, a speed bucket and the name. Positions are read every frame from the live map.
 */
function renderKey(player: any) {
    const speed = Math.round(Number(player?.speed) || 0);
    return [player.clientId, player.currentAnimation, speed, player.userName, player.personColor, Boolean(player.rtls), Boolean(player.isTrackReplay), player.gps === null].join("|");
}

export default function RemotePlayerList({playerObject}: any) {
    const {scene, animations} = playerObject;
    // Latest snapshot per player (updated on every message, read by RemotePlayer each frame) and the
    // list React renders (changed only when someone joins / leaves or changes animation).
    const liveRef = useRef(new Map<string, any>());
    const renderKeysRef = useRef("");
    const [players, setPlayers] = useState<any[]>([]);
    const localClientId = useGame((state: any) => state.clientId);
    const projectID = useGame((state: any) => state.projectID);
    const rtlsMotions = useLiveRtlsMotion(projectID);
    const playerTrackReplay = useGame((state: any) => state.playerTrackReplay);
    const { players: trackPlayers, pathGroups: trackPathGroups } = usePlayerTrackReplay(projectID, playerTrackReplay);
    const setPlayerActionList = useGame((state: any) => state.setPlayerActions);
    useEffect(() => {
        const live = liveRef.current;
        const publish = () => {
            const list = [...live.values()];
            const keys = list.map(renderKey).sort().join("\n");
            if (keys === renderKeysRef.current) return; // only positions moved: no re-render
            renderKeysRef.current = keys;
            setPlayers(list);
            if (import.meta.env.DEV) (window as any).__remotePlayers = { count: list.length, at: performance.now() };
        };
        const receive = (payload: any) => {
            const next = normalizePlayersPayload(payload).filter((player: any) => player?.clientId && hasScenePosition(player));
            const ids = new Set(next.map((player: any) => String(player.clientId)));
            for (const player of next) live.set(String(player.clientId), player);
            for (const id of [...live.keys()]) if (!ids.has(id)) live.delete(id);
            publish();
        };
        const disconnect = (clientID: string) => {
            document.getElementById(clientID)?.remove();
            if (live.delete(String(clientID))) publish();
        };
        const receiveAvailable = (payload: any) => {
            setPlayerActionList(payload);
            receive(payload);
        };
        const clear = () => {
            live.clear();
            publish();
        };
        socket.on("playersUpdate", receive);
        socket.on("remotePlayers", receiveAvailable);
        socket.on("disconnected", disconnect);
        socket.on("disconnect", clear);
        socket.emit("getPlayers", "");
        return () => {
            socket.off("playersUpdate", receive);
            socket.off("remotePlayers", receiveAvailable);
            socket.off("disconnected", disconnect);
            socket.off("disconnect", clear);
        };
    }, [setPlayerActionList]);


    // Clone the model **once** and reuse it. The local model's own scale (PlayerContent sets it) is
    // kept for the remote avatars of character-mode players, so they match the local one in size.
    const localModelScale = useMemo(() => scene.scale.clone(), [scene, playerObject]);
    const clonedScene = useMemo(() => SkeletonUtils.clone(scene), [scene,playerObject]);
    useEffect(() => {
          
        if (projectID == 144) {
            clonedScene.scale.set(0.3,0.3,0.3)

        } else {
            clonedScene.scale.set(0.8,0.8,0.8)
        }
    }, [projectID,playerObject]);

    const visiblePlayers = useMemo(() => {
        const localClientIdValue = String(localClientId || "").trim();
        const socketClientIds = new Set(players.map((player: any) => player?.clientId).filter(Boolean));
        const mergedPlayers = [
            ...players,
            ...trackPlayers.filter((player: any) => !socketClientIds.has(player?.clientId)),
        ];

        return mergedPlayers.filter((player: any) => {
            // Only players in this project (avatars in other projects walk other scenes).
            const playerProject = player.projectID ?? player.project;
            if (playerProject != null && playerProject !== "" && baseProject(playerProject) !== baseProject(projectID)) return false;
            if (!player?.isTrackReplay && !hasScenePosition(player)) return false;
            if (!player?.clientId) return false;
            return !localClientIdValue || localClientIdValue !== player.clientId;
        });
    }, [players, trackPlayers, localClientId, projectID]);

    // New avatars come in one per frame (STAGGER_FRAMES): many players arriving together (the list
    // when joining a busy scene) built in one frame froze it for half a second.
    const [admitted, setAdmitted] = useState<Set<string>>(() => new Set());
    useEffect(() => {
        const wanted = new Set(visiblePlayers.map((player: any) => String(player.clientId)));
        let frame = 0;
        let raf = 0;
        const step = () => {
            setAdmitted((current) => {
                const next = new Set([...current].filter((id) => wanted.has(id)));
                const waiting = [...wanted].filter((id) => !next.has(id));
                if (waiting.length && frame % STAGGER_FRAMES === 0) next.add(waiting[0]);
                if (waiting.length > (frame % STAGGER_FRAMES === 0 ? 1 : 0)) raf = requestAnimationFrame(step);
                frame++;
                return next.size === current.size && [...next].every((id) => current.has(id)) ? current : next;
            });
        };
        step();
        return () => cancelAnimationFrame(raf);
    }, [visiblePlayers]);
    const shownPlayers = useMemo(
        () => visiblePlayers.filter((player: any) => admitted.has(String(player.clientId))),
        [visiblePlayers, admitted]
    );

    return (
        <>
            {playerTrackReplay && <TrackPathDots groups={trackPathGroups} />}
            {shownPlayers.map((player: any) => {
                    return (
                        <RemotePlayer
                            key={player.clientId}
                            player={player}
                            rPlayer={clonedScene}
                            animations={animations}
                            rtlsMotions={rtlsMotions}
                            liveRef={liveRef}
                            modelScale={!player?.rtls && !player?.isTrackReplay && projectID != 144 ? localModelScale : null}
                        />
                    )
                }
            )

            }
        </>
    );
}
