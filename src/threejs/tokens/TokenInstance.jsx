import { useEffect, useState, useMemo, useRef } from "react";
import * as THREE from "three";

import useGame from "../../hooks/useGame.tsx";
import InstancedCoins from "./InstancedCoins.jsx";
import CollectibleMeshesFromInstanceData from "./CollectibleMeshesFromInstanceData.jsx";
import {socket} from "../../socket.js";
import { clearLandingTilePositions, setLandingTilePositions } from "../infiniteWorld/landingTileStore.js";

const SYMBOL_COLORS = ["blue", "red"];
const SYMBOL_PREFIXES = ["alep", "bet", "dalet", "giml", "he"];
const KEY_COLORS = ["red", "green", "yellow", "blue"];
const COMBINED_SYMBOLS = SYMBOL_PREFIXES.flatMap(prefix =>
    SYMBOL_COLORS.map(color => `${prefix}_${color}_tile`)
);

const BASE_TOKEN_LIST = [
    { type: "treasure", subtype: "key", category: "keys", collectable: true, image: null, count: 4, colors: KEY_COLORS },
    { collectable: true, type: "treasure", subtype: "invisible", category: "invisible", image: "invisible.png", count: 4 },
    { collectable: true, type: "treasure", subtype: "health", category: "health", image: "health.png", count: 4 },
    { collectable: true, type: "treasure", subtype: "energy", category: "energy", image: "energy.png", count: 20 },
    { collectable: false, type: "treasure", subtype: "trap", category: "trap", image: "trap.png", count: 2 },
    { collectable: false, type: "treasure", subtype: "checkpoint", category: "checkpoint", image: "checkpoint.png", count: 1 },
    { collectable: true, type: "accessKey", subtype: "accessKey", category: "accessKey", image: null, count: 10, symbol: COMBINED_SYMBOLS },
];

const TOKEN_IMAGES = BASE_TOKEN_LIST
    .filter((token) => token.image)
    .map((token) => ({ image: token.image, type: token.type, category: token.category }));

const textureLoader = new THREE.TextureLoader();
const texturePromiseCache = new Map();

const loadTokenTexture = (image) => {
    if (!image) return Promise.resolve(null);
    const url = `./icons/${image}`;
    if (!texturePromiseCache.has(url)) {
        texturePromiseCache.set(
            url,
            new Promise((resolve) => {
                textureLoader.load(
                    url,
                    resolve,
                    undefined,
                    (err) => {
                        console.error(`Failed to load texture ${image}:`, err);
                        resolve(null);
                    }
                );
            })
        );
    }
    return texturePromiseCache.get(url);
};

const getInstanceDataSignature = (items = []) =>
    items
        .map((item) => {
            const p = item?.position || [];
            return `${item?.key}:${p[0] ?? ""}:${p[1] ?? ""}:${p[2] ?? ""}:${item?.worldIndex ?? ""}`;
        })
        .join("|");

const getTokenPositionsSignature = (positions = {}) =>
    Object.keys(positions)
        .sort()
        .map((category) => `${category}:${getInstanceDataSignature(positions[category] || [])}`)
        .join(";");

const getLevelCode = (gameId, selectedLevel) => {
    const projectLevelMatch = /_L(\d+)$/i.exec(String(gameId ?? ""));
    if (projectLevelMatch) return projectLevelMatch[1];
    return String(selectedLevel?.code ?? selectedLevel?.id ?? selectedLevel?.name ?? "");
};


