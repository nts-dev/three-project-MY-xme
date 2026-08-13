import React from "react";

import { AnimatePresence, motion } from "motion/react";
import BagBox from "./BagBox.jsx";
import BagItem from "./BagItem.jsx";

import { bagConfig } from "../config";

import { isBlank } from "../helpers";
import StyledInventory from "./Inventory.style";
import HudFrame from "../HudFrame.jsx";

const MotionDiv = motion.div;
const slotLabels = ["MAGIC", "BOX", "HEALTH", "KEY", "BOX"];

const gridVariants = {
  visible: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.1,
    },
  },
};

const slotVariants = {
  hidden: { opacity: 0, y: -8, scale: 0.9, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 310, damping: 24 },
  },
};

class Inventory extends React.Component {
  render() {
    const {  updateItemOrder,itemList,toast } = this.props;

    return (
      <StyledInventory>
        <HudFrame as={MotionDiv} className="motion-inventory-frame">
          <MotionDiv
            className="boxes-grid"
            variants={gridVariants}
            initial="hidden"
            animate="visible"
          >
            {bagConfig.bagBoxes.map(bagId => {

              const item = itemList[bagId];
              const count = item?.count ?? (bagId === 0 ? 1 : 2);

              return (
                <MotionDiv
                  key={bagId}
                  className="inventory-slot-motion"
                  variants={slotVariants}
                  whileHover={{ y: -2, scale: 1.035 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <BagBox
                    bagId={bagId}
                    hasItem={!isBlank(item)}
                    updateItemOrder={updateItemOrder}
                    slotLabel={slotLabels[bagId]}
                    slotCount={count}
                  >
                    <AnimatePresence mode="popLayout">
                      {item && (
                        <BagItem
                          key={`${bagId}${item.name}`}
                          bagId={bagId}
                          count={null}
                          item={item}
                          toast={toast}
                        />
                      )}
                    </AnimatePresence>
                  </BagBox>
                </MotionDiv>
              );
            })}
          </MotionDiv>
        </HudFrame>
      </StyledInventory>
    );
  }
}

export default Inventory;
