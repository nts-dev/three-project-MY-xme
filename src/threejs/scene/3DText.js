import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
class PointText3D {
    constructor(text, fontUrl, size, color,visible) {
        this.text = text;
        this.fontUrl = fontUrl;
        this.size = size || 1;
        this.color = color || 0xffffff;
        this.visible = visible
        this.group = new THREE.Group();
        if(this.text && this.size) {
            this.loadFont();
        }

    }

    loadFont() {

        const loader = new FontLoader();
        loader.load(this.fontUrl, font => {
          if(font)
            this.createText(font );
        });
    }

    createText(font) {

        const textGeometry = new TextGeometry(this.text, {
            font: font,
            size: this.size,
            depth: 0.01,
            curveSegments: 4,
             bevelEnabled: true,
            bevelThickness: 0.005,
              bevelSize: 0.005,
             // bevelOffset: 0,
              bevelSegments: 4
        });
         textGeometry.computeBoundingBox();
        const textMaterial = new THREE.MeshBasicMaterial({ color: this.color });

        const textMesh = new THREE.Mesh(textGeometry, textMaterial);

        textMesh.layers.mask = this.visible
        this.group.add(textMesh);
    }

    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }

    getObject() {
        return this.group;
    }
}
export {PointText3D}
