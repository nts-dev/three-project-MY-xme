import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import singleEdges from "../../components/autoCad/single-edges.js";
import {
  loadAutoCadDocument,
  setHoveredAutoCadSegments,
  setSelectedAutoCadDocument,
  setSelectedAutoCadSegments,
  useAutoCadData,
  useHoveredAutoCadSegments,
  useSelectedAutoCadSegments,
} from "./autoCadData.js";
import "./singleEdgesDrawing.css";

const DSL_API_BASE = import.meta.env.VITE_DSL_API_BASE || "http://localhost:3002/api-dsl";
const PREVIEW_PARAMS_EVENT = "theia-preview-params-changed";
const TAB_NAMES = ["Tree", "Clip", "Material", "Zebra"];
const VIEWER_UI_OPTIONS = ["glass"];
const CONTROL_OPTIONS = ["orbit/Y up"];

function normalizeCadOptionToken(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

function resolveCadDocumentHintFromUrl() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  const resolvedParams = window.__NTS_RESOLVED_LAUNCH_PARAMS || {};
  const value =
    params.get("cadDocument")
    || params.get("lineDocument")
    || resolvedParams.cadDocument
    || resolvedParams.lineDocument;
  return typeof value === "string" ? value.trim() : "";
}

function hasLaunchParam() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("launch");
}

function isUrlLevelProjectLaunch() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const skipMenu = params.get("skipMenu");
  const source = params.get("source");
  const projectId = params.get("projectId") || window.__NTS_RESOLVED_LAUNCH_PARAMS?.projectId || "";

  return /_L\d+$/i.test(String(projectId || ""))
    && mode !== "edit"
    && skipMenu !== "1"
    && source !== "theia";
}

function setCadDocumentUrlParam(documentName) {
  if (typeof window === "undefined" || !documentName) return;

  const params = new URLSearchParams(window.location.search);
  params.set("cadDocument", documentName);
  const nextSearch = params.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function resolveSelectedCadValue(options, preferredValue) {
  const normalizedPreferredValue = normalizeCadOptionToken(preferredValue);
  if (!normalizedPreferredValue) return options[0]?.value || "LinesAD1";

  const match = options.find((option) => {
    const normalizedValue = normalizeCadOptionToken(option?.value);
    const normalizedLabel = normalizeCadOptionToken(option?.label);
    return normalizedValue === normalizedPreferredValue || normalizedLabel === normalizedPreferredValue;
  });
  return match?.value || preferredValue;
}

const RULER_ELEVATION = 0.01;
const RULER_MINOR_DIVISIONS = 5;

function getNiceStep(range) {
  if (!Number.isFinite(range) || range <= 0) return 1;

  const roughStep = range / 8;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return magnitude * 2;
  if (normalized <= 5) return magnitude * 5;
  return magnitude * 10;
}

function intersectPlane(camera, x, y, planeY) {
  const near = new THREE.Vector3(x, y, -1).unproject(camera);
  const far = new THREE.Vector3(x, y, 1).unproject(camera);
  const direction = far.sub(near).normalize();
  const ray = new THREE.Ray(near, direction);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const hit = new THREE.Vector3();

  return ray.intersectPlane(plane, hit) ? hit : null;
}

function getVisibleCadBounds(camera, planeY) {
  const corners = [
    intersectPlane(camera, -1, 1, planeY),
    intersectPlane(camera, 1, 1, planeY),
    intersectPlane(camera, -1, -1, planeY),
    intersectPlane(camera, 1, -1, planeY),
  ].filter(Boolean);

  if (corners.length < 4) return null;

  const xs = corners.map((point) => point.x / 0.01);
  const zs = corners.map((point) => point.z / 0.01);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    height: maxZ - minZ,
  };
}

