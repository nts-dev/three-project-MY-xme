import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import { ColorPicker } from "primereact/colorpicker";
import useGame from "../../../../hooks/useGame.tsx";
import "../GameConfirm.css";


export default function AddLevel() {
  const addLevel = useGame((state) => state.addLevel);
  const setAddLevel = useGame((state) => state.setAddLevel);
  const setProjectID = useGame((state) => state.setProjectID);

  const projectID = useGame((state) => state.projectID);

  const setCharacter = useGame((state) => state.setCharacter);
  const setFirstPerson = useGame((state) => state.setFirstPerson);
  const setGridSize = useGame((state) => state.setGridSize);
  const setIsPuzzleGame = useGame((state) => state.setIsPuzzleGame);
  const setButtonMode = useGame((state) => state.setButtonMode);
  const setSelectedAssetName = useGame((state) => state.setSelectedAssetName);
  const setSelectedAssetId = useGame((state) => state.setSelectedAssetId);
  const setCategory = useGame((state) => state.setCategory);
  const levels = useGame((s) => s.levels);
  const setLevels = useGame((s) => s.setLevels);
  const setSelectedLevel = useGame((s) => s.setSelectedLevel);

  const toast = useRef(null);
  const baseProjectId = useMemo(() => String(projectID || "").split("_")[0], [projectID]);
  const [x, setX] = useState(40);
  const [y, setY] = useState(20);
  const [z, setZ] = useState(40);
  const [color, setColor] = useState("000");

  const [saving, setSaving] = useState(false);
  const [nextLevel, setNextLevel] = useState("1");
  const [loadingLevel, setLoadingLevel] = useState(false);

  const warn = (detail) => {
    toast.current?.show({
      severity: "warn",
      summary: "Warning",
      detail,
      life: 3000,
    });
  };

  const success = (detail) => {
    toast.current?.show({
      severity: "success",
      summary: "Saved",
      detail,
      life: 2500,
    });
  };

  // ---------- validation setters ----------
  const setXValue = (value) => {
    const n = Number(value);
    if (!Number.isNaN(n) && n <= 100) setX(value);
    else warn("Enter valid X (1 - 100)");
  };

  const setYValue = (value) => {
    const n = Number(value);
    if (!Number.isNaN(n) && n <= 40) setY(value);
    else warn("Enter valid Y (1 - 40)");
  };

  const setZValue = (value) => {
    const n = Number(value);
    if (!Number.isNaN(n) && n <= 100) setZ(value);
    else warn("Enter valid Z (1 - 100)");
  };

  // ---------- apply grid to game ----------
  const setLevelGridSize = () => {
    // setIsPuzzleGame(1);
    setGridSize({
      x: parseInt(x, 10),
      y: parseInt(y, 10),
      z: parseInt(z, 10),
      backgroundColor: `#${color}`,
    });
  };

  // ---------- fetch next level when dialog opens ----------
  useEffect(() => {
    if (!addLevel) return;
    setSelectedAssetName(null)
    setSelectedAssetId(0)
    setCategory(false)
    const controller = new AbortController();

    (async () => {
      try {
        setLoadingLevel(true);
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/next-level/${baseProjectId}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Failed to load next level (${res.status})`);
        }

        const data = await res.json();

        setNextLevel(String(data?.nextLevel ?? 1));
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error(err);
        warn("Could not load next level from server");
        setNextLevel("1");
      } finally {
        setLoadingLevel(false);
      }
    })();

    return () => controller.abort();
  }, [addLevel, baseProjectId]);

  // ---------- save to backend (backend computes level) ----------
  const saveLevelToApi = useCallback(async () => {
    const payload = {
      project_id: String(baseProjectId),
      x_length: String(parseInt(x, 10)),
      y_length: String(parseInt(y, 10)),
      z_length: String(parseInt(z, 10)),
      bg_color: `#${color}`,
    };

    const res = await fetch(`${import.meta.env.VITE_API_URL}/game-level`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API failed (${res.status}): ${text || "No response body"}`);
    }

    // expected: { success, id, nextLevel, project }
    return await res.json();
  }, [projectID, x, y, z, color]);

  const handleAddLevel = async (hide, e) => {
    if (!x || !y || !z) {
      warn("Check your form again!");
      return;
    }

    try {
      setSaving(true);

      // 1) Save to DB (backend decides nextLevel)
      const saved = await saveLevelToApi();

      const lvl = String(saved?.nextLevel ?? nextLevel);

      success(`Level L${lvl} saved successfully`);

      // 2) Update game state / UI
      setFirstPerson(false);
      setCharacter(false);

      // Use server-generated level for your in-game project string
      setProjectID(`${baseProjectId}_L${lvl}`);
      setNextLevel(lvl);


      

      setLevelGridSize();

      hide(e);
      setAddLevel(false);
       const newLevel = { name: `L ${lvl}`, code: lvl };
      setLevels([...levels, newLevel])

      setTimeout(() => {
        setButtonMode("Edit Mode")
          const newLevel = { name: `L ${lvl}`, code: lvl };
           setSelectedLevel(newLevel)
      }, 1000);

    } catch (err) {
      console.error(err);
      toast.current?.show({
        severity: "error",
        summary: "Save failed",
        detail: err?.message || "Could not save level",
        life: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = !saving && !loadingLevel;

  return (
    <div className="game-confirm-wrapper">
      <Toast ref={toast} />

      <Dialog
        visible={addLevel}
        onHide={() => {
          if (!addLevel) return;
          setAddLevel(false);
        }}
        className={"game-dialog"}
        content={({ hide }) => (
          <div className="game-confirm">
            <div className="grid-header">
              <div> {loadingLevel ? "Loading level..." : `New Level: L${nextLevel}`}</div>

            </div>

            <div className="form-group">
              <label htmlFor="xlen">X Length</label>
              <InputText
                id="xlen"
                className="input-field"
                placeholder="Enter X length (1-100)"
                value={x}
                onChange={(e) => setXValue(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="ylen">Y Length</label>
              <InputText
                id="ylen"
                className="input-field"
                placeholder="Enter Y length (1-40)"
                value={y}
                onChange={(e) => setYValue(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="zlen">Z Length</label>
              <InputText
                id="zlen"
                className="input-field"
                placeholder="Enter Z length (1-100)"
                value={z}
                onChange={(e) => setZValue(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="cp-hex" className="font-bold block mb-2">
                Background Color
              </label>
              <ColorPicker
                inputId="cp-hex"
                format="hex"
                value={color}
                onChange={(e) => setColor(e.value)}
                className="mb-3"
              />
            </div>

            <div className="button-group">
              <Button
                label="Cancel"
                className="action-btn"
                disabled={saving}
                onClick={() => setAddLevel(false)}
              />
              <Button
                label={
                  saving
                    ? "Saving..."
                    : loadingLevel
                      ? "Loading..."
                      : `Add Level (L${nextLevel})`
                }
                className="action-btn"
                disabled={!canSubmit}
                onClick={(e) => handleAddLevel(hide, e)}
              />
            </div>
          </div>
        )}
      />
    </div>
  );
}
