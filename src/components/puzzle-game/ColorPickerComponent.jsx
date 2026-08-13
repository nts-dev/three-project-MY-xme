import { ColorEditor, ColorSwatch, ColorSwatchPicker, Flex, ColorPicker, Provider, defaultTheme, parseColor } from "@adobe/react-spectrum";
import useGame from "../../hooks/useGame";

export default function ColorPickerComponent() {
    const setAssetColor = useGame((state) => state.setAssetColor);
    const assetColor    = useGame((state) => state.assetColor);

    const handleColorChange = (color) => {
        const hexColor = color.toString("hex");
        
         setAssetColor(hexColor);

    };
    const safeColor = assetColor && assetColor !== "undefined" || assetColor === '#undefined'? assetColor : "#ffffff";


    return (
        <Provider theme={defaultTheme} isDisabled>
            <ColorPicker
                value={parseColor(safeColor)}   // <-- convert string to Color object
                onChange={handleColorChange}
            >
                <Flex direction="column" gap="size-300">
                    <ColorEditor />
                    <ColorSwatchPicker
                        value={parseColor(safeColor)}
                        onChange={handleColorChange}
                    >
                        <ColorSwatch color="#fff" />
                        <ColorSwatch color="#f80" />
                        <ColorSwatch color="#080" />
                        <ColorSwatch color="#08f" />
                        <ColorSwatch color="#088" />
                        <ColorSwatch color="#008" />
                    </ColorSwatchPicker>
                </Flex>
            </ColorPicker>
        </Provider>
    );
}
