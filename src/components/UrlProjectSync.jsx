import { useEffect, useRef } from "react";
import useGame from "../hooks/useGame";
import { parseAnimateMotionArgs } from "./popup/spectrum-analyzer/chat/chatCommandParser";
import { animateMotionFromDsl } from "./popup/spectrum-analyzer/chat/dslSceneCommands";

const PREVIEW_MESSAGE_TYPE = "theia-preview-params";
const RUN_COMMAND_MESSAGE_TYPE = "theia-dsl-run-command";
const PREVIEW_PARAMS_EVENT = "theia-preview-params-changed";
const DSL_SCENE_COMMAND_APPLIED = "dsl-scene-command-applied";
const DEFAULT_LEVEL_CODE = "0";
let liveDslCommandQueue = Promise.resolve();

function normalizeProjectId(rawValue) {
  if (!rawValue) return null;
  const normalizedValue = String(rawValue).trim().replace(/[,\s]+$/g, "");
  if (!normalizedValue) return null;
  return /^\d+$/.test(normalizedValue) ? parseInt(normalizedValue, 10) : normalizedValue;
}

function isEmbeddedEditMode(params) {
  const mode = params.get("mode");
  const skipMenu = params.get("skipMenu");
  const source = params.get("source");
  return mode === "edit" || skipMenu === "1" || source === "theia";
}

function isTruthyParam(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function isPackageMode(params, projectId) {
  const rawProjectId = String(projectId ?? params.get("projectId") ?? "").replace(/_L\d+$/i, "");
  return rawProjectId === "140"
    || isTruthyParam(params.get("isPackage"))
    || isTruthyParam(params.get("package"))
    || params.get("mode") === "package"
    || params.get("view") === "package";
}

function isDirectPlayMode(params, projectId) {
  if (isEmbeddedEditMode(params)) return false;

  const mode = params.get("mode");
  const view = params.get("view");
  const directPlay = params.get("directPlay");
  const playMode = params.get("playMode");
  const play = params.get("play");

  return (
    Boolean(projectId)
    || mode === "play"
    || view === "play"
    || isTruthyParam(directPlay)
    || isTruthyParam(playMode)
    || isTruthyParam(play)
  );
}

function getUrlProjectParts(projectId, explicitLevel) {
  const raw = String(projectId ?? "").trim();
  const match = /^(.*)_L(\d+)$/i.exec(raw);
  const baseProjectId = match ? match[1] : raw;
  const levelCode = explicitLevel || (match ? String(parseInt(match[2], 10)) : DEFAULT_LEVEL_CODE);
  const storeProjectId = match || explicitLevel ? `${baseProjectId}_L${levelCode}` : raw;

  return { baseProjectId, levelCode, storeProjectId };
}

export default function UrlProjectSync() {
  const setProjectID = useGame((state) => state.setProjectID);
  const setIsPuzzleGame = useGame((state) => state.setIsPuzzleGame);
  const setSelectedLevel = useGame((state) => state.setSelectedLevel);
  const setPreviewDslMode = useGame((state) => state.setPreviewDslMode);
  const setDirectPlayMode = useGame((state) => state.setDirectPlayMode);
  const setDslSceneCommand = useGame((state) => state.setDslSceneCommand);
  const setRawCategories = useGame((state) => state.setRawCategories);
  const setPackageControl = useGame((state) => state.setPackageControl);
  const setIsPackage = useGame((state) => state.setIsPackage);
  const setBranch = useGame((state) => state.setBranch);
  const lastRefreshTokenRef = useRef("");
  const lastDirectPlayCategoriesRef = useRef("");

  useEffect(() => {
    const syncFromParams = (params, shouldUpdateUrl = false) => {
      if (!(params instanceof URLSearchParams)) {
        return;
      }

      if (shouldUpdateUrl) {
        const nextSearch = params.toString();
        const currentSearch = window.location.search.replace(/^\?/, "");
        if (nextSearch !== currentSearch) {
          const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname;
          window.history.replaceState(window.history.state, "", nextUrl);
        }
      }

      const projectId = normalizeProjectId(params.get("projectId"));
      const refreshToken = params.get("refreshToken") || "";
      const previewDslMode = params.get("dslMode");
      const explicitLevel = params.get("level");
      const {
        baseProjectId,
        levelCode: nextLevelCode,
        storeProjectId,
      } = getUrlProjectParts(projectId, explicitLevel);
      const directPlayMode = isDirectPlayMode(params, projectId);
      const packageMode = isPackageMode(params, projectId);

      if (packageMode) {
        setPackageControl(true);
        setIsPackage(true);
        setProjectID(0);
        setBranch("Packaging");
      } else if (projectId !== null) {
        setPackageControl(false);
        setIsPackage(false);
        setProjectID(storeProjectId);
      }

      setSelectedLevel({
        name: `L ${nextLevelCode}`,
        code: nextLevelCode
      });
      setPreviewDslMode(previewDslMode || null);
      setDirectPlayMode(directPlayMode);

      if (directPlayMode) {
        const {
          setButtonMode,
          setCharacter,
          setFirstPerson,
          setPauseGame,
          setGrid,
          setEditorSelectionEnabled,
          setSelectedEditorInstance,
        } = useGame.getState();

        setButtonMode("Play mode");
        setCharacter(true);
        setFirstPerson(false);
        setPauseGame(false);
        setGrid(false);
        setEditorSelectionEnabled(false);
        setSelectedEditorInstance(null);
        window.dispatchEvent(new CustomEvent("editor-detach-transform-controls"));

        const categoryKey = `${baseProjectId || ""}:${nextLevelCode}`;
        if (baseProjectId && lastDirectPlayCategoriesRef.current !== categoryKey) {
          lastDirectPlayCategoriesRef.current = categoryKey;
          const categoryIsGame = baseProjectId == 147;
          fetch(`${import.meta.env.VITE_API_URL}/getCategories/${categoryIsGame}/${baseProjectId}`)
            .then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.json();
            })
            .then((data) => setRawCategories(data?.data || data || []))
            .catch((error) => {
              console.error("Failed to load direct-play categories:", error);
              setRawCategories([]);
            });
        }
      }

      // setIsPuzzleGame(
      //   previewDslMode
      //     ? previewDslMode === "game"
      //     : embeddedEditMode || (typeof projectId === "string" && /_L\d+$/i.test(projectId))
      // );

      if (refreshToken && refreshToken !== lastRefreshTokenRef.current) {
        const { checkReload, setCheckReload } = useGame.getState();
        setCheckReload((Number(checkReload) || 0) + 1);
      }
      lastRefreshTokenRef.current = refreshToken;

      window.dispatchEvent(new CustomEvent(PREVIEW_PARAMS_EVENT, { detail: Object.fromEntries(params.entries()) }));
    };

    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const launchToken = params.get("launch");
      if (launchToken && !params.get("projectId")) {
        params.set("projectId", launchToken);
      }

      window.__NTS_RESOLVED_LAUNCH_PARAMS = null;
      syncFromParams(params, false);
    };

    const handlePreviewMessage = (event) => {
      const data = event?.data;
      if (!data) {
        return;
      }

      if (data.type === RUN_COMMAND_MESSAGE_TYPE && typeof data.command === "string") {
        queueLiveDslCommand(data.command, setDslSceneCommand);
        return;
      }

      if (data.type !== PREVIEW_MESSAGE_TYPE || typeof data.params !== "object") {
        return;
      }

      const nextParams = new URLSearchParams();
      Object.entries(data.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          nextParams.set(key, String(value));
        }
      });

      syncFromParams(nextParams, true);
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("message", handlePreviewMessage);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("message", handlePreviewMessage);
    };
  }, [setBranch, setDirectPlayMode, setDslSceneCommand, setIsPackage, setIsPuzzleGame, setPackageControl, setPreviewDslMode, setProjectID, setRawCategories, setSelectedLevel]);

  return null;
}

