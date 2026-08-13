import React from "react";
import { Button } from "primereact/button";
import { motion } from "motion/react";

const MotionDiv = motion.div;
const MotionSpan = motion.span;

const toolbarVariants = {
    expanded: {
        opacity: 1,
        transition: {
            staggerChildren: 0.12,
            delayChildren: 0.08,
        },
    },
    collapsed: {
        opacity: 0,
        transition: {
            staggerChildren: 0.025,
            staggerDirection: -1,
        },
    },
};

const controlVariants = {
    expanded: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            opacity: { duration: 0.34 },
            y: { type: "spring", stiffness: 150, damping: 24 },
            scale: { type: "spring", stiffness: 150, damping: 24 },
        },
    },
    collapsed: {
        opacity: 0,
        y: -6,
        scale: 0.96,
    },
};

export function MotionLevelToolbar({ children }) {
    return (
        <MotionDiv
            className="button-box motion-level-toolbar"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
        >
            {children}
        </MotionDiv>
    );
}

export function MotionToolbarItems({ collapsed, children }) {
    return (
        <MotionDiv
            id="top-btn"
            className="motion-level-toolbar-items"
            variants={toolbarVariants}
            initial={false}
            animate={collapsed ? "collapsed" : "expanded"}
            style={{ display: collapsed ? "none" : "flex", gap: "0.2rem" }}
        >
            {children}
        </MotionDiv>
    );
}

export function MotionControl({ children, className = "" }) {
    return (
        <MotionDiv
            className={`motion-level-control ${className}`}
            variants={controlVariants}
            whileHover={{ y: -2, scale: 1.035 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
        >
            {children}
        </MotionDiv>
    );
}

function MorphIcon({ icon, pulse = false }) {
    return (
        <MotionSpan
            key={icon}
            className="motion-morph-icon"
            initial={{ opacity: 0, scale: 0.35, rotate: -90, filter: "blur(4px)" }}
            animate={{
                opacity: 1,
                scale: pulse ? [1, 1.18, 1] : 1,
                rotate: 0,
                filter: "blur(0px)",
            }}
            transition={{
                duration: 0.28,
                ease: "easeOut",
                scale: pulse ? { duration: 1.7, repeat: Infinity, ease: "easeInOut" } : undefined,
            }}
        >
            <i className={icon || "pi pi-circle"} aria-hidden="true" />
        </MotionSpan>
    );
}

export function ToolbarButton({ icon, label, className = "", pulseIcon = false, ...props }) {
    return (
        <Button className={`l-action-btn motion-icon-button ${className}`} {...props}>
            <MorphIcon icon={icon} pulse={pulseIcon} />
            {label && <span className="motion-button-label">{label}</span>}
        </Button>
    );
}
