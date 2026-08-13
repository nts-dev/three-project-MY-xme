import React from "react";
import { motion } from "motion/react";
import StyledFrame from "./Frame.style";

const MotionDiv = motion.div;

const Frame = ({ children, title, className }) => (
  <StyledFrame
    as={MotionDiv}
    className={className}
    initial={{ opacity: 0, y: -18, scale: 0.96, filter: "blur(6px)" }}
    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
    transition={{ type: "spring", stiffness: 270, damping: 23, mass: 0.8 }}
    whileHover={{ y: -1 }}
  >
    <div className="boxes-meta">
      {title && <span className="boxes-title">{title}</span>}
    </div>
    <div className="box-inner-container">{children}</div>
  </StyledFrame>
);

export default Frame;
