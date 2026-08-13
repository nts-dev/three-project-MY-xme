import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_REMOTE_UI_HZ,
  processRemotePlayersSnapshot,
} from "./remotePlayersProcessing";

let workerInstance = null;
let nextRequestId = 1;

function getWorker() {
  if (typeof Worker === "undefined") return null;
  if (!workerInstance) {
    workerInstance = new Worker(new URL("../../../../../workers/remotePlayers.worker.js", import.meta.url), {
      type: "module",
    });
  }
  return workerInstance;
}

export default function useRemotePlayersWorker({
  localClientId,
  projectID,
  updateHz = DEFAULT_REMOTE_UI_HZ,
}) {
  const [players, setPlayers] = useState([]);
  const pendingPlayersRef = useRef(null);
  const latestRawPlayersRef = useRef([]);
  const frameFlushRef = useRef(null);
  const lastAppliedPlayersRef = useRef([]);
  const latestRequestIdRef = useRef(0);
  const worker = useMemo(() => getWorker(), []);

  const applyProcessedResult = useCallback((result) => {
    if (!result?.changed) return;
    lastAppliedPlayersRef.current = result.players || [];
    setPlayers(lastAppliedPlayersRef.current);
  }, []);

  const processSnapshot = useCallback((nextPlayers) => {
    const payload = {
      players: nextPlayers,
      previousPlayers: lastAppliedPlayersRef.current,
      localClientId,
      projectID,
    };

    if (!worker) {
      applyProcessedResult(processRemotePlayersSnapshot(payload));
      return;
    }

    const requestId = nextRequestId++;
    latestRequestIdRef.current = requestId;

    const handleMessage = (event) => {
      const { id, result, error } = event.data || {};
      if (id !== requestId) return;
      worker.removeEventListener("message", handleMessage);
      if (requestId !== latestRequestIdRef.current) return;

      if (error || !result) {
        applyProcessedResult(processRemotePlayersSnapshot(payload));
        return;
      }

      applyProcessedResult(result);
    };

    worker.addEventListener("message", handleMessage);
    worker.postMessage({ id: requestId, payload });
  }, [applyProcessedResult, localClientId, projectID, worker]);

  const flushPendingPlayers = useCallback(() => {
    frameFlushRef.current = null;
    if (!pendingPlayersRef.current) return;

    const next = pendingPlayersRef.current;
    pendingPlayersRef.current = null;
    processSnapshot(next);
  }, [processSnapshot]);

  const handlePlayersSnapshot = useCallback((nextPlayers) => {
    latestRawPlayersRef.current = Array.isArray(nextPlayers) ? nextPlayers : [];
    pendingPlayersRef.current = nextPlayers;
    if (frameFlushRef.current !== null) return;
    frameFlushRef.current = window.setTimeout(flushPendingPlayers, 1000 / updateHz);
  }, [flushPendingPlayers, updateHz]);

  useEffect(() => {
    processSnapshot(latestRawPlayersRef.current);
  }, [localClientId, projectID, processSnapshot]);

  useEffect(() => {
    return () => {
      if (frameFlushRef.current !== null) {
        clearTimeout(frameFlushRef.current);
        frameFlushRef.current = null;
      }
    };
  }, []);

  
  return {
    players,
    handlePlayersSnapshot,
  };
}
