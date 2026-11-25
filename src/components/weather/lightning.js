// Lightning state shared by Lightning (schedules strikes, draws the bolt), RainEffect (multiplies
// the exposure by flashExposure() for the flash) and WeatherSound (thunder after each strike).

export const lightning = { flash: 0 }; // 0 .. 1, current flash brightness

const strikeListeners = new Set();
/** fn({ distance }) for every strike (distance in metres from the viewer). */
export const onStrike = (fn) => {
    strikeListeners.add(fn);
    return () => strikeListeners.delete(fn);
};
export const emitStrike = (strike) => strikeListeners.forEach((fn) => fn(strike));

/** Exposure multiplier for the current flash; stronger at night (darker base exposure). */
export const flashExposure = (daylight = 1) => 1 + lightning.flash * (1.2 + 3 * (1 - daylight));

/** Thunderstorm now (live weather or ?weather=storm|thunderstorm). */
export const isStorm = (weather, preview) =>
    preview ? ["storm", "thunderstorm"].includes(preview) : weather?.kind === "thunderstorm";
