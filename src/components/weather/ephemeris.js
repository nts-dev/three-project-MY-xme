// Sun and moon positions for a place and time: the standard low-precision formulas (Astronomical
// Algorithms / "Explanatory Supplement", as used by the SunCalc library), accurate to a fraction of a
// degree, plenty for lighting and drawing the sky. Angles in radians.
//   azimuth: from south towards west; altitude: above the horizon.

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

const toDays = (date) => date.valueOf() / DAY_MS - 0.5 + J1970 - J2000;
const rightAscension = (l, b) => Math.atan2(Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY), Math.cos(l));
const declination = (l, b) => Math.asin(Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l));
const siderealTime = (d, lw) => RAD * (280.16 + 360.9856235 * d) - lw;
const azimuth = (H, phi, dec) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
const altitude = (H, phi, dec) => Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));

function sunCoords(d) {
    const M = RAD * (357.5291 + 0.98560028 * d); // mean anomaly
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + RAD * 102.9372 + Math.PI; // ecliptic longitude
    return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

function moonCoords(d) {
    const L = RAD * (218.316 + 13.176396 * d);
    const M = RAD * (134.963 + 13.064993 * d);
    const F = RAD * (93.272 + 13.22935 * d);
    const l = L + RAD * 6.289 * Math.sin(M);
    const b = RAD * 5.128 * Math.sin(F);
    const dist = 385001 - 20905 * Math.cos(M); // km
    return { ra: rightAscension(l, b), dec: declination(l, b), dist };
}

/** Sun position: { azimuth, altitude }. */
export function sunPosition(date, lat, lon) {
    const lw = RAD * -lon, phi = RAD * lat, d = toDays(date);
    const c = sunCoords(d);
    const H = siderealTime(d, lw) - c.ra;
    return { azimuth: azimuth(H, phi, c.dec), altitude: altitude(H, phi, c.dec) };
}

/** Moon position: { azimuth, altitude } (with a small refraction correction near the horizon). */
export function moonPosition(date, lat, lon) {
    const lw = RAD * -lon, phi = RAD * lat, d = toDays(date);
    const c = moonCoords(d);
    const H = siderealTime(d, lw) - c.ra;
    let h = altitude(H, phi, c.dec);
    h += (0.017 * RAD) / Math.tan(h + (10.26 * RAD) / (h + 5.1 * RAD));
    return { azimuth: azimuth(H, phi, c.dec), altitude: h };
}

/** Moon illumination: { fraction (0 new .. 1 full), waxing }. */
export function moonIllumination(date) {
    const d = toDays(date);
    const s = sunCoords(d), m = moonCoords(d);
    const sdist = 149598000; // km
    const phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
    const angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return { fraction: (1 + Math.cos(inc)) / 2, waxing: angle < 0 };
}

/**
 * Unit direction towards a body in the scene frame (x east, y up, z south) from SunCalc angles
 * (azimuth from south towards west).
 */
export function sceneDirection({ azimuth: az, altitude: alt }, target) {
    const c = Math.cos(alt);
    return target.set(-Math.sin(az) * c, Math.sin(alt), Math.cos(az) * c);
}
