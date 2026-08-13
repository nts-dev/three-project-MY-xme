import { publicAssetUrl } from "./publicAssetUrl";

const FONT_STYLE_ID = "play-hud-font-face";

const fontUrl = (fileName) => publicAssetUrl(`fonts/${fileName}`);

export const playHudFontFamily = "\"New Science\", \"Roboto Mono\", \"Consolas\", monospace";

export const injectPlayHudFont = () => {
    if (typeof document === "undefined" || document.getElementById(FONT_STYLE_ID)) {
        return;
    }

    const style = document.createElement("style");
    style.id = FONT_STYLE_ID;
    style.textContent = `
@font-face {
    font-family: "New Science";
    src: url("${fontUrl("fonnts.com-New_Science_Regular.otf")}") format("opentype");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
}
@font-face {
    font-family: "New Science";
    src: url("${fontUrl("fonnts.com-New_Science_SemiBold.otf")}") format("opentype");
    font-weight: 700;
    font-style: normal;
    font-display: swap;
}
@font-face {
    font-family: "New Science";
    src: url("${fontUrl("fonnts.com-New_Science_Bold.otf")}") format("opentype");
    font-weight: 900;
    font-style: normal;
    font-display: swap;
}`;

    document.head.appendChild(style);
};
