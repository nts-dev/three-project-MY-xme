// hooks/useCameraControls.ts
import { Pane } from "tweakpane";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import useGame from "../../../hooks/useGame";

const MIN_CAMERA_DISTANCE = 1;
const MAX_CAMERA_DISTANCE = 800000;

export default function useCameraControls({ orbitControls, gl }: any) {
    const pane: any = useRef(null);
    const setAnnotationSettings = useGame((state: any) => state.setAnnotationSettings);
    const showCamControls = useGame((state: any) => state.showCamControls);
    const annotationSettings = useGame((state: any) => state.annotationSettings);
    const projectId = useGame((state: any) => state.projectID);

    const settings = useMemo(() => {
        return {
            maxZoomOutFactor: 1.5,
            zoomSpeed: 4,
            panFactor: 4,
            fontSize: 90,
            fontColor: "#f05",
        };
    }, [projectId]);

    const updateTarget = () => {
        if (!orbitControls.current || !orbitControls.current.object) return;
        const camera = orbitControls.current.object;
        const target = orbitControls.current.target;
        const currentDistance = camera.position.distanceTo(target);

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const panAmount = 0.1 * settings.panFactor;

        if (currentDistance <= 1.01) {
            camera.position.add(forward.clone().multiplyScalar(panAmount));
            target.add(forward.clone().multiplyScalar(panAmount));
        } else if (currentDistance >= MAX_CAMERA_DISTANCE - 0.01) {
            camera.position.add(forward.clone().multiplyScalar(-panAmount));
            target.add(forward.clone().multiplyScalar(-panAmount));
        }

        orbitControls.current.update();
    };

    const onControlsChange = () => {
        orbitControls.current.panSpeed = settings.panFactor;
        orbitControls.current.zoomSpeed = settings.zoomSpeed;
    };

    useEffect(() => {
        const domElement = gl?.current?.domElement;
        if (!domElement || !orbitControls.current) return;

        orbitControls.current.enableDamping = true;
        orbitControls.current.dampingFactor = 0.09;
        orbitControls.current.maxPolarAngle = Math.PI / 2.3;
        orbitControls.current.minDistance = MIN_CAMERA_DISTANCE;
        orbitControls.current.maxDistance = MAX_CAMERA_DISTANCE;
        orbitControls.current.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
        };
        orbitControls.current.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
        };

        onControlsChange();
        orbitControls.current.update();

        pane.current = new Pane();
        pane.current.hidden = !showCamControls;

        const camSettings = pane.current.addFolder({ title: "Camera Settings" });
        camSettings.addBinding(settings, "zoomSpeed", { min: 1, max: 20, step: 1 }).on("change", (ev: any) => {
            settings.zoomSpeed = ev.value;
            onControlsChange();
        });

        camSettings.addBinding(settings, "panFactor", { min: 1, max: 20, step: 1 }).on("change", (ev: any) => {
            settings.panFactor = ev.value;
            onControlsChange();
        });

        const annotationFolder = pane.current.addFolder({ title: "Annotation Settings" });
        annotationFolder.addBinding(settings, "fontSize").on("change", (ev: any) => {
            setAnnotationSettings({ fontSize: ev.value, color: annotationSettings.color });
        });

        annotationFolder.addBinding(settings, "fontColor").on("change", (ev: any) => {
            setAnnotationSettings({ fontSize: annotationSettings.fontSize, color: ev.value });
        });

        return () => {
            if (pane.current) pane.current.dispose();
        };
    }, [gl, orbitControls, projectId, showCamControls]);

    useEffect(() => {
        if (pane.current) {
            pane.current.hidden = !showCamControls;
        }
    }, [showCamControls]);

    return { updateTarget };
}
