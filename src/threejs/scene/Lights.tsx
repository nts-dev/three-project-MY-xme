import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import useGame from "../../hooks/useGame";

const LIGHT_OFFSET = new THREE.Vector3(12, 18, 10);

export default function Lights({ directionLight, cameraRef, orbitControls }: any) {
    const shadow: boolean = useGame((state: any) => state.shadow);
    const targetRef = useGame((state: any) => state.targetRef);

    useFrame(() => {
        if (!shadow || !directionLight.current || !cameraRef.current) {
            return;
        }

        const light = directionLight.current;
        const focusPoint =
            orbitControls?.current?.target ||
            targetRef?.current?.position ||
            cameraRef.current.position;

        const desiredPosition = new THREE.Vector3().copy(focusPoint).add(LIGHT_OFFSET);

        light.position.lerp(desiredPosition, 0.08);
        light.target.position.lerp(focusPoint, 0.12);
        light.target.updateMatrixWorld();
    });

    return null;
}
