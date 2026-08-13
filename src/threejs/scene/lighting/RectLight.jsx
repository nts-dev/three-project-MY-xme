import { forwardRef, memo } from 'react';

const RectLight = memo(function RectLight({
                                              position,
                                              rotation,
                                              width,
                                              height,
                                              color,
                                              intensity,
                                              showPlane
                                          }) {
    return (
        <>
            <rectAreaLight
                position={position}
                rotation={rotation}
                args={[color, intensity, width, height]}
            />
            {showPlane && (
                <mesh position={position} rotation={rotation}>
                    <planeGeometry args={[width, height]} />
                    <meshBasicMaterial color="white" opacity={0.2} transparent />
                </mesh>
            )}
        </>
    );
});

export default RectLight;
