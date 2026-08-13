import React from "react";
import { RigidBody, TrimeshCollider } from "@react-three/rapier";
import { registerNavigationCollider } from "./aiPathfinding/navigationColliderRegistry";

export default function MergedInstanceTrimeshCollider({
  colliderKey,
  geometry,
  name,
}) {
  React.useEffect(
    () => registerNavigationCollider(colliderKey, geometry, name),
    [colliderKey, geometry, name]
  );

  if (!geometry?.attributes?.position?.array || !geometry?.index?.array) {
    return null;
  }

  return (
    <RigidBody
      key={colliderKey}
      type="fixed"
      colliders={false}
    >
      <TrimeshCollider
        friction={0.02}
        restitution={0}
        args={[geometry.attributes.position.array, geometry.index.array]}
        userData={{ name }}
      />
    </RigidBody>
  );
}
