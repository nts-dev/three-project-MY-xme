import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { RigidBody, TrimeshCollider } from "@react-three/rapier";
import { removeMovingPlatformState, setMovingPlatformState } from "./movingPlatformRegistry";

const AnimatedPlatformInstances = forwardRef(function AnimatedPlatformInstances(
  {
    projectId,
    name,
    geometry,
    instanceData = [],
    getTransformForInstance,
  },
  ref
  ) {
  const bodyRefs = useRef({});
  const platformStateRef = useRef({});

  const syncPlatforms = () => {
    for (let index = 0; index < instanceData.length; index += 1) {
      const data = instanceData[index];
      if (!data?.key) {
        continue;
      }

      const body = bodyRefs.current[data.key];
      if (!body?.setNextKinematicTranslation || !body?.setNextKinematicRotation) {
        continue;
      }

      const transform = getTransformForInstance(data);
      const previousState = platformStateRef.current[data.key];
      const previousPosition = previousState?.position || transform.position;
      const delta = {
        x: transform.position.x - previousPosition.x,
        y: transform.position.y - previousPosition.y,
        z: transform.position.z - previousPosition.z,
      };

      body.setNextKinematicTranslation(transform.position);
      body.setNextKinematicRotation(transform.quaternion);

      const nextState = {
        key: data.key,
        name,
        position: transform.position,
        rotation: transform.rotation,
        quaternion: transform.quaternion,
        delta,
      };
      platformStateRef.current[data.key] = nextState;
      setMovingPlatformState(data.key, nextState);
    }
  };

  useImperativeHandle(ref, () => ({
    syncPlatforms,
  }));

  useEffect(() => {
    syncPlatforms();

    return () => {
      for (let index = 0; index < instanceData.length; index += 1) {
        const data = instanceData[index];
        if (!data?.key) {
          continue;
        }
        removeMovingPlatformState(data.key);
      }
      platformStateRef.current = {};
      bodyRefs.current = {};
    };
  }, [instanceData, removeMovingPlatformState]);

  return instanceData.map((data, index) => {
    const transform = getTransformForInstance(data);
    const s = data?.scale || {};
    const sx = s?.x ?? 1;
    const sy = s?.y ?? 1;
    const sz = s?.z ?? 1;

    return (
      <RigidBody
        key={`animated_col_${projectId}_${name}_${data?.key ?? index}`}
        name={name}
        type="kinematicPosition"
        colliders={false}
        ref={(body) => {
          if (body) {
            bodyRefs.current[data.key] = body;
          } else {
            delete bodyRefs.current[data.key];
          }
        }}
        position={[transform.position.x, transform.position.y, transform.position.z]}
        rotation={transform.rotation}
        userData={{ name, source: "TemplateInstancesAnimated", key: data?.key }}
      >
        <TrimeshCollider
          friction={2.5}
          restitution={0}
          contactSkin={0.001}
          scale={[sx, sy, sz]}
          args={[geometry.attributes.position.array, geometry.index.array]}
          userData={{ name, source: "TemplateInstancesAnimatedCollider", key: data?.key }}
        />
      </RigidBody>
    );
  });
});

export default AnimatedPlatformInstances;
