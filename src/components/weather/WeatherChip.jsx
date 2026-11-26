import { useEffect, useRef, useState } from "react";
import {
    WiCloud,
    WiCloudy,
    WiDayCloudy,
    WiDayShowers,
    WiDaySunny,
    WiFog,
    WiNightAltCloudy,
    WiNightAltShowers,
    WiNightClear,
    WiRain,
    WiShowers,
    WiSnow,
    WiSprinkle,
    WiThunderstorm,
    WiTime4,
    WiWindDeg,
} from "react-icons/wi";
import { HiOutlineCalendarDays, HiOutlineMapPin, HiSpeakerWave, HiSpeakerXMark } from "react-icons/hi2";
import { useSoundStore } from "./soundStore";
import { getActiveTerrain } from "../../threejs/terrain/terrainData";
import { rainLevel, useWeatherStore } from "./weatherStore";
import ForecastPanel from "./ForecastPanel";
import "./WeatherChip.css";

const FORECAST_TTL_MS = 30 * 60 * 1000;

const LEVEL_LABELS = { light: "Light", medium: "Medium", heavy: "Heavy" };

// Live weather for the open map (backend /weather, Open-Meteo), as a chip in the top bar:
// temperature, condition and wind; click for details. The location is the terrain's anchor (the
// map's real-world centre), so one reading serves the whole site. Refreshes every 5 minutes and when
// the tab comes back into view; the scene (rain, light, wet roads) follows each new reading.

const REFRESH_MS = 5 * 60 * 1000;
const API_BASE = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const ICONS = {
    clear: [WiDaySunny, WiNightClear],
    "partly-cloudy": [WiDayCloudy, WiNightAltCloudy],
    cloudy: [WiCloudy, WiCloudy],
    fog: [WiFog, WiFog],
    drizzle: [WiSprinkle, WiSprinkle],
    rain: [WiRain, WiRain],
    showers: [WiDayShowers, WiNightAltShowers],
    snow: [WiSnow, WiSnow],
    thunderstorm: [WiThunderstorm, WiThunderstorm],
};

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (degrees) => COMPASS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
const round = (value) => (Number.isFinite(value) ? Math.round(value) : "–");

/** The open map's real-world centre ({ lat, lon }), or null while no terrain is loaded. */
const terrainAnchor = () => {
    const terrain = getActiveTerrain();
    const anchor = terrain?.world?.frame?.anchor || terrain?.anchor;
    return Number.isFinite(anchor?.lat) && Number.isFinite(anchor?.lon) ? anchor : null;
};

