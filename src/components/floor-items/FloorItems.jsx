import {MultiSelect} from "primereact/multiselect";
import * as React from "react";
import {useCallback, useEffect} from "react";
import useGame from "../../hooks/useGame";
import * as THREE from "three";
import {sceneAssets} from "../../threejs/player/puzzle/character/Constants";

export default function FloorItems({colorValue, independent = false, panelClassName}) {
    const aFloors = useGame((state) => state.floors || []);
    const setSelectedFloors = useGame((state) => state.setSelectedFloors);
    const selectedFloors = useGame((state) => state.selectedFloors || []);

    const normalizeSelectedFloors = useCallback((floors = []) => {
        if (!floors.length) return [];

        const nextCodes = new Set(floors.map((floor) => floor.code));
        const removedCodes = selectedFloors
            .map((floor) => floor.code)
            .filter((code) => !nextCodes.has(code));

        if (removedCodes.length) {
            const highestVisibleFloor = Math.min(...removedCodes) - 1;
            return aFloors.filter((floor) => floor.code <= highestVisibleFloor);
        }

        const highestSelectedFloor = Math.max(...nextCodes);
        return aFloors.filter((floor) => floor.code <= highestSelectedFloor);
    }, [aFloors, selectedFloors]);

    const turnOnOffAssets = useCallback((floorList = []) =>{
        const selectedFloorCodes = new Set(floorList.map((floor) => String(floor)));
        const highestSelectedFloor = floorList.length ? Math.max(...floorList) : -1;
        const matrix = new THREE.Matrix4();
        const nonInstancedVisibility = new Map();

        for(const i in sceneAssets){
            const  asset = sceneAssets[i]
            if (!asset) continue;

            const {instance, index, floor, position,quart, scale,noInstbject} = asset
            if (floor === undefined || floor === null) continue;

            const newScale = scale?.clone()
            const isVisible = independent
                ? selectedFloorCodes.has(String(floor))
                : highestSelectedFloor >= 0 && floor <= highestSelectedFloor;

            if(isVisible){
                newScale?.multiplyScalar(1)
            }
            else{
                newScale?.multiplyScalar(0)
            }
            if(noInstbject != undefined && newScale){
                noInstbject.scale.copy(newScale)
            }
            if (instance != undefined && position && quart && newScale) {
                if (typeof instance.setMatrixAt !== "function" || !instance.instanceMatrix) {
                    nonInstancedVisibility.set(instance, (nonInstancedVisibility.get(instance) || false) || isVisible);
                    continue;
                }

                matrix.compose(position, quart, newScale);
                instance.instanceMatrix.needsUpdate = true;
                instance.setMatrixAt(index, matrix);
            }
        }

        nonInstancedVisibility.forEach((isVisible, instance) => {
            instance.visible = isVisible;
        });
    }, [independent])

    useEffect(() => {
        if (!aFloors?.length) return ;
        const floorCodes = selectedFloors.map((floor)=>floor.code)
        turnOnOffAssets(floorCodes)
    }, [aFloors, selectedFloors, turnOnOffAssets]);

    const selectFloor = (event)=>{
        if(event.value.length==0){
            setSelectedFloors([])
            return;
        }

        if (independent) {
            setSelectedFloors(event.value)
            return;
        }

        const normalizedFloors = normalizeSelectedFloors(event.value)
        setSelectedFloors(normalizedFloors)
    }

    return (<div  style={{width: '100%' }}>
            <MultiSelect
                         value={selectedFloors|| []}
                         onChange={selectFloor}
                         options={aFloors} optionLabel="name"
                         style={{minWidth: '4rem'}}
                         placeholder="Floors"
                         maxSelectedLabels={1}
                         selectedItemsLabel={`${selectedFloors.length} floors`}
                         emptyMessage="No floors"
                         panelClassName={panelClassName || (colorValue? "floors-dropdown-panel_black": "")}
            />
        </div>
    )
}
