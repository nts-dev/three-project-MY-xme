import { useEffect, useRef, useState } from "react";
import { AURA_SCALE } from "./placeholderConstants";
import { preparePlaceholderInstances } from "./placeholderPrep";

let workerInstance = null;
let nextRequestId = 1;

function getWorker() {
  if (typeof Worker === "undefined") return null;
  if (!workerInstance) {
    workerInstance = new Worker(new URL("../../workers/placeholderPrep.worker.js", import.meta.url), {
      type: "module",
    });
  }
  return workerInstance;
}

export default function usePreparedPlaceholderInstances(instances, baseSize) {
  const [prepared, setPrepared] = useState([]);
  const latestRequestId = useRef(0);

  useEffect(() => {
    const worker = getWorker();
    const requestId = nextRequestId++;
    latestRequestId.current = requestId;

    if (!instances?.length) {
      setPrepared([]);
      return undefined;
    }

    if (!worker) {
      setPrepared(preparePlaceholderInstances(instances, baseSize, AURA_SCALE));
      return undefined;
    }

    const handleMessage = (event) => {
      const { id, instances: nextPrepared, error } = event.data || {};
      if (id !== latestRequestId.current) return;

      if (error || !Array.isArray(nextPrepared)) {
        setPrepared(preparePlaceholderInstances(instances, baseSize, AURA_SCALE));
        return;
      }

      setPrepared(nextPrepared);
    };

    worker.addEventListener("message", handleMessage);
    worker.postMessage({ id: requestId, instances, baseSize, auraScale: AURA_SCALE });

    return () => {
      worker.removeEventListener("message", handleMessage);
    };
  }, [instances, baseSize]);

  return prepared;
}
