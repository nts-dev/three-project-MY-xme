import { useState } from "react";
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
    WiRaindrop,
    WiSnow,
    WiSprinkle,
    WiThunderstorm,
} from "react-icons/wi";
import { HiOutlineMapPin, HiXMark } from "react-icons/hi2";

// Forecast popup of the weather chip: now (large), the next hours, then the days (5, or all 14
// with "See full forecast"). Data from the backend /weather/forecast (Open-Meteo), the current
// reading from the chip's own /weather (it includes the airport cross-check).

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

const round = (value) => (Number.isFinite(value) ? Math.round(value) : "–");

/** Weather glyph for a kind, coloured by kind (sun amber, rain blue, ...). */
function SkyIcon({ kind, isDay = true, className = "", label }) {
    const [Day, Night] = ICONS[kind] || [WiCloud, WiCloud];
    const Icon = isDay ? Day : Night;
    return <Icon className={`forecast__icon forecast__icon--${kind}${isDay ? "" : " is-night"} ${className}`} aria-label={label} role={label ? "img" : undefined} aria-hidden={label ? undefined : "true"} />;
}

const hourLabel = (time) => {
    const hour = Number(String(time).slice(11, 13));
    if (!Number.isFinite(hour)) return "";
    return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
};

/** The current hour at the site as "YYYY-MM-DDTHH" (the forecast's own format), or null. */
const siteHour = (timeZone) => {
    try {
        const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || undefined, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
            .formatToParts(new Date()).map((p) => [p.type, p.value]));
        return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;
    } catch {
        return null;
    }
};

const DAYS_COLLAPSED = 5;

/** Ref callback: the mouse wheel scrolls the hour strip sideways (it has no scrollbar). */
const wheelSideways = (element) => {
    if (!element || element.dataset.wheel) return;
    element.dataset.wheel = "1";
    element.addEventListener("wheel", (event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return; // touchpad: already sideways
        const max = element.scrollWidth - element.clientWidth;
        if ((event.deltaY < 0 && element.scrollLeft <= 0) || (event.deltaY > 0 && element.scrollLeft >= max - 1)) return; // ends: let the panel scroll
        event.preventDefault();
        element.scrollBy({ left: Math.sign(event.deltaY) * element.clientWidth * 0.6, behavior: "smooth" });
    }, { passive: false });
};

export default function ForecastPanel({ forecast, weather, onClose }) {
    const [full, setFull] = useState(false);
    const data = forecast?.data;
    const days = data?.days || [];
    // The first hour is the current one: show the live reading there (it is cross-checked against
    // the nearest airport observation; the hourly forecast is the raw model, which can say
    // "drizzle" while the observation says it is dry).
    // Hours already past are dropped (the forecast is cached for up to 30 minutes).
    const thisHour = siteHour(data?.timezone || weather?.timezone);
    const hours = (data?.hours || []).filter((hour) => !thisHour || hour.time.slice(0, 13) >= thisHour).map((hour, index) => (index === 0 && weather
        ? { ...hour, now: true, kind: weather.kind, condition: weather.condition, isDay: weather.isDay, temperature: weather.temperature ?? hour.temperature }
        : hour));
    const name = data?.place || weather?.place;
    const today = days[0];
    const shownDays = full ? days : days.slice(0, DAYS_COLLAPSED);

    return (
        <div className="weather-chip__panel forecast" role="dialog" aria-label={name ? `Weather forecast for ${name}` : "Weather forecast"}>
            <div className="forecast__top">
                <p className="forecast__place">
                    <HiOutlineMapPin aria-hidden="true" />
                    <strong>{name || "This location"}</strong>
                </p>
                <button type="button" className="forecast__close" aria-label="Close forecast" onClick={onClose}>
                    <HiXMark aria-hidden="true" />
                </button>
            </div>

            {weather && (
                <div className="forecast__now">
                    <SkyIcon kind={weather.kind} isDay={weather.isDay} className="forecast__now-icon" />
                    <span className="forecast__now-temp">
                        {round(weather.temperature)}
                        <sup>°C</sup>
                    </span>
                    <span className="forecast__now-text">
                        <strong>{weather.condition}</strong>
                        {today && <span>{round(today.temperatureMax)}° / {round(today.temperatureMin)}°</span>}
                    </span>
                </div>
            )}

            {!forecast && <p className="forecast__note">Loading forecast…</p>}
            {forecast?.error && <p className="forecast__note">The forecast is unavailable right now.</p>}

            {hours.length > 0 && (
                <div className="forecast__hours-box">
                    <ol className="forecast__hours" aria-label="Next hours" ref={wheelSideways} tabIndex={0}>
                        {hours.map((hour) => (
                            <li key={hour.time}>
                                <span className="forecast__label">{hour.now ? "Now" : hourLabel(hour.time)}</span>
                                <SkyIcon kind={hour.kind} isDay={hour.isDay} label={hour.condition} />
                                <strong>{round(hour.temperature)}°</strong>
                                <span className="forecast__rain"><WiRaindrop aria-hidden="true" />{round(hour.precipitationProbability)}%</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {shownDays.length > 0 && (
                <div className="forecast__days-box">
                    <ol className="forecast__days" aria-label="Next days">
                        {shownDays.map((day, index) => {
                            const date = new Date(`${day.date}T12:00:00`);
                            return (
                                <li key={day.date} title={`${date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}: ${day.condition}`}>
                                    <span className="forecast__label">{index === 0 ? "Today" : date.toLocaleDateString([], { weekday: "short" })}</span>
                                    {full && <span className="forecast__date">{date.toLocaleDateString([], { day: "numeric", month: "short" })}</span>}
                                    <SkyIcon kind={day.kind} label={day.condition} />
                                    <strong>{round(day.temperatureMax)}°</strong>
                                    <span className="forecast__low">{round(day.temperatureMin)}°</span>
                                    <span className="forecast__rain"><WiRaindrop aria-hidden="true" />{round(day.precipitationProbability)}%</span>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}

            {days.length > DAYS_COLLAPSED && (
                <button type="button" className="forecast__more" aria-expanded={full} onClick={() => setFull((value) => !value)}>
                    {full ? "Show less" : `See full forecast (${days.length} days)`}
                </button>
            )}

            {data && (
                <p className="forecast__source">
                    {data.stale ? "Last known forecast · " : ""}
                    <a href={data.providerUrl || "https://open-meteo.com/"} target="_blank" rel="noreferrer">
                        Forecast by {data.provider || "Open-Meteo"}
                    </a>
                </p>
            )}
        </div>
    );
}
