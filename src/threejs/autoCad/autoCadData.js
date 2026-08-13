import { useEffect, useState } from "react";
import singleEdges from "../../components/autoCad/single-edges.js";
import { socket } from "../../socket.js";

const DSL_API_BASE = import.meta.env.VITE_DSL_API_BASE;
const cadSubscribers = new Set();
const hoveredCadSegmentSubscribers = new Set();
const selectedCadSegmentSubscribers = new Set();
let hoveredCadSegmentIndices = [];
let selectedCadSegmentIndices = [];

function resolveInitialAutoCadDocument() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  if (params.has("launch")) return "";

  const value = params.get("cadDocument") || params.get("lineDocument");
  return normalizeDocumentName(value);
}

const initialAutoCadDocument = resolveInitialAutoCadDocument();
const hasInitialLaunchToken = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("launch");
let selectedAutoCadDocument = initialAutoCadDocument || (hasInitialLaunchToken ? "" : "LinesAD1");
let activeAutoCadData = (hasInitialLaunchToken || (initialAutoCadDocument && initialAutoCadDocument !== "LinesAD1"))
  ? null
  : normalizeAutoCadPayload(singleEdges) || singleEdges;
let lastLoadedAutoCadDocument = "";
let activeLoadToken = 0;
const autoCadDocumentCache = new Map();

function publishAutoCadData(nextData) {
  if (!nextData) return;
  activeAutoCadData = nextData;
  cadSubscribers.forEach((subscriber) => subscriber(nextData));
}

function publishHoveredAutoCadSegments(nextIndices) {
  hoveredCadSegmentIndices = Array.isArray(nextIndices) ? nextIndices : [];
  hoveredCadSegmentSubscribers.forEach((subscriber) => subscriber(hoveredCadSegmentIndices));
}

function publishSelectedAutoCadSegments(nextIndices) {
  selectedCadSegmentIndices = Array.isArray(nextIndices) ? nextIndices : [];
  selectedCadSegmentSubscribers.forEach((subscriber) => subscriber(selectedCadSegmentIndices));
}

function normalizeDocumentName(documentName) {
  return typeof documentName === "string" ? documentName.trim() : "";
}

function canPublishDocument(documentName) {
  const normalizedDocumentName = normalizeDocumentName(documentName);
  return !selectedAutoCadDocument || normalizedDocumentName === selectedAutoCadDocument;
}

function enrichAutoCadData(nextData, documentName, displayName) {
  if (!nextData) return null;
  return {
    ...nextData,
    documentName,
    displayName:
      typeof displayName === "string" && displayName.trim()
        ? displayName.trim()
        : nextData.displayName,
  };
}

function publishLoadedAutoCadDocument(nextData, options = {}) {
  const documentName = normalizeDocumentName(options.documentName || nextData?.documentName);
  if (!nextData || !documentName || !canPublishDocument(documentName)) {
    return null;
  }

  const enrichedData = enrichAutoCadData(nextData, documentName, options.displayName);
  if (!enrichedData) return null;

  lastLoadedAutoCadDocument = documentName;
  autoCadDocumentCache.set(documentName, enrichedData);
  publishAutoCadData(enrichedData);
  return enrichedData;
}

export function setSelectedAutoCadDocument(documentName) {
  const normalizedDocumentName = normalizeDocumentName(documentName);
  if (!normalizedDocumentName) return;
  if (selectedAutoCadDocument === normalizedDocumentName) return;

  selectedAutoCadDocument = normalizedDocumentName;

  const cachedDocument = autoCadDocumentCache.get(normalizedDocumentName);
  if (cachedDocument) {
    lastLoadedAutoCadDocument = normalizedDocumentName;
    publishAutoCadData(cachedDocument);
  }
}

export function setHoveredAutoCadSegments(segmentIndices) {
  publishHoveredAutoCadSegments(segmentIndices);
}

export function setSelectedAutoCadSegments(segmentIndices) {
  publishSelectedAutoCadSegments(segmentIndices);
}

