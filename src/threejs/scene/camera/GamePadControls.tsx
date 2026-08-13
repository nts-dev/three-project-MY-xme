import { useEffect, useRef } from "react";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export default function GamepadControls({ orbitControls }: { orbitControls: React.RefObject<OrbitControlsImpl> }) {
    const animationRef = useRef<number>();
    const initialized = useRef(false);

    useEffect(() => {
        let lastTime = performance.now();

        const loop = (timestamp: number) => {
            const deltaTime = (timestamp - lastTime) / 1000;
            lastTime = timestamp;

            const gamepads = navigator.getGamepads();
            const gp = gamepads[0];

            const controls: any = orbitControls.current;
            if (!gp || !controls) {
                animationRef.current = requestAnimationFrame(loop);
                return;
            }

            // Ensure all necessary methods exist before proceeding
            if (
                typeof controls.rotateLeft !== "function" ||
                typeof controls.rotateUp !== "function" ||
                typeof controls.panLeft !== "function" ||
                typeof controls.panUp !== "function" ||
                typeof controls.dollyIn !== "function" ||
                typeof controls.dollyOut !== "function"
            ) {
                animationRef.current = requestAnimationFrame(loop);
                return;
            }

            // Read inputs
            const [lx, ly] = gp.axes;
            const [rx, ry] = gp.axes.length > 2 ? [gp.axes[2], gp.axes[3]] : [0, 0];
            const lTrigger = gp.buttons[6]?.value || 0;
            const rTrigger = gp.buttons[7]?.value || 0;

            const rotationSpeed = 2.0;
            const panSpeed = 0.5;
            const zoomSpeed = 1.5;

            // Apply transforms
            if (Math.abs(rx) > 0.1) controls.rotateLeft(-rx * rotationSpeed * deltaTime);
            if (Math.abs(ry) > 0.1) controls.rotateUp(-ry * rotationSpeed * deltaTime);
            if (Math.abs(lx) > 0.1) controls.panLeft(lx * panSpeed * deltaTime);
            if (Math.abs(ly) > 0.1) controls.panUp(ly * panSpeed * deltaTime);
            if (rTrigger > 0.1) controls.dollyOut(1 + zoomSpeed * rTrigger * deltaTime);
            if (lTrigger > 0.1) controls.dollyIn(1 + zoomSpeed * lTrigger * deltaTime);

            controls.update();
            animationRef.current = requestAnimationFrame(loop);
        };

        const waitForControls = () => {
            if (orbitControls.current) {
                initialized.current = true;
                animationRef.current = requestAnimationFrame(loop);
            } else {
                requestAnimationFrame(waitForControls);
            }
        };

        waitForControls();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [orbitControls]);

    return null;
}
