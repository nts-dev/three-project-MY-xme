import { RigidBody } from "@react-three/rapier";
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import useGame from "../../hooks/useGame.js";

export default function MovementAsset({ data, object,texture,size }) {
    // ------------------ Refs & State ------------------
    const clonObj = useMemo(() => object.clone(), [object]);
    const rigidBodyRef = useRef();


    const {
        setDeleteAssetId,
        deleteObject,
        buttonMode,
    } = useGame((state) => ({
        setDeleteAssetId: state.setDeleteAssetId,
        deleteObject: state.deleteObject,
        buttonMode: state.buttonMode,
    }));



    return (
        <>
            <RigidBody
                ref={rigidBodyRef}
                key={data.key}
                type="kinematicPosition"
                colliders="trimesh"
                position={data.position}
                friction={2}
                restitution={0}
                // onCollisionEnter={onCollisionEnter}
                // onCollisionExit={onCollisionExit}

            >
                <group



                >
                    <mesh
                         position={[0,0.012,0]}
                        rotation={[-Math.PI / 2, 0, 0]}

                    >
                        <planeGeometry args={[size.width * 0.01, size.length * 0.01]} />
                        <meshBasicMaterial
                            map={texture}
                            transparent
                            opacity={1}
                            depthWrite
                            depthTest
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                    <primitive object={clonObj} scale={[0.01, 0.01, 0.01]}
                               onPointerDown={buttonMode === 'Edit Mode' ? (e) => {
                                   e.stopPropagation();
                                   if (deleteObject) setDeleteAssetId(data.key);
                               }: undefined}
                    />

                </group>

            </RigidBody>

        </>
    );
}
