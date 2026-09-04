import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Box3 } from "three";
import * as THREE from "three";
import Instances from "./Instances";
import PlaceHolder from "./PlaceHolder";
import TreasureToken from "./treasure/TreasureToken";
import useGame from "../hooks/useGame";
import TemplateInstances from "./TemplateInstances";
import AnimatedInstance from "./puzzle/AnimatedInstance";
import AnimatedAsset from "./AnimatedAsset";
import { readDslAnimations } from "./dslAnimationRuntime";
import { objects, sceneAssets,assetCommands } from "./player/puzzle/character/Constants.jsx";
import IndividualAssetsComponent from "./IndividualAssetsComponent";

const GAMEPLAY_COLLISION_BOXES_KEY = "gameplayCollisionBoxes";

const shouldRegisterGameplayCollision = (name = "") => {
    const lowerName = String(name || "").toLowerCase();
    return ![
        "location",
        "character",
        "coin",
        "ocean",
        "water",
        "label",
        "text",
        "path",
        "route",
        "arrow",
        "teleport",
        "ceiling light",
    ].some((token) => lowerName.includes(token));
};

const registerGameplayCollisionBox = (scene, box, metadata = {}) => {
    if (!scene || !box || box.isEmpty?.()) {
        return;
    }

    if (!Array.isArray(scene.userData[GAMEPLAY_COLLISION_BOXES_KEY])) {
        scene.userData[GAMEPLAY_COLLISION_BOXES_KEY] = [];
    }

    scene.userData[GAMEPLAY_COLLISION_BOXES_KEY].push({
        box: box.clone(),
        ...metadata,
    });
};

const clearGameplayCollisionBoxesForKey = (scene, cleanKey) => {
    const boxes = scene?.userData?.[GAMEPLAY_COLLISION_BOXES_KEY];
    if (!Array.isArray(boxes)) {
        return;
    }

    scene.userData[GAMEPLAY_COLLISION_BOXES_KEY] = boxes.filter((collision) => collision?.cleanKey !== cleanKey);
};

