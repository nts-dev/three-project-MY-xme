

export default function ToggleDims(showBdims: boolean,showFdims: boolean, showOdims:boolean,scene: any){
    const sceneObj = scene.getObjectByName('sceneObj');

    if (sceneObj) {
        //Dimensions lines
        const dimensionLinesF = sceneObj.children.filter((obj: any) => obj.name.includes('dimensionLine_Fo') );
        for (const line of dimensionLinesF)
            line.visible = showFdims;
        const dimensionLinesO = sceneObj.children.filter((obj: any) => obj.name === 'dimensionLine_System'|| obj.name.includes('dimensionLine_HP_840_G3'));
        for (const line of dimensionLinesO)
            line.visible = showOdims;
        const dimensionLinesB = sceneObj.children.filter((obj: any) => obj.name === 'dimensionLine_Box');
        for (const line of dimensionLinesB)
            line.visible = showBdims;
        // console.log(dimensionLinesF)
        // console.log(dimensionLinesO)
        // console.log(dimensionLinesB)

        //Arrows
        const arrowHelpersF = sceneObj.children.filter((obj: any) => obj.name.includes('arrowHelper_Fo'));
        for (const line of arrowHelpersF)
            line.visible = showFdims;
        const arrowHelpersO = sceneObj.children.filter((obj: any) => obj.name === 'arrowHelper_System' || obj.name.includes('arrowHelper_HP_840_G3'));
        for (const line of arrowHelpersO)
            line.visible = showOdims;
        const arrowHelpersB = sceneObj.children.filter((obj: any) => obj.name === 'arrowHelper_Box');
        for (const line of arrowHelpersB)
            line.visible = showBdims;


        //labels
        const labelsF = sceneObj.children.filter((obj: any) => obj.name.includes('labelObj_Fo'));
        for (const label of labelsF)
            label.layers.mask = showFdims;

        const labelsO = sceneObj.children.filter((obj: any) => obj.name === 'labelObj_System'|| obj.name.includes('labelObj_HP_840_G3'));
        for (const label of labelsO)
            label.layers.mask = showOdims;

        const labelsB = sceneObj.children.filter((obj: any) => obj.name === 'labelObj_Box');
        for (const label of labelsB)
            label.layers.mask = showBdims;


    }
}
