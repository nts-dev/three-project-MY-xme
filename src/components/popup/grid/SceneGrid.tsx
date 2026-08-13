import * as React from "react";
import {useEffect, useState} from "react";
import * as THREE from 'three'
import useGame from "../../../hooks/useGame";

export default function ToggleGrid({scene}: any) {
    const isGrid: boolean = useGame((state: any) => state.grid)
    const projectId: number = useGame((state: any) => state.projectID)
    const [gridData, setGridData] = useState<number[]>([])
    const maxLegacyGridCells = 2500;


    useEffect(() => {
        setGridData([])
    }, [projectId])

    useEffect(() => {

        if (projectId == 0 || !scene) {
            return
        }
        // const grid = new THREE.GridHelper(100, 100, '#555454', '#555454');
        let y = 0
        let x = 0
        const makePlaneReplicate = (x_value: number, y_value: number, plane: any) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context === null) {
                return
            }
            context.font = `bold 55px Arial`;
            context.fillStyle = "rgb(10,7,7)";
            const cordinates = `( ${x_value * 100} , ${y_value * 100} )`;
            context.fillText(cordinates, 0, 50);

            const texture = new THREE.Texture(canvas)
            texture.needsUpdate = true;
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                depthTest: true,
                depthWrite: false,
                side: THREE.FrontSide,
            });
            plane.material = material
            plane.material.needsUpdate = true;
            plane.rotation.x = THREE.MathUtils.degToRad(-90);
            plane.renderOrder = -900;
            plane.frustumCulled = false;
            return plane;
        }

        const addGrid = async (scene: any): Promise<number[]> => {
            const meshGrid = new THREE.Object3D();
            let offset = 0.3;
            let map = scene.getObjectByName('walls');
            if (!map) {
                map = scene.getObjectByName('Landscape');
                offset = 50
            }
            if (!map) {
                map = scene.getObjectByName('Floor0');
                offset = 0
            }
            if (!map) {
                return []
            }
            const gridIdList = [];
            let posy = 0.5;
            const box = new THREE.Box3();
            box.expandByObject(map);
            const size = box.getSize(new THREE.Vector3());
            x = Math.max(0, Math.ceil(size.x));
            y = Math.max(0, Math.ceil(size.z));

            if (!Number.isFinite(x) || !Number.isFinite(y) || x * y > maxLegacyGridCells) {
                return [];
            }

            const geometry = new THREE.PlaneGeometry(1, 1);
            const material = new THREE.MeshBasicMaterial();
            const plane = new THREE.Mesh(geometry, material);
            // grid.position.set(x/2, 0.3, y/2);
            // scene.add(grid);
            for (let i = 0; i < y; i++) {
                let posx = 0.5;
                for (let i = 0; i < x; i++) {
                    const cordinateLabel = makePlaneReplicate(posx - 0.5, posy - 0.5, plane.clone());
                    cordinateLabel.position.set(posx, offset, posy);
                    meshGrid.add(cordinateLabel);
                    gridIdList.push(cordinateLabel.id);
                    posx += 1;
                }
                posy += 1;
            }
            // meshGrid.rotation.y = -Math.PI/2
            scene.add(meshGrid);
            return gridIdList;
        }

        const gridIds = Array.isArray(gridData) ? gridData : [];

        if (isGrid) {
            if (gridIds.length > 0) {
                for (let i = 0; i < gridIds.length; i++) {
                    let object = scene.getObjectById(gridIds[i]);
                    if (object) {
                        object.layers.mask = 1
                    }
                }
            } else {
                addGrid(scene).then(
                    (value) => {
                        const nextGridData = Array.isArray(value) ? value : [];
                        if (nextGridData.length > 0 || gridIds.length > 0) {
                            setGridData(nextGridData);
                        }
                    }
                );
            }
        } else {
            for (let i = 0; i < gridIds.length; i++) {
                const object = scene.getObjectById(gridIds[i]);
                if (object) {
                    object.layers.mask = 0;
                }
            }
        }

    }, [isGrid, projectId, scene, gridData])

    return null
}
