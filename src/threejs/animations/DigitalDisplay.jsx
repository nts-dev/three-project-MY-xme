import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const colors = ['rgba(19,19,19,0.83)'];

const segments = {
    0: [1, 1, 1, 1, 1, 1, 0],
    1: [0, 1, 1, 0, 0, 0, 0],
    2: [1, 1, 0, 1, 1, 0, 1],
    3: [1, 1, 1, 1, 0, 0, 1],
    4: [0, 1, 1, 0, 0, 1, 1],
    5: [1, 0, 1, 1, 0, 1, 1],
    6: [1, 0, 1, 1, 1, 1, 1],
    7: [1, 1, 1, 0, 0, 0, 0],
    8: [1, 1, 1, 1, 1, 1, 1],
    9: [1, 1, 1, 1, 0, 1, 1],
};

export default function DigitalDisplay({ position, rotation }) {
    const canvasRef = useRef(null);
    const textureRef = useRef(null);
    const materialRef = useRef(null);
    const currentValue = useRef(0);
    const accumulator = useRef(0); // track elapsed time

    // ----------------------------
    // PREALLOCATED DRAW FUNCTIONS
    // ----------------------------
    const drawDigit = (ctx, x, y, w, h, segs, color) => {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        const thickness = w * 0.15;
        const long = w - thickness * 2;
        const short = h * 0.5 - thickness;

        const positions = [
            [x + thickness, y, long, thickness],                         // top
            [x + long + thickness, y + thickness, thickness, short],    // upper-right
            [x + long + thickness, y + short + 2 * thickness, thickness, short], // lower-right
            [x + thickness, y + h - thickness, long, thickness],        // bottom
            [x, y + short + 2 * thickness, thickness, short],           // lower-left
            [x, y + thickness, thickness, short],                       // upper-left
            [x + thickness, y + short, long, thickness],                // middle
        ];

        for (let i = 0; i < 7; i++) {
            if (segs[i]) {
                const p = positions[i];
                ctx.fillRect(p[0], p[1], p[2], p[3]);
            }
        }

        ctx.shadowBlur = 0;
    };

    const drawValue = (val) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const formatted = Math.floor(val).toString().padStart(6, '0');
        const gap = 2;
        const digitWidth = (canvas.width - gap * 5) / 6;
        const digitHeight = canvas.height;

        for (let i = 0; i < 6; i++) {
            const digit = formatted.charCodeAt(i) - 48; // faster than parseInt
            drawDigit(ctx, i * (digitWidth + gap), 0, digitWidth, digitHeight, segments[digit], colors[0]);
        }

        textureRef.current.needsUpdate = true;
    };

    // ----------------------------------
    // INITIAL SETUP (runs once)
    // ----------------------------------
    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        canvasRef.current = canvas;

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        textureRef.current = texture;

        drawValue(0);

        return () => {
            texture.dispose();
        };
    }, []);

    // ----------------------------------
    // GAME-LOOP UPDATE (NO GSAP)
    // ----------------------------------
    useFrame((state, delta) => {
        // 1 second timer using accumulator
        accumulator.current += delta;
        if (accumulator.current >= 1) {
            accumulator.current -= 1;
            currentValue.current += 1;
            drawValue(currentValue.current);
        }

        // Assign map only once
        if (materialRef.current && !materialRef.current.map) {
            materialRef.current.map = textureRef.current;
        }
    });

    return (
        <mesh position={position} rotation={rotation} scale={[0.01, 0.01, 0.01]}>
            <planeGeometry args={[3, 0.75]} />
            <meshBasicMaterial
                ref={materialRef}
                transparent
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}
