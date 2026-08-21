import React from "react";
import { XR } from "@react-three/xr";
import XrPlayerOrigin from "./XrPlayerOrigin";
import XrPerformanceOptimizer from "./XrPerformanceOptimizer";
import { xrStore } from "./xrStore";

export default function XrSceneRoot({ children }) {
    return (
        <XR store={xrStore}>
            {children}
            <XrPlayerOrigin />
            <XrPerformanceOptimizer />
        </XR>
    );
}
