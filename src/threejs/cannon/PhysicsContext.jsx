import React, { createContext, useContext, useState, useEffect } from 'react';
import * as CANNON from 'cannon-es';

const PhysicsContext = createContext();

export const PhysicsProvider = ({ children }) => {
    const [world] = useState(() => new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) }));

    useEffect(() => {
        world.broadphase = new CANNON.SAPBroadphase(world);

        const bodyMaterial = new CANNON.Material();
        const groundMaterial = new CANNON.Material();
        const bodyGroundContactMaterial = new CANNON.ContactMaterial(
            bodyMaterial,
            groundMaterial,
            { friction: 0.1, restitution: 0.3 }
        );
        world.addContactMaterial(bodyGroundContactMaterial);

        return () => {
            // Cleanup physics world if needed
        };
    }, [world]);

    return (
        <PhysicsContext.Provider value={world}>
            {children}
        </PhysicsContext.Provider>
    );
};

export const usePhysics = () => useContext(PhysicsContext);