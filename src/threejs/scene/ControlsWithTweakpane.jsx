import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Pane } from "tweakpane";
import useGame from "../../hooks/useGame";
import { useThree } from "@react-three/fiber";

const ControlsWithTweakpane = ({ orbitControls, camera, gl }) => {
    const setAnnotationSettings = useGame((state) => state.setAnnotationSettings);
    const showCamControls = useGame((state) => state.showCamControls);
    const annotationSettings = useGame((state) => state.annotationSettings);
    const projectId = useGame((state) => state.projectID);
    const character = useGame((state) => state.character);
    const firstPerson = useGame((state) => state.firstPerson);
    const { scene } = useThree();

    const pane = useRef(null);
    const isInteracting = useRef(false);
    const touchDistance = useRef(0);
    const lastTouchCenter = useRef(null);
    const focusPoint = useRef(new THREE.Vector3(0, 0, 0));
    const gestureLock = useRef(null); // 'zoom', 'rotate', or null

    const clickStartTime = useRef(0);
    const movedEnough = useRef(false);
    const lastMousePosition = useRef({ x: 0, y: 0 });
    const clickTimeout = useRef(null);
    const justDoubleClicked = useRef(false);
    const lockThreshold = 2;

    const settings = useMemo(() => {
        return {
            maxZoomOutFactor: 1.5,
            zoomSpeed: 1,
            panFactor: 8,
            fontSize: 90,
            fontColor: "#f05",
        };
    }, [projectId]);

    const getTouchDistance = (e) => {
        const dx = e.touches[0].pageX - e.touches[1].pageX;
        const dy = e.touches[0].pageY - e.touches[1].pageY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (e) => ({
        x: (e.touches[0].pageX + e.touches[1].pageX) / 2,
        y: (e.touches[0].pageY + e.touches[1].pageY) / 2,
    });

    const zoomCamera = (factor) => {
        const controls = orbitControls.current;
        if (!controls || !camera || isInteracting.current) return;

        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        camera.position.addScaledVector(direction, factor);
        controls.target.addScaledVector(direction, factor);
        controls.update();
    };

    const panCamera = (dx, dy) => {
        const controls = orbitControls.current;
        if (!controls || !camera) return;

        const offset = new THREE.Vector3();
        const pan = new THREE.Vector3();
        const element = gl.current.domElement;

        offset.copy(camera.position).sub(controls.target);
        let targetDistance = offset.length();

        targetDistance *= Math.tan(((camera.fov || 45) / 2) * (Math.PI / 180.0));

        pan.set(
            (dx * targetDistance) / element.clientHeight,
            (dy * targetDistance) / element.clientHeight,
            0
        );
        pan.applyMatrix3(new THREE.Matrix3().setFromMatrix4(camera.matrix));
        camera.position.add(pan);
        controls.target.add(pan);
        controls.update();
    };

    const smoothPanCamera = (dx, dy, duration = 100) => {
        const controls = orbitControls.current;
        if (!controls || !camera) return;

        const offset = new THREE.Vector3();
        const pan = new THREE.Vector3();
        const element = gl.current.domElement;

        offset.copy(camera.position).sub(controls.target);
        let targetDistance = offset.length();
        targetDistance *= Math.tan(((camera.fov || 45) / 2) * (Math.PI / 180.0));

        pan.set(
            (dx * targetDistance) / element.clientHeight,
            (dy * targetDistance) / element.clientHeight,
            0
        );
        pan.applyMatrix3(new THREE.Matrix3().setFromMatrix4(camera.matrix));

        const startTime = performance.now();
        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();

        const animate = (time) => {
            const elapsed = time - startTime;
            const t = Math.min(elapsed / duration, 1); // Clamp t to [0, 1]

            const currentPan = pan.clone().multiplyScalar(t);
            camera.position.copy(startPos.clone().add(currentPan));
            controls.target.copy(startTarget.clone().add(currentPan));
            controls.update();

            if (t < 1) requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    };

    const smoothZoomCamera = (factor, duration = 100) => {
        const controls = orbitControls.current;
        if (!controls || !camera || isInteracting.current) return;

        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        const startTime = performance.now();
        const startPosition = camera.position.clone();
        const startTarget = controls.target.clone();
        const zoomVector = direction.clone().multiplyScalar(factor);

        const animate = (time) => {
            const elapsed = time - startTime;
            const t = Math.min(elapsed / duration, 1); // Clamp t to [0, 1]

            camera.position.copy(startPosition.clone().addScaledVector(zoomVector, t));
            controls.target.copy(startTarget.clone().addScaledVector(zoomVector, t));
            controls.update();

            if (t < 1) requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    };

    const handleTouchStart = (e) => {
        const controls = orbitControls.current;

        if (e.touches.length === 2) {
            touchDistance.current = getTouchDistance(e);
            lastTouchCenter.current = getTouchCenter(e);
            gestureLock.current = null;
            if (controls) controls.enableRotate = false;
        } else if (e.touches.length === 1) {
            gestureLock.current = "rotate";
            if (controls) controls.enableRotate = true;
        }
    };

    const handleTouchMove = (e) => {
        e.preventDefault();
        const controls = orbitControls.current;

        if (e.touches.length === 2) {
            const newDistance = getTouchDistance(e);
            const newCenter = getTouchCenter(e);
            const deltaDistance = newDistance - touchDistance.current;

            const deltaX = newCenter.x - lastTouchCenter.current.x;
            const deltaY = newCenter.y - lastTouchCenter.current.y;
            const moveDistance = Math.sqrt(deltaX ** 2 + deltaY ** 2);

            // Detect gesture type only if it has moved enough
            if (!gestureLock.current && (Math.abs(deltaDistance) > lockThreshold || moveDistance > lockThreshold)) {
                if (Math.abs(deltaDistance) > moveDistance) {
                    gestureLock.current = "zoom";
                } else {
                    gestureLock.current = "pan";
                }
            }

            if (gestureLock.current === "zoom" && Math.abs(deltaDistance) > 0.5) {
                const zoomFactor =
                    deltaDistance > 0 ? settings.zoomSpeed * 0.07 : -settings.zoomSpeed * 0.07;
                zoomCamera(zoomFactor);
                // smoothZoomCamera(zoomFactor)
                touchDistance.current = newDistance;
            } else if (gestureLock.current === "pan") {
                smoothPanCamera(deltaX, deltaY)
                // panCamera(deltaX, deltaY);
            }

            lastTouchCenter.current = newCenter;
            if (controls) controls.enableRotate = false;
        }
    };

    const handleTouchEnd = () => {
        const controls = orbitControls.current;
        if (controls) controls.enableRotate = true;
        gestureLock.current = null;
        touchDistance.current = 0;
        lastTouchCenter.current = null;
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? settings.zoomSpeed : -settings.zoomSpeed;
       zoomCamera(zoomFactor);
        // smoothZoomCamera(zoomFactor)
    };

    const handleClickToFocus = (event) => {
        if (!scene || !camera) return;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
            const newTarget = intersects[0].point;
            updateFocusPoint(newTarget);
        }
    };

    const updateFocusPoint = (newTarget) => {
        focusPoint.current.copy(newTarget);
        const controls = orbitControls.current;
        if (!controls) return;

        const duration = 0.4;
        const steps = duration * 60;
        const startTarget = controls.target.clone();
        let step = 0;

        const animate = () => {
            if (step >= steps) {
                controls.target.copy(newTarget);
                controls.update();
                return;
            }

            controls.target.lerpVectors(startTarget, newTarget, step / steps);
            controls.update();
            step++;
            requestAnimationFrame(animate);
        };

        animate();
    };

    useEffect(() => {
        const controls = orbitControls.current;
        const canvas = gl.current?.domElement;
        if (!controls || !canvas) return;

        controls.enableZoom = false;
        controls.enableRotate = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.09;
        controls.panSpeed = settings.panFactor;
        controls.minDistance = 0.01;
        controls.maxDistance = Infinity;
        controls.target.copy(focusPoint.current);
        controls.update();
        // controls.zoomToCursor = true
        controls.maxPolarAngle = Math.PI/2
        pane.current = new Pane();
        pane.current.hidden = !showCamControls;

        const camSettings = pane.current.addFolder({ title: "Camera Settings" });
        camSettings.addBinding(settings, "zoomSpeed", { min: 1, max: 20, step: 1 }).on("change", (ev) => {
            settings.zoomSpeed = ev.value;
        });

        camSettings.addBinding(settings, "panFactor", { min: 1, max: 20, step: 1 }).on("change", (ev) => {
            settings.panFactor = ev.value;
        });

        const annotationFolder = pane.current.addFolder({ title: "Annotation Settings" });
        annotationFolder.addBinding(settings, "fontSize").on("change", (ev) => {
            setAnnotationSettings({ fontSize: ev.value, color: annotationSettings.color });
        });

        annotationFolder.addBinding(settings, "fontColor").on("change", (ev) => {
            setAnnotationSettings({ fontSize: annotationSettings.fontSize, color: ev.value });
        });

        const handleMouseDown = (e) => {
            clickStartTime.current = Date.now();
            movedEnough.current = false;
            lastMousePosition.current = { x: e.clientX, y: e.clientY };
            isInteracting.current = true;
        };

        const handleMouseMove = (e) => {
            const dx = e.clientX - lastMousePosition.current.x;
            const dy = e.clientY - lastMousePosition.current.y;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                movedEnough.current = true;
            }
        };

        const handleMouseUp = (e) => {
            isInteracting.current = false;
            const duration = Date.now() - clickStartTime.current;
            if (duration < 250 && !movedEnough.current) {
                clickTimeout.current = setTimeout(() => {
                    if (!justDoubleClicked.current && !firstPerson && !character) {
                        gestureLock.current = null
                        handleClickToFocus(e);
                    }
                    clickTimeout.current = null;
                }, 250);
            }
        };

        const handleDoubleClick = () => {
            if (clickTimeout.current) {
                clearTimeout(clickTimeout.current);
                clickTimeout.current = null;
            }
            justDoubleClicked.current = true;
            setTimeout(() => (justDoubleClicked.current = false), 300);
        };

        canvas.addEventListener("mousedown", handleMouseDown);
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseup", handleMouseUp);
        canvas.addEventListener("dblclick", handleDoubleClick);
        canvas.addEventListener("wheel", handleWheel, { passive: false });
        canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
        canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
        canvas.addEventListener("touchend", handleTouchEnd);
        canvas.addEventListener("contextmenu", (e) => e.preventDefault());

        return () => {
            canvas.removeEventListener("mousedown", handleMouseDown);
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("mouseup", handleMouseUp);
            canvas.removeEventListener("dblclick", handleDoubleClick);
            canvas.removeEventListener("wheel", handleWheel);
            canvas.removeEventListener("touchstart", handleTouchStart);
            canvas.removeEventListener("touchmove", handleTouchMove);
            canvas.removeEventListener("touchend", handleTouchEnd);
            canvas.removeEventListener("contextmenu", (e) => e.preventDefault());
            if (clickTimeout.current) clearTimeout(clickTimeout.current);
        };
    }, [projectId, settings, scene, character, firstPerson]);

    useEffect(() => {
        if (pane.current) {
            pane.current.hidden = !showCamControls;
        }
    }, [showCamControls]);

    return null;
};

export default ControlsWithTweakpane;
