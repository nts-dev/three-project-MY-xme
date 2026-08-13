import React, {useEffect} from 'react';
import * as THREE from 'three';
import {CSS2DRenderer, CSS2DObject} from 'three/examples/jsm/renderers/CSS2DRenderer';
import useGame from "../../hooks/useGame";



let labelRenderer: CSS2DRenderer | any = null;

const DimensionHelper:any = ({objects, scene}: any) => {


    labelRenderer = new CSS2DRenderer();
    const sceneObj = scene.getObjectByName('sceneObj');
    const showDimensions = useGame((state: any) => state.showDimensions);
    const setLabelRenderer = useGame((state: any) => state.setLabelRenderer);



    const addDimension = (start: THREE.Vector3, end: THREE.Vector3, label: string,title: string, objName: string) => {
        const lineMaterial = new THREE.LineBasicMaterial({ color: '#d60808', linewidth: 2 });
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const dimensionLine = new THREE.Line(lineGeometry, lineMaterial);

        dimensionLine.name = `dimensionLine_${objName}`

        dimensionLine.visible = false

        if(sceneObj)
            sceneObj.add(dimensionLine);

        // Add arrows at the start and end of the line
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const arrowLength = 0.05; // Adjust the size of the arrow
        const arrowHeadLength = 0.05; // Length of the arrowhead
        const arrowHeadWidth = 0.02; // Width of the arrowhead

        // Create the arrow at the start of the line
        const arrowHelperStart = new THREE.ArrowHelper(
            direction.clone().negate(), // Arrow points in the opposite direction
            start,
            arrowLength,
            '#d60808',
            arrowHeadLength,
            arrowHeadWidth
        );
        arrowHelperStart.name = `arrowHelper_${objName}`
        arrowHelperStart.visible = false
        if(sceneObj)
            sceneObj.add(arrowHelperStart);

        // Create the arrow at the end of the line
        const arrowHelperEnd = new THREE.ArrowHelper(
            direction,
            end,
            arrowLength,
            '#d60808',
            arrowHeadLength,
            arrowHeadWidth
        );
        arrowHelperEnd.name = `arrowHelper_${objName}`
        arrowHelperEnd.visible = false
        if(sceneObj)
            sceneObj.add(arrowHelperEnd);

        // Create and attach the label at the midpoint of the line
        const labelDiv = document.createElement('div');
        labelDiv.className = 'label';
        labelDiv.textContent = label;
        labelDiv.title = title;


        const labelObj = new CSS2DObject(labelDiv);

        // Calculate the midpoint between start and end
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        midpoint.y -=0.05
        // Set the label position to the midpoint
        labelObj.position.copy(midpoint);
        labelObj.name = `labelObj_${objName}`;
        labelObj.layers.mask = 0
        // console.log(labelObj)
        if(sceneObj)
            sceneObj.add(labelObj);

        return { dimensionLine, labelObj, arrowHelperStart, arrowHelperEnd };
    };
    const onWindowResize = () => {
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onWindowResize);

    useEffect(() => {

        if (labelRenderer ) {
            labelRenderer.setSize(window.innerWidth, window.innerHeight);
            labelRenderer.domElement.id = 'dims'
            labelRenderer.domElement.style.position = 'absolute';
            labelRenderer.domElement.style.height = '100%';
            labelRenderer.domElement.style.width = '100%';
            labelRenderer.domElement.style.top = '0px';
            labelRenderer.domElement.style.pointerEvents = 'none';
            setLabelRenderer(labelRenderer)

            for (const obj of objects) {
                const { object, dims } = obj;
                // Get dimensions, with fallback to calculated bounding box dimensions
                const length = dims?.fields['Length (mm)']?.value ?? new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).x * 1000;
                const height = dims?.fields['Height (mm)']?.value ?? new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).y * 1000;
                const width = dims?.fields['Width (mm)']?.value ?? new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).z * 1000;

                // Get bounding box for the object
                const bbox = new THREE.Box3().setFromObject(object);
                const min = bbox.min;
                const max = bbox.max;

                // Add dimensions based on calculated or provided values
                addDimension(
                    new THREE.Vector3(min.x, min.y, min.z), // Start point
                    new THREE.Vector3(min.x + (length / 1000), min.y, min.z), // End point calculated based on length
                    `${parseFloat(length).toFixed(1)} mm`,
                    'Length',
                    object.name
                );

                addDimension(
                    new THREE.Vector3(max.x, min.y, min.z), // Start point
                    new THREE.Vector3(max.x, min.y + (height / 1000), min.z), // End point calculated based on height
                    `${parseFloat(height).toFixed(1)} mm`,
                    'Height',
                    object.name
                );

                addDimension(
                    new THREE.Vector3(max.x, max.y, min.z), // Start point
                    new THREE.Vector3(max.x, max.y, min.z + (width / 1000)), // End point calculated based on width
                    `${parseFloat(width).toFixed(1)} mm`,
                    'Width',
                    object.name
                );
            }



        }


    }, [showDimensions,objects]);

    return null;
};

export {labelRenderer};
export default DimensionHelper;
