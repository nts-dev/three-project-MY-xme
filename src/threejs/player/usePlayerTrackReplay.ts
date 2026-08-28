import {useEffect, useMemo, useRef, useState} from "react";

const DEFAULT_TRACK_PLAYER_IDS = ["47116a0906b3acc8"];
const PROJECT_TRACK_SOURCES: Record<string, { id: string; url: string }[]> = {
    "33": [{ id: "74867395b0df4a08", url: `${getApiBaseUrl()}/player/74867395b0df4a08.json` }],
};
const TRACK_STEP_MS = 650;
const TRACK_START_FRAME = 10;

function getTrackPlayerIds() {
    const configuredIds = String(import.meta.env.VITE_PLAYER_TRACK_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

    return configuredIds.length > 0 ? configuredIds : DEFAULT_TRACK_PLAYER_IDS;
}

function getTrackSources(projectID: any) {
    const projectSources = PROJECT_TRACK_SOURCES[getProjectBaseId(projectID)];
    if (projectSources) return projectSources;

    return getTrackPlayerIds().map((id) => ({
        id,
        url: `${getApiBaseUrl()}/player/${encodeURIComponent(id)}.json`,
    }));
}

function getApiBaseUrl() {
    return String(import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
}

function getProjectBaseId(projectID: any) {
    return String(projectID || "").replace(/_L\d+$/i, "");
}

function isSameProject(record: any, projectID: any) {
    if (record?.project === undefined || record?.project === null) return true;
    const recordProject = String(record.project);
    const projectBaseId = getProjectBaseId(projectID);
    return recordProject === String(projectID) || recordProject === projectBaseId;
}

function toNumber(value: any, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function sceneUnitsToPlayerUnits(value: any) {
    return toNumber(value) * 100;
}

function getPlayerUnitPosition(record: any) {
    const position = record?.position || {};

    return {
        x: toNumber(record?.posX, sceneUnitsToPlayerUnits(record?.three_x ?? position.x)),
        y: toNumber(record?.posY, sceneUnitsToPlayerUnits(position.y)),
        z: toNumber(record?.posZ, sceneUnitsToPlayerUnits(record?.three_z ?? position.z)),
    };
}

function normalizeTrackRecord(record: any, fallbackClientId: string) {
    const clientId = String(record?.clientId || fallbackClientId);
    const playerPosition = getPlayerUnitPosition(record);

    return {
        ...record,
        clientId,
        posX: playerPosition.x,
        posY: playerPosition.y,
        posZ: playerPosition.z,
        position: {
            x: playerPosition.x / 100,
            y: playerPosition.y / 100,
            z: playerPosition.z / 100,
        },
        speed: toNumber(record?.speed ?? record?.cSpeed, 10),
        currentAnimation: record?.currentAnimation || "Idle",
        direction: undefined,
        noOfLivesRemaining: record?.noOfLivesRemaining ?? 3,
        userName: record?.userName && record.userName !== "Unknown"
            ? record.userName
            : record?.device_name || clientId,
        isTrackReplay: true,
    };
}

function byDateTime(firstRecord: any, secondRecord: any) {
    const firstDate = Date.parse(firstRecord?.dateTime || "");
    const secondDate = Date.parse(secondRecord?.dateTime || "");

    if (!Number.isFinite(firstDate) || !Number.isFinite(secondDate)) return 0;
    return firstDate - secondDate;
}

async function fetchTrack(source: { id: string; url: string }, projectID: any) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`Unable to load player track ${source.id}`);

    const payload = await response.json();
    const records = Array.isArray(payload) ? payload : payload?.data;
    if (!Array.isArray(records)) return [];

        return records
        .filter((record) => isSameProject(record, projectID))
        .sort(byDateTime)
        .slice(TRACK_START_FRAME)
        .map((record) => normalizeTrackRecord(record, source.id));
}

export default function usePlayerTrackReplay(projectID: any, enabled: boolean) {
    const [tracks, setTracks] = useState<Record<string, any[]>>({});
    const [players, setPlayers] = useState<any[]>([]);
    const indexesRef = useRef<Record<string, number>>({});
    const trackSources = useMemo(() => getTrackSources(projectID), [projectID]);

    useEffect(() => {
        let cancelled = false;

        if (!enabled) {
            indexesRef.current = {};
            setTracks({});
            setPlayers([]);
            return () => {
                cancelled = true;
            };
        }

        Promise.all(
            trackSources.map(async (source) => [source.id, await fetchTrack(source, projectID)] as const)
        )
            .then((entries) => {
                if (cancelled) return;
                indexesRef.current = {};
                setTracks(Object.fromEntries(entries.filter(([, records]) => records.length > 0)));
            })
            .catch((error) => {
                console.warn("Failed to load player track replay", error);
                if (!cancelled) setTracks({});
            });

        return () => {
            cancelled = true;
        };
    }, [projectID, trackSources, enabled]);

    useEffect(() => {
        const trackEntries = Object.entries(tracks);

        if (trackEntries.length === 0) {
            setPlayers([]);
            return;
        }

        let intervalId: number | undefined;

        const tick = () => {
            let allTracksFinished = true;

            setPlayers(
                trackEntries.map(([clientId, records]) => {
                    const currentIndex = indexesRef.current[clientId] || 0;
                    const nextIndex = Math.min(currentIndex + 1, records.length - 1);
                    indexesRef.current[clientId] = nextIndex;
                    if (nextIndex < records.length - 1) allTracksFinished = false;
                    return records[currentIndex];
                })
            );

            if (allTracksFinished) {
                if (intervalId !== undefined) window.clearInterval(intervalId);
            }
        };

        tick();
        intervalId = window.setInterval(tick, TRACK_STEP_MS);

        return () => {
            if (intervalId !== undefined) window.clearInterval(intervalId);
        };
    }, [tracks]);

    return players;
}
