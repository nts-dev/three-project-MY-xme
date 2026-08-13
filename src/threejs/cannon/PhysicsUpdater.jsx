import  { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const PhysicsUpdater = ({world}) => {
 // Access the physics world from context
    const lastCallTime = useRef(null);

    useFrame((state, delta) => {
        if (!world) return; // Ensure world is defined

        const time = state.clock.getElapsedTime(); // Get current time in seconds

        if (!lastCallTime.current) {
            world.step(1 / 60); // Initial step
        } else {
            const dt = time - lastCallTime.current; // Calculate delta time
            world.step(1 / 60, dt); // Step the physics world
        }

        lastCallTime.current = time; // Update last call time
    });

    return null; // This component doesn't render anything
};

export default PhysicsUpdater;