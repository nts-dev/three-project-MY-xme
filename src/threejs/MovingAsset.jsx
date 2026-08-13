import { RigidBody } from "@react-three/rapier";
import { useMemo, useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import useGame from "../hooks/useGame";
import DigitalDisplay from "./animations/DigitalDisplay.jsx";
import DigitalDisplay14 from "./animations/DigitalDisplay14.jsx";

export default function MovingAsset({ data, object }) {
    // ------------------ Refs & State ------------------
    const clonObj = useMemo(() => object.clone(), [object]);
    const rigidBodyRef = useRef();
    const animationProgress = useRef(0);
    const isAnimating = useRef(false);
    const isDelaying = useRef(false);
    const canCollide = useRef(true);
    const delayStartTime = useRef(0);
    const hasReachedDestination = useRef(false);
    const travelDirection = useRef(0);
    const blockLandingArmed = useRef(true);

    const moveDistance = 2.0;
    const delayDuration = 2.0; // seconds
    const moveDuration = 4.0; // seconds

    const originalPosition = useRef(new THREE.Vector3(...data.position));
    const startPosition = useRef(new THREE.Vector3(...data.position));
    const prevPosition = useRef(originalPosition.current.clone());
    const targetPositionRef = useRef(originalPosition.current.clone());
    const tileVelocity = useRef(new THREE.Vector3());
    const targetPosTmp = useRef(new THREE.Vector3());
    const finalPosTmp = useRef(new THREE.Vector3());

    const isCharacterOnTile = useRef(false);
    const tileState = useRef("neutral"); // neutral, left, right, cannot_left, cannot_right
    const characterSide = useRef(null);
    const characterOffset = useRef(0);
    const characterY = useRef(0);

    const originalMaterialsRef = useRef(new Map());
    const { gl } = useThree();

    const {
        gameCharacterRef,
        setDeleteAssetId,
        deleteObject,
        setScan,
        scan,
        setSearchItem,
        setScannedId,
        setAnimationRef,
        assetColor,
        buttonMode,
        standingOnMovingBlock,
        hasJumped,
        setPlayAssetInfoRequest,
    } = useGame((state) => ({
        gameCharacterRef: state.gameCharacterRef,
        setDeleteAssetId: state.setDeleteAssetId,
        deleteObject: state.deleteObject,
        setScan: state.setScan,
        scan: state.scan,
        setSearchItem: state.setSearchItem,
        setScannedId: state.setScannedId,
        setAnimationRef: state.setAnimationRef,
        assetColor: state.assetColor,
        buttonMode: state.buttonMode,
        standingOnMovingBlock: state.standingOnMovingBlock,
        hasJumped: state.hasJumped,
        setPlayAssetInfoRequest: state.setPlayAssetInfoRequest,
    }));

    const blockName = `movingBlock_${data.key}`;

    // ------------------ Helpers ------------------
    const createArrow = useCallback((dirX, color, light = false) => {
        const dir = new THREE.Vector3(dirX, 0, 0);
        const origin = new THREE.Vector3(dirX * 0.03, 0.01, 0);
        const length = 0.05;
        const col = light ? new THREE.Color(color).offsetHSL(0, -0.3, 0.3) : color;
        return new THREE.ArrowHelper(dir, origin, length, col, 0.01, 0.005);
    }, []);

    const canMoveLeft = useCallback(() => {
        const pos = rigidBodyRef.current?.translation();
        return pos && pos.x > -5;
    }, []);
    const canMoveRight = useCallback(() => {
        const pos = rigidBodyRef.current?.translation();
        return pos && pos.x < 5;
    }, []);

    const setMaterialColor = useCallback((obj, hexColor) => {
        if (!hexColor) return;
        const updateMaterial = (material) => {
            const clone = material.clone();
            if (clone?.color) clone.color.set(hexColor);
            return clone;
        };
        const traverse = (node) => {
            if (node.material) {
                const original = Array.isArray(node.material)
                    ? node.material.map((m) => m.clone())
                    : node.material.clone();
                originalMaterialsRef.current.set(node, original);
                node.material = Array.isArray(node.material)
                    ? node.material.map(updateMaterial)
                    : updateMaterial(node.material);
            }
            node.children?.forEach(traverse);
        };
        traverse(obj);
    }, []);

    const restoreOriginalMaterials = useCallback((obj) => {
        const restore = (node) => {
            if (originalMaterialsRef.current.has(node)) {
                node.material = originalMaterialsRef.current.get(node);
                originalMaterialsRef.current.delete(node);
            }
            node.children?.forEach(restore);
        };
        restore(obj);
    }, []);

    // ------------------ Visual Elements ------------------
    const neutralCircle = useMemo(() => {
        const geometry = new THREE.CircleGeometry(0.03, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 0.011, 0);
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
    }, []);

    const leftArrow = useMemo(() => createArrow(-1, 0xff0000), [createArrow]);
    const leftArrowLight = useMemo(() => createArrow(-1, 0xff9999, true), [createArrow]);
    const rightArrow = useMemo(() => createArrow(1, 0x00ff00), [createArrow]);
    const rightArrowLight = useMemo(() => createArrow(1, 0x99ff99, true), [createArrow]);

    // ------------------ Collision Events ------------------
    const onCollisionEnter = useCallback((e) => {
        const obj = e.rigidBodyObject;
        if (obj?.name === "character" && gameCharacterRef && canCollide.current) {
            const assetPos = rigidBodyRef.current.translation();
            const charPos = gameCharacterRef.translation();
            const relativeX = charPos.x - assetPos.x;

            characterSide.current = relativeX < 0 ? "left" : "right";
            travelDirection.current = hasReachedDestination.current
                ? Math.sign(startPosition.current.x - assetPos.x)
                : (characterSide.current === "left" ? -1 : 1);
            tileState.current = travelDirection.current < 0
                ? (canMoveLeft() ? "left" : "cannot_left")
                : (canMoveRight() ? "right" : "cannot_right");

            characterOffset.current =
                characterSide.current === "left" ? -0.001 : 0.001;
            gameCharacterRef.setTranslation(
                { x: assetPos.x + characterOffset.current, y: charPos.y, z: assetPos.z },
                true
            );

            delayStartTime.current = performance.now() / 1000;
            isDelaying.current = ["left", "right"].includes(tileState.current);
            canCollide.current = !isDelaying.current;
            isCharacterOnTile.current = true;
            characterY.current = charPos.y;
            blockLandingArmed.current = false;
        }
    }, [canMoveLeft, canMoveRight, gameCharacterRef]);

    const onCollisionExit = useCallback((e) => {
        if (e.rigidBodyObject?.name === "character" && !isDelaying.current) {
            isCharacterOnTile.current = false;
            tileState.current = "neutral";
            characterSide.current = null;
            characterOffset.current = 0;
            canCollide.current = true;
        }
    }, []);

    // ------------------ Frame Loop ------------------
    useFrame((_, delta) => {
        if (!rigidBodyRef.current) return;
        const now = performance.now();
        const nowSec = now / 1000;
        const isStandingOnThisBlock = standingOnMovingBlock === blockName;

        if (
            isStandingOnThisBlock &&
            hasJumped &&
            blockLandingArmed.current &&
            gameCharacterRef &&
            canCollide.current &&
            !isDelaying.current &&
            !isAnimating.current
        ) {
            const assetPos = rigidBodyRef.current.translation();
            const charPos = gameCharacterRef.translation();
            const relativeX = charPos.x - assetPos.x;

            characterSide.current = relativeX < 0 ? "left" : "right";
            travelDirection.current = hasReachedDestination.current
                ? Math.sign(startPosition.current.x - assetPos.x)
                : (characterSide.current === "left" ? -1 : 1);

            tileState.current = travelDirection.current < 0
                ? (canMoveLeft() ? "left" : "cannot_left")
                : (canMoveRight() ? "right" : "cannot_right");

            characterOffset.current = characterSide.current === "left" ? -0.001 : 0.001;
            isCharacterOnTile.current = true;
            characterY.current = charPos.y;
            delayStartTime.current = nowSec;
            isDelaying.current = ["left", "right"].includes(tileState.current);
            isAnimating.current = false;
            canCollide.current = false;
            blockLandingArmed.current = false;

            if (isDelaying.current) {
                gameCharacterRef.setTranslation(
                    { x: assetPos.x + characterOffset.current, y: charPos.y, z: assetPos.z },
                    true
                );
            } else {
                canCollide.current = true;
            }
        } else if (!isStandingOnThisBlock) {
            blockLandingArmed.current = true;
            if (!isDelaying.current && !isAnimating.current) {
                isCharacterOnTile.current = false;
            }
        } else if (!isDelaying.current && !isAnimating.current) {
            isCharacterOnTile.current = false;
        }

        // Visual state control
        neutralCircle.visible = tileState.current === "neutral";
        leftArrow.visible =
            tileState.current === "left" && (isDelaying.current || isAnimating.current);
        leftArrowLight.visible = tileState.current === "cannot_left";
        rightArrow.visible =
            tileState.current === "right" && (isDelaying.current || isAnimating.current);
        rightArrowLight.visible = tileState.current === "cannot_right";

        // Blink effect
        if (
            (isDelaying.current || isAnimating.current) &&
            ["left", "right"].includes(tileState.current)
        ) {
            const blink = Math.sin((now / 500) * Math.PI) > 0;
            if (tileState.current === "left") leftArrow.visible = blink;
            if (tileState.current === "right") rightArrow.visible = blink;
        }

        // Delay before movement
        if (isDelaying.current && !isAnimating.current) {
            if (nowSec - delayStartTime.current >= delayDuration) {
                isDelaying.current = false;
                isAnimating.current = true;
                animationProgress.current = 0;
            }
            tileVelocity.current.set(0, 0, 0);
            return;
        }

        if (!isAnimating.current) {
            tileVelocity.current.set(0, 0, 0);
            return;
        }

        // Movement animation
        animationProgress.current += delta;
        if (animationProgress.current >= moveDuration) {
            // End animation
            isAnimating.current = false;
            canCollide.current = true;
            tileState.current = "neutral";
            const finalPos = finalPosTmp.current.copy(targetPositionRef.current);
            originalPosition.current.copy(finalPos);
            hasReachedDestination.current = !hasReachedDestination.current;
            rigidBodyRef.current.setTranslation(finalPos, true);
            if (isCharacterOnTile.current && gameCharacterRef) {
                gameCharacterRef.setTranslation(
                    { x: finalPos.x + characterOffset.current, y: characterY.current, z: finalPos.z },
                    true
                );
            }
            tileVelocity.current.set(0, 0, 0);
            return;
        }

        // Progress movement
        const progress = animationProgress.current / moveDuration;
        const easedProgress = progress * progress * (3 - 2 * progress); // smoothstep [0..1]
        const moveStart = originalPosition.current;
        const moveEnd = finalPosTmp.current.copy(
            hasReachedDestination.current
                ? startPosition.current
                : startPosition.current.clone().setX(startPosition.current.x + travelDirection.current * moveDistance)
        );
        const targetPos = targetPosTmp.current.copy(moveStart).lerp(moveEnd, easedProgress);

        tileVelocity.current
            .copy(targetPos)
            .sub(prevPosition.current)
            .divideScalar(delta || 1 / 60);
        prevPosition.current.copy(targetPos);
        targetPositionRef.current.copy(targetPos);
        rigidBodyRef.current.setTranslation(targetPos, true);

        // Move character with tile
        if (isCharacterOnTile.current && gameCharacterRef) {
            gameCharacterRef.setTranslation(
                { x: targetPos.x + characterOffset.current, y: characterY.current, z: targetPos.z },
                true
            );
        }
    });

    // ------------------ Effects ------------------
    // useEffect(() => {
    //     if (meshRef?.current && assetColor && data.key) {
    //         const index = meshRef.current.userData[data.key];
    //         if (index !== undefined) {
    //             meshRef.current.setColorAt(index, new THREE.Color(assetColor));
    //             meshRef.current.instanceColor.needsUpdate = true;
    //         }
    //     }
    // }, [assetColor, data.key, meshRef]);

    useEffect(() => {
        return () => {
            restoreOriginalMaterials(clonObj);
        };
    }, [clonObj, restoreOriginalMaterials]);

    // ------------------ Events ------------------
    const handleDbClick = (e) => {
        e.stopPropagation();
        setAnimationRef(null);
        if (data.key !== undefined) {
            setScannedId(`${data.key}t_click`);
            setSearchItem({ noZoom: true });
            setScan(!scan);
        }
    };

    const handlePlayInfoClick = useCallback((e) => {
        e.stopPropagation();
        const instanceId =
            data?.key || data?.assetId || data?.assetID || data?.instanceId || data?.instance_id || data?.userData?.instance_id;

        if (!instanceId) return;

        setPlayAssetInfoRequest({
            instanceId,
            name: data?.name || object?.name || blockName,
            instanceIndex: data?.key,
        });
    }, [blockName, data, object?.name, setPlayAssetInfoRequest]);

    // ------------------ JSX ------------------
    return (
        <>



        <RigidBody
            ref={rigidBodyRef}
            key={data.key}
            name={blockName}
            userData={{ name: blockName, source: "MovingAsset", key: data.key }}
            type="kinematicPosition"
            colliders="trimesh"
            position={data.position}
            friction={2}
            restitution={0}
            onCollisionEnter={onCollisionEnter}
            onCollisionExit={onCollisionExit}

        >
            <group

                onPointerOver={buttonMode === 'Edit Mode' ?() => {
                    gl.domElement.style.cursor = "pointer";
                    setMaterialColor(clonObj, "rgb(243,255,211)");
                }: undefined}
                onPointerOut={buttonMode === 'Edit Mode' ?() => {
                    gl.domElement.style.cursor = "default";
                    restoreOriginalMaterials(clonObj);
                }: undefined}

               // scale={[0.01, 0.01, 0.01]}
                // onDoubleClick={buttonMode === 'Edit Mode' ? handleDbClick: undefined}
            >
                <primitive object={clonObj} scale={[0.01, 0.01, 0.01]}
                           onPointerDown={buttonMode === 'Play mode' ? handlePlayInfoClick : buttonMode === 'Edit Mode' ? (e) => {
                               e.stopPropagation();
                              if (deleteObject) setDeleteAssetId(data.key);
                           }: undefined}
                />
                <primitive object={neutralCircle} />
                <primitive object={leftArrow} />
                <primitive object={leftArrowLight} />
                <primitive object={rightArrow} />
                <primitive object={rightArrowLight} />
                <DigitalDisplay position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} />
                <DigitalDisplay14 position={[0, 0.012, 0.01]} rotation={[-Math.PI / 2, 0, 0]} />
            </group>

        </RigidBody>

            </>
    );
}
