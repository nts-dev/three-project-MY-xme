import { useEffect, useMemo } from "react";
import * as THREE from "three";

type RoutePathIndicatorProps = {
    points: [number, number, number][];
    coordinateScale?: number;
    activeColor?: THREE.ColorRepresentation;
    inactiveColor?: THREE.ColorRepresentation;
    activeSegmentIndex?: number;
    directionSign?: 1 | -1;
    yOffset?: number;
};

export default function RoutePathIndicator({
    points,
    coordinateScale = 1,
    activeColor = "#1f8fff",
    inactiveColor = "#4b5563",
    activeSegmentIndex = 0,
    directionSign = 1,
    yOffset = 0.04,
}: RoutePathIndicatorProps) {
    const segments = useMemo(() => {
        const scaledPoints = points.map((point) =>
            new THREE.Vector3(...point).multiplyScalar(coordinateScale)
        );

        return scaledPoints.slice(0, -1).map((from, index) => {
            const to = scaledPoints[index + 1];
            const vector = to.clone().sub(from);
            const length = vector.length();

            if (length <= 0) {
                return null;
            }

            const liftedFrom = from.clone();
            const liftedTo = to.clone();
            liftedFrom.y += yOffset;
            liftedTo.y += yOffset;

            const geometry = new THREE.BufferGeometry().setFromPoints([liftedFrom, liftedTo]);
            const material = new THREE.LineBasicMaterial({
                color: index === activeSegmentIndex ? activeColor : inactiveColor,
                transparent: true,
                opacity: index === activeSegmentIndex ? 0.95 : 0.22,
                depthWrite: false,
            });
            const line = new THREE.Line(geometry, material);
            line.frustumCulled = false;
            line.name = `route-path-line-${index}`;

            return {
                from: liftedFrom,
                to: liftedTo,
                direction: vector.normalize(),
                length,
                line,
            };
        }).filter(Boolean) as Array<{
            from: THREE.Vector3;
            to: THREE.Vector3;
            direction: THREE.Vector3;
            length: number;
            line: THREE.Line;
        }>;
    }, [activeColor, activeSegmentIndex, coordinateScale, inactiveColor, points, yOffset]);

    useEffect(() => {
        return () => {
            segments.forEach((segment) => {
                segment.line.geometry.dispose();
                (segment.line.material as THREE.Material).dispose();
            });
        };
    }, [segments]);

    const activeSegment = segments[activeSegmentIndex] || segments[0];
    const activeDirection = activeSegment?.direction.clone().multiplyScalar(directionSign);
    const activeOrigin = directionSign > 0 ? activeSegment?.from : activeSegment?.to;
    const headLength = activeSegment ? Math.min(activeSegment.length * 0.22, 0.35) : 0.1;
    const headWidth = Math.min(headLength * 0.55, 0.18);

    return (
        <group name="route-path-indicator">
            {segments.map((segment, index) => (
                <primitive key={index} object={segment.line} />
            ))}
            {activeSegment && activeDirection && activeOrigin && (
                <arrowHelper
                    key={`${activeSegmentIndex}-${directionSign}`}
                    args={[activeDirection, activeOrigin, activeSegment.length, activeColor, headLength, headWidth]}
                    name="route-path-active-arrow"
                />
            )}
        </group>
    );
}
