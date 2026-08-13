export const isSpaceKey = (event) => (
    event?.code === 'Space' || event?.key === ' ' || event?.key === 'Spacebar'
);

export const suppressSpaceButtonActivation = (event) => {
    if (!isSpaceKey(event)) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
};

export const blurCurrentTarget = (event) => {
    event?.currentTarget?.blur?.();
};
