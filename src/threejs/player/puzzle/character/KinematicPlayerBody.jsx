import { CapsuleCollider, CuboidCollider, RigidBody } from "@react-three/rapier";
import OrbitingShape from "./OrbitingShape.jsx";
// import Status from "./Status.jsx";

export default function KinematicPlayerBody({
  bodyRef,
  colliderRef,
  characterModel,
  firstPerson,
  character,
  uName,
  colliderArgs = [0.01, 0.0178],
  onCollisionEnter,
  onCollisionExit,
  onIntersectionEnter,
  onIntersectionExit,
  onHeadIntersectionEnter,
  children,
}) {
  return (
    <RigidBody
      ref={bodyRef}
      name="character"
      key="person"
      position={[1, 0.12, 0]}
      type="kinematicPosition"
      colliders={false}
      friction={0.04}
      restitution={0}
      enabledRotations={[false, false, false]}
      onCollisionEnter={onCollisionEnter}
      onCollisionExit={onCollisionExit}
      onIntersectionEnter={onIntersectionEnter}
      onIntersectionExit={onIntersectionExit}
      ccd
    >
      <CapsuleCollider ref={colliderRef} args={colliderArgs} />
      <CuboidCollider
        args={[0.008, 0.004, 0.008]}
        position={[0, 0.12, 0]}
        sensor
        onIntersectionEnter={onHeadIntersectionEnter}
      />
      {children}

      <primitive object={characterModel} position={[0, -0.026, 0]}>
        <OrbitingShape />
      </primitive>

      {/* {(firstPerson || character) && (
        <Status userName={uName} characterModel={characterModel} bodyRef={bodyRef} />
      )} */}
    </RigidBody>
  );
}
