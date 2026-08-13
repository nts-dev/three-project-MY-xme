let avatarLoadingHudVisible = false;
const listeners = new Set();

export function setAvatarLoadingHudVisible(nextVisible) {
    const visible = Boolean(nextVisible);
    if (avatarLoadingHudVisible === visible) return;

    avatarLoadingHudVisible = visible;
    listeners.forEach((listener) => listener());
}

export function subscribeAvatarLoadingHud(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getAvatarLoadingHudSnapshot() {
    return avatarLoadingHudVisible;
}
