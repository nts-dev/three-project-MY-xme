import { useCallback, useMemo, useRef } from "react";
import { filterInteractionCandidates } from "./interactionIndexProcessing";

let workerInstance = null;
let nextRequestId = 1;

function getWorker() {
  if (typeof Worker === "undefined") return null;
  if (!workerInstance) {
    workerInstance = new Worker(new URL("../../../../../workers/interactionIndex.worker.js", import.meta.url), {
      type: "module",
    });
  }
  return workerInstance;
}

export default function useInteractionIndexWorker() {
  const worker = useMemo(() => getWorker(), []);
  const latestRequestIdRef = useRef(0);
  const latestCandidateIdsRef = useRef([]);
  const busyRef = useRef(false);

  const requestCandidates = useCallback((payload) => {
    if (!payload?.records?.length) {
      latestCandidateIdsRef.current = [];
      return [];
    }

    if (!worker) {
      latestCandidateIdsRef.current = filterInteractionCandidates(payload);
      return latestCandidateIdsRef.current;
    }

    if (busyRef.current) {
      return latestCandidateIdsRef.current;
    }

    const requestId = nextRequestId++;
    latestRequestIdRef.current = requestId;
    busyRef.current = true;

    const handleMessage = (event) => {
      const { id, result, error } = event.data || {};
      if (id !== requestId) return;
      worker.removeEventListener("message", handleMessage);
      busyRef.current = false;
      if (requestId !== latestRequestIdRef.current) return;

      if (error || !Array.isArray(result)) {
        latestCandidateIdsRef.current = filterInteractionCandidates(payload);
        return;
      }

      latestCandidateIdsRef.current = result;
    };

    worker.addEventListener("message", handleMessage);
    worker.postMessage({ id: requestId, payload });

    return latestCandidateIdsRef.current;
  }, [worker]);

  return {
    requestCandidates,
    latestCandidateIdsRef,
  };
}
