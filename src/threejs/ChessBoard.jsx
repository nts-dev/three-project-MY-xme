import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { useFBX } from '@react-three/drei';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import useGame from '../hooks/useGame';
import { objects, sceneAssets } from "./player/puzzle/character/Constants.jsx";

const Chessboard = ({ fbx = 'Tile.fbx' }) => {
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

  const TILE_SCALE = 0.01;
  const TILE_GAP = 0.09;
  const TILE_SPACING = TILE_SCALE + TILE_GAP;
  const totalInstances = gridSize.x * gridSize.y * gridSize.z;
  const gridKey = `${gridSize.x || 0}-${gridSize.y || 0}-${gridSize.z || 0}`;

  const model = useFBX(`${import.meta.env.VITE_FILE_URL}/${fbx}`);

  const translucentRef = useRef();
  const highlightRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [hoveredId, setHoveredId] = useState(null);

  // Highlight mesh – created once and cleaned up properly
  const highlightMesh = useMemo(() => {
    const mesh = model.clone(true);
    mesh.userData.__chessBoardInteractionBlocker = true;
    mesh.traverse((child) => {
      child.userData.__chessBoardInteractionBlocker = true;
    });
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  }, [model, scene]);

  // ────────────────────────────────────────────────
  // Cleanup when projectId changes
  // ────────────────────────────────────────────────
  useEffect(() => {
    // Reset local state
    setHoveredId(null);

    // Clear any project-specific global data
    Object.keys(sceneAssets).forEach((key) => {
      if (sceneAssets[key]?.name?.includes('chess') || sceneAssets[key]?.name?.includes('tile')) {
        delete sceneAssets[key];
      }
    });

    // Reset refs
    if (translucentRef.current) {
      translucentRef.current.count = 0;
      translucentRef.current.instanceMatrix.needsUpdate = true;
    }
    if (highlightRef.current) {
      highlightRef.current.count = 0;
      highlightRef.current.instanceMatrix.needsUpdate = true;
    }

    // Optional log
    // console.log(`[Chessboard] Reset for new project: ${projectId}`);

    // Cleanup function (runs before next projectId or unmount)
    return () => {
      setHoveredId(null);
      if (translucentRef.current) {
        translucentRef.current.dispose?.();
      }
      if (highlightRef.current) {
        highlightRef.current.dispose?.();
      }
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
      color: '#f37979',
      wireframe: true,
      opacity: 0.3,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  const allPositions = useMemo(() => {
    const positions = [];
    for (let x = 0; x < gridSize.x; x++) {
      for (let y = 0; y < gridSize.y; y++) {
        for (let z = 0; z < gridSize.z; z++) {
          positions.push([
            (x - gridSize.x / 2 + 0.5) * TILE_SPACING,
            (y - gridSize.y / 2 + 0.52) * TILE_SPACING,
            (z - gridSize.z / 2 + 0.5) * TILE_SPACING,
          ]);
        }
      }
    }
    
    return positions;
  }, [gridSize.x, gridSize.y, gridSize.z]);

  const positionsAtLayer = useMemo(() => {
    const positions = [];
    for (let x = 0; x < gridSize.x; x++) {
      for (let z = 0; z < gridSize.z; z++) {
        positions.push([
          (x - gridSize.x / 2 + 0.5) * TILE_SPACING,
          (controlButtonIndex - gridSize.y / 2 + 0.52) * TILE_SPACING,
          (z - gridSize.z / 2 + 0.5) * TILE_SPACING,
        ]);
      }
    }
    return positions;
  }, [gridSize.x, gridSize.y, gridSize.z, controlButtonIndex]);

  const offset = useMemo(
    () =>
      new THREE.Vector3(
        (gridSize.x * TILE_SPACING) / 2 + 0.004,
        (gridSize.y * TILE_SPACING) / 2 - 0.051,
        (gridSize.z * TILE_SPACING) / 2 - 0.289
      ),
    [gridSize.x, gridSize.y, gridSize.z]
  );

  // Update translucent instances
  useEffect(() => {
    if (!translucentRef.current || !geometry) return;
 
    const rotation = new THREE.Euler(THREE.MathUtils.degToRad(-90), 0, 0);
    const scale = new THREE.Vector3(TILE_SCALE, TILE_SCALE, TILE_SCALE);

    allPositions.forEach((position, i) => {
      dummy.position.set(...position);
      dummy.rotation.copy(rotation);
      dummy.scale.copy(scale);
      dummy.updateMatrix();
      translucentRef.current.setMatrixAt(i, dummy.matrix);
    });

    translucentRef.current.instanceMatrix.needsUpdate = true;
    translucentRef.current.count = allPositions.length;

    return () => {
      if (translucentRef.current) {
        translucentRef.current.count = 0;
        translucentRef.current.instanceMatrix.needsUpdate = true;
      }
    };
  }, [allPositions, geometry]);

  // Show/hide translucent layer based on mode
  useEffect(() => {
    if (translucentRef.current) {
      // translucentRef.current.visible = buttonMode === 'Preview Mode #2';
      translucentRef.current.visible = false;
    }
  }, [buttonMode]);

  // Update highlight layer
  useEffect(() => {
    if (!highlightRef.current || !geometry) return;

    const rotation = new THREE.Euler(THREE.MathUtils.degToRad(-90), 0, 0);
    const scale = new THREE.Vector3(TILE_SCALE, TILE_SCALE, TILE_SCALE);

    positionsAtLayer.forEach((position, i) => {
      dummy.position.set(...position);
      dummy.rotation.copy(rotation);
      dummy.scale.copy(scale);
      dummy.updateMatrix();
      highlightRef.current.setMatrixAt(i, dummy.matrix);
    });

    highlightRef.current.count = positionsAtLayer.length;
    highlightRef.current.instanceMatrix.needsUpdate = true;
    highlightMesh.visible = false;
    setHoveredId(null);
  }, [positionsAtLayer, geometry, highlightMesh]);

  // Pointer events
  const handlePointerOver = useCallback(
    (e) => {
      e.stopPropagation();
      if (buttonMode !== 'Edit Mode') return;

      const id = e.instanceId;
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();

      e.object.getMatrixAt(id, matrix);
      matrix.decompose(position, quaternion, scale);

      position.add(offset);
      highlightMesh.position.copy(position);
      highlightMesh.scale.copy(scale);
      highlightMesh.visible = true;

      setHoveredId(id);
    },
    [highlightMesh, offset, buttonMode]
  );

  const handlePointerOut = useCallback(
    (e) => {
      e.stopPropagation();
      highlightMesh.visible = false;
      setHoveredId(null);
    },
    [highlightMesh]
  );

  const applyTemplatePlacement = useCallback((placement) => {
    if (!placement?.templateAssetProps) {
      return;
    }

    setTemplateAssetProps(placement.templateAssetProps);

    if (placement.scanDefaultInstance) {
      setScannedId(`${defaultInstanceId}t_click`);
      setScan(!scan);
      setSearchItem({ noZoom: true });
    }
  }, [defaultInstanceId, scan, setTemplateAssetProps, setScannedId, setScan, setSearchItem]);

  const queueOrApplyTemplatePlacement = useCallback((placement) => {
    applyTemplatePlacement(placement);
  }, [applyTemplatePlacement]);

  const handleClick = useCallback(
    (e) => {
      console.log(e)
      e.stopPropagation();

      if (deleteObject || buttonMode !== 'Edit Mode') return;

      const id = e.instanceId;

      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const rotation = new THREE.Euler(0, THREE.MathUtils.degToRad(rotationValue), 0);

      e.object.getMatrixAt(id, matrix);
      matrix.decompose(position, quaternion, scale);

      position.add(offset);
    
     

      if (selectedAssetName && objects[selectedAssetName] && !selectedAssetName.includes('platform')) {
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
          isChessBoard: true
        };
       
        queueOrApplyTemplatePlacement({
          templateAssetProps,
          scanDefaultInstance: false,
        });
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
        isChessBoard: true
      };
      queueOrApplyTemplatePlacement({
        templateAssetProps,
        scanDefaultInstance: true,
      });
    },
    [
      deleteObject,
      buttonMode,
      selectedAssetName,
      defaultInstanceId,
      rotationValue,
      vAlignValue,
      projectId,
      offset,
      queueOrApplyTemplatePlacement,
    ]
  );

  // Cursor style
  useEffect(() => {
    gl.domElement.style.cursor = hoveredId !== null && buttonMode === 'Edit Mode' ? 'pointer' : 'default';
  }, [hoveredId, buttonMode, gl]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      scene.remove(highlightMesh);
      highlightMesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      if (translucentRef.current) {
        translucentRef.current.dispose?.();
      }
      if (highlightRef.current) {
        highlightRef.current.dispose?.();
      }
    };
  }, [highlightMesh, scene]);

  if (!geometry || !baseMaterial) return null;

  return (
    <>
   
  <directionalLight position={[5, 10, 5]} intensity={0.1} />
      <ambientLight intensity={0.4} />
      {/* <instancedMesh
        ref={translucentRef}
        args={[geometry, translucentMaterial, totalInstances]}
        position={offset}
      /> */}

      <instancedMesh
        key={gridKey}
        ref={highlightRef}
        args={[geometry, wireframeMaterial, gridSize.x * gridSize.z]}
        position={offset}
        userData={{ __chessBoardInteractionBlocker: true }}
        onPointerOver={buttonMode === 'Edit Mode' ? handlePointerOver : undefined}
        onPointerOut={buttonMode === 'Edit Mode' ? handlePointerOut : undefined}
        onDoubleClick={buttonMode === 'Edit Mode' ? handleClick : undefined}
        visible={buttonMode === 'Edit Mode'}
      />
    </>
  );
};

export default Chessboard;
