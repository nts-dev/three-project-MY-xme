import * as THREE from 'three';

export default function ImageDisplayMaterial({
                                                 url = 'your-image.jpg',   // 🔹 path to your image
                                                 emissive = true,          // 🔹 make it glow
                                                 brightness = 2.0          // 🔹 brightness factor
                                             } = {}) {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(url);

    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    return new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        // emissive: emissive ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
        // emissiveIntensity: emissive ? brightness : 0
    });
}
