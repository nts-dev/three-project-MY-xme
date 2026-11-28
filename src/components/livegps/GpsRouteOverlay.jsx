import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import useGpsRouteTest from "./gpsRouteTest";
import useLiveGps from "./liveGpsStore";
import useGame from "../../hooks/useGame";
import { getTerrainHeightAt } from "../../threejs/terrain/terrainData";
import { remoteGpsRoutes } from "../../threejs/player/gpsTrack";

// GPS route test in the scene: the route as a blue line on the ground (the planned street route, or
// the path of a recorded real walk), which the avatar walks along; and the avatar's distance from it
// measured for the test's numbers (gpsRouteTest.js).

const BAND_WIDTH = 1.2; // metres
// Just above the surface (the depth offset keeps it over the asphalt): higher, it was drawn over the
// avatar's feet, which stand on the surface.
const LIFT = 0.015; // metres above the ground
const SAMPLE_MS = 200;

// On the surface drawn there: the street ribbons (world_ground_roads) can sit a little above the
// terrain's height (they follow the finer Google elevation), which would hide a line at terrain height.
const raycaster = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
const origin = new THREE.Vector3();
let roadsGroup = null;
function groundY(x, z) {
    const terrain = getTerrainHeightAt(x, z) ?? 0;
    if (roadsGroup) {
        origin.set(x, terrain + 20, z);
        raycaster.set(origin, DOWN);
        raycaster.far = 40;
        const hit = raycaster.intersectObject(roadsGroup, true)[0];
        if (hit && hit.point.y > terrain) return hit.point.y + LIFT;
    }
    return terrain + LIFT;
}

function routeBand(points) {
    // Densified so the band follows the ground between the corners.
    const line = [];
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[i + 1];
        line.push(a);
        if (!b) break;
        const pieces = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1.5);
        for (let k = 1; k < pieces; k++) line.push({ x: a.x + ((b.x - a.x) * k) / pieces, z: a.z + ((b.z - a.z) * k) / pieces });
    }
    const positions = [];
    const index = [];
    line.forEach((p, i) => {
        const a = line[Math.max(0, i - 1)];
        const b = line[Math.min(line.length - 1, i + 1)];
        const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        const nx = -(b.z - a.z) / length * (BAND_WIDTH / 2);
        const nz = (b.x - a.x) / length * (BAND_WIDTH / 2);
        const y = groundY(p.x, p.z);
        positions.push(p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz);
        if (i) index.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(index);
    return geometry;
}

/** One route line (its band built once per route). */
function RouteLine({ route, material }) {
    const band = useMemo(() => routeBand(route.points), [route]);
    useEffect(() => () => band.dispose(), [band]);
    return <mesh geometry={band} material={material} renderOrder={5} frustumCulled={false} />;
}

/** The lines of routes other players are walking (their route comes with their GPS updates). */
function RemoteRouteLines({ material }) {
    const [routes, setRoutes] = useState([]);
    const lastRef = useRef(0);
    useFrame(() => {
        const now = performance.now();
        if (now - lastRef.current < 1000) return;
        lastRef.current = now;
        const next = remoteGpsRoutes();
        setRoutes((current) => (
            current.length === next.length && current.every((r, i) => r.id === next[i].id && r.route === next[i].route) ? current : next
        ));
    });
    return routes.map(({ id, route }) => <RouteLine key={id} route={route} material={material} />);
}

export default function GpsRouteOverlay() {
    const scene = useThree((state) => state.scene);
    const route = useGpsRouteTest((s) => s.route);
    const active = useGpsRouteTest((s) => s.active);
    const liveStatus = useLiveGps((s) => s.status);
    const lastSampleRef = useRef(0);

    useEffect(() => {
        roadsGroup = scene.getObjectByName("world_ground_roads") || null;
    });
    const band = useMemo(() => {
        if (!route) return null;
        roadsGroup = scene.getObjectByName("world_ground_roads") || null;
        return routeBand(route.points);
    }, [route, scene]);
    useEffect(() => () => band?.dispose(), [band]);
    const material = useMemo(() => new THREE.MeshBasicMaterial({
        color: "#2f8cff", transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12,
    }), []);
    useEffect(() => () => material.dispose(), [material]);

    // The Live GPS button switched off during the test: the test ends there.
    useEffect(() => {
        if (active && liveStatus === "off") useGpsRouteTest.getState().finish();
    }, [active, liveStatus]);

    useFrame(() => {
        const test = useGpsRouteTest.getState();
        if (!test.active) return;
        const now = performance.now();
        if (now - lastSampleRef.current < SAMPLE_MS) return;
        lastSampleRef.current = now;
        const body = useGame.getState().characterRef;
        if (body?.translation) {
            const t = body.translation();
            test.sampleAvatar(t.x, t.z);
        }
    });

    return (
        <>
            {route && band && (
                <group name="gps-route-test">
                    <mesh geometry={band} material={material} renderOrder={5} frustumCulled={false} />
                </group>
            )}
            <group name="gps-remote-routes">
                <RemoteRouteLines material={material} />
            </group>
        </>
    );
}
