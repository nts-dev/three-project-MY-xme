import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import useGame from "../../hooks/useGame";
import { useThree } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "three";
import { Object3D } from "three";
import VideoTexture from "./VideoTexture";
import { useSelector } from "react-redux";

const MIN_SCENE_CAMERA_NEAR = 0.05;
const MIN_SCENE_CAMERA_FAR = 2500000;
const MAX_SCENE_CAMERA_FAR = 100000000;

const SCREEN_MATERIAL_NAMES = new Set([
    "Screen_02",
    "Screen_01",
    "Screen_04",
    "Screen_11",
    "Screen_12",
    "Screen_13",
    "Screen_14",
]);

type ManagedMesh = {
    mesh: THREE.Mesh;
    orig: THREE.Material | THREE.Material[];
    originalRenderOrder: number;
};

export default function Building({ bProjectId }: { bProjectId: number }) {
    const walls = useGame((state: any) => state.walls);
    const isGame = useGame((state: any) => state.isGame);
    const isPuzzleGame = useGame((state: any) => state.isPuzzleGame);
    const orbitControlsRef = useGame((state: any) => state.orbitControlsRef);

    const wallsOpacity = useGame((state: any) => state.wallsOpacity);
    const setWallsOpacity = useGame((state: any) => state.setWallsOpacity);
    const selectedFloors = useGame((state: any) => state.selectedFloors || []);
    const setFloors = useGame((state: any) => state.setFloors);
    const setSelectedFloors = useGame((state: any) => state.setSelectedFloors);


    const colliders = useGame((state: any) => state.colliders);
    const setColliders = useGame((state: any) => state.setColliders);

    const { camera, gl, scene } = useThree();
    const buildingUrl = useMemo(
        () => `${import.meta.env.VITE_FILE_URL}/${bProjectId}.FBX`,
        [bProjectId]
    );

    const [fbxModel, setFbxModel] = useState<THREE.Object3D | null>(null);
    const [loadError, setLoadError] = useState<Error | null>(null);

    const wallObjRef = useRef<THREE.Object3D | null>(null);
    const managedMeshesRef = useRef<ManagedMesh[]>([]);
    const processedModelRef = useRef<THREE.Object3D | null>(null);
    const floorObjectsRef = useRef<Map<number, THREE.Object3D[]>>(new Map());
    const framedCameraKeyRef = useRef<string | null>(null);
    const originalSortObjectsRef = useRef<boolean | null>(null);

    const [loaded, setLoaded] = useState(false);

    const getFloorCodeFromName = useCallback((name?: string) => {
        if (!name) return null;
        const normalizedName = name.trim();
        const match = normalizedName.match(/^Floor_(\d)/i);
        if (!match) return null;

        const parsedIndex = parseInt(match[1], 10);
        if (Number.isNaN(parsedIndex)) return null;

        return Math.max(parsedIndex, 0);
    }, []);

    const isScreenMaterial = (mat: THREE.Material | THREE.Material[]) => {
        if (Array.isArray(mat)) return mat.some((m: any) => SCREEN_MATERIAL_NAMES.has(m?.name));
        return SCREEN_MATERIAL_NAMES.has((mat as any)?.name);
    };

    const getWallsChildIndex = useCallback(() => {
        if (bProjectId === 48) return 6;
        if (bProjectId === 32) return 2;
        if (bProjectId === 125) return 3;
        return -1;
    }, [bProjectId]);

    const syncModelFloors = useCallback(
        (model: THREE.Object3D) => {
            const seenCodes = new Set<number>();
            const nextFloorObjects = new Map<number, THREE.Object3D[]>();
            const nextFloors: Array<{ name: string; code: number }> = [];

            model.children.forEach((child: any) => {
                const code = getFloorCodeFromName(child?.name);
                if (code == null) return;

                const currentObjects = nextFloorObjects.get(code) || [];
                currentObjects.push(child);
                nextFloorObjects.set(code, currentObjects);

                if (seenCodes.has(code)) return;

                seenCodes.add(code);
                nextFloors.push({ name: `Floor ${code}`, code });
            });

            nextFloors.sort((a, b) => a.code - b.code);

            floorObjectsRef.current = nextFloorObjects;
            if (!nextFloors.length) {
                return;
            }
            setFloors(nextFloors);
            setSelectedFloors(nextFloors);
        },
        [getFloorCodeFromName, setFloors, setSelectedFloors]
    );

    const applySelectedFloorsToModel = useCallback(
        (activeFloors: Array<{ name: string; code: number }>) => {
            const activeFloorCodes = new Set(activeFloors.map((floor) => floor.code));

            for (const [code, objects] of floorObjectsRef.current.entries()) {
                const isVisible = activeFloorCodes.has(code);
                for (const object of objects) {
                    object.traverse((child: any) => {
                        if (child?.name === "Roof") return;
                        child.layers.mask = isVisible ? 1 : 0;
                    });
                }
            }
        },
        []
    );

    const applyWallState = useCallback(
        (_showWalls: boolean, _opacityPercent: number) => {
            if (gl) {
                if (originalSortObjectsRef.current == null) {
                    originalSortObjectsRef.current = gl.sortObjects;
                }
                gl.sortObjects = originalSortObjectsRef.current;
            }

            for (const { mesh, orig, originalRenderOrder } of managedMeshesRef.current) {
                mesh.frustumCulled = false;
                mesh.material = orig;
                mesh.renderOrder = originalRenderOrder;
            }
        },
        [gl]
    );

    const restoreRendererSorting = useCallback(() => {
        if (gl && originalSortObjectsRef.current != null) {
            gl.sortObjects = originalSortObjectsRef.current;
        }
        originalSortObjectsRef.current = null;
    }, [gl]);

    const frameCameraToBuilding = useCallback(
        (model: THREE.Object3D) => {
            if (
                !model ||
                isGame ||
                isPuzzleGame ||
                camera.userData?.__projectGoogleMapsOverlayCamera
            ) return;

            model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(model);
            if (box.isEmpty()) return;

            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            const maxXZ = Math.max(size.x, size.z, 1);
            const maxSize = Math.max(maxXZ, size.y, 1);
            const fov = camera instanceof THREE.PerspectiveCamera
                ? THREE.MathUtils.degToRad(camera.fov)
                : THREE.MathUtils.degToRad(50);
            const fitDistance = (maxSize * 0.65) / Math.tan(fov / 2);
            const height = Math.max(fitDistance, maxXZ * 0.9, size.y * 2, 8);
            const zOffset = Math.max(maxXZ * 0.35, size.z * 0.55, 6);
            const target = new THREE.Vector3(
                center.x,
                box.min.y + size.y * 0.3,
                center.z
            );

            camera.position.set(center.x, center.y + height * 3.5, center.z + zOffset * 4);
            // camera.near = MIN_SCENE_CAMERA_NEAR;
            // camera.far = THREE.MathUtils.clamp(
            //     Math.max(MIN_SCENE_CAMERA_FAR, height * 4, maxSize * 5),
            //     MIN_SCENE_CAMERA_FAR,
            //     MAX_SCENE_CAMERA_FAR
            // );
            camera.lookAt(target);
            camera.updateProjectionMatrix?.();

            const controls = orbitControlsRef?.current;
            if (controls) {
                controls.target.copy(target);
                controls.update?.();
            }
        },
        [camera, isGame, isPuzzleGame, orbitControlsRef]
    );

    // -----------------------------
    // Process model once: store originals + initial apply
    // -----------------------------
    const processModel = useCallback(
        (model: THREE.Object3D) => {
            if (processedModelRef.current === model) {
                applyWallState(!!walls, wallsOpacity ?? (walls ? 100 : 30));
                return;
            }

            processedModelRef.current = model;
            managedMeshesRef.current = [];

            // Build colliders without duplicates
            // const colliderSet = new Set<THREE.Object3D>(colliders);
            model.traverse((child: any) => {
                if (!child?.isMesh) return;
                child.frustumCulled = false;

                // colliderSet.add(child);

                if (child.name === "Roof") {
                    child.layers.mask = 0;
                }

                if (!child.material) return;

                // Save original materials once, on the mesh itself (fast + no Map lookups)
                if (child.userData.__origMat == null) {
                    child.userData.__origMat = Array.isArray(child.material)
                        ? [...child.material]
                        : child.material;
                }
                if (child.userData.__origRenderOrder == null) {
                    child.userData.__origRenderOrder = child.renderOrder || 0;
                }
                if (child.userData.__origFrustumCulled == null) {
                    child.userData.__origFrustumCulled = child.frustumCulled;
                }
                const orig: THREE.Material | THREE.Material[] = child.userData.__origMat;

                // Never touch screen materials
                if (isScreenMaterial(orig)) return;
                managedMeshesRef.current.push({
                    mesh: child as THREE.Mesh,
                    orig,
                    originalRenderOrder: child.userData.__origRenderOrder,
                });
            });

            applyWallState(!!walls, wallsOpacity ?? (walls ? 100 : 30));

            // write colliders once
            // setColliders(Array.from(colliderSet));
        },
        [applyWallState, colliders, setColliders, walls, wallsOpacity]
    );

    // -----------------------------------
    // Opacity change handler: keep building walls opaque.
    // -----------------------------------
    useEffect(() => {
        if (!wallObjRef.current) return;
        applyWallState(!!walls, wallsOpacity ?? 30);
      
    }, [applyWallState, wallsOpacity, walls]);

    // -----------------------------------
    // Walls toggle handler
    // -----------------------------------
    useEffect(() => {
        setWallsOpacity(100);
    }, [walls, setWallsOpacity]);

    // -----------------------------------
    // Initial model load
    // -----------------------------------
    useEffect(() => {
        if (!bProjectId || bProjectId <= 0) {
            setFbxModel(null);
            setLoadError(null);
            setLoaded(false);
            return;
        }

        let cancelled = false;
        const loader = new FBXLoader();

        setFbxModel(null);
        setLoadError(null);
        setLoaded(false);

        loader.load(
            buildingUrl,
            (model) => {
                if (cancelled) return;
                setFbxModel(model);
            },
            undefined,
            (error) => {
                if (cancelled) return;
                console.warn(`[Building1] failed to load building model for project ${bProjectId}: ${buildingUrl}`, error);
                setFbxModel(null);
                setLoadError(error instanceof Error ? error : new Error(`Failed to load ${buildingUrl}`));
            }
        );

        return () => {
            cancelled = true;
        };
    }, [buildingUrl, bProjectId]);

    useEffect(() => {
        if (!bProjectId || bProjectId <= 0 || !fbxModel || !scene) return;

        fbxModel.scale.set(0.01, 0.01, 0.01);

        let sceneObj = scene.getObjectByName("sceneObj") as THREE.Object3D;
        if (!sceneObj) {
            sceneObj = new Object3D();
            sceneObj.name = "sceneObj";
            scene.add(sceneObj);
        }

        if (!fbxModel.parent) {
            sceneObj.add(fbxModel);
        }

        // Custom walls mapping depending on project
        const idx = getWallsChildIndex();
        if (idx >= 0 && fbxModel.children[idx]) {
            fbxModel.children[idx].name = "walls";
        }

        if (bProjectId === 137) setLoaded(true);

        wallObjRef.current = fbxModel;

        processModel(fbxModel);
        syncModelFloors(fbxModel);

        const frameKey = `${bProjectId}:${fbxModel.uuid}`;
        if (framedCameraKeyRef.current !== frameKey) {
            framedCameraKeyRef.current = frameKey;
            requestAnimationFrame(() => frameCameraToBuilding(fbxModel));
        }
    }, [fbxModel, bProjectId, scene, getWallsChildIndex, processModel, syncModelFloors, frameCameraToBuilding]);

    useEffect(() => {
        if (!loadError) return;

        wallObjRef.current?.parent?.remove(wallObjRef.current);
        wallObjRef.current = null;
        managedMeshesRef.current = [];
        processedModelRef.current = null;
        floorObjectsRef.current = new Map();
        restoreRendererSorting();
        setFloors([]);
        setSelectedFloors([]);
    }, [loadError, restoreRendererSorting, setFloors, setSelectedFloors]);

    useEffect(() => {
        applySelectedFloorsToModel(selectedFloors);
    }, [applySelectedFloorsToModel, selectedFloors]);

    useEffect(() => {
        return () => {
            wallObjRef.current?.parent?.remove(wallObjRef.current);
            wallObjRef.current = null;
            managedMeshesRef.current = [];
            processedModelRef.current = null;
            floorObjectsRef.current = new Map();
            framedCameraKeyRef.current = null;
            restoreRendererSorting();
        };
    }, [buildingUrl, restoreRendererSorting]);

    return <>
    {loaded && <VideoTexture object={wallObjRef.current} />}
    </>;
}
