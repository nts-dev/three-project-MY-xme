import {useThree} from "@react-three/fiber";
import useGame from "../../hooks/useGame";
import {useEffect} from "react";

export default function CheckLabel(){
    const isLabel = useGame((state: any) => state.label);
    const annotation = useGame((state: any) => state.annotations);
    const annotationSettings = useGame((state: any) => state.annotationSettings);
    const {scene} = useThree()

    const getObjectsByName  = ()=> {
        const result:any = [];
        scene.traverse((child) => {
            if (child.name === 'label' || child.userData?.isSceneLabel) {
                result.push(child);
            }
        });
        return result;
    }

    const setObjectLayerMask = (object: any, mask: number) => {
        object.layers.mask = mask;
        object.children?.forEach((child: any) => setObjectLayerMask(child, mask));
    };

    useEffect(()=>{
        const labels = getObjectsByName()
        for(const label of labels ){
            const mask = label.userData?.isAnnotation || label.children?.[0]?.userData?.isAnnotation
                ? Number(Boolean(annotation))
                : Number(Boolean(isLabel));
            setObjectLayerMask(label, mask);
        }
    },[isLabel,annotation,scene])


    useEffect(() => {
        const labels = getObjectsByName()
        for(const label of labels ){
            const {fontSize, color} = annotationSettings
            label.traverse?.((child: any) => {
                if(child.userData?.isAnnotation && child.userData?.updateText){
                    const textList = child.userData.textList
                    child.userData.updateText(textList,color,fontSize)
                }
            });
        }
    }, [annotationSettings, scene]);

    return null;

}
