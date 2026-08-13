import { useRef, useEffect } from 'react';
import {extend, useFrame, useThree} from '@react-three/fiber';
import OctgramShaderMaterial from './OctgramShaderMaterial';
extend({ OctgramShaderMaterial });
export default function Plane({ size = [1, 1] }) {
    const materialRef = useRef();
    const { size: viewportSize, clock } = useThree();

    // Set initial resolution
    useEffect(() => {
        if (materialRef.current) {
            materialRef.current.uResolution.set(viewportSize.width, viewportSize.height);
        }
    }, [viewportSize]);

    useFrame(() => {
        if (materialRef.current) {
            materialRef.current.uTime = clock.getElapsedTime();
            // Optional if dynamic resize support needed
            materialRef.current.uResolution.set(viewportSize.width, viewportSize.height);
        }
    });

    return (
        <mesh position={[0.5, 0.5, 0]}>
            <planeGeometry args={size} />
            <octgramShaderMaterial ref={materialRef} />
        </mesh>
    );
}
