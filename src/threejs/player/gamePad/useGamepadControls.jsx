// hooks/useGamepadControls.js
import { useEffect, useRef, useState } from 'react';
import { GamepadManager } from '@donmccurdy/gamepad';

export function useGamepadControls() {
    const [axes, setAxes] = useState({ x: 0, y: 0 });
    const [buttons, setButtons] = useState({ jump: false });
    const gamepadRef = useRef(null);

    useEffect(() => {
        const gamepad = new GamepadManager();
        gamepadRef.current = gamepad;

        const onUpdate = () => {
            const pad = gamepad.get(0);
            if (pad) {
                setAxes({ x: pad.axes[0], y: pad.axes[1] }); // left stick
                setButtons({
                    jump: pad.buttons[0].pressed, // button A
                });
            }
        };

        const interval = setInterval(onUpdate, 1000 / 60); // 60 fps poll
        return () => clearInterval(interval);
    }, []);

    return { axes, buttons };
}
