import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { animate as motionAnimate } from 'motion';

const DOT_FONT = {
    ' ': [
        '00000',
        '00000',
        '00000',
        '00000',
        '00000',
        '00000',
        '00000'
    ],
    'A': [
        '01110',
        '10001',
        '10001',
        '11111',
        '10001',
        '10001',
        '10001'
    ],
    'B': [
        '11110','10001','11110','10001','10001','10001','11110'
    ],
    'C': [
        '01110','10001','10000','10000','10000','10001','01110'
    ],
    'D': [
        '11100','10010','10001','10001','10001','10010','11100'
    ],
    'E': [
        '11111','10000','11110','10000','10000','10000','11111'
    ],
    'F': [
        '11111','10000','11110','10000','10000','10000','10000'
    ],
    'G': [
        '01110','10001','10000','10111','10001','10001','01110'
    ],
    'H': [
        '10001','10001','10001','11111','10001','10001','10001'
    ],
    'I': [
        '11111','00100','00100','00100','00100','00100','11111'
    ],
    'J': [
        '00111','00010','00010','00010','10010','10010','01100'
    ],
    'K': [
        '10001','10010','10100','11000','10100','10010','10001'
    ],
    'L': [
        '10000','10000','10000','10000','10000','10000','11111'
    ],
    'M': [
        '10001','11011','10101','10101','10001','10001','10001'
    ],
    'N': [
        '10001','11001','10101','10011','10001','10001','10001'
    ],
    'O': [
        '01110','10001','10001','10001','10001','10001','01110'
    ],
    'P': [
        '11110','10001','10001','11110','10000','10000','10000'
    ],
    'Q': [
        '01110','10001','10001','10001','10001','10010','01101'
    ],
    'R': [
        '11110','10001','10001','11110','10100','10010','10001'
    ],
    'S': [
        '01111','10000','10000','01110','00001','00001','11110'
    ],
    'T': [
        '11111','00100','00100','00100','00100','00100','00100'
    ],
    'U': [
        '10001','10001','10001','10001','10001','10001','01110'
    ],
    'V': [
        '10001','10001','10001','10001','10001','01010','00100'
    ],
    'W': [
        '10001','10001','10001','10101','10101','10101','01010'
    ],
    'X': [
        '10001','10001','01010','00100','01010','10001','10001'
    ],
    'Y': [
        '10001','10001','01010','00100','00100','00100','00100'
    ],
    'Z': [
        '11111','00010','00100','01000','10000','10000','11111'
    ],
    '0': [
        '01110','10001','10011','10101','11001','10001','01110'
    ],
    '1': [
        '00100','01100','00100','00100','00100','00100','01110'
    ],
    '2': [
        '01110','10001','00001','00010','00100','01000','11111'
    ],
    '3': [
        '11110','00001','00001','01110','00001','00001','11110'
    ],
    '4': [
        '00010','00110','01010','10010','11111','00010','00010'
    ],
    '5': [
        '11111','10000','10000','11110','00001','00001','11110'
    ],
    '6': [
        '01110','10000','10000','11110','10001','10001','01110'
    ],
    '7': [
        '11111','00001','00010','00100','01000','01000','01000'
    ],
    '8': [
        '01110','10001','10001','01110','10001','10001','01110'
    ],
    '9': [
        '01110','10001','10001','01111','00001','00010','11100'
    ]
};

export default function DigitalDisplay({ position, rotation }) {
    const canvasRef = useRef(document.createElement('canvas'));
    const textureRef = useRef(null);
    const materialRef = useRef(null);
    const offsetRef = useRef({ x: 0 });

    const drawChar = (ctx, x, y, char, pixelSize) => {
        const grid = DOT_FONT[char] || DOT_FONT[' '];
        for (let row = 0; row < 7; row++) {
            for (let col = 0; col < 5; col++) {
                if (grid[row][col] === '1') {
                    ctx.fillRect(
                        x + col * pixelSize,
                        y + row * pixelSize,
                        pixelSize,
                        pixelSize
                    );
                }
            }
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        canvas.width = 512;
        canvas.height = 128;

        textureRef.current = new THREE.CanvasTexture(canvas);
        textureRef.current.minFilter = THREE.NearestFilter;
        textureRef.current.magFilter = THREE.NearestFilter;
        if (materialRef.current) {
            materialRef.current.map = textureRef.current;
            materialRef.current.needsUpdate = true;
        }

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ff006a';

        const pixelSize = Math.floor(canvas.height / 7);
        const charWidth = 5 * pixelSize + pixelSize;
        const fullText = 'PUZZLE GAME 2 ';
        const totalWidth = fullText.length * charWidth;
        const pixelsPerSecond = 3 * charWidth;

        const scrollControls = motionAnimate(offsetRef.current, {
            x: totalWidth
        }, {
            duration: totalWidth / pixelsPerSecond,
            ease: 'linear',
            repeat: Infinity
        });
        let frameId = 0;

        const renderFrame = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let x = -offsetRef.current.x;

            for (let r = 0; r < 2; r++) {
                for (let i = 0; i < fullText.length; i++) {
                    drawChar(ctx, x + i * charWidth, 0, fullText[i].toUpperCase(), pixelSize);
                }
                x += totalWidth;
            }

            textureRef.current.needsUpdate = true;
            frameId = requestAnimationFrame(renderFrame);
        };

        frameId = requestAnimationFrame(renderFrame);

        return () => {
            scrollControls.stop();
            cancelAnimationFrame(frameId);
            textureRef.current?.dispose();
        };
    }, []);

    return (
        <mesh position={position} rotation={rotation} scale={[0.01, 0.01, 0.01]}>
            <planeGeometry args={[4, 1]} />
            <meshBasicMaterial
                ref={materialRef}
                map={textureRef.current}
                transparent
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}
