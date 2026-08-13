import * as THREE from 'three';
import SixteenSegment  from './SixteenSegment.js'; // Make sure this is the full class

export default function CreateLEDMaterial({
                                              text = 'H00000',
                                              width =1024,
                                              height = 1024,
                                              segmentCount = 6,
                                              segmentColor = '#00ff00',
                                              backgroundColor = '#000000'
                                          } = {}) {
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Create segment display
    const display = new SixteenSegment(canvas, segmentCount, width, height);
    display.segmentColor = segmentColor;
    display.backgroundColor = backgroundColor;
    display.drawText(text);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    // Return material
    return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.4,
        metalness: 0.2
    });
}
