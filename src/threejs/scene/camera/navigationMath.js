// Normalize wheel units without imposing a minimum step on precision trackpads.
export function wheelDollyStep(deltaY, deltaMode, viewportHeight, distance, zoomSpeed) {
    const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? viewportHeight : 1;
    const amount = Math.min(6, Math.abs(deltaY * unit) / 80);
    const stepPerUnit = Math.max(zoomSpeed * 0.25, distance * 0.12, 0.05);
    return Math.min(amount * stepPerUnit, 10);
}
