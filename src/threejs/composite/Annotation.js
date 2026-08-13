
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject} from 'three/examples/jsm/renderers/CSS3DRenderer.js';
class Annotation {
    constructor(scene,camera, position, text = 'HTML PointText',rotationY,cHeight,cLength,cWidth,asset,name,pHight) {
        this.scene = scene;
        this.camera = camera;
        this.rotation = rotationY;
        this.htmlElement = document.createElement('div');
        this.htmlElement.classList.add('annotation')
        this.htmlElement.innerText = text;
        this.height = cHeight;
        this.width = cWidth/100;
        this.length = cLength/100;

        this.css3DObject = new CSS3DObject(this.htmlElement);
        const offset = this.adjustOffset();
        this.position = position.clone().add(offset);
        this.css3DObject.position.copy(this.position);
        this.css3DObject.scale.multiplyScalar(0.01);
        this.css3DObject.name = name;
        this.css3DObject.userData.pHeight = pHight*2;

        this.css3DObject.renderOrder = 1;
        this.scene.add(this.css3DObject);

        this.css3DRenderer = new CSS3DRenderer();


        // this.css3DRenderer.setSize(window.innerWidth, window.innerHeight);

        const devicePixelRatio = window.devicePixelRatio || 1;
        this.css3DRenderer.setSize(window.innerWidth , window.innerHeight );

        this.css3DRenderer.domElement.style.position = 'absolute';
        this.css3DRenderer.domElement.style.top = '0';
        this.css3DRenderer.domElement.style.height = '100%';
        this.css3DRenderer.domElement.style.width = '100%';
        this.css3DRenderer.domElement.style.pointerEvents = 'none';
        // window.addEventListener('resize', this.onWindowResize);
        document.body.appendChild(this.css3DRenderer.domElement);

    }


    adjustOffset(){

        this.css3DObject.rotation.x = -THREE.MathUtils.degToRad(90);
        this.css3DObject.rotation.z = -THREE.MathUtils.degToRad(90);
        return new THREE.Vector3(0, this.height, 0);

    }

    adjustScaleAndPosition() {
        const distance = this.camera.position.distanceTo(this.scene.position);
        const scale = 1 / distance;  // Adjust scale based on distance

        this.css3DObject.scale.setScalar(scale);

        // Adjust the position of the annotation to account for the distance
        const objectPosition = new THREE.Vector3();
        this.scene.getWorldPosition(objectPosition);
        const screenPosition = objectPosition.project(this.camera);

        // Convert screenPosition to CSS3D coordinates
        screenPosition.x = (screenPosition.x * window.innerWidth) / 2 + window.innerWidth / 2;
        screenPosition.y = -(screenPosition.y * window.innerHeight) / 2 + window.innerHeight / 2;

        this.css3DObject.position.set(screenPosition.x, screenPosition.y, 0);
    }
    render() {
        // this.adjustScaleAndPosition()
        this.css3DRenderer.render(this.scene, this.camera);
    }
}
export {Annotation}