function queueLiveDslCommand(command, setDslSceneCommand) {
  liveDslCommandQueue = liveDslCommandQueue
    .then(() => runLiveDslCommand(command, setDslSceneCommand))
    .catch((error) => {
      console.error("[theia-dsl-run-command] command queue failed", error);
    });
}

async function runLiveDslCommand(command, setDslSceneCommand) {
  const trimmed = String(command || "").trim().replace(/^#/, "");
  if (!/^animateMotion\s+/i.test(trimmed)) {
    return;
  }

  try {
    const parsed = parseAnimateMotionArgs(trimmed.replace(/^animateMotion\s+/i, ""));
    const projectId = getActiveProjectId();
    const result = await animateMotionFromDsl({ projectId, ...parsed });
    const commandPayload = {
      data: result.delta?.category ? { categories: [result.delta.category] } : result.data || { categories: [] },
      projectId: result.projectId,
      assetId: result.animation.id,
      source: parsed.target,
      saved: false,
      delta: result.delta,
      commandId: `${result.projectId}:${result.animation.id}:${Date.now()}`,
      createdAt: Date.now(),
    };

    setDslSceneCommand(commandPayload);
    window.dispatchEvent(new CustomEvent(DSL_SCENE_COMMAND_APPLIED, { detail: commandPayload }));
  } catch (error) {
    console.error("[theia-dsl-run-command] animateMotion failed", error);
  }
}

function getActiveProjectId() {
  const params = new URLSearchParams(window.location.search);
  const urlProjectId = params.get("projectId");
  if (urlProjectId && /_L\d+$/i.test(urlProjectId)) {
    return urlProjectId;
  }

  const { projectID, selectedLevel } = useGame.getState();
  const levelCode = Number.parseInt(String(selectedLevel?.code ?? ""), 10);
  if (Number.isFinite(levelCode) && Number(projectID) > 0) {
    return `${projectID}_L${Math.max(0, levelCode)}`;
  }

  return projectID;
}
