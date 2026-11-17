// Web Mercator ("slippy map") maths for the endless world terrain.
// Unit coordinates: u (west 0 -> east 1), v (north 0 -> south 1), same as map tile pixels.
// Scene: x = east, z = south, y = up, in metres at the anchor latitude.

export const EARTH_CIRCUMFERENCE = 40075016.686;
const DEG = Math.PI / 180;

export function geoToUnit(lat, lon) {
    const sin = Math.sin(lat * DEG);
    return {
        u: (lon + 180) / 360,
        v: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
    };
}

export function unitToGeo(u, v) {
    const n = Math.PI * (1 - 2 * v);
    return { lat: Math.atan(Math.sinh(n)) / DEG, lon: u * 360 - 180 };
}

/**
 * The scene frame: the anchor (lat/lon) is scene 0,0. Mercator is scaled by cos(anchor latitude)
 * so one scene unit is one metre around the anchor (the error grows slowly with distance in
 * latitude: about 0.5% at 100 km near the equator).
 */
export function createWorldFrame(anchor) {
    const origin = geoToUnit(anchor.lat, anchor.lon);
    const metersPerUnit = EARTH_CIRCUMFERENCE * Math.cos(anchor.lat * DEG);
    return {
        anchor,
        origin,
        metersPerUnit,
        unitToScene: (u, v) => ({ x: (u - origin.u) * metersPerUnit, z: (v - origin.v) * metersPerUnit }),
        sceneToUnit: (x, z) => ({ u: origin.u + x / metersPerUnit, v: origin.v + z / metersPerUnit }),
        geoToScene(lat, lon) {
            const { u, v } = geoToUnit(lat, lon);
            return this.unitToScene(u, v);
        },
        sceneToGeo(x, z) {
            const { u, v } = this.sceneToUnit(x, z);
            return unitToGeo(u, v);
        },
    };
}

export const tileKey = (z, x, y) => `${z}/${x}/${y}`;
