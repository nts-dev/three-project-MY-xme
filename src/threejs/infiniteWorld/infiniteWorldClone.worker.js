import { buildWorldCloneCells } from "./infiniteWorldCloneProcessing";

self.onmessage = (event) => {
    const { id, scenePayload, cells, metrics } = event.data || {};

    try {
        self.postMessage({
            id,
            cells: buildWorldCloneCells({ scenePayload, cells, metrics }),
        });
    } catch (error) {
        self.postMessage({
            id,
            error: error?.message || "Failed to build infinite world clones",
        });
    }
};
