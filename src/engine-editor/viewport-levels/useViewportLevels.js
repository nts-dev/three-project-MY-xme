import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGame from '../../hooks/useGame';
import { DEFAULT_LEVEL_CODE, buildLevelOptions, getBaseProjectId, getCurrentLevelCode } from './levelUtils';

const fetchJson = async (url, signal) => {
    const res = await fetch(url, { signal });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed (${res.status})`);
    }
    return res.json();
};

export const useViewportLevels = () => {
    const projectID = useGame((state) => state.projectID);
    const selectedLevel = useGame((state) => state.selectedLevel);
    const setSelectedLevel = useGame((state) => state.setSelectedLevel);
    const levels = useGame((state) => state.levels);
    const setLevels = useGame((state) => state.setLevels);
    const setProjectID = useGame((state) => state.setProjectID);
    const setGridSize = useGame((state) => state.setGridSize);
    const setIsPuzzleGame = useGame((state) => state.setIsPuzzleGame);
    const [loading, setLoading] = useState(false);
    const rowAbortRef = useRef(null);
    const requestedLevelRef = useRef(null);

    const baseProjectId = useMemo(() => getBaseProjectId(projectID), [projectID]);
    const currentLevelCode = useMemo(() => getCurrentLevelCode(projectID), [projectID]);
    const selectedLevelCode = String(currentLevelCode ?? DEFAULT_LEVEL_CODE);

    useEffect(() => {
        if (!baseProjectId) return;
        const controller = new AbortController();

        (async () => {
            try {
                setLoading(true);
                const rows = await fetchJson(`${import.meta.env.VITE_API_URL}/get-game-levels?project_id=${encodeURIComponent(baseProjectId)}`, controller.signal);
                const options = buildLevelOptions(rows);
                const fallback = options.find((option) => option.code === DEFAULT_LEVEL_CODE)
                    || options[0]
                    || { name: `L ${DEFAULT_LEVEL_CODE}`, code: DEFAULT_LEVEL_CODE };
                const selected = currentLevelCode ? options.find((option) => String(option.code) === String(currentLevelCode)) : null;
                setLevels(options);
                setSelectedLevel(selected || fallback);
            } catch (error) {
                if (error?.name !== 'AbortError') {
                    console.error('Load editor levels error:', error);
                    setLevels([{ name: `L ${DEFAULT_LEVEL_CODE}`, code: DEFAULT_LEVEL_CODE }]);
                }
            } finally {
                setLoading(false);
            }
        })();

        return () => controller.abort();
    }, [baseProjectId, currentLevelCode, setLevels, setSelectedLevel]);

    const applyLevel = useCallback(async (levelCode) => {
        if (!baseProjectId || !levelCode) return;

        rowAbortRef.current?.abort();
        const controller = new AbortController();
        rowAbortRef.current = controller;
        requestedLevelRef.current = String(levelCode);

        try {
            setLoading(true);
            const url = `${import.meta.env.VITE_API_URL}/get-game-level/one?project_id=${encodeURIComponent(baseProjectId)}&level=${encodeURIComponent(levelCode)}`;
            const row = await fetchJson(url, controller.signal);
            if (requestedLevelRef.current !== String(levelCode)) return;

            setGridSize({
                x: parseInt(row.x_length, 10),
                y: parseInt(row.y_length, 10),
                z: parseInt(row.z_length, 10),
                backgroundColor: row.bg_color?.startsWith('#') ? row.bg_color : `#${row.bg_color || '000'}`,
            });
               
            const nextProjectId = `${baseProjectId}_L${levelCode}`;
            if (String(useGame.getState().projectID || '') !== nextProjectId) {
                setProjectID(nextProjectId);
            }
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.error('Load editor level row error:', error);
            }
        } finally {
            setLoading(false);
        }
    }, [baseProjectId, setGridSize, setIsPuzzleGame, setProjectID]);

    useEffect(() => {
        if (!baseProjectId || String(baseProjectId).includes('151')) return;
        applyLevel(currentLevelCode || DEFAULT_LEVEL_CODE);
    }, [applyLevel, baseProjectId, currentLevelCode]);

    const selectLevel = useCallback(async (levelCode) => {
        const code = String(levelCode ?? DEFAULT_LEVEL_CODE);
        const option = levels.find((level) => String(level?.code) === code) || { name: `L ${code}`, code };
        setSelectedLevel(option);

        if (code === '0') {
            requestedLevelRef.current = '0';
            setProjectID(`${baseProjectId}_L0`);
            return;
        }

        await applyLevel(code);
    }, [applyLevel, baseProjectId, levels, setProjectID, setSelectedLevel]);

    return { levels, loading, selectedLevelCode, selectLevel };
};
