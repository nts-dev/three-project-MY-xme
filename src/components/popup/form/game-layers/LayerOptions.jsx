import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import useGame from "../../../../hooks/useGame";
import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup
} from "@mui/material";

const MotionDiv = motion.div;

const layerPanelVariants = {
  hidden: { opacity: 0, x: 18, scale: 0.97, filter: "blur(5px)" },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 26,
      staggerChildren: 0.035,
      delayChildren: 0.06,
    },
  },
};

const layerItemVariants = {
  hidden: { opacity: 0, x: 10, scale: 0.92 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 330, damping: 24 },
  },
};

export default function LayerOptions() {
  const setControlButtonIndex = useGame((state) => state.setControlButtonIndex);
  const controlButtonIndex = useGame((state) => state.controlButtonIndex);
  const buttonMode = useGame((state) => state.buttonMode);
  const gridSize = useGame((state) => state.gridSize);
  const containerRef = useRef(null);

  const handleChange = (event) => {
    const selectedValue = event.target.value;
    const level = parseInt(selectedValue.replace("L", ""), 10);
    setControlButtonIndex(level);
  };

  // 👇 Scroll to bottom when layers change
  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.scrollTop =
      containerRef.current.scrollHeight;
  }, [gridSize.y]);

  useEffect(() => {
    const layerCount = Number(gridSize.y) || 0;
    if (layerCount <= 0) return;

    const maxLayer = layerCount - 1;
    const currentLayer = Number(controlButtonIndex);
    const nextLayer = Number.isFinite(currentLayer)
      ? Math.min(Math.max(currentLayer, 0), maxLayer)
      : 0;

    if (nextLayer !== controlButtonIndex) {
      setControlButtonIndex(nextLayer);
    }
  }, [controlButtonIndex, gridSize.y, setControlButtonIndex]);

  if (buttonMode === "Play mode") return null;

  return (
    <MotionDiv
      ref={containerRef}
      className={ "radio-group-right-max motion-right-hud-panel motion-layer-panel"}
      style={{ overflowY: "auto" }} // make sure scrolling is enabled
      variants={layerPanelVariants}
      initial="hidden"
      animate="visible"
    >
      <FormControl>
        <FormLabel
          id="level-radio-buttons-group-label"
          className={"visible-element"}
        >
          Layers
        </FormLabel>

        <RadioGroup
          aria-labelledby="level-radio-buttons-group-label"
          value={`L${controlButtonIndex}`}
          name="radio-buttons-group"
          className={"visible-element"}
          onChange={handleChange}
        >
          {Array.from(
            { length: gridSize.y },
            (_, i) => gridSize.y - 1 - i
          ).map((level) => (
            <MotionDiv
              key={level}
              variants={layerItemVariants}
              whileHover={{ x: -3, scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
            <FormControlLabel
              className={"visible-element"}
              value={`L${level}`}
              control={
                <Radio
                  sx={{
                    color: "rgb(208, 208, 208)",
                    textShadow: "1px 1px 1px rgba(0,0,0,0.9)"
                  }}
                />
              }
              label={`L${level}`}
            />
            </MotionDiv>
          ))}
        </RadioGroup>
      </FormControl>
    </MotionDiv>
  );
}
