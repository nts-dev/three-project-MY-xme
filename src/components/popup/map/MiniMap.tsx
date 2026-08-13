import * as React from "react";
import useGame from "../../../hooks/useGame";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const ShowMapContour = (floorNo: any) => {
    for (let matId in floorNo.material) {
        if (matId == '0') {
            floorNo.material[matId].opacity = 1.0
            // floorNo.material[matId].color = new THREE.Color('#f60202');
            floorNo.material[matId].transparent = false;
            floorNo.material[matId].needsUpdate = true;
            break;
        }
    }
}
const HideContour = (floorNo: any) => {
    for (let matId in floorNo.material) {
        if (matId == '0') {
            floorNo.material[matId].opacity = 0.3
            floorNo.material[matId].transparent = true;
            floorNo.material[matId].needsUpdate = true;
            break;
        }
    }
}

const MiniMapRenderer = ({ scene, projectId }: any) => {
    const containerRef: any = useRef();
    const miniCamraSettings: any = useMemo(() => ({
        125: { x: 14.73, y: 5, z: 9.43 },
        139: { x: 9.73, y: 8, z: 10.43 },
        48: { x: 16.78, y: 19.00, z: 43.46 },
        132: { x: 7.26, y: 3.30, z: 14.59 },
        70: { x: 33.25, y: 7.00, z: 29.99 },
        32: { x: 3.36, y: 8.97, z: 12.68 },
        129: { x: 12.92, y: 2.13, z: 6.35 },
        135: { x: 12.92, y: 2.13, z: 6.35 },
    }), []);

    const minimapRenderer = useMemo(() => new THREE.WebGLRenderer({ antialias: true }), []);

    useEffect(() => {
        if (scene) {
            const map = scene.getObjectByName('walls');
            if (!map) return;

            const box = new THREE.Box3();
            box.expandByObject(map);
            const size = box.getSize(new THREE.Vector3());


            size.x =   size.x<20? 40: size.x
            size.z =   size.z<30? 30: size.z

            minimapRenderer.domElement.id = 'miniRenderer'
            minimapRenderer.setSize(size.x * 10, size.z * 10);
            const minimapCamera = new THREE.OrthographicCamera(-size.x / 2, size.x / 2, size.z / 2, -size.z / 2, 0.000000001, 50);
            const center = miniCamraSettings[Number(projectId)];
            minimapCamera.position.set(center.x, center.y, center.z);
            minimapCamera.lookAt(center.x, 0, center.z);
            ShowMapContour(map)
            minimapRenderer.render(scene, minimapCamera);

            if (containerRef.current) {
                HideContour(map)
                containerRef.current.appendChild(minimapRenderer.domElement);
            }
        }

        return () => {
            if (containerRef.current) {
                const mMap = containerRef.current.querySelector('#miniRenderer')
                if (mMap) mMap.remove()
            }
        }
    }, [ projectId]);

    return <div ref={containerRef} className="minimap-container" />;
};

const MiniMap = ({ scene}: any) => {
    const isMap = useGame((state: any) => state.map);
    const projectId = useGame((state: any) => state.projectID);

    return isMap ? <MiniMapRenderer scene={scene} projectId={projectId} /> : null;
};

export default MiniMap;
