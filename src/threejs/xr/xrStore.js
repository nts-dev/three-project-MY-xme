import { createXRStore } from "@react-three/xr";

export const xrStore = createXRStore({
    // No WebXR emulator: on localhost it injected a floating "Enter XR" button over the HUD. Real
    // headsets enter VR through the toolbar's VR button (VrViewButton).
    emulate: false,
    controller: {
        rayPointer: {
            minDistance: 0.05,
            rayModel: { maxLength: 18 },
        },
        grabPointer: false,
        teleportPointer: false,
    },
    hand: {
        rayPointer: {
            minDistance: 0.05,
            rayModel: { maxLength: 12 },
        },
        grabPointer: false,
        touchPointer: false,
        teleportPointer: false,
    },
    gaze: false,
    transientPointer: false,
    screenInput: false,
});
