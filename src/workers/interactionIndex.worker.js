import { filterInteractionCandidates } from "../threejs/player/puzzle/character/interactionIndex/interactionIndexProcessing";

self.onmessage = (event) => {
  const { id, payload } = event.data || {};

  try {
    self.postMessage({
      id,
      result: filterInteractionCandidates(payload || {}),
    });
  } catch (error) {
    self.postMessage({
      id,
      error: error?.message || "Failed to filter interaction candidates.",
    });
  }
};
