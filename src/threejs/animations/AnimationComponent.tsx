import * as THREE from "three";

const animations: any[] = []
export default function AnimationComponent(sceneObj: any, object: any, assets: any,name: string){


    for (const asset of assets) {
        const {fields} = asset;
        const x = fields['X-pos']?.value ? fields['X-pos']?.value : 0;
        const y = fields['Y-pos']?.value ? fields['Y-pos']?.value : 0;
        const z = fields['Z-pos']?.value ? fields['Z-pos']?.value : 0;
         const contAnimation = fields['Continuous Animation']?.value ? fields['Continuous Animation']?.value : 0;


        const angle = fields['Angle']?.value ? fields['Angle']?.value : 0;

        const objectClone = object.clone()
        const position = new THREE.Vector3(parseFloat(x) , parseFloat(z), parseFloat(y)).multiplyScalar(0.01);
        objectClone.position.copy(position)

        objectClone.rotation.y = THREE.MathUtils.degToRad(angle)
        objectClone.scale.set(0.01,0.01,0.01)
        sceneObj.add(objectClone)


        const mixer = new THREE.AnimationMixer(objectClone.children[0]);
        const action = mixer.clipAction(object.animations[0]);
        action.enabled = true;

// Continuous animation
        if (contAnimation == 1) {
            // Ensure continuous looping with LoopRepeat
            action.setLoop(THREE.LoopRepeat, Infinity);  // Set an infinite loop
            action.play();
        } else {
            // Play once, then stop
            action.reset()
                .fadeIn(0.2)
                .setLoop(THREE.LoopOnce, undefined as unknown as number)  // Play the animation once
                .play();
            action.clampWhenFinished = true;  // Stop when animation finishes
        }

        animations.push({mixer,action,contAnimation,objectClone,name})


    }
}
export {animations}
