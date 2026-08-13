import React, { useState, useEffect } from 'react';
import { Tree } from 'primereact/tree';
import useGame from "../../../hooks/useGame";
import { Vector3 } from 'three';

export default function ComponentTree({scene, camera,orbitControls}: any) {
    const [nodes, setNodes] = useState([]);
    const componentTree = useGame((state: any) => state.componentTree);

    // Set the tree nodes based on the component tree state
    useEffect(() => {
        setNodes(componentTree);
    }, [componentTree]);


    const ZoomToAsset = (object: any) => {
        const center = new Vector3(); // Create a new vector for the world position
        object.getWorldPosition(center);   // Get the object's world position

        if (center && orbitControls.current) {
            // Calculate the direction vector from the camera to the target object
            const camDirection = camera.position.clone().sub(orbitControls.current.target).normalize();

            // Optionally multiply by a scalar to control the zoom distance (adjust the 10 as needed)
            const zoomDistance = camDirection.multiplyScalar(1);

            // Update the OrbitControls' target to focus on the object's world center
            orbitControls.current.target.copy(center);

            // Move the camera towards the object by subtracting the direction vector
            camera.position.copy(center).add(zoomDistance);

            // Ensure that the camera projection matrix is updated after changes
            camera.updateProjectionMatrix();

            // Optionally, you can call controls.update() to ensure the camera updates smoothly
            orbitControls.current.update();
        }
    };

    const focusNode = (node: any) => {
        const objectName = node?.data?.objectName || node?.label;
        const obj = objectName ? scene?.getObjectByName(objectName) : null;

        if (obj) {
            ZoomToAsset(obj);
        }
    };

    const nodeTemplate = (node: any) => {
        const hasChildren = Boolean(node.children?.length);

        return (
            <span className="package-tree-node">
                <i className={`package-tree-node-icon pi ${hasChildren ? 'pi-folder' : 'pi-file'}`} />
                <span className="package-tree-node-label">{node.label}</span>
            </span>
        );
    };

    return (
        <div className="card flex justify-content-center package-component-tree">
            <Tree
                value={nodes}
                filter
                filterMode="lenient"
                filterPlaceholder="Search parts..."
                nodeTemplate={nodeTemplate}
                onNodeClick={(e: any) => focusNode(e.node)}
                className="w-full md:w-30rem package-component-tree-widget"
            />
        </div>
    );
}
