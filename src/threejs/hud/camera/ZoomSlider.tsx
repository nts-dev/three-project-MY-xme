import * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import * as THREE from "three";
import { motion } from "motion/react";
import { Container } from '@playcanvas/pcui/react';

const MotionDiv = motion.div;

export default function ZoomSlider({ camera, orbitControls }: any) {
    const previousZoomValue = useRef(40);
    const sliderTrackRef = useRef<HTMLDivElement | null>(null);
    const [zoomValue, setZoomValue] = useState(40);

    const handleZoomChange = useCallback((value: number) => {
        const newZoomValue = Number(value);
        if (!Number.isFinite(newZoomValue)) {
            return;
        }

        const zoomDifference = newZoomValue - previousZoomValue.current;
        const targetDistanceThreshold = 2; // Threshold for how close the camera can get to the target
        const maxZoomOutFactor = 1;
        if (camera.current) {
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyQuaternion(camera.current.quaternion);
            // Adjust the zoom intensity based on the difference
            const zoomIntensity = 0.5; // Adjust this scalar for zoom speed
            camera.current.position.add(direction.multiplyScalar(zoomDifference * zoomIntensity));
        }

        if (orbitControls.current && camera.current) {
            const distanceToTarget = camera.current.position.distanceTo(orbitControls.current.target);
            if (distanceToTarget < targetDistanceThreshold) {
                const direction = orbitControls.current.target.clone()
                    .sub(camera.current.position)
                    .normalize();

                // Move the target and camera away from each other slightly
                orbitControls.current.target.add(direction.multiplyScalar(maxZoomOutFactor));
                camera.current.position.sub(direction.multiplyScalar(maxZoomOutFactor));

                // Ensure we don't overshoot the movement
                if (camera.current.position.distanceTo(orbitControls.current.target) >= targetDistanceThreshold) {
                    camera.current.position.sub(direction.multiplyScalar(-maxZoomOutFactor));
                }

                orbitControls.current.update();
            }
        }

        previousZoomValue.current = newZoomValue;
        setZoomValue(newZoomValue);
    }, [camera, orbitControls]);

    const updateZoomFromPointer = useCallback((clientY: number) => {
        const track = sliderTrackRef.current;
        if (!track) {
            return;
        }

        const rect = track.getBoundingClientRect();
        const nextValue = ((rect.bottom - clientY) / rect.height) * 100;
        handleZoomChange(THREE.MathUtils.clamp(nextValue, 0, 100));
    }, [handleZoomChange]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        updateZoomFromPointer(event.clientY);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
            return;
        }

        updateZoomFromPointer(event.clientY);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            handleZoomChange(THREE.MathUtils.clamp(zoomValue + 2, 0, 100));
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            handleZoomChange(THREE.MathUtils.clamp(zoomValue - 2, 0, 100));
        }
    };

    return (
        <MotionDiv
            className="zoom-meter motion-right-hud-panel motion-zoom-panel"
            initial={{ opacity: 0, x: 18, scale: 0.96, filter: "blur(5px)" }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ type: "spring", stiffness: 270, damping: 25 }}
            whileHover={{ x: -2 }}
        >
            <Container class={['pcui-canvas-zoom-control']}>
                <i className="pi pi-search-plus visible-element" aria-hidden="true"></i>
                <div className="pcui-canvas-zoom-slider-wrap">
                    <div
                        ref={sliderTrackRef}
                        className="pcui-canvas-zoom-vertical-slider"
                        role="slider"
                        tabIndex={0}
                        aria-label="Camera zoom"
                        aria-orientation="vertical"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Number(zoomValue.toFixed(1))}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onKeyDown={handleKeyDown}
                    >
                        <div
                            className="pcui-canvas-zoom-vertical-bar"
                            style={{ height: `${zoomValue}%` }}
                        />
                        <div
                            className="pcui-canvas-zoom-vertical-handle"
                            style={{ bottom: `${zoomValue}%` }}
                        />
                    </div>
                </div>
                <i className="pi pi-search-minus visible-element" aria-hidden="true"></i>
            </Container>
        </MotionDiv>
    );
}
