import { preparePlaceholderInstances } from "../threejs/placeholders/placeholderPrep";

self.onmessage = (event) => {
  const { id, instances, baseSize, auraScale } = event.data || {};

  try {
    self.postMessage({
      id,
      instances: preparePlaceholderInstances(instances, baseSize, auraScale),
    });
  } catch (error) {
    self.postMessage({
      id,
      error: error?.message || "Failed to prepare placeholder instances.",
    });
  }
};
