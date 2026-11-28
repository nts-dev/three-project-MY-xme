import { getActiveTerrain } from "../../threejs/terrain/terrainData";
import { useSkyStore, useWeatherStore } from "./weatherStore";

// The site's clock (the sky, the office lights): the moment the scene shows, at the site's UTC offset.

/** UTC offset in hours for the site: from the weather reading's timestamp, else from the longitude. */
export function siteOffsetHours(weather, lon) {
    const match = /([+-])(\d{2}):(\d{2})$/.exec(String(weather?.observedAt || ""));
    if (match) return (match[1] === "-" ? -1 : 1) * (Number(match[2]) + Number(match[3]) / 60);
    return Math.round(lon / 15);
}

/**
 * The site's wall clock for the moment the scene shows (now, or ?time=HH:MM): { day, minutes },
 * day 0 = Sunday .. 6, minutes since midnight. Without a terrain anchor: the browser's clock.
 */
export function siteClock() {
    const anchor = getActiveTerrain()?.world?.frame?.anchor;
    const { timePreview } = useSkyStore.getState();
    const weather = useWeatherStore.getState().weather;
    if (!Number.isFinite(anchor?.lon)) {
        const now = new Date();
        const match = /^(\d{1,2}):(\d{2})$/.exec(String(timePreview || ""));
        return { day: now.getDay(), minutes: match ? Number(match[1]) * 60 + Number(match[2]) : now.getHours() * 60 + now.getMinutes() };
    }
    const offset = siteOffsetHours(weather, anchor.lon);
    const site = new Date(displayDate(timePreview, weather, anchor.lon).getTime() + offset * 3600000);
    return { day: site.getUTCDay(), minutes: site.getUTCHours() * 60 + site.getUTCMinutes() };
}

/** The moment to show: now, or today's ?time=HH:MM at the site. */
export function displayDate(timePreview, weather, lon) {
    const now = new Date();
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(timePreview || ""));
    if (!match) return now;
    const offset = siteOffsetHours(weather, lon);
    const site = new Date(now.getTime() + offset * 3600000); // site wall clock, read through UTC getters
    return new Date(Date.UTC(site.getUTCFullYear(), site.getUTCMonth(), site.getUTCDate(), Number(match[1]), Number(match[2])) - offset * 3600000);
}
