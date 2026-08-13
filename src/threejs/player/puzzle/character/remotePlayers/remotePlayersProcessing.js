export const DEFAULT_REMOTE_UI_HZ = 12;
export const DEFAULT_POS_EPS = 0.5;
export const DEFAULT_QUAT_EPS = 0.002;

function hasValidLocalClient(localClientId) {
  return localClientId !== null && localClientId !== undefined && String(localClientId).trim() !== "";
}

function shouldShowRemotePlayer(player, localClientId, projectID) {
  if (!player || !hasValidLocalClient(localClientId)) return false;
  if (!player.clientId || player.clientId.length === 0) return false;
  if (localClientId === player.clientId) return false;
  if (projectID != player.projectID) return false;
  if (player.invisible) return false;
  return true;
}

function hasMeaningfulPlayerDelta(
  prevPlayers,
  nextPlayers,
  posEps = DEFAULT_POS_EPS,
  quatEps = DEFAULT_QUAT_EPS
) {
  if (!Array.isArray(prevPlayers) || !Array.isArray(nextPlayers)) return true;
  if (prevPlayers.length !== nextPlayers.length) return true;

  const prevMap = new Map(prevPlayers.map((p) => [p?.clientId, p]));
  for (let i = 0; i < nextPlayers.length; i++) {
    const next = nextPlayers[i];
    const prev = prevMap.get(next?.clientId);
    if (!prev) return true;
    if (prev.currentAnimation !== next.currentAnimation) return true;
    if (prev.projectID !== next.projectID) return true;
    if (prev.invisible !== next.invisible) return true;
    if (prev.avatarColor !== next.avatarColor) return true;
    if (prev.userName !== next.userName) return true;
    if (prev.hpPct !== next.hpPct || prev.enPct !== next.enPct) return true;
    if (Math.abs((prev.posX ?? 0) - (next.posX ?? 0)) > posEps) return true;
    if (Math.abs((prev.posY ?? 0) - (next.posY ?? 0)) > posEps) return true;
    if (Math.abs((prev.posZ ?? 0) - (next.posZ ?? 0)) > posEps) return true;

    const prevQuat = prev.quaternion;
    const nextQuat = next.quaternion;
    if (!!prevQuat !== !!nextQuat) return true;
    if (prevQuat && nextQuat) {
      if (Math.abs((prevQuat[0] ?? 0) - (nextQuat[0] ?? 0)) > quatEps) return true;
      if (Math.abs((prevQuat[1] ?? 0) - (nextQuat[1] ?? 0)) > quatEps) return true;
      if (Math.abs((prevQuat[2] ?? 0) - (nextQuat[2] ?? 0)) > quatEps) return true;
      if (Math.abs((prevQuat[3] ?? 0) - (nextQuat[3] ?? 0)) > quatEps) return true;
    }
  }

  return false;
}

export function processRemotePlayersSnapshot({
  players,
  previousPlayers,
  localClientId,
  projectID,
  posEps = DEFAULT_POS_EPS,
  quatEps = DEFAULT_QUAT_EPS,
}) {
  const filteredPlayers = Array.isArray(players)
    ? players.filter((player) => shouldShowRemotePlayer(player, localClientId, projectID))
    : [];

  return {
    players: filteredPlayers,
    changed: hasMeaningfulPlayerDelta(previousPlayers, filteredPlayers, posEps, quatEps),
  };
}
