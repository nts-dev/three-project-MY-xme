import * as THREE from "three";
import vert from "./graffiti.vert";
import frag from "./graffiti.frag";

export default function CreateGraffitiMaterial({
                                                   width = 128,
                                                   height = 64,
                                                   fontSize = 120,
                                                   text = "ROGUEPLAYER AI",

                                                   repeat = 4,
                                                   offset = [0.5, 0.25],

                                                   wobbleAmp = 0.035,
                                                   wobbleFreq = 10.0,

                                                   textColor = "#c4e7ff",
                                                   bgColor   = "#3a3f48",
                                                   bgAlpha   = 1.0,
                                               } = {}) {

    // ---------------------
    // 1) TEXT → ALPHA MASK
    // ---------------------
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${fontSize}px "PlayRegular","Impact",sans-serif"`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(255,255,255,0.35)";
    ctx.shadowBlur = Math.min(width, height) * 0.02;
    ctx.fillText(text, width / 2, height / 2);

    const maskTex = new THREE.CanvasTexture(canvas);
    maskTex.colorSpace = THREE.SRGBColorSpace;
    maskTex.minFilter = THREE.LinearMipmapLinearFilter;
    maskTex.magFilter = THREE.LinearFilter;
    maskTex.generateMipmaps = true;
    maskTex.wrapS = maskTex.wrapT = THREE.RepeatWrapping;

    // ---------------------
    // 2) SHADER UNIFORMS
    // ---------------------
    const uniforms = {
        uMask:       { value: maskTex },
        uTime:       { value: 0 },
        uRepeat:     { value: new THREE.Vector2(repeat, repeat) },
        uOffset:     { value: new THREE.Vector2(offset[0], offset[1]) },
        uWobbleAmp:  { value: wobbleAmp },
        uWobbleFreq: { value: wobbleFreq },
        uTextColor:  { value: new THREE.Color(textColor) },
        uBgColor:    { value: new THREE.Color(bgColor) },
        uBgAlpha:    { value: bgAlpha },
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vert,
        fragmentShader: frag,
        transparent: bgAlpha < 1.0,
        depthWrite: bgAlpha >= 1.0,
        toneMapped: true,
    });

    // -----------------------------------------
    // 3) NO RAF, NO GSAP — PURE GAME LOOP UPDATE
    // -----------------------------------------
    // Call this from your main useFrame() or tick loop
    material.userData.update = (delta) => {
        uniforms.uTime.value += delta;  // ultra fast
    };

    material.userData.disposeGraffiti = () => {
        maskTex.dispose();
        material.dispose();
    };

    return material;
}
