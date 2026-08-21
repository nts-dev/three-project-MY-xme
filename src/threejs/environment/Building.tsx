import * as React from "react";
import { useEffect, useCallback } from "react";
import useGame from "../../hooks/useGame";
import { useThree } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "three";
import { Object3D } from "three";

type AnyMaterial = THREE.Material & {
    map?: THREE.Texture | null;
    color?: THREE.Color;
};

export default function Building({ directionLight }: any) {
    const setMatList: any = useGame((state: any) => state.setMatList);
    const matList: AnyMaterial[] = useGame((state: any) => state.matList); // kept, not required by the new approach
    const shadow: boolean = useGame((state: any) => state.shadow);
    const walls: boolean = useGame((state: any) => state.walls);
    const setColliders: any = useGame((state: any) => state.setColliders);
    const checkReload = useGame((state: any) => state.checkReload);

    const { scene } = useThree();

    const projectID: number = 125; // useGame((state: any) => state.projectID)

    const normalizeTexture = (tex?: THREE.Texture | null) => {
        if (!tex) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
    };

    const getWallsIndex = useCallback(() => {
        if (projectID === 48) return 6;
        if (projectID === 32) return 2;
        if (projectID === 125) return 3; // make sure this matches your FBX structure
        return 0;
    }, [projectID]);

    const storeOriginalOnce = (mesh: THREE.Mesh) => {
        if (mesh.userData.__origMat == null) {
            mesh.userData.__origMat = mesh.material;
        }
    };

    const swapObjectMaterials = useCallback(
        (root: THREE.Object3D, _showOpaque: boolean) => {
            root.traverse((obj: any) => {
                if (!obj?.isMesh) return;

                const mesh = obj as THREE.Mesh;
                storeOriginalOnce(mesh);

                const orig = mesh.userData.__origMat as THREE.Material | THREE.Material[];
                mesh.material = orig as any;
            });
        },
        []
    );

    const updateWalls = useCallback(
        (show: boolean) => {
            const wallObj = scene.getObjectByName("walls");
            if (!wallObj) return;

            // Always restore original opaque wall materials.
            swapObjectMaterials(wallObj, show);
        },
        [scene, swapObjectMaterials]
    );

    const updateNonWalls = useCallback(
        (root: THREE.Object3D) => {
            // Keep non-wall building parts on their original materials.
            swapObjectMaterials(root, false);
        },
        [swapObjectMaterials]
    );

    const setUpMaterials = useCallback(
        (fbxFile: any) => {
            if (!fbxFile?.children?.length) return;

            const wallsIndex = getWallsIndex();

            // Preserve original materials for non-wall building parts.
            if (projectID === 32 || projectID === 125) {
                for (let i = 0; i < fbxFile.children.length; i++) {
                    if (i !== wallsIndex) updateNonWalls(fbxFile.children[i]);
                }
            }

            // Collect a "wall materials list" (if you still use it elsewhere)
            const oMatList: AnyMaterial[] = [];

            const wallsRoot = fbxFile.children[wallsIndex];
            if (wallsRoot) {
                wallsRoot.traverse((child: any) => {
                    if (!child?.isMesh || !child.material) return;

                    const pushMat = (m: AnyMaterial) => {
                        normalizeTexture(m.map);
                        oMatList.push(m);
                    };

                    if (Array.isArray(child.material)) child.material.forEach(pushMat);
                    else pushMat(child.material as AnyMaterial);
                });

                wallsRoot.name = "walls";
            }

            // Roof layer mask logic
            fbxFile.traverse((child: any) => {
                if (child?.isMesh && child.name === "Roof") {
                    child.layers.mask = 0;
                }
            });

            // Keep walls opaque. Transparent building walls are expensive in VR.
            if ([125, 48, 70, 132, 135, 137, 139, 32].includes(projectID)) {
                updateWalls(true);
            }

            setMatList(oMatList);
        },
        [getWallsIndex, projectID, setMatList, updateNonWalls, updateWalls]
    );

    useEffect(() => {
        if (projectID <= 0 ) return;

        const loader = new FBXLoader();

        loader.load(`${import.meta.env.VITE_FILE_URL}/${projectID}.FBX`, (object) => {
            object.scale.multiplyScalar(0.01);

            // Attach to scene
            if (scene) {
                const sceneObj = scene.getObjectByName("sceneObj");
                if (sceneObj) {
                    sceneObj.add(object);
                } else {
                    const sceneObject = new Object3D();
                    sceneObject.name = "sceneObj";
                    object.position.y = 4.6;
                    sceneObject.add(object);
                    scene.add(sceneObject);
                }
            }

            setUpMaterials(object);

            // Colliders (don’t mutate existing state arrays)
            const newColliders: THREE.Object3D[] = [];
            object.traverse((child: any) => {
                if (child?.isMesh) newColliders.push(child);
            });
            setColliders(newColliders);
        });
    }, [projectID, checkReload, scene, setColliders, setUpMaterials]);

    useEffect(() => {
        // Keep building walls opaque even when the wall toggle changes.
        updateWalls(true);
    }, [shadow, walls, projectID, checkReload, updateWalls]);

    return null;
}
