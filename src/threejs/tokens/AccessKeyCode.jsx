import React, { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../../socket";
import useGame from "../../hooks/useGame";
import AccessKeyPlane from "./AccessKeyPlane.jsx";
import AccessCodePlane from "./AccessCodePlane.jsx";

export default function AccessKeyCode({ size, instanceData }) {
    const gameId = useGame((s) => s.projectID);

    // ✅ Local states (lightweight)
    const [accessKey, setAccessKey] = useState([]);
    const [accessCode, setAccessCode] = useState([]);

    // ✅ Keep latest gameId in ref (avoid stale closures in socket callbacks)
    const gameIdRef = useRef(gameId);
    useEffect(() => {
        gameIdRef.current = gameId;
    }, [gameId]);

    // ✅ Precomputed symbol list (runs once per instance length change)
    const tokenList = useMemo(() => {
        const colors = ["blue", "red"];
        const symbols = ["alep", "bet", "dalet", "giml", "he"];

        const combinedSymbols = symbols.flatMap((prefix) =>
            colors.map((color) => `${prefix}_${color}_wall`)
        );

        return [
            {
                collectable: false,
                type: "accessCode",
                subtype: "accessCode",
                category: "accessCode",
                image: null,
                count: 10,
                symbol: combinedSymbols,
            },
        ];
    }, []);

    // ✅ Request AccessCode positions once all deps are ready
    useEffect(() => {
        if (!instanceData.length || !gameId) return;
        socket.emit("getAccessCodePosition", { gameId, instanceData, tokenList });
    }, [gameId, tokenList, instanceData]);

    // ✅ Setup socket listeners ONCE (refs prevent rebinds)
    useEffect(() => {
        const handleAccessKeySpawn = ({ key, pId }) => {
            if (!key || pId !== gameIdRef.current) return;
            // Update only if key changed — prevents redundant re-renders
            setAccessKey((prev) => (prev !== key ? key : prev));
        };

        const handleAccessCodeSpawn = ({ accessCode, pId }) => {
            if (!accessCode || pId !== gameIdRef.current) return;
            setAccessCode((prev) => (prev !== accessCode ? accessCode : prev));
        };

        socket.on("accessKeySpawn", handleAccessKeySpawn);
        socket.on("accessCodeSpawn", handleAccessCodeSpawn);

        return () => {
            socket.off("accessKeySpawn", handleAccessKeySpawn);
            socket.off("accessCodeSpawn", handleAccessCodeSpawn);
        };
    }, []);

    // ✅ Precompute rendered elements (no inline map in render)
    const accessKeyElements = useMemo(
        () =>
            accessKey.map((key) => (
                <AccessKeyPlane
                    key={key.key}
                    data={key}
                    rotation={[Math.PI / 2, Math.PI , 0]}
                    size={{ width: size.width, length: size.length }}
                    texturePath={`./icons/${key.symbol}.png`}
                    collectable
                    id={key.key}
                    rToken={key}
                />
            )),
        [accessKey, size]
    );

    const accessCodeElements = useMemo(
        () =>
            accessCode.map((code) => (
                <AccessCodePlane
                    key={code.key}
                    data={code}
                    rotation={[0, -Math.PI / 2, 0]}
                    wall
                    size={{ width: size.height, length: size.length }}
                    texturePath={`./icons/${code.symbol}.png`}
                    id={code.key}
                />
            )),
        [accessCode, size]
    );

    return (
        <>
            {accessKeyElements}
            {accessCodeElements}
        </>
    );
}
