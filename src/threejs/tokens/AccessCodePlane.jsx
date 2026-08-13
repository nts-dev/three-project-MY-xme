import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import useGame from "../../hooks/useGame";
import {socket} from "../../socket";

// 🔹 Shared geometry (same for all instances)
const SHARED_GEOMETRY = new THREE.PlaneGeometry(0.1, 0.1);

export default React.memo(function AccessCodePlane({
                                                       data,
                                                       rotation,
                                                       texturePath,
                                                       id,
                                                   }) {
    const [imageTexture, setImageTexture] = useState(null);


    const tokenCode = useGame((s) => s.tokenCode);
    const setTokenCode = useGame((s) => s.setTokenCode);
    const setItemsDictionary = useGame((s) => s.setItemsDictionary);
    const itemsDictionary = useGame((s) => s.itemsDictionary);
    const uColor = useGame((s) => s.uColor);
    const clientId = useGame((s) => s.clientId);
    const setTerminalMessage = useGame((s) => s.setTerminalMessage);
    const gameId = useGame((s) => s.projectID);
    const [displayCode, setDisplayCode] = useState(tokenCode.codeValue);


    const lastUpdate = useRef(null);
    const debounceTimer = useRef(null);

    // ---------- POSITION LOGIC ----------
    const position = useMemo(() => {
        const pos = [...(data.position || [0, 0, 0])];
        pos[1] += 0.011;
        const rotationY = parseInt(THREE.MathUtils.radToDeg(data.rotation[2]));
        pos[1] += 0.05;

        if (rotationY > 90 && rotationY < 180){
            rotation[1] += Math.PI;
            pos[0] += 0.051;
        }
        if (rotationY > 0 && rotationY < 90) {
            rotation[1] += Math.PI/2;
            pos[2] += 0.028;
        }
        if (rotationY > -90 && rotationY <= 0){
            rotation[1] += Math.PI;
            pos[0] -= 0.051;
        }
        if (rotationY > -180 && rotationY <= -90) {
            pos[2] -= 0.028;
            rotation[1] -= Math.PI/2;
        }
        return pos;
    }, [data.position, data.rotation, rotation]);


    // ---------- LOAD IMAGE TEXTURE (original behavior preserved) ----------
    useEffect(() => {
        if (!texturePath) return;
        const loader = new THREE.TextureLoader();
        loader.load(
            texturePath,
            (tex) => {
                setImageTexture(tex);
            },
            undefined,
            (err) => console.warn("⚠️ Texture not found:", texturePath, err)
        );
    }, [texturePath]);

    // ---------- MERGE / TOGGLE CODE ----------
    const mergeCode = (prevDisplay, newCode) => {
        if (!newCode || newCode.length < 3) return prevDisplay;

        const [posIndex, newValue] = [parseInt(newCode[0]), newCode.slice(1)];
        if (isNaN(posIndex) || posIndex < 1 || posIndex > 5) return prevDisplay;

        const parts = prevDisplay.split("-");
        const currentValue = parts[posIndex - 1];

        if (currentValue === newValue) {
            parts[posIndex - 1] = "##";
            lastUpdate.current = { id: tokenCode.id, isActive: true };

        } else {
            parts[posIndex - 1] = newValue;
            lastUpdate.current = { id: tokenCode.id, isActive: false };

        }

        return parts.join("-");
    };



    // ---------- DOUBLE CLICK HANDLER ----------
    const handleDoubleClick = () => {
        const pColor = uColor?.name || "";

        if (tokenCode?.code && data.symbol.includes(pColor.toLowerCase()) && (tokenCode.color === null ||  data.symbol.includes(tokenCode.color))) {
            const newCode = tokenCode.code; // e.g. "3AC"
            setDisplayCode((prev) => mergeCode(prev, newCode));

        }
    };

    // ---------- DEBOUNCED ITEM DICTIONARY UPDATE ----------
    useEffect(() => {
        if (!lastUpdate.current) return;
        const { id: updateId, isActive } = lastUpdate.current;

        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            const existingItem = itemsDictionary[updateId];
            if (!existingItem) return;

            setItemsDictionary({
                ...itemsDictionary,
                [updateId]: { ...existingItem, active: isActive },
            });
            lastUpdate.current = null;
        }, 150); // debounce 150ms

        setTokenCode({id:tokenCode.id ,code: tokenCode.code, color: tokenCode.color,codeValue: displayCode})

        setTerminalMessage({ command: "", message: `You successfully unlocked ${tokenCode.code} of the key` });

        socket.emit("tokenCodeUpdate", {clientId: clientId, tokenCode: displayCode, gameId: gameId, id: tokenCode.id});


    }, [
        clientId,
        displayCode,
        gameId,
        itemsDictionary,
        setItemsDictionary,
        setTerminalMessage,
        setTokenCode,
        tokenCode.code,
        tokenCode.color,
        tokenCode.id,
    ]);




    // ---------- MATERIAL & GEOMETRY (stable references) ----------
    const materialRef = useRef(
        new THREE.MeshBasicMaterial({
            transparent: false,
            alphaTest: 0.5,
            // depthWrite: true,
            // depthTest: true,
            side: THREE.DoubleSide,
            map: imageTexture,
        })
    );

    useEffect(() => {

        materialRef.current.map = imageTexture;
        materialRef.current.needsUpdate = true;
    }, [imageTexture]);

    if (!materialRef.current) return null;

    // ---------- RENDER ----------
    return (
        <RigidBody type="fixed" colliders={false} sensor key={`token_${id}`}>
            <mesh
                position={position}
                rotation={rotation}
                name={data.symbol}
                onDoubleClick={handleDoubleClick}
                geometry={SHARED_GEOMETRY}
                material={materialRef.current}
            />
            <CuboidCollider
                args={[5 * 0.0075, 5 * 0.0075, 0.001]}
                position={position}
                sensor
            />
        </RigidBody>
    );
});