export default function WeatherChip() {
    const [anchor, setAnchor] = useState(terrainAnchor);
    const [weather, setWeather] = useState(null);
    const [failed, setFailed] = useState(false);
    const [open, setOpen] = useState(false); // false | "details" | "forecast"
    const [forecast, setForecast] = useState(null); // { at, key, data } or { at, key, error }
    const preview = useWeatherStore((state) => state.preview);
    const soundOn = useSoundStore((state) => state.on);
    const toggleSound = useSoundStore((state) => state.toggle);
    const rootRef = useRef(null);

    // Wait for the terrain (and follow it if another map is opened).
    useEffect(() => {
        const timer = setInterval(() => {
            const next = terrainAnchor();
            setAnchor((current) => (current?.lat === next?.lat && current?.lon === next?.lon ? current : next));
        }, 2000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!anchor) {
            setWeather(null);
            useWeatherStore.getState().setWeather(null);
            return undefined;
        }
        let cancelled = false;
        const load = async () => {
            try {
                const response = await fetch(`${API_BASE}/weather?cordinates=${anchor.lat.toFixed(4)},${anchor.lon.toFixed(4)}`, { cache: "no-cache" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (!cancelled) {
                    setWeather(data);
                    useWeatherStore.getState().setWeather(data); // for the scene (RainEffect)
                    setFailed(false);
                }
            } catch (error) {
                console.warn("Weather unavailable:", error);
                if (!cancelled) setFailed(true);
            }
        };
        let loadedAt = 0;
        const refresh = () => {
            loadedAt = Date.now();
            load();
        };
        refresh();
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") refresh(); // background tabs catch up on return
        }, REFRESH_MS);
        // Back in the tab (or window): refresh at once if the reading is more than a minute old.
        const onVisible = () => {
            if (document.visibilityState === "visible" && Date.now() - loadedAt > 60 * 1000) refresh();
        };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        return () => {
            cancelled = true;
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);
        };
    }, [anchor]);

    // 14-day forecast: fetched when its popup opens, kept for 30 minutes per location.
    useEffect(() => {
        if (open !== "forecast" || !anchor) return undefined;
        const key = `${anchor.lat.toFixed(4)},${anchor.lon.toFixed(4)}`;
        if (forecast?.key === key && !forecast.error && Date.now() - forecast.at < FORECAST_TTL_MS) return undefined;
        let cancelled = false;
        if (forecast?.key !== key || forecast?.error) setForecast(null);
        fetch(`${API_BASE}/weather/forecast?cordinates=${key}`)
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
            .then((data) => { if (!cancelled) setForecast({ at: Date.now(), key, data }); })
            .catch((error) => {
                console.warn("Forecast unavailable:", error);
                if (!cancelled) setForecast({ at: Date.now(), key, error: true });
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, anchor]);

    // Close the details when clicking elsewhere or pressing Escape.
    useEffect(() => {
        if (!open) return undefined;
        const onPointer = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
        const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // Live clock for the chip, ticking every second.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!anchor || (!weather && !failed)) return null;
    if (!weather) return null; // unavailable: show nothing rather than an error in the scene

    const [DayIcon, NightIcon] = ICONS[weather.kind] || [WiCloud, WiCloud];
    const Icon = weather.isDay ? DayIcon : NightIcon;
    const windTo = Number.isFinite(weather.windDirection) ? (weather.windDirection + 180) % 360 : null;
    // In the site's own time zone (the reading's time there), not the viewer's.
    let updated = null;
    if (weather.observedAt) {
        try {
            updated = new Date(weather.observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: weather.timezone || undefined });
        } catch {
            updated = new Date(weather.observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
    }

    // Local time at the site (its time zone, not the viewer's).
    let clock;
    try {
        clock = new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: weather.timezone || undefined });
    } catch {
        clock = new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    // The rain level the scene draws (a ?weather= preview overrides the live reading).
    const level = rainLevel(weather, preview);

    return (
        <div className={`weather-chip weather-chip--${weather.kind}${open === "details" ? " is-open" : ""}${open === "forecast" ? " has-forecast" : ""}`} ref={rootRef}>
            <div className="weather-chip__bar">
            <button
                type="button"
                className="weather-chip__summary"
                aria-expanded={open === "details"}
                aria-label={`Weather now${weather.place ? ` in ${weather.place}` : ""}: ${round(weather.temperature)} degrees, ${weather.condition}, wind ${round(weather.windSpeed)} km/h. Show details`}
                onClick={() => setOpen((value) => (value === "details" ? false : "details"))}
            >
                <Icon className="weather-chip__icon" aria-hidden="true" />
                <strong>{round(weather.temperature)}°</strong>
                <span className="weather-chip__condition">{weather.condition}</span>
                {windTo !== null && (
                    <span className="weather-chip__wind">
                        <WiWindDeg aria-hidden="true" style={{ transform: `rotate(${windTo}deg)` }} />
                        {compass(weather.windDirection)} {round(weather.windSpeed)} km/h
                    </span>
                )}
                <span className="weather-chip__time">
                    <WiTime4 aria-hidden="true" />
                    <time>{clock}</time>
                </span>
            </button>
            <button
                type="button"
                className={`weather-chip__forecast-toggle${open === "forecast" ? " is-active" : ""}`}
                aria-expanded={open === "forecast"}
                aria-label="14-day forecast"
                title="14-day forecast"
                onClick={() => setOpen((value) => (value === "forecast" ? false : "forecast"))}
            >
                <HiOutlineCalendarDays aria-hidden="true" />
            </button>
            <button
                type="button"
                className={`weather-chip__sound${soundOn ? "" : " is-off"}`}
                aria-pressed={soundOn}
                aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
                title={soundOn ? "Sound on (weather, footsteps)" : "Sound off"}
                onClick={toggleSound}
            >
                {soundOn ? <HiSpeakerWave aria-hidden="true" /> : <HiSpeakerXMark aria-hidden="true" />}
            </button>
            </div>

            {open === "details" && (
                <div className="weather-chip__panel" role="dialog" aria-label={weather.place ? `Weather in ${weather.place}` : "Weather details"}>
                    {weather.place && (
                        <p className="weather-chip__place">
                            <HiOutlineMapPin aria-hidden="true" />
                            <span>Weather for <strong>{weather.place}</strong></span>
                        </p>
                    )}
                    <div className="weather-chip__panel-head">
                        <Icon aria-hidden="true" />
                        <div>
                            <strong>{round(weather.temperature)}°C</strong>
                            <span>{weather.condition}{weather.stale ? " (last known)" : ""}</span>
                        </div>
                    </div>
                    <dl>
                        <div><dt>Feels like</dt><dd>{round(weather.feelsLike)}°C</dd></div>
                        <div><dt>Humidity</dt><dd>{round(weather.humidity)}%</dd></div>
                        <div><dt>Wind</dt><dd>{windTo !== null ? `${compass(weather.windDirection)} ` : ""}{round(weather.windSpeed)} km/h</dd></div>
                        <div><dt>Gusts</dt><dd>{round(weather.windGusts)} km/h</dd></div>
                        <div><dt>Cloud cover</dt><dd>{round(weather.cloudCover)}%</dd></div>
                        <div><dt>Rain (15 min)</dt><dd>{Number.isFinite(weather.precipitation) ? `${weather.precipitation.toFixed(1)} mm` : "–"}</dd></div>
                        {level !== "none" && (
                            <div className="weather-chip__observed">
                                <dt>Rain intensity (shown in the scene)</dt>
                                <dd>{LEVEL_LABELS[level]}{preview ? " (preview)" : ""}</dd>
                            </div>
                        )}
                    </dl>
                    <p className="weather-chip__source">
                        {updated ? `Updated ${updated} local time · ` : ""}
                        <a href={weather.providerUrl || "https://open-meteo.com/"} target="_blank" rel="noreferrer">
                            Weather data by {weather.provider || "Open-Meteo"}
                        </a>
                    </p>
                </div>
            )}

            {open === "forecast" && (
                <ForecastPanel
                    forecast={forecast?.key === `${anchor.lat.toFixed(4)},${anchor.lon.toFixed(4)}` ? forecast : null}
                    weather={weather}
                    onClose={() => setOpen(false)}
                />
            )}
        </div>
    );
}
