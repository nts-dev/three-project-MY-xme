const movingPlatforms = Object.create(null);

export function setMovingPlatformState(key, value) {
  if (key === undefined || key === null) {
    return;
  }
  movingPlatforms[String(key)] = value;
}

export function removeMovingPlatformState(key) {
  if (key === undefined || key === null) {
    return;
  }
  delete movingPlatforms[String(key)];
}

export function getMovingPlatformState(key) {
  if (key === undefined || key === null) {
    return null;
  }
  return movingPlatforms[String(key)] || null;
}

export function clearMovingPlatformStates() {
  Object.keys(movingPlatforms).forEach((key) => {
    delete movingPlatforms[key];
  });
}
