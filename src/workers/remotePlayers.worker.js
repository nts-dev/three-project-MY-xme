import { processRemotePlayersSnapshot } from "../threejs/player/puzzle/character/remotePlayers/remotePlayersProcessing";

self.onmessage = (event) => {
  const { id, payload } = event.data || {};

  try {
    self.postMessage({
      id,
      result: processRemotePlayersSnapshot(payload || {}),
    });
  } catch (error) {
    self.postMessage({
      id,
      error: error?.message || "Failed to process remote players.",
    });
  }
};