export default function TokenInstance({ instanceData = [], size }) {
    const [coinTexture, setCoinTexture] = useState(null);
    const [textures, setTextures] = useState({});
    const [tokenPositions, setTokenPositions] = useState({});
    const [isTexturesLoaded, setIsTexturesLoaded] = useState(false);
    const tokenPositionsSignatureRef = useRef("");
    const instanceDataRef = useRef(instanceData);


    const gameId = useGame((s) => s.projectID);
    const buttonMode = useGame((s) => s.buttonMode);
    
    const selectedLevel = useGame((s) => s.selectedLevel);
    const alternateWorldIndex = useGame((s) => s.alternateWorldIndex);
    instanceDataRef.current = instanceData;

    const levelCode = useMemo(() => getLevelCode(gameId, selectedLevel), [gameId, selectedLevel]);
    const isAlternateWorldLevel = String(levelCode).replace(/^L/i, "") === "1";

    const tokenList = useMemo(
        () => {
            return [
            ...BASE_TOKEN_LIST,
            {
                type: "coin",
                image: "bitcoin.png",
                category: "coins",
                count: instanceData.length
            }
        ]},
        [instanceData.length]
    );

    useEffect(() => {
        let mounted = true;

        const texturePromises = [
            ...TOKEN_IMAGES.map((token) =>
                loadTokenTexture(token.image).then((texture) => ({ ...token, texture }))
            ),
            loadTokenTexture("bitcoin.png").then((texture) => ({ type: "coin", category: "coins", texture })),
        ];

        const keyPromises = KEY_COLORS.map((color) =>
            loadTokenTexture(`${color}_key.png`).then((texture) => ({ color, texture }))
        );

        Promise.all([Promise.all(texturePromises), Promise.all(keyPromises)]).then(([loadedTokenTextures, loadedKeyTextures]) => {
            if (!mounted) return;
            let loadedCoinTexture = null;
            const loadedTextures = {};

            loadedTokenTextures.forEach((token) => {
                if (!token.texture) return;
                if (token.type === "coin") {
                    loadedCoinTexture = token.texture;
                } else {
                    loadedTextures[token.category] = token.texture;
                }
            });

            loadedKeyTextures.forEach(({ color, texture }) => {
                if (!texture) return;
                loadedTextures.keys = {
                    ...(loadedTextures.keys || {}),
                    [color]: texture,
                };
            });

            setCoinTexture(loadedCoinTexture);
            setTextures(loadedTextures);
            setIsTexturesLoaded(true);
        });

        return () => {
            mounted = false;
        };
    }, []);


    const instanceDataSignature = useMemo(() => getInstanceDataSignature(instanceData), [instanceData]);

    useEffect(() => {
        setLandingTilePositions(instanceData);

        return () => {
            clearLandingTilePositions();
        };
    }, [instanceData, instanceDataSignature]);

    useEffect(() => {
  
        if (!instanceData.length || !gameId || buttonMode !=='Play mode') {
            if (tokenPositionsSignatureRef.current !== "") {
                tokenPositionsSignatureRef.current = "";
                setTokenPositions({});
            }
            return;
        }
        socket.emit('getTokenPosition', {
            gameId,
            instanceData: instanceDataRef.current,
            tokenList,
            level: levelCode,
            alternateWorld: isAlternateWorldLevel ? { worldCount: 9, visibleFraction: 0.25 } : null
        });

        const handleTokenPositions = (positions) => {
     
            const nextPositions = positions || {};
            const nextSignature = getTokenPositionsSignature(nextPositions);
            if (nextSignature === tokenPositionsSignatureRef.current) return;
            tokenPositionsSignatureRef.current = nextSignature;
            
            setTokenPositions(nextPositions);
        };

        const handleError = (error) => {
            console.error('Socket error:', error.message);
        };

        socket.on('tokenPositions', handleTokenPositions);
        socket.on('error', handleError);

        return () => {
            socket.off('tokenPositions', handleTokenPositions);
            socket.off('error', handleError);
        };
    }, [gameId, instanceDataSignature, tokenList, levelCode, isAlternateWorldLevel,buttonMode]);


    const collectibleRenders = useMemo(() => {
        
        if (!isTexturesLoaded || buttonMode !=='Play mode') return [];
   
        return tokenList
            .filter((token) => token.type === "treasure")
            .map((token) => {

                const { category, subtype, collectable } = token;
                const instanceDataLocal = tokenPositions[category] || [];
                const textureObj = textures[category];
               
                
                if (!instanceDataLocal.length || !textureObj) return null;

                return (
                    <CollectibleMeshesFromInstanceData
                        key={subtype}
                        token={token}
                        collectable={collectable}
                        type={subtype}
                        instanceData={instanceDataLocal}
                        textures={category === "keys" || category === "access" ? textureObj : undefined}
                        texture={category !== "keys" ? textureObj : undefined}
                        size={size}
                    />
                );
            })
            .filter(Boolean);
         
    }, [tokenList, tokenPositions, textures, size, isTexturesLoaded,buttonMode]);

    // const shouldRenderCoins = useMemo(
    //     () =>
    //         isTexturesLoaded &&
    //         !!coinTexture &&
    //         !!(tokenPositions.coins?.length > 0),
    //     [coinTexture, tokenPositions, isTexturesLoaded]
    // );

    // const visibleCoins = useMemo(() => {
    //     const coins = tokenPositions.coins || [];
    //     if (!isAlternateWorldLevel) return coins;
    //     return coins.filter((coin) => Number(coin?.worldIndex) === alternateWorldIndex);
    // }, [alternateWorldIndex, isAlternateWorldLevel, tokenPositions.coins]);

    return (
        <>
            {/* {shouldRenderCoins && visibleCoins.length > 0 && (
                <InstancedCoins
                    size={size}
                    coinTexture={coinTexture}
                    instanceData={visibleCoins}
                    gameId={gameId}
                    alternateWorld={isAlternateWorldLevel ? { worldIndex: alternateWorldIndex, worldCount: 9 } : null}
                    // onCollision={handleCollisionEnter}
                />
            )} */}
            {collectibleRenders}

        </>
    );
}
