import React, { useRef, useEffect, useState } from 'react';
import {
    AmbientLight as AmbientLightImpl,
    PointLight as PointLightImpl,
    DirectionalLight as DirectionalLightImpl,
    SpotLight as SpotLightImpl,
    RectAreaLight as RectAreaLightImpl,
} from 'three';
import { PlaneGeometry, Mesh, MeshBasicMaterial } from 'three';
import * as THREE from "three";

const LightComponent = ({
                            type = 'ambient',
                            position = [0, 0, 0],
                            intensity = 1,
                            color = '#ffffff',
                            target = [0, 0, 0],
                            distance = 0,
                            angle = Math.PI / 4,
                            penumbra = 0,
                            decay = 1,
                            width = 1,
                            height = 1,
                            castShadow = false,
                        }) => {
    const lightRef = useRef();
    const planeRef = useRef(); // Ref for the plane
    const [isReady, setIsReady] = useState(false);

    // Light class lookup
    const LightClass = {
        ambient: AmbientLightImpl,
        point: PointLightImpl,
        directional: DirectionalLightImpl,
        spot: SpotLightImpl,
        rect: RectAreaLightImpl,
    }[type.toLowerCase()] || AmbientLightImpl;

    console.log('LightClass for type', type.toLowerCase(), ':', typeof LightClass); // Debug log

    // Create light instance
    useEffect(() => {
        try {
            const light = new LightClass();
            light.intensity = intensity;
            light.color.set(color);
            light.castShadow = castShadow;

            // Apply position to all light types (will be overridden by plane for rect)
            light.position.set(0, 0, 0); // Default to origin, plane will handle transformation

            // Apply specific props
            if (type.toLowerCase() === 'point') {
                light.distance = distance;
                light.decay = decay;
            } else if (type.toLowerCase() === 'directional') {
                light.target = new THREE.Object3D();
                light.target.position.set(...target);
            } else if (type.toLowerCase() === 'spot') {
                light.angle = angle;
                light.penumbra = penumbra;
                light.distance = distance;
                light.decay = decay;
                light.target = new THREE.Object3D();
                light.target.position.set(...target);
            } else if (type.toLowerCase() === 'rect') {
                light.width = width;
                light.height = height;
            }

            lightRef.current = light;
            setIsReady(true);

            // Attach light to plane if it's a rect light and plane is ready
            if (type.toLowerCase() === 'rect' && planeRef.current) {
                planeRef.current.add(light);
                // Ensure light's position is at the plane's origin (center of plane)
                light.position.set(0, 0, 0); // Relative to plane
                planeRef.current.rotateX(-Math.PI / 2);
                // light.rotateX(-Math.PI / 2);
            }
        } catch (error) {
            console.error('Error instantiating light:', error);
        }

        return () => {
            if (lightRef.current && (type.toLowerCase() === 'directional' || type.toLowerCase() === 'spot')) {
                lightRef.current.target.removeFromParent();
            }
            if (lightRef.current && planeRef.current && type.toLowerCase() === 'rect') {
                planeRef.current.remove(lightRef.current); // Cleanup attachment
            }
        };
    }, [type, intensity, color, castShadow, distance, angle, penumbra, decay, width, height, target]);

    // Update target position if it changes
    useEffect(() => {
        if (lightRef.current && (type.toLowerCase() === 'directional' || type.toLowerCase() === 'spot')) {
            lightRef.current.target.position.set(...target);
            lightRef.current.target.updateMatrixWorld();
        }
    }, [type, target]);

    return isReady ? (
        <>
            {type.toLowerCase() === 'rect' && (
                <group position={position}> {/* Group to apply position */}
                    <mesh ref={planeRef}>
                        <planeGeometry args={[width, height]} />
                        <meshBasicMaterial color="gray" transparent opacity={0.3} />
                    </mesh>
                </group>
            )}
            {type.toLowerCase() !== 'rect' && <primitive ref={lightRef} object={lightRef.current} />}
        </>
    ) : null;
};

export default LightComponent;