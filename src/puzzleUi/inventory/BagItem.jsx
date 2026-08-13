import React, { useEffect, useRef, memo, useState, forwardRef } from 'react';
import { useDrag } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { Tooltip } from 'react-tooltip';
import { AnimatePresence, motion } from 'motion/react';
import StyledBagItem from './BagItem.style';
import StyledItemTooltip from './ItemTooltip.style';
import useGame from '../../hooks/useGame';

const MotionDiv = motion.div;
const MotionButton = motion.button;

const actionDialogMessageVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)" },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        transition: { type: "spring", stiffness: 300, damping: 24, delay: 0.04 },
    },
};

const actionDialogFooterVariants = {
    visible: {
        transition: {
            staggerChildren: 0.07,
            delayChildren: 0.1,
        },
    },
};

const actionButtonVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.86 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 360, damping: 22 },
    },
};

const inventoryActions = [
    { key: "use", label: "Use", variant: "primary" },
    { key: "dispose", label: "Dispose", variant: "danger" },
    { key: "sell", label: "Sell", variant: "neutral" },
    { key: "auction", label: "Auction", variant: "neutral" },
    { key: "cancel", label: "Cancel", variant: "ghost" },
];

export const PresentationalBagItem = forwardRef(function PresentationalBagItem({
                                          drag,
                                          isDragging,
                                          item,
                                          count,
                                          containerId,
                                          toast,
                                      }, forwardedRef) {
    const tooltipId = `tooltip-${containerId}`;
    const itemsDictionary = useGame((state) => state.itemsDictionary);
    const setDroppedTokenData = useGame((state) => state.setDroppedTokenData);
    const setItemsDictionary = useGame((state) => state.setItemsDictionary);
    const setDroppedToken = useGame((state) => state.setDroppedToken);
    const setNotification = useGame((state) => state.setNotification);
    const invisible = useGame((state) => state.invisible);
    const [dialogVisible, setDialogVisible] = useState(false); // State to control dialog visibility

    const accept = (item) => {
        if (invisible) {
            setNotification({
                header: 'Invisible mode!',
                text: `Avatar is in invisible mode! Try again when you are visible!`,
                htmlCode: '&#9888;',
                position: 'center',
                id: item.id,
                timeout: 3000,
            });
            return;
        }

        const newDict = { ...itemsDictionary };
        if (newDict[item.id]?.count > 1) {
            newDict[item.id].count--;
        } else {
            delete newDict[item.id];
        }

        setItemsDictionary(newDict);
        setDroppedToken({ ...item });
        toast.current?.show({
            severity: 'success',
            summary: 'Accepted',
            detail: `A ${item.name} is in use`,
            life: 3000,
        });
    };

    const reject = () => {
        toast.current?.show({
            severity: 'warn',
            summary: 'Rejected',
            detail: 'You have rejected',
            life: 3000,
        });
    };

    const disposeToken = (item) => {

        setDroppedTokenData({ id: item.id });
        const newDict = { ...itemsDictionary };
        if (newDict[item.id]?.count > 1) {
            newDict[item.id].count--;
        } else {
            delete newDict[item.id];
        }
        setItemsDictionary(newDict);
    };

    const handleUse = (item) => {
        accept(item);
        toast.current?.show({
            severity: 'success',
            summary: 'Used',
            detail: `You used ${item.name}`,
            life: 2000,
        });
        setDialogVisible(false); // Close the dialog
    };

    const handleDispose = (item) => {
        disposeToken(item);
        toast.current?.show({
            severity: 'warn',
            summary: 'Disposed',
            detail: `You disposed of ${item.name}`,
            life: 2000,
        });
        setDialogVisible(false); // Close the dialog
    };

    const handleSell = (item) => {
        toast.current?.show({
            severity: 'info',
            summary: 'Sold',
            detail: `${item.name} sold successfully`,
            life: 2000,
        });
        setDialogVisible(false); // Close the dialog
    };

    const handleAuction = (item) => {
        toast.current?.show({
            severity: 'info',
            summary: 'Auction Started',
            detail: `${item.name} has been put up for auction`,
            life: 2000,
        });
        setDialogVisible(false); // Close the dialog
    };

    const confirmDropKey = () => {
        setDialogVisible(true); // Show the dialog
    };

    const onclick = () => {
        confirmDropKey();
    };

    const setItemNode = (node) => {
        drag?.(node);
        if (typeof forwardedRef === "function") {
            forwardedRef(node);
        } else if (forwardedRef) {
            forwardedRef.current = node;
        }
    };

    if (!item) return null;

    return (
        <>
            <StyledItemTooltip>
                <StyledBagItem
                    as={MotionDiv}
                    ref={setItemNode}
                    data-tooltip-id={tooltipId}
                    data-tooltip-html={`
            <ul style="list-style:none; margin:0; padding:0; z-index: 9999999;">
              <li><strong>Name:</strong> ${item.name}</li>
              <li><strong>Type:</strong> ${item.type}</li>
            </ul>`}
                    $isDragging={isDragging}
                    onClick={onclick}
                    initial={{ opacity: 0, scale: 0.44, rotate: -16, filter: "blur(5px)" }}
                    animate={{ opacity: isDragging ? 0 : 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.58, rotate: 10, filter: "blur(5px)" }}
                    whileHover={{ scale: 1.12, rotate: -3 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 430, damping: 24 }}
                >
                    <img src={item.image} alt={item.name} />
                    <div className="item-meta">
                        {count && count > 0 && <span className="item-count"> x {count}</span>}
                    </div>
                </StyledBagItem>
                {!isDragging && (
                    <Tooltip id={tooltipId} className="react-tooltip" place="top" effect="solid" />
                )}
            </StyledItemTooltip>

            <AnimatePresence>
                {dialogVisible && (
                    <MotionDiv
                        className="inventory-action-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setDialogVisible(false)}
                    >
                        <MotionDiv
                            className="inventory-action-dialog"
                            initial={{ opacity: 0, y: 16, scale: 0.96, filter: "blur(6px)" }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: 12, scale: 0.96, filter: "blur(5px)" }}
                            transition={{ type: "spring", stiffness: 330, damping: 27 }}
                            onClick={(event) => event.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-label="Inventory action"
                        >
                            <div className="inventory-action-dialog__chrome">
                                <span>ITEM ACTION</span>
                                <MotionButton
                                    type="button"
                                    className="inventory-action-dialog__close"
                                    whileHover={{ scale: 1.08 }}
                                    whileTap={{ scale: 0.94 }}
                                    onClick={() => setDialogVisible(false)}
                                    aria-label="Close inventory action dialog"
                                >
                                    x
                                </MotionButton>
                            </div>
                            <MotionDiv
                                className="inventory-action-message"
                                variants={actionDialogMessageVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                What do you want to do with {item.name}?
                            </MotionDiv>
                            <MotionDiv
                                className="inventory-action-footer"
                                variants={actionDialogFooterVariants}
                                initial="hidden"
                                animate="visible"
                            >
                                {inventoryActions.map((action) => {
                                    const disabled = action.key === "use" && item.alphabet;
                                    const handleClick = () => {
                                        if (action.key === "use") handleUse(item);
                                        if (action.key === "dispose") handleDispose(item);
                                        if (action.key === "sell") handleSell(item);
                                        if (action.key === "auction") handleAuction(item);
                                        if (action.key === "cancel") {
                                            reject();
                                            setDialogVisible(false);
                                        }
                                    };

                                    return (
                                        <MotionButton
                                            key={action.key}
                                            type="button"
                                            className={`inventory-action-btn inventory-action-btn--${action.variant}`}
                                            variants={actionButtonVariants}
                                            whileHover={disabled ? undefined : { y: -2, scale: 1.04 }}
                                            whileTap={disabled ? undefined : { scale: 0.94 }}
                                            disabled={disabled}
                                            onClick={handleClick}
                                        >
                                            {action.label}
                                        </MotionButton>
                                    );
                                })}
                            </MotionDiv>
                        </MotionDiv>
                    </MotionDiv>
                )}
            </AnimatePresence>
        </>
    );
});

const BagItem = forwardRef(function BagItem({ item, bagId, count, isEquiped, toast }, forwardedRef) {
    const dragRef = useRef(null);

    const [{ isDragging }, drag, preview] = useDrag({
        type: 'BAG_ITEM',
        item: { ...item, bagId, isEquiped, count },
        canDrag: true,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    useEffect(() => {
        preview(getEmptyImage(), { captureDraggingState: true });
    }, [preview]);

    return (
        <PresentationalBagItem
            ref={forwardedRef}
            containerId={bagId}
            drag={(node) => {
                drag(node);
                dragRef.current = node;
            }}
            isDragging={isDragging}
            item={item}
            count={count}
            toast={toast}
        />
    );
});

export default memo(BagItem);