export function normalizeAutoCadPayload(payload) {
  if (!payload) return null;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch (error) {
      console.error("Failed to parse AutoCAD payload:", error);
      return null;
    }
  }

  if (payload.updateAutoCad) {
    const nextData = normalizeAutoCadPayload(payload.updateAutoCad);
    if (!nextData) return null;
    return {
      ...nextData,
      documentName:
        typeof payload.documentName === "string" && payload.documentName.trim()
          ? payload.documentName.trim()
          : nextData.documentName,
      displayName:
        typeof payload.displayName === "string" && payload.displayName.trim()
          ? payload.displayName.trim()
          : nextData.displayName,
    };
  }
  if (payload.single_edges) return payload.single_edges;
  if (payload.parts) return payload;
  return null;
}

export async function loadAutoCadDocument(documentName, options = {}) {
  const normalizedDocumentName = normalizeDocumentName(documentName);
  if (!normalizedDocumentName) {
    return null;
  }

  const forceReload = Boolean(options.forceReload);
  if (!forceReload) {
    const cachedDocument = autoCadDocumentCache.get(normalizedDocumentName);
    if (cachedDocument) {
      if (canPublishDocument(normalizedDocumentName)) {
        lastLoadedAutoCadDocument = normalizedDocumentName;
        publishAutoCadData(cachedDocument);
      }
      return cachedDocument;
    }
  }

  const loadToken = ++activeLoadToken;
  const res = await fetch(`${DSL_API_BASE}/linesad-docs/${encodeURIComponent(normalizedDocumentName)}`, {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Failed to load ${normalizedDocumentName}`);
  }

  const document = data?.document || {};
  const nextData = normalizeAutoCadPayload(document.result);
  if (!nextData) {
    return null;
  }

  if (loadToken !== activeLoadToken) {
    return autoCadDocumentCache.get(selectedAutoCadDocument) || null;
  }

  return publishLoadedAutoCadDocument(nextData, {
    documentName: normalizedDocumentName,
    displayName: document.displayName,
  });
}

export function useHoveredAutoCadSegments() {
  const [hoveredSegments, setHoveredSegments] = useState(hoveredCadSegmentIndices);

  useEffect(() => {
    const handleHoveredSegments = (nextSegments) => {
      setHoveredSegments(Array.isArray(nextSegments) ? nextSegments : []);
    };

    hoveredCadSegmentSubscribers.add(handleHoveredSegments);
    return () => {
      hoveredCadSegmentSubscribers.delete(handleHoveredSegments);
    };
  }, []);

  return hoveredSegments;
}

export function useSelectedAutoCadSegments() {
  const [selectedSegments, setSelectedSegments] = useState(selectedCadSegmentIndices);

  useEffect(() => {
    const handleSelectedSegments = (nextSegments) => {
      setSelectedSegments(Array.isArray(nextSegments) ? nextSegments : []);
    };

    selectedCadSegmentSubscribers.add(handleSelectedSegments);
    return () => {
      selectedCadSegmentSubscribers.delete(handleSelectedSegments);
    };
  }, []);

  return selectedSegments;
}

export function useAutoCadData(data = singleEdges) {
  const [liveData, setLiveData] = useState(() => activeAutoCadData);

  useEffect(() => {
    const nextData = normalizeAutoCadPayload(data);
    if (!nextData || selectedAutoCadDocument || lastLoadedAutoCadDocument) {
      return;
    }

    activeAutoCadData = nextData;
    setLiveData(nextData);
  }, [data]);

  useEffect(() => {
    const handlePublishedData = (nextData) => {
      setLiveData(nextData);
    };

    cadSubscribers.add(handlePublishedData);
    return () => {
      cadSubscribers.delete(handlePublishedData);
    };
  }, []);

  useEffect(() => {
    const handleAutoCadUpdate = (payload) => {
      const payloadDocumentName = normalizeDocumentName(payload?.documentName);
      if (!payloadDocumentName || !canPublishDocument(payloadDocumentName)) {
        return;
      }

      const nextData = normalizeAutoCadPayload(payload);
      if (!nextData) return;

      publishLoadedAutoCadDocument(nextData, {
        documentName: payloadDocumentName,
        displayName: payload?.displayName,
      });
    };

    socket.on("autoCadJson", handleAutoCadUpdate);
    socket.on("updateAutoCad", handleAutoCadUpdate);

    return () => {
      socket.off("autoCadJson", handleAutoCadUpdate);
      socket.off("updateAutoCad", handleAutoCadUpdate);
    };
  }, []);

  return liveData;
}
