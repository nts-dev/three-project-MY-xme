import * as THREE from 'three';

export default function CreateSyncedVideoMaterial({
                                                      videoUrl
                                                  } = {}) {
    if (!videoUrl) {
        console.warn('CreateSyncedVideoMaterial: No video URL provided.');
        return new THREE.MeshStandardMaterial({ color: 0x000000 });
    }

    // --- Create video element (autoplay + muted) ---
    const video = document.createElement('video');
    video.src = videoUrl;
    video.loop = true;
    video.muted = true;
    video.autoplay = true;        // <-- enables true autoplay
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.style.display = 'none';
    document.body.appendChild(video);

    // Request the video to load
    video.load();

    // --- Create video texture ---
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // texture.repeat.set(repeatX, repeatY);


    // --- Create material (starts with overlay) ---
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 1,
        // roughness: 0.4,
        // metalness: 0.2,
        depthTest: true,
    });
    material.color.setScalar(1.5);
    return material;
}
