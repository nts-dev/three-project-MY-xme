import React, { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useFBX } from "@react-three/drei";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import useGame from "../hooks/useGame";
import { objects, sceneAssets } from "./player/puzzle/character/Constants.jsx";


/**
 * Grid-aligned Chessboard that matches your JSON generator grid system:
 * - No centering / no offset
 * - Grid starts at (0,0,0) and grows positive
 * - STEP = (tileSize + gap) * unitScale
 *
 * Notes:
 * - TILE_SCALE is still your FBX scale (visual size)
 * - STEP is the world spacing between tile centers
 */
const LevelChessBoard = ({
  fbx = "Tile.fbx",

  // matches your generator defaults (can be tuned)
  unitScale = 0.1,
  tileSize = 100,
  gap = 0,

  // Your tile model appears to need this base rotation (keep it)
  baseRotationDeg = { x: -90, y: 0, z: 0 },

  // optional: if you want "center-bottom" like (50,0,50) style, set true
  // (adds STEP/2 on X and Z only)
  centerBottomXZ = false,
}) => {
  // Zustand selectors
  const setScan = useGame((state) => state.setScan);
  const scan = useGame((state) => state.scan);
  const setSearchItem = useGame((state) => state.setSearchItem);
  const setScannedId = useGame((state) => state.setScannedId);
  const setTemplateAssetProps = useGame((state) => state.setTemplateAssetProps);
  const projectId = useGame((state) => state.projectID);

  const controlButtonIndex = useGame((state) => state.controlButtonIndex);
  const buttonMode = useGame((state) => state.buttonMode);
  const defaultInstanceId = useGame((state) => state.defaultInstanceId);
  const selectedAssetName = useGame((state) => state.selectedAssetName);
  const rotationValue = useGame((state) => state.rotationValue);
  const vAlignValue = useGame((state) => state.vAlignValue);
  const gridSize = useGame((state) => state.gridSize);
  const deleteObject = useGame((state) => state.deleteObject);

  const { scene, gl } = useThree();

  // Visual scale of the FBX tile (your existing value)
  const TILE_SCALE = 0.01;

  // World spacing between tile centers (matches your generator)
 // ✅ world spacing matches your scaled tile
const STEP = useMemo(
  () => (tileSize + gap) * unitScale * TILE_SCALE,
  [tileSize, gap, unitScale]
);

  const totalInstances = useMemo(
    () => gridSize.x * gridSize.y * gridSize.z,
    [gridSize.x, gridSize.y, gridSize.z]
  );

  const model = useFBX(`${import.meta.env.VITE_FILE_URL}/${fbx}`);

  const translucentRef = useRef();
  const highlightRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [hoveredId, setHoveredId] = useState(null);

  // Highlight mesh – created once and cleaned up properly
  const highlightMesh = useMemo(() => {
    const mesh = model.clone(true);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  }, [model, scene]);

  // ────────────────────────────────────────────────
  // Cleanup when projectId changes
  // ────────────────────────────────────────────────
  useEffect(() => {
    setHoveredId(null);

    Object.keys(sceneAssets).forEach((key) => {
      if (sceneAssets[key]?.name?.includes("chess") || sceneAssets[key]?.name?.includes("tile")) {
        delete sceneAssets[key];
      }
    });

    if (translucentRef.current) {
      translucentRef.current.count = 0;
      translucentRef.current.instanceMatrix.needsUpdate = true;
    }
    if (highlightRef.current) {
      highlightRef.current.count = 0;
      highlightRef.current.instanceMatrix.needsUpdate = true;
    }

    return () => {
      setHoveredId(null);
      if (translucentRef.current) translucentRef.current.dispose?.();
      if (highlightRef.current) highlightRef.current.dispose?.();
    };
  }, [projectId]);

  const geometry = useMemo(() => {
    const geo = model.children[0]?.geometry;
    if (geo) {
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
    }
    return geo;
  }, [model]);

  const baseMaterial = useMemo(() => model.children[0]?.material, [model]);

  const translucentMaterial = useMemo(() => {
    if (!baseMaterial) return null;
    const mat = baseMaterial.clone();
    mat.transparent = true;
    mat.opacity = 0.1;
    mat.depthWrite = false;
    mat.depthTest = false;
    return mat;
  }, [baseMaterial]);

  const wireframeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: "#f37979",
      wireframe: true,
      opacity: 0.3,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  // Helper to align to your generator: starts at (0,0,0) and increases positive
  const gridToWorld = useCallback(
    (x, y, z) => {
      const half = centerBottomXZ ? STEP / 2 : 0;
      return [x * STEP + half, y * STEP, z * STEP + half];
    },
    [STEP, centerBottomXZ]
  );

  const allPositions = useMemo(() => {
    const positions = [];
    for (let x = 0; x < gridSize.x; x++) {
      for (let y = 0; y < gridSize.y; y++) {
        for (let z = 0; z < gridSize.z; z++) {
          positions.push(gridToWorld(x, y, z));
        }
      }
    }
    return positions;
  }, [gridSize.x, gridSize.y, gridSize.z, gridToWorld]);

  const positionsAtLayer = useMemo(() => {
    const positions = [];
    for (let x = 0; x < gridSize.x; x++) {
      for (let z = 0; z < gridSize.z; z++) {
        positions.push(gridToWorld(x, controlButtonIndex, z));
      }
    }
    return positions;
  }, [gridSize.x, gridSize.z, controlButtonIndex, gridToWorld]);

  // Update translucent instances (entire grid volume)
  useEffect(() => {
    if (!translucentRef.current || !geometry) return;

    const rotation = new THREE.Euler(
      THREE.MathUtils.degToRad(baseRotationDeg.x),
      THREE.MathUtils.degToRad(baseRotationDeg.y),
      THREE.MathUtils.degToRad(baseRotationDeg.z)
    );
    const scale = new THREE.Vector3(TILE_SCALE, TILE_SCALE, TILE_SCALE);

    for (let i = 0; i < allPositions.length; i++) {
      const p = allPositions[i];
      dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.copy(rotation);
      dummy.scale.copy(scale);
      dummy.updateMatrix();
      translucentRef.current.setMatrixAt(i, dummy.matrix);
    }

    translucentRef.current.instanceMatrix.needsUpdate = true;
    translucentRef.current.count = allPositions.length;

    return () => {
      if (translucentRef.current) {
        translucentRef.current.count = 0;
        translucentRef.current.instanceMatrix.needsUpdate = true;
      }
    };
  }, [allPositions, geometry, dummy, baseRotationDeg]);

  // Show/hide translucent layer based on mode
  useEffect(() => {
    if (translucentRef.current) {
       translucentRef.current.visible = buttonMode === "Preview Mode #2";
    }
  }, [buttonMode]);

  // Update highlight layer (only current Y layer)
  useEffect(() => {
    if (!highlightRef.current || !geometry) return;

    const rotation = new THREE.Euler(
      THREE.MathUtils.degToRad(baseRotationDeg.x),
      THREE.MathUtils.degToRad(baseRotationDeg.y),
      THREE.MathUtils.degToRad(baseRotationDeg.z)
    );
    const scale = new THREE.Vector3(TILE_SCALE, TILE_SCALE, TILE_SCALE);

    for (let i = 0; i < positionsAtLayer.length; i++) {
      const p = positionsAtLayer[i];
      dummy.position.set(p[0], p[1], p[2]);
      dummy.rotation.copy(rotation);
      dummy.scale.copy(scale);
      dummy.updateMatrix();
      highlightRef.current.setMatrixAt(i, dummy.matrix);
    }

    highlightRef.current.count = positionsAtLayer.length;
    highlightRef.current.instanceMatrix.needsUpdate = true;
  }, [positionsAtLayer, geometry, dummy, baseRotationDeg]);

  // Pointer events
  const handlePointerOver = useCallback(
    (e) => {
      e.stopPropagation();
      if (buttonMode !== "Edit Mode") return;

      const id = e.instanceId;
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();

      e.object.getMatrixAt(id, matrix);
      matrix.decompose(position, quaternion, scale);

      // ✅ no offset
      highlightMesh.position.copy(position);
      highlightMesh.scale.copy(scale);
      highlightMesh.visible = true;

      setHoveredId(id);
    },
    [highlightMesh, buttonMode]
  );

  const handlePointerOut = useCallback(
    (e) => {
      e.stopPropagation();
      highlightMesh.visible = false;
      setHoveredId(null);
    },
    [highlightMesh]
  );

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (deleteObject || buttonMode !== "Edit Mode") return;

      const id = e.instanceId;
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();

      // NOTE: your asset rotation value is degrees; keep as radians for Three Euler
      const rotation = new THREE.Euler(0, THREE.MathUtils.degToRad(rotationValue), 0);

      e.object.getMatrixAt(id, matrix);
      matrix.decompose(position, quaternion, scale);

      // ✅ no offset (position already in generator grid space)

      if (selectedAssetName && objects[selectedAssetName] && !selectedAssetName.includes("platform")) {
        const asset = objects[selectedAssetName];
        if (!asset.assetID || [0, 8725, 8743].includes(asset.assetID)) return;

        const { categoryIndex, assetID, name, halfLength, halfWidth, color } = asset;

        const templateAssetProps = {
          categoryIndex,
          assetID,
          name,
          halfLength: halfWidth,
          length: halfLength,
          position,
          rotation,
          projectId,
          vAlignValue,
          color,
          textures: [],
        };
        setTemplateAssetProps(templateAssetProps);
        return;
      }

      if (!sceneAssets[defaultInstanceId]) return;

      const { categoryIndex, name, assetID, length, width, color } = sceneAssets[defaultInstanceId];

      const templateAssetProps = {
        categoryIndex,
        assetID,
        name,
        halfLength: width,
        length,
        position,
        rotation,
        projectId,
        vAlignValue,
        color,
        textures: [],
      };

      setTemplateAssetProps(templateAssetProps);
      setScannedId(`${defaultInstanceId}t_click`);
      setScan(!scan);
      setSearchItem({ noZoom: true });
    },
    [
      deleteObject,
      buttonMode,
      selectedAssetName,
      defaultInstanceId,
      rotationValue,
      vAlignValue,
      projectId,
      setTemplateAssetProps,
      setScannedId,
      setScan,
      setSearchItem,
      scan,
    ]
  );

  // Cursor style
  useEffect(() => {
    gl.domElement.style.cursor =
      hoveredId !== null && buttonMode === "Edit Mode" ? "pointer" : "default";
  }, [hoveredId, buttonMode, gl]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      scene.remove(highlightMesh);
      highlightMesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });

      if (translucentRef.current) translucentRef.current.dispose?.();
      if (highlightRef.current) highlightRef.current.dispose?.();
    };
  }, [highlightMesh, scene]);

  if (!geometry || !baseMaterial || !translucentMaterial) return null;

  return (
    <>
      {/* <directionalLight position={[5, 10, 5]} intensity={0.1} />
      <ambientLight intensity={0.4} /> */}

      <instancedMesh ref={translucentRef} args={[geometry, translucentMaterial, totalInstances]} />

      <instancedMesh
        ref={highlightRef}
        args={[geometry, wireframeMaterial, gridSize.x * gridSize.z]}
        onPointerOver={buttonMode === "Edit Mode" ? handlePointerOver : undefined}
        onPointerOut={buttonMode === "Edit Mode" ? handlePointerOut : undefined}
        onDoubleClick={buttonMode === "Edit Mode" ? handleClick : undefined}
        visible={buttonMode === "Edit Mode"}
      />
    </>
  );
};

export default LevelChessBoard;
