import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const formatCoordinate = (value) => (
    Number.isFinite(value) ? value.toFixed(2) : '--'
);

const getClipboardText = (coordinates) => (
    `x: ${formatCoordinate(coordinates?.x)}, z: ${formatCoordinate(coordinates?.z)}`
);

const copyTextToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
};

const ViewportMouseCoordinates = ({ cameraRef, canvasHostRef }) => {
    const [coordinates, setCoordinates] = useState(null);
    const [copied, setCopied] = useState(false);
    const raycaster = useMemo(() => new THREE.Raycaster(), []);
    const pointer = useRef(new THREE.Vector2());
    const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
    const hitPoint = useRef(new THREE.Vector3());
    const latestCoordinates = useRef(null);
    const copiedTimer = useRef(null);

    useEffect(() => {
        const host = canvasHostRef?.current;
        if (!host) {
            return undefined;
        }

        const getCoordinatesFromEvent = (event) => {
            const camera = cameraRef?.current;
            if (!camera) {
                return null;
            }

            const rect = host.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                return null;
            }

            pointer.current.set(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );

            camera.updateMatrixWorld?.();
            raycaster.setFromCamera(pointer.current, camera);

            if (raycaster.ray.intersectPlane(groundPlane, hitPoint.current)) {
                return {
                    x: hitPoint.current.x * 100,
                    z: hitPoint.current.z * 100,
                };
            }

            return null;
        };

        const updateCoordinates = (event) => {
            const nextCoordinates = getCoordinatesFromEvent(event);
            latestCoordinates.current = nextCoordinates;
            setCoordinates(nextCoordinates);
        };

        const copyCoordinates = async (event) => {
            const nextCoordinates = getCoordinatesFromEvent(event) || latestCoordinates.current;
            if (!nextCoordinates) {
                return;
            }

            latestCoordinates.current = nextCoordinates;
            setCoordinates(nextCoordinates);
            // await copyTextToClipboard(getClipboardText(nextCoordinates));
            // setCopied(true);
            // window.clearTimeout(copiedTimer.current);
            // copiedTimer.current = window.setTimeout(() => setCopied(false), 900);
        };

        const clearCoordinates = () => {
            latestCoordinates.current = null;
            setCoordinates(null);
        };

        host.addEventListener('pointermove', updateCoordinates);
        host.addEventListener('click', copyCoordinates);
        host.addEventListener('pointerleave', clearCoordinates);

        return () => {
            window.clearTimeout(copiedTimer.current);
            host.removeEventListener('pointermove', updateCoordinates);
            host.removeEventListener('click', copyCoordinates);
            host.removeEventListener('pointerleave', clearCoordinates);
        };
    }, [cameraRef, canvasHostRef, groundPlane, raycaster]);

    return (
        <div className={`webglstudio-coordinate-readout ${copied ? 'is-copied' : ''}`} aria-live="polite">
            <span>X : {formatCoordinate(coordinates?.x)}</span>
            <span>Z : {formatCoordinate(coordinates?.z)}</span>
            {copied && <span className="coordinate-copy-state">Copied</span>}
        </div>
    );
};

export default ViewportMouseCoordinates;
