import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useEffect } from "react";
import * as THREE from "three";

export default function TileColumn({ objectList }: any) {

    const adjustTilesCamera = (object: any, camera: any) => {
        if(camera) {
            const box = new THREE.Box3().setFromObject(object); // Get the object's bounding box
            const size = new THREE.Vector3();
            box.getSize(size); // Get the size of the bounding box


            const maxDim = Math.max(size.x, size.y, size.z); // Determine the largest dimension
            const fov = camera.fov * (Math.PI / 180); // Convert FOV to radians
            // Calculate the camera distance based on the object's size and FOV
            const distance = (maxDim / 0.8) / Math.tan(fov / 2); // 0.7 corresponds to 70% of the tile
            const center = new THREE.Vector3();
            box.getCenter(center); // Get the center of the bounding box
            camera.position.set(center.x, center.y, center.z + distance); // Position the camera
            camera.lookAt(center); // Make the camera look at the object
            camera.updateProjectionMatrix();// Update the camera projection
        }
    }

    const handleDragStart = (e: any, objectData: any) => {
        // e.preventDefault()
        const {name} = objectData; // Extract only the lightweight properties
        e.dataTransfer.setData("application/json", JSON.stringify({ name }));


    };

    useEffect(() => {
        const scenes: THREE.Scene[] = [];
        const content = document.getElementById("tile-container");
        const tileColumn = document.getElementById("t-column");


        for (let i = 0; i < objectList.length; i++) {

            const objectData = objectList[i];

            const {object, name, categoryIndex} = objectData;

             if (!object) {
                   return;
               }
            object.scale.set(1,1,1)
            const obj = object;
            const scene = new THREE.Scene();

            const element = document.createElement("div");
            element.className = "list-item";
            element.draggable = true;
            element.addEventListener("dragstart", (e) => handleDragStart(e, objectData))

            const header = document.createElement("div");
            header.className = "tile-header";

            const descriptionElement = document.createElement("div");
            descriptionElement.className = "tile-name";
            descriptionElement.innerText = name;
            header.appendChild(descriptionElement);
            element.appendChild(header);

            const sceneElement = document.createElement("div");
            element.appendChild(sceneElement);

            scene.userData.element = sceneElement;
            content?.appendChild(element);

            const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000)
            adjustTilesCamera(obj, camera)
            scene.userData.camera = camera;
            const controls = new OrbitControls(scene.userData.camera, scene.userData.element);
            scene.userData.controls = controls;
            scene.add(obj);
            scene.add(new THREE.HemisphereLight(0xaaaaaa, 0x444444, 3));

            const light = new THREE.DirectionalLight(0xffffff, 1.5);
            light.position.set(1, 1, 1);
            scene.add(light);

            scenes.push(scene);
        }

        const canvas: any = document.getElementById("tile-canvas");
        if (!canvas) {
            return;
        }

        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });

        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setAnimationLoop(animate);

        function updateSize() {
            if (!canvas) {
                return;
            }

            const width = canvas.clientWidth;
            const height = canvas.clientHeight;

            if (canvas.width !== width || canvas.height !== height) {
                renderer.setSize(width, height, false);
            }
        }

        function animate() {
            updateSize();

            if (!tileColumn) return;

            renderer.setClearColor(0xffffff); // White background
            renderer.setScissorTest(false); // Disable scissor test for clearing the whole canvas
            renderer.clear(); // Clear the canvas

            renderer.setScissorTest(true); // Enable scissor test for individual scenes

            scenes.forEach((scene, index) => {

                scene.children[0].rotation.y = Date.now() * 0.001; // Rotate objects
                scene.children[0].rotation.x = 0.2
                const camera = scene.userData.camera;
                const element = scene.userData.element;
                const rect = element.getBoundingClientRect();

                if ( rect.bottom < 0 || rect.top > renderer.domElement.clientHeight ) {
                    return; // it's off screen
                }
                const width = rect.right - rect.left;
                const height = rect.bottom - rect.top;
                const bottom = (renderer.domElement.clientHeight - (rect.bottom)+35);
                renderer.setViewport(1, bottom,  width, height);
                renderer.setScissor(1, bottom,  width, height);
                renderer.render(scene, camera);

            });
        }

        return () => {
            renderer.dispose();
            scenes.splice(0, scenes.length).forEach((scene) => scene.userData.controls.dispose())

            if (content) {
                while (content.firstChild) {
                    content.removeChild(content.firstChild);
                }
            }
        }

    }, [objectList]);


    return null;
}
