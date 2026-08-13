import { memo, useRef } from 'react';
import * as THREE from 'three';
import { useHelper } from '@react-three/drei';

const SpotLight = memo(function SpotLight({
                                                          position,
                                                          rotation,
                                                          angle = Math.PI / 6,
                                                          distance = 10,
                                                          intensity = 5,
                                                          color = '#ffffff',
                                                          showHelper = false,
                                                      }) {
    const lightRef = useRef();
    const targetRef = useRef();

    // ✅ Attach the helper to the light
    useHelper(showHelper && lightRef, THREE.SpotLightHelper, 'cyan');

    return (
        <>
            <spotLight
                ref={lightRef}
                position={position}
                rotation={rotation}
                angle={angle}
                distance={distance}
                intensity={intensity}
                color={color}
                penumbra={0.3}
                castShadow
                target={targetRef.current}
            />
            <object3D ref={targetRef} position={[0, 0, -1]} />
        </>
    );
});

export default SpotLight;
