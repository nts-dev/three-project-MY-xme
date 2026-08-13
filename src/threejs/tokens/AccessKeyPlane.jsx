import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { socket } from "../../socket";
import useGame from "../../hooks/useGame";
import { enPc, realTimeChaPosition } from "../player/puzzle/character/Constants.jsx";

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();
const COLOR_WORDS = new Set([
  "red",
  "blue",
  "green",
  "yellow",
  "brown",
  "purple",
  "black",
  "white",
  "gray",
  "orange",
]);

export default function AccessKeyPlane({
  data,
  rotation,
  texturePath,
  collectable,
  id,
  rToken,
}) {
  const meshRef = useRef();
  const colliderRef = useRef();
  const textureRef = useRef(null);
  const [loadedTexture, setLoadedTexture] = useState(null);

  const [collected, setCollected] = useState(false);
  const [collisionEnabled, setCollisionEnabled] = useState(true);
  const token = rToken;
  const [position, setPosition] = useState(() => {
    const pos = [...(data.position || [0, 0, 0])];
    pos[1] += 0.011;
    return pos;
  });

  const {
    droppedTokenData,
    setDroppedToken,
    setItemsDictionary,
    setTokenCode,
    tokenCode,
    itemsDictionary,
    projectID: gameId,
    clientId,
    speedFactor,
    setSpeedFactor,
    registerCollectibleCollider,
    unregisterCollectibleCollider,
    collectibleRayHit,
  } = useGame((state) => ({
    droppedTokenData: state.droppedTokenData,
    setDroppedToken: state.setDroppedToken,
    setItemsDictionary: state.setItemsDictionary,
    setTokenCode: state.setTokenCode,
    tokenCode: state.tokenCode,
    itemsDictionary: state.itemsDictionary,
    projectID: state.projectID,
    clientId: state.clientId,
    speedFactor: state.speedFactor,
    setSpeedFactor: state.setSpeedFactor,
    registerCollectibleCollider: state.registerCollectibleCollider,
    unregisterCollectibleCollider: state.unregisterCollectibleCollider,
    collectibleRayHit: state.collectibleRayHit,
  }));

  const collisionEnabledRef = useRef(collisionEnabled);
  const collectedRef = useRef(collected);
  const itemsDictionaryRef = useRef(itemsDictionary);
  const tokenCodeRef = useRef(tokenCode);
  const speedFactorRef = useRef(speedFactor);
  const lastProcessedRayHitTickRef = useRef(0);

  useEffect(() => {
    collisionEnabledRef.current = collisionEnabled;
  }, [collisionEnabled]);
  useEffect(() => {
    collectedRef.current = collected;
  }, [collected]);
  useEffect(() => {
    itemsDictionaryRef.current = itemsDictionary;
  }, [itemsDictionary]);
  useEffect(() => {
    tokenCodeRef.current = tokenCode;
  }, [tokenCode]);
  useEffect(() => {
    speedFactorRef.current = speedFactor;
  }, [speedFactor]);

  useEffect(() => {
    if (droppedTokenData?.id !== id) return;

    setTokenCode({
      id,
      code: "##-##-##-##-##",
      color: null,
      codeValue: tokenCodeRef.current.codeValue,
    });
    enPc.current = Math.min(100, enPc.current + 20);
    setSpeedFactor(Math.min(1, speedFactorRef.current + 0.04));
    setCollected(false);
    setCollisionEnabled(false);

    const pos = [...(realTimeChaPosition || [0, 0, 0])];
    pos[1] -= 0.025;
    setPosition(pos);

    const timer = setTimeout(() => setCollisionEnabled(true), 30000);
    return () => clearTimeout(timer);
  }, [droppedTokenData, id, setSpeedFactor, setTokenCode]);

  useEffect(() => {
    if (!texturePath) return;
    if (textureCache.has(texturePath)) {
      const tex = textureCache.get(texturePath);
      textureRef.current = tex;
      setLoadedTexture(tex);
      return;
    }
    textureLoader.load(
      texturePath,
      (tex) => {
        textureCache.set(texturePath, tex);
        textureRef.current = tex;
        setLoadedTexture(tex);
      },
      undefined,
      (err) => console.warn("Texture load failed:", texturePath, err)
    );
  }, [texturePath]);

  useEffect(() => {
    const handleItemCollected = ({ itemId }) => {
      if (itemId === id) setCollected(true);
    };
    socket.on("itemCollected", handleItemCollected);
    return () => socket.off("itemCollected", handleItemCollected);
  }, [id]);

  const addItemToDictionary = useCallback(() => {
    const name = token.symbol;
    const image = `${token.symbol}.png`;
    const latestItems = useGame.getState().itemsDictionary || {};
    setItemsDictionary({
      ...latestItems,
      [id]: {
        id,
        name,
        color: null,
        attributes: { attack: 1 },
        image: `${import.meta.env.VITE_VIDEO_URL}/assets/treasure/${image}`,
        stackable: true,
        type: name,
        count: 1,
        active: true,
        alphabet: true,
      },
    });
  }, [id, setItemsDictionary, token.symbol]);

  const onCollision = useCallback(() => {
    if (!collisionEnabledRef.current || collectedRef.current || !collectable) return;
    const inventoryFull = Object.keys(itemsDictionaryRef.current || {}).length >= 5;
    if (inventoryFull) return;

    const color = token.symbol?.split("_").find((w) => COLOR_WORDS.has(w));

    setTokenCode({
      code: token.code,
      color,
      symbol: token.symbol,
      id,
      codeValue: tokenCodeRef.current.codeValue,
    });
    setCollected(true);
    enPc.current = Math.max(0, enPc.current - 20);
    setSpeedFactor(Math.max(0.8, speedFactorRef.current - 0.04));
    socket.emit("collectItem", {
      gameId,
      itemId: id,
      clientId,
      subtype: token.subtype,
      category: token.category,
    });

    addItemToDictionary();
    setDroppedToken({ type: token.subtype, category: token.category });
  }, [
    addItemToDictionary,
    clientId,
    collectable,
    gameId,
    id,
    setDroppedToken,
    setSpeedFactor,
    setTokenCode,
    token,
  ]);

  useEffect(() => {
    if (!collectibleRayHit) return;
    if (collectibleRayHit.id !== id) return;
    const tick = Number(collectibleRayHit.tick || 0);
    if (tick <= 0) return;
    if (lastProcessedRayHitTickRef.current === tick) return;
    lastProcessedRayHitTickRef.current = tick;
    onCollision();
  }, [collectibleRayHit, id, onCollision]);

  useEffect(() => {
    if (!collisionEnabled || collected) return;
    const getHandle = () => {
      const c = colliderRef.current;
      if (!c) return null;
      if (typeof c.handle === "function") {
        const v = c.handle();
        return v === undefined || v === null ? null : String(v);
      }
      const v = c.handle;
      return v === undefined || v === null ? null : String(v);
    };
    const raf = requestAnimationFrame(() => {
      const handle = getHandle();
      if (!handle) return;
      registerCollectibleCollider(handle, id);
    });
    return () => {
      cancelAnimationFrame(raf);
      const handle = getHandle();
      if (!handle) return;
      unregisterCollectibleCollider(handle);
    };
  }, [collisionEnabled, collected, id, registerCollectibleCollider, unregisterCollectibleCollider]);

  if (collected || !loadedTexture) return null;

  return (
    <RigidBody type="fixed" colliders={false} sensor>
      <mesh ref={meshRef} position={position} rotation={rotation}>
        <planeGeometry args={[0.1, 0.1]} />
        <meshBasicMaterial map={loadedTexture} alphaTest={0.5} />
      </mesh>

      {collisionEnabled && !collected && (
        <CuboidCollider
          ref={colliderRef}
          args={[0.0375, 0.0375, 0.001]}
          position={position}
          rotation={rotation}
          sensor
          onIntersectionEnter={onCollision}
          userData={{ collectibleId: id, category: token?.category, subtype: token?.subtype }}
        />
      )}
    </RigidBody>
  );
}
