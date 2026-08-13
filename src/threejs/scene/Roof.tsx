import useGame from "../../hooks/useGame";
import {useEffect} from "react";

export default function Roof({scene}: any) {
    const roof: any = useGame((state: any) => state.roof)

    const getObjectsByName = (name: string) => {
        const result: any = [];
        scene.traverse((child: any) => {
            if (child.name === name) {
                result.push(child);
            }
        });
        return result;
    }

    useEffect(() => {
        if (scene) {
            const roofObjs = getObjectsByName("Roof")
            if (roofObjs.length > 0) {
                for (const roofObj of roofObjs) {
                    roofObj.layers.mask = roof ? 1 : 0
                }
            }

        }

    }, [roof])
    return null;


}
