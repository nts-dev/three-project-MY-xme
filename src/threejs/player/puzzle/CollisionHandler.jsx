import * as THREE from 'three';

export default function CollisionHandler(
    dir,
    distance,
    scene,
    characterRef,
    activeCoinsRef,
    moveAmountRef,
    raycaster,
    setNoOfCoins,
    noOfCoins,
    setInstanceId,
    climbRef,
    setNotification,
    characterHeightRef,
    goingUp
) {
    const checkInstanceCollision = (mesh, raycaster, activeArray) => {
        const instanceMatrix = new THREE.Matrix4();
        const tempPosition = new THREE.Vector3();
        const boundingBox = new THREE.Box3();
        const tempScale = new THREE.Vector3();

        for (let i = 0; i < mesh.count; i++) {
            if (!activeArray[i]) continue;
            mesh.getMatrixAt(i, instanceMatrix);
            tempPosition.setFromMatrixPosition(instanceMatrix);
            tempScale.setFromMatrixScale(instanceMatrix);
            if (Math.abs(tempPosition.y - raycaster.ray.origin.y) > characterHeightRef.current) continue;

            // Use actual scale for more accurate bounding box
            boundingBox.setFromCenterAndSize(tempPosition, tempScale);
            if (raycaster.ray.intersectsBox(boundingBox)) {
                return { index: i, position: tempPosition, scale: tempScale };
            }
        }
        return null;
    };

    function getRandomWord() {
        return Math.random() < 0.5 ? '+' : 'with';
    }

    const willCollide = () => {
        if (!characterRef.current) return false;

        const clonePosition = characterRef.current.position.clone().add(dir.clone().multiplyScalar(distance));
        const origin = clonePosition.clone();

         origin.y += 0.003; // Slightly above character base
        raycaster.current.set(origin, dir.clone().normalize());

        // Reset ladder flag before detection
        climbRef.current = false;
        // goingUp.current = false;

        // Check instanced mesh collisions (e.g., coins)
        for (const { mesh, active } of activeCoinsRef.current) {
            const collision = checkInstanceCollision(mesh, raycaster.current, active);
            if (collision) {
                const { index } = collision;
                const dummy = new THREE.Object3D();
                mesh.getMatrixAt(index, dummy.matrix);
                dummy.position.setFromMatrixPosition(dummy.matrix);
                dummy.scale.set(0, 0, 0);
                dummy.updateMatrix();
                mesh.setMatrixAt(index, dummy.matrix);
                mesh.instanceMatrix.needsUpdate = true;
                active[index] = false;
                setNoOfCoins(noOfCoins + 1);
                return false; // Allow movement through coins
            }
        }

        // Check collisions with non-instanced meshes
        const objects = scene.children.filter(
            (obj) => obj !== characterRef.current && !obj.isInstancedMesh
        );
        const intersects = raycaster.current.intersectObjects(objects, true);

        if (
            intersects.length > 0 &&
            intersects[0].distance < moveAmountRef.current &&
            Math.abs(intersects[0].point.y - origin.y) < characterHeightRef.current
        ) {
            const objName = intersects[0].object.name.toLowerCase();

            if (objName.includes('ladder')) {
                climbRef.current = true;
                goingUp.current = true;
                setNotification({
                    header: 'Climb Up Ladder!',
                    text: `Use shift ${getRandomWord()} up to go up`,
                    htmlCode: '▣',
                    position: 'top-center',
                });
                return true; // Allow movement toward ladder but handle climbing separately
            }

            if (objName.includes('coin')) {
                const clickedInstance = intersects[0].instanceId ?? -1;
                const instanceInfo = intersects[0].object.userData.instances[clickedInstance];
                setInstanceId(instanceInfo.assetId);
                return false;
            }

            return true; // Block movement for other collisions
        }

        return false;
    };

    return willCollide();
}