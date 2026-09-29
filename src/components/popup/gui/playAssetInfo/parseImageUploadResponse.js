export function parseImageUploadResponse(text) {
    try {
        return JSON.parse(text);
    } catch {
        // The PHP uploader also returns an object literal, not JSON.
        // Match its known response format without evaluating server code.
        const match = text.trim().match(/^\{\s*state\s*:\s*(true|false)\s*,\s*name\s*:\s*'([^'\r\n]*)'\s*,\s*size\s*:\s*(\d+)\s*\}\s*;?$/);
        if (!match) throw new Error("The upload server returned an unexpected response.");
        return { state: match[1] === "true", name: match[2], size: Number(match[3]) };
    }
}
