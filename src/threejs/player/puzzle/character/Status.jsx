import { Html } from "@react-three/drei";
import { memo, useEffect, useRef } from "react";
import { useGame1 } from "../../../../hooks/useGame1";
import * as THREE from "three";
import useGame from "../../../../hooks/useGame";
import { enPc} from "./Constants.jsx";
import {useFrame} from "@react-three/fiber";

function Status({ userName, characterModel }) {
    // --- refs for internal math ---
    const hpRef = useRef(100);

    const eBar = useRef(null);
    const inBar = useRef(null);

    // --- store & actions ---
    const curAnimation = useGame1((state) => state.curAnimation);
    const droppedToken = useGame((state) => state.droppedToken);
    const setInvisible = useGame((state) => state.setInvisible);

    const setHp = useGame((state) => state.setHp);
    const hp = useGame((state) => state.hp);
    const setHasDied = useGame((state) => state.setHasDied);
    const setTerminalMessage = useGame((state) => state.setTerminalMessage);
    const hasDied = useGame((state) => state.hasDied);


    //
    const updateEnergyUI = () => {

        if(!eBar.current || !inBar.current ) return;

        if(enPc.current <= 20  ) {
            eBar.current.classList.add("is-empty");
        }
        else{
            eBar.current.classList.remove("is-empty");
        }
        if(inBar.current){
            inBar.current.style.width = `${enPc.current}%`;
        }
    };

    useFrame(() => {
        if(!eBar.current || !inBar.current ) return;

        if(enPc.current <= 20  ) {
            eBar.current.classList.add("is-empty");
        }
        else{
            eBar.current.classList.remove("is-empty");
        }
        if(inBar.current){
            inBar.current.style.width = `${enPc.current}%`;
        }
    })




    // --- energy drain over time ---
    useEffect(() => {
        let timer;
        const updateEnergy = () => {
            enPc.current = Math.max(0, enPc.current - 1 );
            updateEnergyUI();
            if (enPc.current > 0 && curAnimation === "Run") {
                timer = setTimeout(updateEnergy, 500);
            }
        };

        if (curAnimation === "Run") {
            timer = setTimeout(updateEnergy, 1000);
        }
        return () => clearTimeout(timer);
    }, [curAnimation]);


    // --- helpers for materials ---
    const makeModelTranslucent = (root, toOpacity = 0.15) => {
        if (!root) return;
        root.traverse((obj) => {
            if (!(obj.isMesh || obj.isSkinnedMesh) || !obj.material) return;
            if (!obj.userData.__origMat) obj.userData.__origMat = obj.material;

            const setProps = (m) => {
                const clone = m.clone();
                clone.transparent = true;
                clone.opacity = toOpacity;
                clone.depthWrite = false;
                clone.alphaTest = 0;
                clone.side = THREE.FrontSide;
                return clone;
            };
            obj.material = Array.isArray(obj.material)
                ? obj.material.map(setProps)
                : setProps(obj.material);
        });
    };

    const restoreModelMaterials = (root) => {
        if (!root) return;
        setInvisible(false);
        root.traverse((obj) => {
            if (!(obj.isMesh || obj.isSkinnedMesh)) return;
            const disposeMat = (m) => m?.dispose?.();
            if (obj.userData.__origMat) {
                const current = obj.material;
                Array.isArray(current) ? current.forEach(disposeMat) : disposeMat(current);
                obj.material = obj.userData.__origMat;
                delete obj.userData.__origMat;
            }
        });
    };

    // --- apply droppedToken effects ---
    useEffect(() => {
        if (!droppedToken || !characterModel) return;
        let timeoutId;

        switch (droppedToken.type) {
            case "invisible": {
                makeModelTranslucent(characterModel, 0.15);
                setInvisible(true);
                timeoutId = setTimeout(() => {
                    restoreModelMaterials(characterModel);
                    setInvisible(false);
                }, 30000);
                break;
            }
            case "health": {
                hpRef.current = Math.min(100, hpRef.current + 35);
                setHp(hpRef.current);
                break;
            }
            case "energy": {

                enPc.current = Math.min(100, enPc.current + 20);
                // updateEnergyUI();
                break;
            }
            case "trap": {
                const prevHp = hpRef.current;
                const newHp = Math.max(0, prevHp - 20);
                hpRef.current = newHp;
                setHp(newHp);

                if (newHp ===0) {

                    setHasDied(true);
                    //setNoOfLivesRemaining(noOfLivesRemaining - 1)
                }
                setTerminalMessage({
                    command: "",
                    message: `Trap triggered! -20% HP. Current HP: ${hpRef.current}%`,
                });
                break;
            }
        }



        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                restoreModelMaterials(characterModel);
                setInvisible(false);
            }
        };
    }, [droppedToken, hasDied]);

    return (
        <Html
            transform
            sprite
            distanceFactor={0.1}
            position={[0, 0.11, 0]}
            zIndexRange={[100, 0]}
            className="stat-ui"
            style={{ pointerEvents: "none", willChange: "transform" }}
        >
            <div className="stat-bars">
                <div className="stat-name" title={userName}>
                    {userName}
                </div>

                <div className={`stat-bar stat-bar--health ${hp <= 20 ? "is-empty" : ""}`}>
                    <div className="stat-bar__fill" style={{ width: `${hp}%` }} />
                </div>

                <div ref={eBar} className={`stat-bar stat-bar--energy`}>
                    <div ref={inBar} className="stat-bar__fill"  />
                </div>
            </div>
        </Html>
    );
}

export default memo(Status);

