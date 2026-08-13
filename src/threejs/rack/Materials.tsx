import * as THREE from "three";


export default function Materials(textureUrl: string){
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(`${import.meta.env.VITE_FILE_URL}/${textureUrl}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    return new THREE.MeshStandardMaterial({
        map: texture,
    });

}
