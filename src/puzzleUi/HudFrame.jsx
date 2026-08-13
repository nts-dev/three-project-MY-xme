import React from "react";
import { publicAssetCssUrl } from "./publicAssetUrl";
import "./HudFrame.css";

const hudLeftAnchorUrl = publicAssetCssUrl("left.svg");
const hudRightAnchorUrl = publicAssetCssUrl("right.svg");

const HudFrame = ({
    as: Component = "div",
    children,
    className = "",
    contentClassName = "",
    style,
    ...props
}) => (
    <Component
        className={`game-hud-frame ${className}`.trim()}
        style={{
            "--game-hud-frame-left-anchor-url": hudLeftAnchorUrl,
            "--game-hud-frame-right-anchor-url": hudRightAnchorUrl,
            ...style,
        }}
        {...props}
    >
        <span className="game-hud-frame__glass" aria-hidden="true" />
        <span className="game-hud-frame__anchor game-hud-frame__anchor--tl" aria-hidden="true" />
        <span className="game-hud-frame__anchor game-hud-frame__anchor--tr" aria-hidden="true" />
        <span className="game-hud-frame__anchor game-hud-frame__anchor--bl" aria-hidden="true" />
        <span className="game-hud-frame__anchor game-hud-frame__anchor--br" aria-hidden="true" />
        <div className={`game-hud-frame__content ${contentClassName}`.trim()}>
            {children}
        </div>
    </Component>
);

export default HudFrame;
