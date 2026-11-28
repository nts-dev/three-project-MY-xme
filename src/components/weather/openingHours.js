// Opening hours as written in the unit records ("Opening Hours"), e.g.
//   "Monday: 9:00 AM – 6:00 PM; Tuesday: …; Saturday: Closed; Sunday: Closed"
//   "Mon–Fri 9:00 AM–6:00 PM; Sat 9:00 AM–1:00 PM (Warehouse Only); Sun Closed"
//   "Mon–Fri: 10:00 AM–6:30 PM; Sat–Sun: Closed"     "Open 24 hours daily"
//   "Monday: 8:00 AM – 12:00 PM, 1:00 – 6:00 PM; …"  (split days; a start without AM / PM takes the end's)
// parsed into opening ranges per weekday. Empty / "N/A" / unreadable text gives null (unknown).

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_WORD = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?/gi;
const TIME = /(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i;

function dayIndex(word) {
    return DAYS.indexOf(word.slice(0, 3).toLowerCase());
}

/** "9:00 AM" -> minutes; `fallbackMeridiem` for a time written without AM / PM. */
function toMinutes(text, fallbackMeridiem) {
    const match = TIME.exec(text);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    const meridiem = (match[3] || fallbackMeridiem || "").toLowerCase().replace(/\./g, "");
    if (hours > 24 || minutes > 59) return null;
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

/** "9:00 AM – 6:00 PM" -> [start, end] in minutes (end past midnight is + 1440), or null. */
function parseRange(text) {
    const parts = text.split(/\s*(?:–|—|-|to)\s*/i).filter(Boolean);
    if (parts.length < 2) return null;
    const endMeridiem = (/(am|pm)/i.exec(parts[1]) || [])[1];
    let start = toMinutes(parts[0], null);
    const end0 = toMinutes(parts[1], null);
    if (end0 === null) return null;
    // A start without AM / PM ("1:00 – 6:00 PM", "12:00 – 7:00 PM"): the one that keeps it before the end.
    if (!/(am|pm)/i.test(parts[0])) {
        const pm = toMinutes(parts[0], endMeridiem || "pm");
        const am = toMinutes(parts[0], "am");
        start = pm !== null && pm < end0 ? pm : am;
    }
    if (start === null) return null;
    let end = end0;
    if (end <= start) end += 1440; // closes after midnight ("8:00 AM – 12:00 AM")
    return [start, end];
}

/**
 * Opening hours text -> array of 7 lists of [start, end] minute ranges (index 0 = Sunday), or null
 * when the text gives no usable hours.
 */
export function parseOpeningHours(text) {
    const value = String(text ?? "").trim();
    if (!value || /^n\/?a$/i.test(value)) return null;
    const week = Array.from({ length: 7 }, () => []);
    let any = false;
    if (/24\s*hours?\s*(daily|a day|every ?day)?$/i.test(value) && !DAY_WORD.test(value.replace(/daily/i, ""))) {
        DAY_WORD.lastIndex = 0;
        for (const day of week) day.push([0, 1440]);
        return week;
    }
    DAY_WORD.lastIndex = 0;
    for (const segment of value.split(/;|\n/)) {
        const text = segment.trim();
        if (!text) continue;
        // Days: "Monday", "Mon–Fri", "Sat–Sun", "Mon, Wed".
        const words = [...text.matchAll(DAY_WORD)];
        if (!words.length) continue;
        const firstAfterDays = words[words.length - 1].index + words[words.length - 1][0].length;
        const daysText = text.slice(0, firstAfterDays);
        let days = [];
        const range = /([a-z]{3})[a-z]*\.?\s*(?:–|—|-|to)\s*([a-z]{3})/i.exec(daysText);
        if (range && dayIndex(range[1]) >= 0 && dayIndex(range[2]) >= 0) {
            for (let d = dayIndex(range[1]), n = 0; n < 7; d = (d + 1) % 7, n++) {
                days.push(d);
                if (d === dayIndex(range[2])) break;
            }
        } else {
            days = words.map((word) => dayIndex(word[1])).filter((d) => d >= 0);
        }
        const rest = text.slice(firstAfterDays).replace(/^\s*:\s*/, "").replace(/\(.*?\)/g, "").trim();
        if (/closed/i.test(rest) && !/\d/.test(rest)) {
            any = true;
            continue;
        }
        const ranges = /open\s*24|24\s*hours/i.test(rest)
            ? [[0, 1440]]
            : rest.split(",").map((part) => parseRange(part.trim())).filter(Boolean);
        if (!ranges.length) continue;
        any = true;
        for (const day of days) week[day].push(...ranges);
    }
    return any ? week : null;
}

/** Open at `minutes` past midnight on weekday `day` (0 = Sunday)? Includes the previous day's hours past midnight. */
export function isOpenAt(week, day, minutes) {
    if (!week) return false;
    if (week[day].some(([start, end]) => minutes >= start && minutes < end)) return true;
    const previous = week[(day + 6) % 7];
    return previous.some(([, end]) => end > 1440 && minutes + 1440 < end);
}
