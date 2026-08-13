import React, { memo } from "react";
import { useDrop } from "react-dnd";

import StyledBagBox from "./BagBox.style";

const Bag = ({
               children,
               updateItemOrder,
               bagId,
               hasItem,
               accept,
               className,
               showType,
               shouldHighlight,
               slotLabel,
               slotCount
             }) => {
  // const [{ isOver, canDrop }, drop] = useDrop({
  //   accept: accept ,
  //   drop: (item) => {
  //     if (item.bagId === bagId) return;
  //     updateItemOrder(bagId, item);
  //   },
  //   collect: (monitor) => ({
  //     isOver: monitor.isOver(),
  //     canDrop: monitor.canDrop(),
  //   }),
  // });

  // combine the drop-state flags and your own flags
  const highlight = !hasItem && shouldHighlight;

  return (
      <StyledBagBox
          // ref={drop}
          className={`${className ?? ""} ${highlight ? "highlight" : ""}`}
          $hasItem={hasItem}
      >
        {slotLabel && <span className="slot-label">{slotLabel}</span>}
        {showType && !children && <span className="slot-type">{accept}</span>}
        {children}
        {slotCount !== undefined && slotCount !== null && (
            <span className="slot-count">{slotCount}</span>
        )}
      </StyledBagBox>
  );
};

export default memo(Bag);
