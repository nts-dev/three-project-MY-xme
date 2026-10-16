// Visualization of the physical robot test environment: a ~3m x 1m cardboard sheet,
// 4 RTLS anchor markers, a start marker, and the intended rectangular route outline.
//
// IMPORTANT: none of these coordinates are surveyed/verified physical measurements.
// The cardboard rectangle is centered on the actual recorded GR100F trajectory's
// bounding box (so it visually lines up with the existing dot trail) but sized to
// the 3m x 1m dimension you described; the anchor positions are a fixed margin
// outside that rectangle's corners, not real anchor hardware positions. Replace
// with surveyed coordinates once available.
import { useMemo } from "react";
import * as THREE from "three";
import usePlayerTrackReplay from "../player/usePlayerTrackReplay";
import { transformRtlsScenePoint } from "../player/CameraPathReplay";

const CARDBOARD_LENGTH = 3; // meters, long axis — matches the stated test area
const CARDBOARD_WIDTH = 1; // meters, short axis
const ANCHOR_MARGIN = 0.15; // meters outside the cardboard edge, for visibility only
const ANCHOR_HEIGHT = 0.3; // meters above floor, for visibility only
const ROUTE_INSET = 0.85; // intended rectangular route sits slightly inside the sheet edge

function getPointPosition(point: any): THREE.Vector3 {
    const position = point?.position || {};
    return new THREE.Vector3(Number(position.x) || 0, Number(position.y) || 0, Number(position.z) || 0);
}

function buildQuadGeometry(corners: THREE.Vector3[]) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(corners.flatMap((corner) => [corner.x, corner.y, corner.z]));
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    return geometry;
}

export default function RobotTestArea({ projectID }: { projectID: any }) {
    const { pathGroups } = usePlayerTrackReplay(projectID, true, "robot");

    const layout = useMemo(() => {
        const allPoints = pathGroups.flatMap((group) => group.points.map(getPointPosition));
        if (allPoints.length === 0) return null;

        const minX = Math.min(...allPoints.map((point) => point.x));
        const maxX = Math.max(...allPoints.map((point) => point.x));
        const minZ = Math.min(...allPoints.map((point) => point.z));
        const maxZ = Math.max(...allPoints.map((point) => point.z));
        const centerX = (minX + maxX) / 2;
        const centerZ = (minZ + maxZ) / 2;

        // Long axis follows whichever recorded span is larger.
        const alongX = maxX - minX >= maxZ - minZ;
        const halfX = (alongX ? CARDBOARD_LENGTH : CARDBOARD_WIDTH) / 2;
        const halfZ = (alongX ? CARDBOARD_WIDTH : CARDBOARD_LENGTH) / 2;

        const at = (sx: number, sz: number, extraX = 0, extraZ = 0, y = 0) =>
            transformRtlsScenePoint(
                new THREE.Vector3(centerX + sx * (halfX + extraX), y, centerZ + sz * (halfZ + extraZ))
            );

        const corners = [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)];
        const anchors = [
            at(-1, -1, ANCHOR_MARGIN, ANCHOR_MARGIN, ANCHOR_HEIGHT),
            at(1, -1, ANCHOR_MARGIN, ANCHOR_MARGIN, ANCHOR_HEIGHT),
            at(1, 1, ANCHOR_MARGIN, ANCHOR_MARGIN, ANCHOR_HEIGHT),
            at(-1, 1, ANCHOR_MARGIN, ANCHOR_MARGIN, ANCHOR_HEIGHT),
        ];
        const routeCorners = [
            at(-ROUTE_INSET, -ROUTE_INSET),
            at(ROUTE_INSET, -ROUTE_INSET),
            at(ROUTE_INSET, ROUTE_INSET),
            at(-ROUTE_INSET, ROUTE_INSET),
        ];
        const start = transformRtlsScenePoint(getPointPosition(pathGroups[0]?.points?.[0]));

        return { corners, anchors, routeCorners, start };
    }, [pathGroups]);

    const floorGeometry = useMemo(() => (layout ? buildQuadGeometry(layout.corners) : null), [layout]);
    const floorMaterial = useMemo(
        () =>
            new THREE.MeshStandardMaterial({
                color: "#c8a06a",
                roughness: 0.95,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.55,
            }),
        []
    );
    const anchorGeometry = useMemo(() => new THREE.CylinderGeometry(0.03, 0.03, ANCHOR_HEIGHT * 2, 8), []);
    const anchorMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffd21f", roughness: 0.4 }), []);
    const startGeometry = useMemo(() => new THREE.ConeGeometry(0.06, 0.12, 12), []);
    const startMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#21d86f" }), []);
    const routeGeometry = useMemo(() => {
        if (!layout) return null;
        return new THREE.BufferGeometry().setFromPoints([...layout.routeCorners, layout.routeCorners[0]]);
    }, [layout]);
    const routeMaterial = useMemo(() => new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: 0.1, gapSize: 0.06 }), []);

    if (!layout || !floorGeometry || !routeGeometry) return null;

    return (
        <group name="robot-test-area">
            <mesh geometry={floorGeometry} material={floorMaterial} />
            <line geometry={routeGeometry} material={routeMaterial} onUpdate={(line: any) => line.computeLineDistances()} />
            {layout.anchors.map((position, index) => (
                <mesh key={index} position={position} geometry={anchorGeometry} material={anchorMaterial} />
            ))}
            <mesh position={layout.start} geometry={startGeometry} material={startMaterial} />
        </group>
    );
}
