import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useJoystickControls } from "../../hooks/useJoystickControls";
import { getXrStickIntent, toJoystickState } from "./xrControllerInput";
import { xrStore } from "./xrStore";

export default function XrControllerMovementBridge() {
    const lastStateRef = useRef({ active: false, distance: 0, angle: 0, run: false });

    useEffect(() => {
        return () => {
            useJoystickControls.getState().resetJoystick();
        };
    }, []);

    useFrame(() => {
        const session = xrStore.getState?.().session;
        if (!session) {
            if (lastStateRef.current.active) {
                useJoystickControls.getState().resetJoystick();
                lastStateRef.current = { active: false, distance: 0, angle: 0, run: false };
            }
            return;
        }

        const nextState = toJoystickState(getXrStickIntent(session.inputSources));
        const lastState = lastStateRef.current;
        const hasChanged = nextState.active !== lastState.active
            || Math.abs(nextState.distance - lastState.distance) > 0.01
            || Math.abs(nextState.angle - lastState.angle) > 0.01
            || nextState.run !== lastState.run;

        if (!hasChanged) return;

        if (nextState.active) {
            useJoystickControls.getState().setJoystick(nextState.distance, nextState.angle, nextState.run);
        } else {
            useJoystickControls.getState().resetJoystick();
        }

        lastStateRef.current = nextState;
    });

    return null;
}