export default function R3fInstancePattern({
    fbx,
    assets,
    name,
    floors,
    properties,
    fileName,
    defaultColor,
    id,
    cleanKey,
    renderKey,
    commandOverlay = false,
    cellKey,
    registerGlobalInstances = true,
    visible
}) {
    const { scene } = useThree();
    const projectId = useGame((state) => state.projectID);
    const setTotalCoins = useGame((state) => state.setTotalCoins);
    const isPuzzleGame = useGame((state) => state.isPuzzleGame);
    const setDoorList = useGame((state) => state.setDoorList);
    const object = useMemo(
        () => (fbx.animations.length > 0 && isPuzzleGame
            ? fbx.clone()
            : fbx.children[0]?.children[0]?.clone() || fbx.children[0]?.clone() || fbx.clone()),
        [fbx, isPuzzleGame]
    );
    const deleteId = useGame((state) => state.deleteId);
    const safeName = String(cleanKey);
    const mountedInstanceKeysRef = useRef([]);
    const componentKeyBase = `${projectId}_${renderKey ?? safeName}_${id ?? cleanKey ?? fileName ?? "asset"}`;
    const geometry = useMemo(() => object.geometry, [object]); // new THREE.BoxGeometry(1, 1, 1);
    const dslAnimations = useMemo(() => readDslAnimations(properties), [properties]);



    const material = useMemo(() => {
        if (!safeName.includes("Key_Asset")) {
            return object.material
        }

        const mat = Array.isArray(object.material)
            ? object.material.map((item) => item?.clone?.() ?? item)
            : object.material?.clone?.() ?? object.material;

        if (Array.isArray(mat)) {
            return mat.map((item) => {
                if (!item) return item;
                item.transparent = true;
                item.opacity = 0.2;
                return item;
            });
        }

        // mat.vertexColors = true;          // enable per-instance color control
        mat.transparent = true;           // allow alpha
        mat.opacity = 0.2;                // default full opacity
        return mat;

    }, [object, safeName]);

    const [createInstances, setCreateInstances] = useState([]); // Array to store createInstances
    const [individualInstances, setIndividualInstances] = useState([]); // Array to store createInstances
    const cleanupOwnedSceneAssets = (instanceKeys) => {
        instanceKeys.forEach((instanceKey) => {
            const entry = sceneAssets[instanceKey];
            if (!entry || entry.name !== safeName) {
                return;
            }

            entry.object?.parent?.remove?.(entry.object);
            delete sceneAssets[instanceKey];
        });
    };

    const getBoundingBoxSize = (model) => {
        const boxDims = new Box3().setFromObject(model);
        return {
            width: (boxDims.max.x - boxDims.min.x) / 2,
            height: (boxDims.max.y - boxDims.min.y) / 2,
            length: (boxDims.max.z - boxDims.min.z) / 2,
        };
    };
    const size = useMemo(() => getBoundingBoxSize(object), [object]);
    const extractAngle = (angle) => {
        try {
            const obj = JSON.parse(angle);
            if (typeof obj === "object" && obj !== null) {
                return obj;
            }
        } catch (error) {
            // console.log(error)
            // If parsing fails, return default
        }
        return { x: 0, y: angle || 0, z: 0 };
    };

    // Calculate total coins directly from assets
    const totalCoins = useMemo(() => assets.filter(() =>
        safeName.toLowerCase().includes("coin")
    ).length, [assets, name])
    useEffect(() => {
        cleanupOwnedSceneAssets(mountedInstanceKeysRef.current);
        clearGameplayCollisionBoxesForKey(scene, safeName);
        mountedInstanceKeysRef.current = [];
        setCreateInstances([]); // Clear the instances
        setIndividualInstances([])
        const { width: halfWidth, height: halfHeight, length: halfLength } = size;
        const initialQuaternion = object.quaternion;
        const pivotBox = new Box3().setFromObject(object);
        const instances = new Map();
        const individualInstances = new Map();
        const specialInstances = [619914, 622772, 622770, 620578, 623632, 622984];
    
        const liveKeys = new Set();
        for (const asset of assets) {
            const { fields } = asset;

            const instanceKey = asset._raw?.instance_id || asset.instanceId || asset.instance_id;
            const renderInstanceKey = asset.cloneKey
                || asset.worldCloneKey
                || asset._raw?.clone_key
                || asset._raw?.world_clone_key
                || instanceKey;
       
            if (instanceKey) {
                liveKeys.add(String(renderInstanceKey));
                mountedInstanceKeysRef.current.push(String(renderInstanceKey));
            }

            if (instanceKey === 623624) continue;
              if(safeName.includes('Teleport') || safeName.includes('Cylindrical Rings')|| safeName.includes('LED Display 20x10x1 ')|| safeName.includes('Colored black Squares')
                || safeName.includes('Ceiling Lights')){
             
               continue
           }

            if (!instanceKey || instanceKey == 0) continue;
            const x = parseFloat(fields["X-pos"]?.value) || 0;
            const y = parseFloat(fields["Y-pos"]?.value) || 0;
            const z = parseFloat(fields["Z-pos"]?.value) || 0;

            
            const hAlign = fields["v-align"]?.value
            const vAlignValue = hAlign === "top" ? 0.1 : hAlign === "center" ? 0.05 : 0

            const settings = fields["Settings"]?.value
            const angle = extractAngle(fields["Angle"]?.value || "");
            const floor = fields["Floor"]?.value
                ? parseInt(fields["Floor"]?.value.split(" ")[1])
                : 0;

            const angleX = THREE.MathUtils.degToRad(angle.x);
            const angleY = THREE.MathUtils.degToRad(angle.y);
            const angleZ = THREE.MathUtils.degToRad(angle.z);
            const yAxis = new THREE.Vector3(0, 0, 1);
            const zAxis = new THREE.Vector3(0, 1, 0);

            const quaternionX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
            const quaternionY = new THREE.Quaternion().setFromAxisAngle(yAxis, angleY);
            const quaternionZ = new THREE.Quaternion().setFromAxisAngle(zAxis, angleZ);

            const finalQuaternion = new THREE.Quaternion();
            const xzQuaternion = new THREE.Quaternion();
            const initialAndYQuaternion = new THREE.Quaternion().multiply(quaternionY);

            initialAndYQuaternion.multiplyQuaternions(initialQuaternion, quaternionY);
            xzQuaternion.multiplyQuaternions(quaternionX, quaternionZ);
            finalQuaternion.multiplyQuaternions(initialAndYQuaternion, xzQuaternion);
            // finalQuaternion.multiply(quaternionY)
            const hexColor = material?.color?.getHexString();
            const absScale = object.scale.clone();
            const width = fields["Width"]?.value || 0;
            const length = fields["Length"]?.value || 0;
            const height = fields["Height"]?.value || 0;

            const l = length ? length / 20 : halfLength;
            const w = width ? width / 20 : halfWidth;
            floors[floor] = { name: `Floor ${floor}`, code: floor };
            const defColor = defaultColor || `#${hexColor}`;

            const color =  fields["Color"]?.value === undefined ? defColor : fields["Color"]?.value;

            // const position = isNaN(projectId) ? new THREE.Vector3(parseFloat(x) , parseFloat(z), parseFloat(y) ).multiplyScalar(0.01) : 
            //                                      new THREE.Vector3(parseFloat(x) + w , parseFloat(z), parseFloat(y) + l ).multiplyScalar(0.01);

            const isNumericLike = !isNaN(projectId) || /_L\d+$/i.test(String(projectId));

                    const position = isNumericLike
                    ? new THREE.Vector3(
                        parseFloat(x) + w,
                        parseFloat(z),
                        parseFloat(y) + l
                        ).multiplyScalar(0.01)
                    : new THREE.Vector3(
                        parseFloat(x),
                        parseFloat(z),
                        parseFloat(y)
                        ).multiplyScalar(0.01);

           
            ///const va = hAlign || 'bottom';           // default to bottom like your examples
         

       //assetCommands.current += `placeObjectArea ${cleanKey} (1,1), pos(${(position.x * 100).toFixed(1)},${(position.y* 100).toFixed(1)},${(position.z* 100).toFixed(1)}), angle(${angle.x},${angle.y},${angle.z}), vAlign(${va}), color(${color}), length(${length || 0}), height(${height || 0}), width(${width || 0})\n `
            
            if (safeName.toLowerCase().includes('key')) {
              
                // position.z += 0.03
                 position.y += 0.05
                // position.x -= 0.1
                  //console.log(position)
            }

          
          if (width > 0) {
                let xFactor = 1;
                if (parseFloat(width) > 0) {
                    xFactor = parseFloat(width) / 10 / (pivotBox.max.x - pivotBox.min.x);
                    absScale.y = xFactor;
                }
            }

            if (height > 0) {
                let yFactor = 1;
                if (parseFloat(height) > 0) {
                    yFactor = parseFloat(height) / 10 / (pivotBox.max.y - pivotBox.min.y);
                    absScale.z = yFactor;
                }
            }
            absScale.multiplyScalar(0.01);
         
   
            

            const euler = new THREE.Euler();
            euler.setFromQuaternion(finalQuaternion, "XYZ");
            const collisionMatrix = new THREE.Matrix4();
            const collisionBox = new THREE.Box3().copy(pivotBox);
            collisionMatrix.compose(position, finalQuaternion, absScale);
            collisionBox.applyMatrix4(collisionMatrix);

            if (shouldRegisterGameplayCollision(safeName)) {
                registerGameplayCollisionBox(scene, collisionBox, {
                    instanceId: instanceKey,
                    cloneKey: renderInstanceKey,
                    name: safeName,
                    cleanKey: safeName,
                });
            }
            
            objects[safeName] = {
                object,
                name: safeName,
                categoryIndex: asset._raw?.category_index || asset.category_index || asset.category,
                halfWidth,
                halfHeight,
                halfLength,
                assetID: asset._raw?.asset_id || asset?.assetId || asset?.asset_id,
                scale: absScale,
                vAlignValue,
                color,
                fileName,
                defaultColor,
                id
            };
            // console.log(asset._raw.category_index)
            if (specialInstances.includes(instanceKey) || safeName.includes('Wall_Glass_Door')) {
                const object = fbx;
                individualInstances.set(renderInstanceKey, {

                    key: renderInstanceKey,
                    instanceId: instanceKey,
                    instance_id: instanceKey,
                    cloneKey: renderInstanceKey,
                    worldCloneShift: asset.worldCloneShift || asset._raw?.world_clone_shift,
                    position: [position.x, position.y, position.z],
                    rotation: [angleX, angleY, angleZ],
                    scale: absScale,
                    settings,
                    vAlignValue,
                    color,
                    object,
                    halfLength,
                    halfHeight,
                    halfWidth,
                    name: safeName,
                    userData: {
                        name: `${safeName}`,
                        instance_id: `${instanceKey}`,
                        cloneKey: `${renderInstanceKey}`,
                        worldCloneShift: asset.worldCloneShift || asset._raw?.world_clone_shift,
                        //    Properties: properties && properties !== "" ? JSON.parse(properties) : {},
                        length: (halfLength * 2) / 100,
                        height: (halfHeight * 2) / 100,
                        width: (halfWidth * 2) / 100,
                        rotation: euler,
                        position,
                    },
                });

            }
            else {

                instances.set(renderInstanceKey, {
                    key: renderInstanceKey,
                    instanceId: instanceKey,
                    instance_id: instanceKey,
                    cloneKey: renderInstanceKey,
                    worldCloneShift: asset.worldCloneShift || asset._raw?.world_clone_shift,
                    position: [position.x, position.y, position.z],
                    rotation: [euler.x, euler.y, euler.z],
                    scale: absScale,
                    settings,
                    vAlignValue,
                    color,
                    halfLength,
                    halfHeight,
                    halfWidth,
                    name: safeName,
                    cleanKey: safeName,
                    userData: {
                        name: `${safeName}`,
                        instance_id: `${instanceKey}`,
                        cloneKey: `${renderInstanceKey}`,
                        worldCloneShift: asset.worldCloneShift || asset._raw?.world_clone_shift,
                        //    Properties: properties && properties !== "" ? JSON.parse(properties) : {},
                        length: (halfLength * 2) / 100,
                        height: (halfHeight * 2) / 100,
                        width: (halfWidth * 2) / 100,
                        rotation: euler,
                        position,
                    },
                });
            }



            // existingKeys.add(instanceKey);
            const previousSceneAsset = sceneAssets[renderInstanceKey];
            if (previousSceneAsset?.object) {
                previousSceneAsset.object.parent?.remove?.(previousSceneAsset.object);
            }

            const hFbx = fbx.animations.length > 0 ? fbx.clone(true) : fbx.children[0]?.clone(true);
            hFbx.scale.multiplyScalar(0.01003);


            sceneAssets[renderInstanceKey] = {
                position,
                originalInstanceId: instanceKey,
                cloneKey: renderInstanceKey,
                worldCloneShift: asset.worldCloneShift || asset._raw?.world_clone_shift,
                instance: null,
                index: 0,
                length: l,
                width: w,
                angle: angle.y,
                fAngle: angle.y,
                quarternion: finalQuaternion,
                quart: finalQuaternion,
                scale: absScale,
                axis: new THREE.Vector3(0, 1, 0),
                object: hFbx,
                instanceData: null,
                floor: floor,
                labelId: null,
                name: safeName,
                vAlignValue,
                categoryIndex: asset._raw?.category_index || asset.category_index || asset.category,
                inUse: fields["Status"]?.value === "In Use",
                statusFieldId: fields["Status"]?.fieldId,
                halfHeight,
                halfLength,
                halfWidth,
                assetID: asset._raw?.asset_id || asset?.asset_id || asset?.assetId,
                color,
                fileName
            };

        }
       
      
        if (safeName.includes('Wall_Glass_Door')) {

            setDoorList(Array.from(individualInstances.values()))

        }
        const instanceData = Array.from(instances.values())

        setCreateInstances(instanceData)


        setIndividualInstances(Array.from(individualInstances.values()))

        return () => {
            setCreateInstances([]); // Clear the instances
            setIndividualInstances([])

            if (safeName.includes('Wall_Glass_Door')) {
                setDoorList([]);
            }

            cleanupOwnedSceneAssets(mountedInstanceKeysRef.current);
            clearGameplayCollisionBoxesForKey(scene, safeName);
            mountedInstanceKeysRef.current = [];
            delete objects[safeName];
        };

    }, [safeName, fbx, assets, projectId, defaultColor, fileName, id, cleanKey, renderKey, setDoorList, size, object, material, scene])// Added assets as a dependency

    // Update totalCoins in the global state
    useEffect(() => {


        if (safeName.toLowerCase().includes("coin")) {
            setTotalCoins(totalCoins);
        }


    }, [totalCoins, setTotalCoins, safeName]);

    const instancesD = useMemo(() => {

        if (fbx.animations?.length === 0) return [];


        return createInstances.map((data, i) => {
            const obj = object;
            const clonedAnimations = obj.animations.map(anim => ({
                ...anim,
                name: `${safeName}_${i}_${anim.name}`, // Unique name per instance and animation
            }));
            return {
                key: `${safeName}_${i}`,
                data,
                name: safeName,
                object: obj,
                animations: clonedAnimations,
            };
        });



    }, [createInstances, name, object.animations]);


    // delete instance
    useEffect(() => {
        if (!deleteId) {
            return;
        }

        setCreateInstances((currentInstances) => {
            if (!currentInstances.some((item) => item.key === deleteId)) {
                return currentInstances;
            }

            return currentInstances.filter((item) => item.key !== deleteId);
        });
    }, [deleteId]);



    return (
        <Fragment
            key={`${safeName}-fragment`}
        >

            {createInstances.length && safeName.toLowerCase().includes("game_box") && (
                <Instances
                    key={`${componentKeyBase}_gamebox`}

                    object={object}
                    name={safeName}
                    createInstances={createInstances}
                />
            )}

            {createInstances.length && safeName.toLowerCase().includes("key_asset") && (
                <TreasureToken
                    key={`${componentKeyBase}_treasure`}
                    object={object}
                    name={safeName}
                    createInstances={createInstances}
                />
            )}

            {createInstances.length && safeName.toLowerCase().includes("place_holder") && (
                <PlaceHolder
                    key={`${componentKeyBase}_placeholder`}
                    object={object}
                    name={safeName}
                    createInstances={createInstances}
                    cellKey={cellKey}
                />
            )} 
        

                <>
                    {createInstances.length && fbx.animations?.length === 0 &&
                        !safeName.toLowerCase().includes("moving") &&
                         !safeName.toLowerCase().includes("game_box") &&
                        !safeName.toLowerCase().includes("place_holder") &&
                         !safeName.toLowerCase().includes("key_asset") &&
                        <>
                            <TemplateInstances
                                key={`${componentKeyBase}_templAssets`}
                                instanceData={createInstances}
                                geometry={geometry}
                                material={material}
                                name={safeName}
                                object={fbx}
                                size={size}
                                id={id}
                                animations={dslAnimations}
                                cellKey={cellKey}
                                registerGlobalInstances={registerGlobalInstances}
                                visible={visible}
                            />

                        </>
                    }
                    <IndividualAssetsComponent
                        key={`${componentKeyBase}_indivAssets`}
                        instanceData={individualInstances}
                    />
                    {/* {
                        safeName.toLowerCase().includes("moving") && (

                            <AnimatedAsset
                                key={`${componentKeyBase}_animAssets`}
                                instanceData={createInstances}
                                object={fbx}
                                name={safeName}
                            />
                        )

                    } */}

                    <AnimatedInstance
                        instanceData={instancesD}
                        key={`${componentKeyBase}_animatedInstances`}
                    />
                </>
           
        </Fragment>
    );
}

