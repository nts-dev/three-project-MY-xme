import useGame from "../../../hooks/useGame";

/**
 * Busy indicator for the global `lazy` flag. It no longer blocks the screen: background work
 * (the first data import, scene loads) shows nothing, and actions that set a message
 * (setLazyMsg, e.g. "Saving...") show a small non-blocking status pill in the corner.
 */
export default function LazyLoader() {
    const lazy: boolean = useGame((state: any) => state.lazy);
    const lazyMsg: string = useGame((state: any) => state.lazyMsg);

    if (!lazy || !lazyMsg) {
        return null;
    }

    return (
        <div className="app-busy-pill" role="status" aria-live="polite">
            <span className="app-busy-pill__spinner" aria-hidden="true" />
            <span>{lazyMsg}</span>
        </div>
    );
}