function buildAnchoredRulerTicks(camera, viewport, planeY) {
  const bounds = getVisibleCadBounds(camera, planeY);
  const widthPx = viewport?.clientWidth ?? 0;
  const heightPx = viewport?.clientHeight ?? 0;

  if (!bounds || widthPx <= 0 || heightPx <= 0 || bounds.width <= 0 || bounds.height <= 0) {
    return { horizontal: [], vertical: [], visible: false };
  }

  const majorStep = getNiceStep(Math.max(bounds.width, bounds.height));
  const minorStep = majorStep / RULER_MINOR_DIVISIONS;
  const minorPixelX = (minorStep / bounds.width) * widthPx;
  const minorPixelY = (minorStep / bounds.height) * heightPx;

  if (!Number.isFinite(minorPixelX) || !Number.isFinite(minorPixelY) || minorPixelX <= 0 || minorPixelY <= 0) {
    return { horizontal: [], vertical: [], visible: false };
  }

  const horizontal = [];
  const vertical = [];
  const hCount = Math.ceil(widthPx / minorPixelX) + 1;
  const vCount = Math.ceil(heightPx / minorPixelY) + 1;

  for (let index = 0; index <= hCount; index += 1) {
    const pixel = index * minorPixelX;
    if (pixel > widthPx + 1) break;

    const value = index * minorStep;
    const isMajor = index % RULER_MINOR_DIVISIONS === 0;
    horizontal.push({
      offset: (pixel / widthPx) * 100,
      label: isMajor ? formatCadLength(value) : "",
      major: isMajor,
    });
  }

  for (let index = 0; index <= vCount; index += 1) {
    const pixel = index * minorPixelY;
    if (pixel > heightPx + 1) break;

    const value = -(index * minorStep);
    const isMajor = index % RULER_MINOR_DIVISIONS === 0;
    vertical.push({
      offset: (pixel / heightPx) * 100,
      label: isMajor ? formatCadLength(value) : "",
      major: isMajor,
    });
  }

  return { horizontal, vertical, visible: true };
}

