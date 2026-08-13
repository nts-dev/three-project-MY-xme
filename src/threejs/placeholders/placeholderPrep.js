import { AURA_SCALE } from "./placeholderConstants";

const toNumberArray = (value, fallback) => {
  if (Array.isArray(value)) {
    return [
      Number(value[0]) || fallback[0],
      Number(value[1]) || fallback[1],
      Number(value[2]) || fallback[2],
    ];
  }

  if (value && typeof value === "object") {
    return [
      Number(value.x) || fallback[0],
      Number(value.y) || fallback[1],
      Number(value.z) || fallback[2],
    ];
  }

  return fallback;
};

export function preparePlaceholderInstances(instances = [], baseSize = [1, 1, 1], auraScale = AURA_SCALE) {
  const sensorSize = [
    (Number(baseSize[0]) || 1) * auraScale,
    (Number(baseSize[1]) || 1) * auraScale,
    (Number(baseSize[2]) || 1) * auraScale,
  ];
  const halfHeight = sensorSize[1] / 2;

  return instances.map((inst, index) => {
    const userData = inst?.userData || {};
    return {
      key: inst?.key,
      assetId: inst?.assetId,
      assetID: inst?.assetID,
      instanceId: inst?.instanceId,
      instance_id: inst?.instance_id,
      name: inst?.name,
      userData: {
        instance_id: userData.instance_id,
        name: userData.name,
      },
      position: toNumberArray(inst?.position, [0, 0, 0]),
      rotation: toNumberArray(inst?.rotation, [0, 0, 0]),
      sensorSize,
      halfHeight,
      sourceIndex: index,
    };
  });
}
