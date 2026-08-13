import * as THREE from 'three';
import useGame from '../../hooks/useGame';

interface TextIndex {
    index: number;
    fieldIndex: number;
}

class LabelObject3D extends THREE.Object3D {
    canvas: HTMLCanvasElement | undefined;
    context: CanvasRenderingContext2D | null | undefined;
    updateText: ((newTextList: string[], color: string, fontSize: number, isAnnotation?: boolean) => void) | undefined;
    constructor() {
        super();
    }
}

export function AddLabel(
    projectId: number,
    width: number,
    length: number,
    textList: Array<string>,
    position: THREE.Vector3,
    fontSize: number,
    labelName: string,
    labelRotation: THREE.Vector3,
    updateIndices: Array<TextIndex> = [],
    isLod: boolean,
    isAnnotation: boolean,
    lodDistances: { near: number; far: number } = { near: 0.01, far: 2 }
) {
    // Helper function for text label
    const createTextLabel = () => {
        const geometry = new THREE.PlaneGeometry(width - 5, length);
        const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
        return new THREE.Mesh(geometry, material);
    };

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = width * 10;
    canvas.height = length * 10;

    const renderText = (
        textList: string[],
        color: string,
        fontSize: number,
        isAnnotation: boolean,
        context: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement
    ) => {
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the background
        context.fillStyle = isAnnotation ? 'rgba(255,255,255,0)' : 'rgb(255, 255, 255)'; // Transparent if annotated
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the border (only when isAnnotation is false)
        if (!isAnnotation) {
            context.strokeStyle = 'rgb(255,255,255)'; // White border (invisible against white background)
            context.lineWidth = 13; // Border width
            context.strokeRect(0, 0, canvas.width, canvas.height);
        }

        // Set text properties
        context.font = `${fontSize - 12}px Arial`;
        context.textAlign = 'left'; // Left-align for text and bullet point
        context.textBaseline = 'middle'; // Center vertically
        context.fillStyle = isAnnotation ? color : 'rgb(10, 7, 7)'; // Text color

        // Define padding, line height, and bullet point offset
        const padding = 20; // Padding from edges
        const lineHeight = fontSize - 10; // Line height
        const bulletOffset = 25; // Increased gap between bullet and text
        const bulletXOffset = 10; // Move bullet left (less than padding)

        // Calculate total height of text block
        const totalTextHeight = textList.length * lineHeight;

        // Starting Y position (centered vertically)
        const startY = (canvas.height - totalTextHeight) / 2 + lineHeight / 2;

        // Draw single bullet point at top-left when isAnnotation is true
        if (isAnnotation) {
            // Increase bullet point size
            context.font = `${fontSize - 6}px Arial`; // Larger font for bullet
            context.fillText('•', bulletXOffset, startY); // Bullet point moved left
            context.font = `${fontSize - 12}px Arial`; // Restore font for text
        }

        // Function to wrap text into multiple lines
        const wrapText = (text: string, maxWidth: number) => {
            const words = text?.split(' ');
            let line = '';
            const lines = [];

            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                const metrics = context.measureText(testLine);
                const testWidth = metrics.width;

                if (testWidth > maxWidth && i > 0) {
                    lines.push(line.trim());
                    line = words[i] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line.trim());
            return lines;
        };

        // Draw each text item
        let y = startY;
        for (const text of textList) {
            const lines = wrapText(text, canvas.width - 2 * padding - (isAnnotation ? bulletOffset : 0));

            for (const line of lines) {
                context.fillText(line, padding + (isAnnotation ? bulletOffset : 0), y); // Shift text for bullet
                y += lineHeight; // Move to next line
            }
        }
    };

    const getSavedAnnotationData = () => {
        if (!isAnnotation) {
            return { fontColor: 'rgb(9,9,9)', fontSize };
        }

        return { fontColor: 'rgb(255, 0, 0)', fontSize };
    };

    const settingData: any = getSavedAnnotationData();

    renderText(textList, settingData.fontColor, settingData.fontSize, isAnnotation, context, canvas);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    const highDetailLabel = createTextLabel();
    highDetailLabel.material.map = texture;
    highDetailLabel.position.z = -1;

    // Set rendering properties for visibility
    highDetailLabel.renderOrder = isAnnotation ? 1000 : 0; // High renderOrder when annotated
    highDetailLabel.material.depthTest = !isAnnotation; // Disable depth test when annotated
    highDetailLabel.material.needsUpdate = true;

    const labelObj: any = new LabelObject3D();
    labelObj.add(highDetailLabel);
    labelObj.name = labelName;
    labelObj.userData.isSceneLabel = labelName === 'label';
    labelObj.userData.isAnnotation = isAnnotation;
    labelObj.canvas = canvas;
    labelObj.context = context;

    labelObj.children[0].userData.updateText = (
        newTextList: string[],
        color: string,
        fontSize: number,
        isAnnotation: boolean = false
    ) => {
        if (labelObj.canvas && labelObj.context) {
            renderText(newTextList, color, fontSize, isAnnotation, labelObj.context, labelObj.canvas);
            texture.needsUpdate = true;
            // Update rendering properties when text is updated
            labelObj.children[0].renderOrder = isAnnotation ? 1000 : 0;
            labelObj.children[0].material.depthTest = !isAnnotation;
            labelObj.children[0].material.needsUpdate = true;
        }
    };
    const showSceneLabels = Boolean((useGame.getState() as any).label);
    const initialLayerMask = labelName === 'label' ? (showSceneLabels ? 1 : 0) : 1;
    labelObj.layers.mask = initialLayerMask;
    labelObj.children[0].layers.mask = initialLayerMask;
    labelObj.children[0].userData.textList = textList;
    labelObj.children[0].userData.updateIndices = updateIndices;
    labelObj.children[0].userData.isAnnotation = isAnnotation;
    labelObj.children[0].userData.isSceneLabel = labelName === 'label';

    // Create an LOD object and add different levels of detail
    const lod = new THREE.LOD();
    lod.name = labelName;
    lod.userData.isSceneLabel = labelName === 'label';
    lod.userData.isAnnotation = isAnnotation;
    lod.layers.mask = initialLayerMask;
    lod.position.copy(position);
    lod.rotation.set(labelRotation.x, labelRotation.y, labelRotation.z);

    lod.addLevel(labelObj, isLod ? lodDistances.near : 0.01);

    // Add a lower detail object (or empty object) for farther range
    const lowDetailPlaceholder = new THREE.Object3D();
    lod.addLevel(lowDetailPlaceholder, isLod ? lodDistances.far : 25);
    lod.frustumCulled = false;

    // Return the LOD object
    return lod;
}
