const COMMAND_PREFIX = "#";

export function isCommandText(text = "") {
    return text.trim().startsWith(COMMAND_PREFIX);
}

export function parseCommandText(text = "") {
    const raw = text.trim();
    if (!isCommandText(raw)) {
        return null;
    }

    const [, name = "", rest = ""] = raw.match(/^#(\S+)\s*(.*)$/) || [];
    return {
        name: name.toLowerCase(),
        args: rest.trim(),
        raw,
    };
}

export function parsePlaceObjectArgs(args = "") {
    const save = /(?:^|\s)-s(?:\s|$)/i.test(args);
    const argsWithoutFlags = args.replace(/(?:^|\s)-s(?:\s|$)/gi, " ").trim();
    const source = argsWithoutFlags.match(/^("[^"]+"|'[^']+'|[^\s]+)/)?.[1];
    const pos = args.match(/pos\s*\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)/i);

    if (!source) {
        throw new Error("Missing source. Use: #placeobject Tile20 pos(0,0,0) or add -s to save");
    }

    if (!pos) {
        throw new Error("Missing position. Use: pos(x,y,z)");
    }

    return {
        source: source.replace(/^["']|["']$/g, ""),
        save,
        position: {
            x: Number(pos[1]),
            y: Number(pos[2]),
            z: Number(pos[3]),
        },
    };
}

export function parseAnimateMotionArgs(args = "") {
    const [, target = "", property = ""] = args.match(/^(\S+)\s+(\S+)/) || [];
    const from = parseVectorArg(args, "from");
    const to = parseVectorArg(args, "to");
    const duration = parseNumberArg(args, "duration", 0);
    const repeat = parseNumberArg(args, "repeat", 0);
    const ease = args.match(/ease\s*\(\s*([^)]+?)\s*\)/i)?.[1]?.trim() || "linear";
    const yoyo = String(args.match(/yoyo\s*\(\s*([^)]+?)\s*\)/i)?.[1] || "false").toLowerCase() === "true";

    if (!target || !property) {
        throw new Error("Use: #animateMotion FloorTile moveY from(0,0,0) to(0,60,0) duration(2.8)");
    }

    if (!from || !to) {
        throw new Error("Missing from/to vectors. Use: from(x,y,z) to(x,y,z)");
    }

    return {
        target,
        property,
        from,
        to,
        duration,
        ease,
        yoyo,
        repeat,
    };
}

function parseVectorArg(args, name) {
    const match = args.match(new RegExp(`${name}\\s*\\(\\s*([-+]?\\d*\\.?\\d+)\\s*,\\s*([-+]?\\d*\\.?\\d+)\\s*,\\s*([-+]?\\d*\\.?\\d+)\\s*\\)`, "i"));
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function parseNumberArg(args, name, fallback) {
    const value = Number(args.match(new RegExp(`${name}\\s*\\(\\s*([-+]?\\d*\\.?\\d+)\\s*\\)`, "i"))?.[1]);
    return Number.isFinite(value) ? value : fallback;
}