function formatCadLength(value) {
  if (!Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function measureSegments(edges, segmentIndices) {
  if (!Array.isArray(segmentIndices) || segmentIndices.length === 0) return 0;

  let total = 0;
  const uniqueIndices = Array.from(new Set(segmentIndices.map((value) => Number(value)).filter(Number.isFinite)));

  for (const segmentIndex of uniqueIndices) {
    const startIndex = segmentIndex * 6;
    if (startIndex + 5 >= edges.length) continue;

    const x1 = edges[startIndex] ?? 0;
    const z1 = edges[startIndex + 1] ?? 0;
    const x2 = edges[startIndex + 3] ?? 0;
    const z2 = edges[startIndex + 4] ?? 0;
    total += Math.hypot(x2 - x1, z2 - z1);
  }

  return total;
}

function collectSegmentIndices(node) {
  if (!node || typeof node !== "object") return [];
  const own = Array.isArray(node.segmentIndices) ? node.segmentIndices : [];
  const childSegments = Array.isArray(node.children)
    ? node.children.flatMap((child) => collectSegmentIndices(child))
    : [];
  return Array.from(new Set([...own, ...childSegments].map((value) => Number(value)).filter(Number.isFinite)));
}

function getSelectionState(node, selectedSet) {
  const segmentIndices = collectSegmentIndices(node);
  if (!segmentIndices.length) return "none";
  const selectedCount = segmentIndices.filter((index) => selectedSet.has(index)).length;
  if (selectedCount === 0) return "none";
  if (selectedCount === segmentIndices.length) return "full";
  return "partial";
}

function getIconClass(prefix, state) {
  if (state === "full") return `tcv_button_${prefix}`;
  if (state === "partial") return `tcv_button_${prefix}_mix`;
  return `tcv_button_${prefix}_no`;
}

function iconButton(label, iconClassName, onClick, title) {
  return (
    <button
      key={label}
      type="button"
      className={`cad-ui__tool ${iconClassName}`}
      onClick={onClick}
      title={title || label}
      aria-label={label}
    />
  );
}

function renderCadTreeNodes(
  nodes,
  {
    depth = 0,
    hoveredNodeId,
    setHoveredNodeId,
    expandedMap,
    setExpandedMap,
    selectedSet,
    setSelectedSet,
  } = {},
) {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;

  return nodes.map((node) => {
    const stats = node?.stats;
    const statText =
      stats && typeof stats === "object"
        ? [
            Number.isFinite(stats.segmentCount) ? `${stats.segmentCount}` : null,
            Number.isFinite(stats.width) ? `W ${stats.width}` : null,
            Number.isFinite(stats.height) ? `H ${stats.height}` : null,
          ]
            .filter(Boolean)
            .join(" | ")
        : "";
    const hasChildren = Array.isArray(node?.children) && node.children.length > 0;
    const isExpanded = hasChildren ? expandedMap[node.id] !== false : false;
    const isHovered = hoveredNodeId === node?.id;
    const selectionState = getSelectionState(node, selectedSet);
    const nodeSegmentIndices = collectSegmentIndices(node);
    const toggleSelection = () => {
      setSelectedSet((prev) => {
        const next = new Set(prev);
        const shouldSelect = selectionState !== "full";
        for (const segmentIndex of nodeSegmentIndices) {
          if (shouldSelect) next.add(segmentIndex);
          else next.delete(segmentIndex);
        }
        setSelectedAutoCadSegments(Array.from(next).sort((a, b) => a - b));
        return next;
      });
    };

    return (
      <div key={node?.id || `${node?.label}-${depth}`} className="tv-tree-node">
        <div className="tv-node-content">
          <span
            className="tv-nav-marker"
            style={{ marginLeft: depth * 20 }}
            onClick={
              hasChildren
                ? () =>
                    setExpandedMap((prev) => ({
                      ...prev,
                      [node.id]: !(prev[node.id] !== false),
                    }))
                : undefined
            }
          >
            {hasChildren ? (isExpanded ? "\u25BE" : "\u25B8") : ""}
          </span>
          <span
            className={`tv-icon tv-icon0 tcv_tree_button ${getIconClass("shape", selectionState)}`}
            onClick={toggleSelection}
          />
          <span
            className={`tv-icon tv-icon1 tcv_tree_button ${getIconClass("mesh", selectionState)}`}
            onClick={toggleSelection}
          />
          {hasChildren ? (
            <button
              type="button"
              className="tv-node-label cad-tree-label-button"
              onClick={() =>
                setExpandedMap((prev) => ({
                  ...prev,
                  [node.id]: !(prev[node.id] !== false),
                }))
              }
            >
              {node?.label}
              {statText ? ` (${statText})` : ""}
            </button>
          ) : (
            <button
              type="button"
              className={`tv-node-label cad-tree-label-button${isHovered ? " tv-node-label-highlight" : ""}`}
              onMouseEnter={() => {
                setHoveredNodeId(node?.id || null);
                setHoveredAutoCadSegments(node?.segmentIndices || []);
              }}
              onMouseLeave={() => {
                setHoveredNodeId(null);
                setHoveredAutoCadSegments([]);
              }}
            >
              {node?.label}
              {statText ? ` (${statText})` : ""}
            </button>
          )}
        </div>
        {hasChildren && isExpanded ? (
          <div className="tv-children">
            {renderCadTreeNodes(node.children, {
              depth: depth + 1,
              hoveredNodeId,
              setHoveredNodeId,
              expandedMap,
              setExpandedMap,
              selectedSet,
              setSelectedSet,
            })}
          </div>
        ) : null}
      </div>
    );
  });
}

export default function SingleEdgesOverlay({ data = singleEdges, cameraRef }) {
  const hideChrome = isUrlLevelProjectLaunch();
  const [cadDocumentHint, setCadDocumentHint] = useState(() => resolveCadDocumentHintFromUrl());
  const liveData = useAutoCadData(data);
  const hoveredSegments = useHoveredAutoCadSegments();
  const selectedSegments = useSelectedAutoCadSegments();
  const [activeTab, setActiveTab] = useState("Tree");
  const [cadOptions, setCadOptions] = useState([{ value: "LinesAD1", label: "LinesAD 1" }]);
  const [selectedCad, setSelectedCad] = useState(() => cadDocumentHint || (hasLaunchParam() ? "" : "LinesAD1"));
  const [selectedUi] = useState(VIEWER_UI_OPTIONS[0]);
  const [selectedControl] = useState(CONTROL_OPTIONS[0]);
  const [showHelp, setShowHelp] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [hoveredTreeNodeId, setHoveredTreeNodeId] = useState(null);
  const [expandedTreeNodes, setExpandedTreeNodes] = useState({ outside: true, inside: true });
  const [selectedTreeSegments, setSelectedTreeSegments] = useState(() => new Set());
  const viewportRef = useRef(null);
  const [rulerTicks, setRulerTicks] = useState({ horizontal: [], vertical: [], visible: false });
  const lastTopViewDocumentRef = useRef(null);
  // const [selectedTreeSegments, setSelectedTreeSegments] = useState(() => new Set());
  // const [selectedTreeSegments, setSelectedTreeSegments] = useState(() => new Set());
  const selectedCadLabel = useMemo(() => {
    const match = cadOptions.find((option) => option.value === selectedCad);
    return match?.label || selectedCad.replace("LinesAD", "LinesAD ");
  }, [cadOptions, selectedCad]);
  const displayedCadOptions = useMemo(() => {
    if (!selectedCad || cadOptions.some((option) => option.value === selectedCad)) {
      return cadOptions;
    }

    return [
      ...cadOptions,
      {
        value: selectedCad,
        label: selectedCad.replace("LinesAD", "LinesAD "),
      },
    ];
  }, [cadOptions, selectedCad]);

  const drawingStats = useMemo(() => {
    const edges = liveData?.parts?.[0]?.shape?.edges || [];
    const segmentCount = Math.floor(edges.length / 6);
    const bb = liveData?.bb || {};
    return {
      partName: liveData?.parts?.[0]?.name || "Lines",
      segmentCount,
      width: (bb.xmax ?? 0) - (bb.xmin ?? 0),
      height: (bb.ymax ?? 0) - (bb.ymin ?? 0),
      scaledWidth: ((bb.xmax ?? 0) - (bb.xmin ?? 0)) * 0.01,
      scaledHeight: ((bb.ymax ?? 0) - (bb.ymin ?? 0)) * 0.01,
    };
  }, [liveData]);
  const measurementStats = useMemo(() => {
    const edges = liveData?.parts?.[0]?.shape?.edges || [];
    return {
      hoveredLength: measureSegments(edges, hoveredSegments),
      selectedLength: measureSegments(edges, selectedSegments),
      selectedCount: Array.isArray(selectedSegments) ? selectedSegments.length : 0,
    };
  }, [hoveredSegments, liveData, selectedSegments]);
  const cadTree = useMemo(() => {
    const root = liveData?.cadTree;
    if (!root || typeof root !== "object") return null;
    return root;
  }, [liveData]);

  useEffect(() => {
    setSelectedTreeSegments(new Set());
    setSelectedAutoCadSegments([]);
  }, [liveData?.documentName]);

  useEffect(() => {
    setSelectedAutoCadSegments(Array.from(selectedTreeSegments).sort((a, b) => a - b));
  }, [selectedTreeSegments]);

  const focusRadius = Math.max(drawingStats.scaledWidth, drawingStats.scaledHeight, 1);

  const setView = useCallback(
    (position) => {
      const camera = cameraRef?.current;
      if (!camera) return;
      camera.position.set(position[0], position[1], position[2]);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    },
    [cameraRef]
  );

  const handleResetView = useCallback(() => {
    const d = Math.max(focusRadius * 1.6, 6);
    setView([0, d, d]);
  }, [focusRadius, setView]);

  const handleTopView = useCallback(() => {
    const d = Math.max(focusRadius * 2, 6);
    setView([0, d, 0.001]);
  }, [focusRadius, setView]);

  const handleCadDocumentChange = useCallback((event) => {
    const nextCad = event.target.value;
    setSelectedCad(nextCad);
    setCadDocumentUrlParam(nextCad);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const appRoot = document.querySelector(".editor-app-root");
    const roots = [document.documentElement, document.body, appRoot].filter(Boolean);
    roots.forEach((root) => root.classList.toggle("is-single-edges-url-overlay", hideChrome));
    if (hideChrome) {
      setShowSidebar(false);
    }

    return () => {
      roots.forEach((root) => root.classList.remove("is-single-edges-url-overlay"));
    };
  }, [hideChrome]);

  useEffect(() => {
    const syncCadHint = (event) => {
      const eventCadDocument =
        event?.detail && typeof event.detail.cadDocument === "string"
          ? event.detail.cadDocument.trim()
          : event?.detail && typeof event.detail.lineDocument === "string"
            ? event.detail.lineDocument.trim()
          : "";
      setCadDocumentHint(eventCadDocument || resolveCadDocumentHintFromUrl());
    };

    syncCadHint();
    window.addEventListener("popstate", syncCadHint);
    window.addEventListener(PREVIEW_PARAMS_EVENT, syncCadHint);

    return () => {
      window.removeEventListener("popstate", syncCadHint);
      window.removeEventListener(PREVIEW_PARAMS_EVENT, syncCadHint);
    };
  }, []);

  const toolbarButtons = useMemo(
    () => [
      iconButton("Panel", `cad-ui__tool--panel ${showSidebar ? "cad-ui__tool--active" : ""}`, () => setShowSidebar((prev) => !prev), showSidebar ? "Hide tabs" : "Show tabs"),
      iconButton("Iso", "cad-ui__tool--iso", () => setView([focusRadius, focusRadius, focusRadius]), "Isometric view"),
      iconButton("Top", "cad-ui__tool--top", handleTopView, "Top view"),
      iconButton("Front", "cad-ui__tool--front", () => setView([0, focusRadius, focusRadius * 2]), "Front view"),
      iconButton("Left", "cad-ui__tool--left", () => setView([-focusRadius * 2, focusRadius, 0]), "Left view"),
      iconButton("Right", "cad-ui__tool--right", () => setView([focusRadius * 2, focusRadius, 0]), "Right view"),
      iconButton("Reset", "cad-ui__tool--reset", handleResetView, "Reset view"),
      iconButton("Help", "cad-ui__tool--help", () => setShowHelp((prev) => !prev), "Toggle help"),
    ],
    [focusRadius, handleResetView, handleTopView, setView, showSidebar]
  );
  useEffect(() => {
    let cancelled = false;

    async function loadCadOptions() {
      try {
        const res = await fetch(`${DSL_API_BASE}/linesad-docs`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load CAD templates");
        const options = Array.isArray(data?.documents) && data.documents.length > 0
          ? data.documents.map((doc) => ({
              value: doc.name,
              label: typeof doc.displayName === "string" && doc.displayName.trim()
                ? doc.displayName.trim()
                : doc.name.replace("LinesAD", "LinesAD "),
            }))
          : [{ value: "LinesAD1", label: "LinesAD 1" }];
        if (cancelled) return;
        setCadOptions(options);
        setSelectedCad((prev) => resolveSelectedCadValue(options, cadDocumentHint || prev));
      } catch {
        if (cancelled) return;
        const fallbackOptions = [{ value: "LinesAD1", label: "LinesAD 1" }];
        setCadOptions(fallbackOptions);
        setSelectedCad((prev) => resolveSelectedCadValue(fallbackOptions, cadDocumentHint || prev));
      }
    }

    void loadCadOptions();
    return () => {
      cancelled = true;
    };
  }, [cadDocumentHint]);


  useEffect(() => {
    const documentName = typeof liveData?.documentName === "string" ? liveData.documentName.trim() : "";
    if (!documentName) return;

    const displayName =
      typeof liveData?.displayName === "string" && liveData.displayName.trim()
        ? liveData.displayName.trim()
        : documentName.replace("LinesAD", "LinesAD ");

    setCadOptions((prev) => {
      const existingIndex = prev.findIndex((option) => option.value === documentName);
      if (existingIndex < 0) {
        return [...prev, { value: documentName, label: displayName }];
      }

      const next = [...prev];
      next[existingIndex] = { value: documentName, label: displayName };
      return next;
    });
  }, [liveData?.displayName, liveData?.documentName]);

  useEffect(() => {
    if (!selectedCad) return;
    setSelectedAutoCadDocument(selectedCad);
    if (liveData?.documentName === selectedCad) return;

    let cancelled = false;

    async function loadSelectedCad() {
      try {
        await loadAutoCadDocument(selectedCad);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load selected CAD document", error);
        }
      }
    }

    void loadSelectedCad();
    return () => {
      cancelled = true;
    };
  }, [liveData?.documentName, selectedCad]);

  useEffect(() => {
    const documentName = typeof liveData?.documentName === "string" ? liveData.documentName.trim() : "";
    if (!documentName) return;
    if (lastTopViewDocumentRef.current === documentName) return;

    lastTopViewDocumentRef.current = documentName;
    handleTopView();
  }, [handleTopView, liveData?.documentName]);

  return (
    <div className="cad-ui">
      <div className="cad-ui__shell" data-theme="light">
        {!hideChrome ? (
          <>
            <div className="cad-ui__menu-row">
              <div className="cad-ui__menu-group">
                <span className="cad-ui__menu-label">Demo:</span>
              </div>
              <div className="cad-ui__menu-group">
                <label className="cad-ui__menu-label" htmlFor="cad-ui-mode">
                  UI
                </label>
                <select
                  id="cad-ui-mode"
                  className="cad-ui__select cad-ui__select--compact"
                  value={selectedUi}
                  onChange={() => {}}
                >
                  {VIEWER_UI_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cad-ui__menu-group">
                <label className="cad-ui__menu-label" htmlFor="cad-control-mode">
                  Control
                </label>
                <select
                  id="cad-control-mode"
                  className="cad-ui__select cad-ui__select--compact"
                  value={selectedControl}
                  onChange={() => {}}
                >
                  {CONTROL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cad-ui__menu-group">
                <label className="cad-ui__menu-label" htmlFor="cad-source">
                  Cad
                </label>
                <select
                  id="cad-source"
                  className="cad-ui__select cad-ui__select--compact"
                  value={selectedCad}
                  onChange={handleCadDocumentChange}
                >
                  {displayedCadOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="cad-ui__toolbar">
              <div className="cad-ui__toolbar-tools">{toolbarButtons}</div>
              <div className="cad-ui__measurements">
                <span className="cad-ui__measurement-chip">
                  Hover: {formatCadLength(measurementStats.hoveredLength)} u
                </span>
                <span className="cad-ui__measurement-chip">
                  Selected: {formatCadLength(measurementStats.selectedLength)} u
                </span>
                <span className="cad-ui__measurement-chip">
                  Segments: {measurementStats.selectedCount}
                </span>
              </div>
            </div>
          </>
        ) : null}

        <div className="cad-ui__body">
          {showSidebar ? (
            <aside className="cad-ui__sidebar">
              <div className="cad-ui__tabs">
                {TAB_NAMES.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`cad-ui__tab ${activeTab === tab ? "cad-ui__tab--active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="cad-ui__panel">
                {activeTab === "Tree" && (
                  <div className="cad-ui__panel-content">
                    <div className="cad-ui__section-title">{cadTree?.label || drawingStats.partName}</div>
                    {cadTree?.children ? (
                      <div className="tcv_toplevel">
                        {renderCadTreeNodes(cadTree.children, {
                          hoveredNodeId: hoveredTreeNodeId,
                          setHoveredNodeId: setHoveredTreeNodeId,
                          expandedMap: expandedTreeNodes,
                          setExpandedMap: setExpandedTreeNodes,
                          selectedSet: selectedTreeSegments,
                          setSelectedSet: setSelectedTreeSegments,
                        })}
                      </div>
                    ) : null}
                  </div>
                )}

                {activeTab === "Clip" && (
                  <div className="cad-ui__panel-content">
                    <div className="cad-ui__section-title">Clip</div>
                    <div className="cad-ui__placeholder">Clipping controls reserved for CAD mode.</div>
                  </div>
                )}

                {activeTab === "Material" && (
                  <div className="cad-ui__panel-content">
                    <div className="cad-ui__section-title">Material</div>
                    <div className="cad-ui__placeholder">Line material presets can be added here.</div>
                  </div>
                )}

                {activeTab === "Zebra" && (
                  <div className="cad-ui__panel-content">
                    <div className="cad-ui__section-title">Zebra</div>
                    <div className="cad-ui__placeholder">Zebra analysis is not enabled for the line-only CAD view.</div>
                  </div>
                )}
              </div>
            </aside>
          ) : null}

          <div ref={viewportRef} className={`cad-ui__viewport ${showSidebar ? "cad-ui__viewport--with-sidebar" : "cad-ui__viewport--full"}`}>
            {rulerTicks.visible ? (
              <>
                <div className="cad-ui__ruler cad-ui__ruler--horizontal">
                  {rulerTicks.horizontal.map((tick) => (
                    <div
                      key={"hx-" + tick.offset + "-" + tick.label + "-" + (tick.major ? "major" : "minor")}
                      className={"cad-ui__ruler-tick " + (tick.major ? "cad-ui__ruler-tick--major" : "")}
                      style={{ left: tick.offset + "%" }}
                    >
                      {tick.label ? <span className="cad-ui__ruler-label">{tick.label}</span> : null}
                    </div>
                  ))}
                </div>
                <div className="cad-ui__ruler cad-ui__ruler--vertical">
                  {rulerTicks.vertical.map((tick) => (
                    <div
                      key={"vz-" + tick.offset + "-" + tick.label + "-" + (tick.major ? "major" : "minor")}
                      className={"cad-ui__ruler-tick " + (tick.major ? "cad-ui__ruler-tick--major" : "")}
                      style={{ top: tick.offset + "%" }}
                    >
                      {tick.label ? <span className="cad-ui__ruler-label">{tick.label}</span> : null}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>          {showHelp && (
            <div className="cad-ui__help">
              <div className="cad-ui__help-title">Mouse Navigation</div>
              <div>Rotate: left mouse button</div>
              <div>Pan: right mouse button</div>
              <div>Zoom: mouse wheel</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}














