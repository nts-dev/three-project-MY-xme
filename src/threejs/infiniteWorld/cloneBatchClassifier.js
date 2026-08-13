const SIMPLE_CUBE_PATTERNS = [
    "floor_cube",
    "wall_cube",
    "wall cube",
    "platform_cube",
    "platform cube",
];

const EXCLUDED_PATTERNS = [
    "glass",
    "door",
    "key",
    "coin",
    "token",
    "moving",
    "placeholder",
    "place_holder",
    "teleport",
    "display",
    "light",
];

export const isCloneBatchCandidate = (item) => {
    const name = String(item?.cleanKey || item?.name || item?.fileName || "").toLowerCase();

    if (!name) {
        return false;
    }

    if (EXCLUDED_PATTERNS.some((pattern) => name.includes(pattern))) {
        return false;
    }

    return SIMPLE_CUBE_PATTERNS.some((pattern) => name.includes(pattern));
};
