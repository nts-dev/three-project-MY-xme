import * as THREE from 'three';
import { Box3, Vector3 } from 'three';
import { PointText3D } from "./scene/3DText";
import AnimationComponent from "./animations/AnimationComponent";
import AttachLabel from "./label/AttachLabel";
import { createBuildingLabelSprite, updateBuildingLabelSpriteLogo } from "./label/BuildingLabelSprite";
import Composite from './Composite';
import { applyDslAnimations, clearDslAnimations, readDslAnimations } from './dslAnimationRuntime';
import { isGeneratedAssetReference, normalizeSceneAssetName } from './generatedAssetPaths';

import {
    instanceMesh,
    locationData,
    locationPoints,
    objects,
    sceneAssets
} from "./player/puzzle/character/Constants.jsx";

const FONT_URL = `${import.meta.env.VITE_FILE_URL}/fonts/optimer_regular.typeface.json`; // reused
const GAMEPLAY_RAYCAST_COLLIDER_KEY = "gameplayRaycastCollider";
const MIN_GAMEPLAY_COLLIDER_HEIGHT = 0.15;

const makeCollisionMaterialDoubleSided = (material) => {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((item) => {
        if (!item || item.side === THREE.DoubleSide) {
            return;
        }

        item.userData = item.userData || {};
        if (item.userData.originalGameplayCollisionSide === undefined) {
            item.userData.originalGameplayCollisionSide = item.side;
        }
        item.side = THREE.DoubleSide;
        item.needsUpdate = true;
    });
};

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
        "road",
        "ground",
        "terrain",
        "map",
        "floor",
        "plane",
        "base",
    ].some((token) => lowerName.includes(token));
};

const buildBackendLogoUrl = (logoNameOrUrl) => {
    const value = String(logoNameOrUrl || "").trim();
    if (!value) return "";
    if (value.startsWith("data:") || value.startsWith("blob:")) {
        return value;
    }

    const apiBase = String(import.meta.env.VITE_API_URL || "")
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/api$/i, "");
    const cleanName = value
        .replace(/^https?:\/\/[^/]+\/.*?\/files\//i, "")
        .replace(/^https?:\/\/[^/]+\/files\//i, "")
        .replace(/^(\.\.\/)?files\//i, "")
        .replace(/^\/?(api\/)?files\//i, "")
        .replace(/^\/+/, "");
    const encodedPath = cleanName.split("/").map(encodeURIComponent).join("/");
    return apiBase ? `${apiBase}/files/${encodedPath}` : `/files/${encodedPath}`;
};

const applySavedBuildingLabelLogo = async ({ buildingLabel, fields, fallbackName, instanceId }) => {
    if (!buildingLabel || !instanceId) {
        return;
    }

    try {
        const logoUrl = buildBackendLogoUrl(`logo/${String(instanceId).trim()}.jpeg`);
        if (!logoUrl) {
            return;
        }

        await updateBuildingLabelSpriteLogo({
            sprite: buildingLabel,
            fields,
            fallbackName,
            logoUrl,
        });
    } catch (error) {
        console.warn("Failed to load saved building label logo:", error);
    }
};

const parseFloorCode = (value, fallback = 0) => {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    if (typeof value === "number" && !Number.isNaN(value)) {
        return Math.max(0, Math.trunc(value));
    }

    const normalized = String(value).trim();
    const prefixedMatch = normalized.match(/^Floor[_\s-]*(\d)/i);
    if (prefixedMatch) {
        return Math.max(0, parseInt(prefixedMatch[1], 10));
    }

    const numericMatch = normalized.match(/(\d+)/);
    if (numericMatch) {
        const digits = numericMatch[1];
        return Math.max(0, parseInt(digits.charAt(0), 10));
    }

    return fallback;
};

export default async function InstancedPattern(
    fbx,
    assets,
    name,
    scene,
    branch,
    projectID,
    composite,
    floors,
    dimensions,
    fileName,
    properties,
    category_index
) {
    const lowerName = String(name || "").toLowerCase();
    const generatedAsset = isGeneratedAssetReference(fileName);
    const cleanKey = normalizeSceneAssetName(fileName || name || "")
    const assetCommandLines = [];

   
    const loadLocation = (position, l,w, fields, angle, instancId, width, length) => {
        const fObject = fbx.clone();
        const baseChild = fObject.children[0];

        baseChild.layers.mask = 0;

        const mixer = new THREE.AnimationMixer(baseChild);
        const action = mixer.clipAction(fObject.animations[0]);
        action.enabled = true;
        action.play();

        fObject.rotation.y = THREE.MathUtils.degToRad(angle);
        fObject.position.copy(position);
        fObject.scale.set(0.01, 0.01, 0.01);
        scene.add(fObject);

        const info = fields['Info']?.value;
        const key = fields['Info']?.instance_id;
        const floor = parseFloorCode(fields['Floor']?.value, 0);
      

        const text3D = new PointText3D(info, FONT_URL, 0.2, 0xff0000, 0);
        text3D.setPosition(position.x - 0.50, position.y + 0.50, position.z);
        const threedText = text3D.getObject();

        scene.add(threedText);
        locationData.push({ text: threedText, mixer, pin: fObject });


        if (!locationPoints[floor]) {
            locationPoints[floor] = {
                key: floor,
                label: `Floor ${floor}`,
                data: '',
                icon: 'pi pi-fw pi-inbox',
                children: [{
                    key,
                    label: info,
                    data: instancId,
                    floor,
                    icon: 'pi pi-map-marker',
                }]
            };
        } else {
            locationPoints[floor].children.push({
                key,
                label: info,
                data: instancId,
                floor,
                icon: 'pi pi-map-marker',
            });
        }

        sceneAssets[instancId] = {
            position,
            halfHeight,
            halfWidth: width ? width / 20 :  halfWidth,
            halfLength: length ? length / 20 : halfLength,
            length: l,
            width: w,
            cleanKey,
        };


    };

    const makeElements = (fields) => {
        const qty = Number(fields['qtyHeight']?.value) || 0;
        const elements = new Array(qty);
        for (let i = 0; i < qty; i++) {
            elements[i] = {
                position: new Vector3(0, i / 10, 0),
                rotation: new Vector3(THREE.MathUtils.degToRad(90), 0, 0),
                scale: new Vector3(0.5, 1, 1)
            };
        }
        return elements;
    };

    const extractAngle = (angle) => {
        try {
            const obj = JSON.parse(angle);
            if (typeof obj === 'object' && obj !== null) {
                return obj;
            }
        } catch (e) {
            console.log(e);
        }
        return { x: 0, y: angle || 0, z: 0 };
    };

    const parseScaleAxis = (value, fallback, divisor = 1) => {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed / divisor : fallback;
    };

    const extractVectorScale = (scaleValue, fallbackScale, divisor = 1) => {
        if (!scaleValue) {
            return null;
        }

        if (typeof scaleValue === 'object') {
            return new Vector3(
                parseScaleAxis(scaleValue.x, fallbackScale.x, divisor),
                parseScaleAxis(scaleValue.y, fallbackScale.y, divisor),
                parseScaleAxis(scaleValue.z, fallbackScale.z, divisor)
            );
        }

        try {
            const obj = JSON.parse(scaleValue);
            if (typeof obj === 'object' && obj !== null) {
                return new Vector3(
                    parseScaleAxis(obj.x, fallbackScale.x, divisor),
                    parseScaleAxis(obj.y, fallbackScale.y, divisor),
                    parseScaleAxis(obj.z, fallbackScale.z, divisor)
                );
            }
        } catch (e) {
            console.log(e);
        }

        return null;
    };

    const isUnitFallbackScale = (scale) => (
        scale
        && Math.abs(scale.x - 1) < 0.000001
        && Math.abs(scale.y - 1) < 0.000001
        && Math.abs(scale.z - 1) < 0.000001
    );

    const rootChild = fbx.children[0] || fbx;
    const object = rootChild.children[0] ? rootChild.children[0] : rootChild;

    if (!THREE.Cache.enabled) {
        THREE.Cache.enabled = true;
    }

    const categoryObject = fbx.clone(true);
    if (categoryObject.children[0]) {
        categoryObject.children[0].name = name;
    }

    if (name.includes("Animated")) {
        AnimationComponent(scene, fbx, assets, name);
        return;
    }

    const { halfWidth, halfLength, halfHeight } = dimensions;

    const initialQuaternion = object.quaternion;
    const material = object.material;

    const pivotBox = new Box3().setFromObject(object);
    const pivotSize = pivotBox.getSize(new Vector3());
    const hasVerticalCollisionSurface = pivotSize.y >= MIN_GAMEPLAY_COLLIDER_HEIGHT;

    let axis;
    if (generatedAsset) {
        axis = new Vector3(0, 1, 0);
    } else if (object.rotation.x >= 0 && object.rotation.y > 0) {
        axis = new Vector3(1, 0, 0);
    } else if (object.rotation.x > 0 && object.rotation.y <= 0) {
        axis = new Vector3(0, 1, 0);
    } else {
        axis = new Vector3(0, 0, 1);
    }

    const instancedMesh = new THREE.InstancedMesh(object.geometry, material, assets.length);
    instancedMesh.frustumCulled = false;
    instancedMesh.userData.instances = [];
    instancedMesh.userData.gameplayColliderHeight = pivotSize.y;
    instancedMesh.userData[GAMEPLAY_RAYCAST_COLLIDER_KEY] = shouldRegisterGameplayCollision(name) && hasVerticalCollisionSurface;
    if (instancedMesh.userData[GAMEPLAY_RAYCAST_COLLIDER_KEY]) {
        makeCollisionMaterialDoubleSided(instancedMesh.material);
    }
    const rotationQuaternionTmp = new THREE.Quaternion();
    const finalQuaternionTmp = new THREE.Quaternion();
    const matrixTmp = new THREE.Matrix4();
    const labelBoxTmp = new THREE.Box3();
    const animatedDummy = new THREE.Object3D();
    const animatedEuler = new THREE.Euler();
    const animatedQuaternion = new THREE.Quaternion();

    let index = 0;


    for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        
        const { fields, annotationText } = asset;
        const raw = asset._raw || asset;
        const instanceId = raw.instance_id || raw.instanceId
       

        const xRaw = fields['X-pos']?.value;
        const yRaw = fields['Y-pos']?.value;
        const zRaw = fields['Z-pos']?.value;
        

        const x = Number(xRaw) ? xRaw : 0;
        const y = Number(yRaw) ? yRaw : 0;
        const z = Number(zRaw) ? zRaw : 0;

        const angleVal = fields['Angle']?.value ? fields['Angle'].value : 0;
        const angleValue = extractAngle(angleVal);
        const angle = angleValue.y;

        const rotationAngle = THREE.MathUtils.degToRad(angle);
        rotationQuaternionTmp.setFromAxisAngle(axis, rotationAngle);
        finalQuaternionTmp.multiplyQuaternions(initialQuaternion, rotationQuaternionTmp);
        const finalQuaternion = finalQuaternionTmp.clone();

        const absScale = object.scale.clone();
        const savedProjectScaleValue = asset.transform?.scale || raw.transform?.scale;
        const savedProjectScale = extractVectorScale(savedProjectScaleValue, absScale);
        const useSavedProjectScale = savedProjectScale && !isUnitFallbackScale(savedProjectScale);
       

        const widthRaw = fields['Width']?.value;
        const lengthRaw = fields['Length']?.value;
        const heightRaw = fields['Height']?.value;

        const width = Number(widthRaw) ? widthRaw : 0;
        const length = Number(lengthRaw) ? lengthRaw : 0;
        const height = Number(heightRaw) ? heightRaw : 0;


         if (fields['Status']?.value === "Not in Use" && !String(projectID).includes("153_L1")) {
        //    console.log(projectID)
            continue;

        }
        const floorField = fields['Floor']?.value;
        const floor = parseFloorCode(
            floorField,
            projectID == 125 ? 1 : 0
        );

        const floorValue = floor || 0;
        floors[floorValue] = { name: `Floor ${floorValue}`, code: floorValue };

        if (useSavedProjectScale) {
            absScale.copy(savedProjectScale);
        } else if (generatedAsset) {
            if (width > 0) {
                const wFloat = parseFloat(width);
                if (wFloat > 0 && pivotSize.x > 0) {
                    absScale.x = (wFloat / 10) / pivotSize.x;
                }
            }

            if (height > 0) {
                const hFloat = parseFloat(height);
                if (hFloat > 0 && pivotSize.y > 0) {
                    absScale.y = (hFloat / 10) / pivotSize.y;
                }
            }

            if (length > 0) {
                const lFloat = parseFloat(length);
                if (lFloat > 0 && pivotSize.z > 0) {
                    absScale.z = (lFloat / 10) / pivotSize.z;
                }
            }
        } else {
            if (width > 0) {
                const wFloat = parseFloat(width);
                if (wFloat > 0) {
                    const xFactor = (wFloat / 10) / (pivotBox.max.x - pivotBox.min.x);
                    absScale.y = xFactor;
                }
            }

            if (height > 0) {
                const hFloat = parseFloat(height);
                if (hFloat > 0) {
                    const yFactor = (hFloat / 10) / (pivotBox.max.y - pivotBox.min.y);
                    absScale.z = yFactor;
                }
            }
        }


        if (!useSavedProjectScale) {
            absScale.multiplyScalar(0.01);
            const savedFieldScale = extractVectorScale(fields['Scale']?.value, absScale, 100);
            if (savedFieldScale && !isUnitFallbackScale(savedFieldScale)) {
                absScale.copy(savedFieldScale);
            }
        }

       

        objects[cleanKey] = {
            object: categoryObject,
            name,
            categoryIndex: raw.category_index || category_index,
            halfWidth: width ? width / 20 :  halfWidth,
            halfLength: length ? length / 20 : halfLength,
            halfHeight,
            assetID: raw.asset_id ||raw.assetId,
            scale: absScale,
            fileName,
            cleanKey
        };

        const l = length ? length / 20 : halfLength;
        const w = width ? width / 20 : halfWidth;
        const defaultColor = typeof material?.color?.getHexString === "function"
            ? `#${material.color.getHexString()}`
            : "#ffffff";
        const color = fields["Color"]?.value || defaultColor;
        const va = fields["v-align"]?.value || "bottom";
 
        // assetCommandLines.push(
        //     `placeObject ${cleanKey}, pos(${(x)},${(z)},${(y)}), angle(${angleValue.x},${angleValue.y},${angleValue.z}), vAlign(${va}), color(${color}), length(${length}), height(${height }), width(${width })\n`
        // );
        const position = new THREE.Vector3(
            parseFloat(x) + (generatedAsset ? 0 : w),
            parseFloat(z),
            parseFloat(y) + (generatedAsset ? 0 : l)
        ).multiplyScalar(0.01);


 
        const info = fields['Info']?.value;
        // console.log(name,info);
        if (lowerName === 'location' && info) {
            loadLocation(position, l,w, fields, angle, instanceId, w,l);
            continue;
        }

        const textIndexList = [];
        let labelId = 0;
        const content = fields['stacking']?.value;
        const labelText = fields['LabelText']?.value;
        

        if (labelText) {
            const sku = fields['SKU']?.value || 'No SKU Found';
            textIndexList.push({ index: textIndexList.length, fieldIndex: fields['SKU']?.valueId });

            const cname = fields['Name']?.value || 'No name Found';
            const containerName = `[${instanceId}]${cname}`;
            textIndexList.push({ index: textIndexList.length, fieldIndex: fields['Name']?.valueId });
            textIndexList.push({ index: textIndexList.length, fieldIndex: fields['LabelText']?.valueId });

            if (content) {
                const elements = makeElements(fields);
                const compositeObj = Composite(composite.children[0], elements);
                compositeObj.scale.multiplyScalar(0.01);
                compositeObj.position.copy(position);
                scene.add(compositeObj);
            }

            const labelAngle = THREE.MathUtils.degToRad(parseFloat(angle) + 270);
            const sizeAndFont = { width: 20, length: 8, font: 30 };

            labelId = AttachLabel(
                projectID,
                [sku, containerName, labelText],
                scene,
                position,
                new Vector3(),
                textIndexList,
                new Vector3(0, 0, w + 1.5),
                new Vector3(0, labelAngle, 0),
                sizeAndFont,
                false
            );
        }
 
        const description = ''//JSON.parse(raw.description);

        // if (annotationText?.length > 0) {
        //     const labelAngle = THREE.MathUtils.degToRad(parseFloat(angle));
        //     const textList = [];

        //     for (let j = 0; j < annotationText.length; j++) {
        //         const annotation = annotationText[j];
        //         if (annotation.value.length > 0) {
        //             textList.push(`${annotation.value}`);
        //         }
        //     }

        //     if (textList.length > 0) {
        //         if (description.length > 0) {
        //             textList.push(description.join(' '));
        //         }

        //         const sizeAndFont = { width: halfWidth * 2, length: halfLength * 2, font: 90 };

        //         labelId = AttachLabel(
        //             projectID,
        //             textList,
        //             scene,
        //             position,
        //             new Vector3(-Math.PI / 2, 0, 0),
        //             textIndexList,
        //             new Vector3(0, halfHeight * 2.1, 0),
        //             new Vector3(0, labelAngle, 0),
        //             sizeAndFont,
        //             true
        //         );
        //     }
        // }

         
        if (lowerName.includes('filefolder')) {
            const labelAngle = THREE.MathUtils.degToRad(parseFloat(angle));
            const textList = [];


            textList.push(branch);
            textList.push(`(${fields['Map number']?.value || 'N/A'}) ${fields['Map name']?.value || 'N/A'}`);
            textList.push(`Period: ${fields['Period']?.value || 'N/A'}`);


            const sizeAndFont = { width: 30, length: 6, font: 30 };

            labelId = AttachLabel(
                projectID,
                textList,
                scene,
                position,
                new Vector3(),
                textIndexList,
                new Vector3(halfHeight, 0, l + 1.5),
                new Vector3(0, labelAngle, Math.PI / 2),
                sizeAndFont,
                false
            );
         
        }

        if (lowerName.includes('dl')) {
            const labelAngle = THREE.MathUtils.degToRad(parseFloat(angle));
            const textList = [];

            textList.push(`(${instanceId}) ${fields['Intern IP Address']?.value}/${fields['Model']?.value}`);
            textList.push(`Usage: ${fields['Usage']?.value}-${fields['OS']?.value}`);

            const sizeAndFont = { width: 50, length: 5, font: 30 };

            labelId = AttachLabel(
                projectID,
                textList,
                scene,
                position,
                new Vector3(),
                textIndexList,
                new Vector3(0, halfHeight, l + 1.5),
                new Vector3(0, labelAngle, 0),
                sizeAndFont,
                false
            );
        }

        const initaialScale = absScale.clone();

       

        matrixTmp.compose(position, finalQuaternion, absScale);
        instancedMesh.setMatrixAt(index, matrixTmp);
        labelBoxTmp.copy(pivotBox).applyMatrix4(matrixTmp);

        const assetOjb = { description, assetId: instanceId, fields, categoryIndex: raw.category_index, content };

        const instanceData = {
            id: instanceId + '_' + index,
            assetId: instanceId,
            assetObject: assetOjb,
            fileName: fileName,
            floor,
            xId: fields['X-pos']?.valueId,
            yId: fields['Y-pos']?.valueId,
            zId: fields['Z-pos']?.valueId,
            angleId: fields['Angle']?.valueId,
            cleanKey    
        };

        instancedMesh.userData.instances.push(instanceData);

        sceneAssets[instanceId] = {
            position,
            instance: instancedMesh,
            index,
            length: l,
            width: w,
            angle,
            fAngle: angle,
            quarternion: finalQuaternion,
            quart: finalQuaternion,
            scale: initaialScale,
            axis,
            // object: cFbx,
            instanceData,
            floor,
            labelId,
            name,
            halfWidth: width ? width / 20 :  halfWidth,
            halfLength: length ? length / 20 : halfLength,
            categoryIndex: raw.category_index || category_index,
            inUse: fields['Status']?.value === "In Use",
            statusFieldId: fields['Status']?.fieldId,
            halfHeight,
            assetID: raw.asset_id,
            fileName,
            color,
            cleanKey,
            vAlignValue: va,
            commandLine: assetCommandLines[assetCommandLines.length - 1] || "",
        };

        const buildingLabel = createBuildingLabelSprite({
            fields,
            fallbackName: name,
            position,
            angle,
            halfHeight: height ? parseFloat(height) / 2 : halfHeight,
            halfLength: l,
            topY: labelBoxTmp.max.y,
            instanceId,
            
        });

        if (buildingLabel) {
            scene.add(buildingLabel);
            sceneAssets[instanceId].buildingLabel = buildingLabel;
            applySavedBuildingLabelLogo({
                buildingLabel,
                fields,
                fallbackName: name,
                instanceId,
            });
        }

        index++;
    }

    instancedMesh.name = name;
    instancedMesh.count = index;
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    instanceMesh[name] = instancedMesh;

    if (lowerName.includes('character')) {
        instancedMesh.layers.mask = 0;
    }

    if (scene !== undefined && !lowerName.includes('location')) {
        instancedMesh.instanceMatrix.needsUpdate = true;
        scene.add(instancedMesh);
    }

    const dslAnimations = readDslAnimations(properties);
    if (dslAnimations.length && index > 0) {
        applyDslAnimations(
            `${projectID}:${name}:office`,
            dslAnimations,
            () => ({
                position: new THREE.Vector3(),
                rotation: new THREE.Euler()
            }),
            (target) => {
                const hasTargetScope = Array.isArray(target.targetInstanceIds);
                const targetIds = hasTargetScope ? target.targetInstanceIds.map(String) : [];
                instancedMesh.userData.instances.forEach((item, meshIndex) => {
                    if (hasTargetScope && !targetIds.includes(String(item.assetId))) {
                        return;
                    }
                    const asset = sceneAssets[item.assetId];
                    if (!asset) return;

                    if (!asset.baseAnimationPosition) {
                        asset.baseAnimationPosition = asset.position.clone();
                    }
                    if (asset.baseAnimationAngle === undefined) {
                        asset.baseAnimationAngle = asset.angle || 0;
                    }

                    const basePosition = asset.baseAnimationPosition;
                    const nextPosition = new THREE.Vector3(
                        target.__absolutePosition && target.x !== undefined ? target.x : basePosition.x + (target.x || 0),
                        target.__absolutePosition && target.y !== undefined ? target.y : basePosition.y + (target.y || 0),
                        target.__absolutePosition && target.z !== undefined ? target.z : basePosition.z + (target.z || 0)
                    );
                    animatedEuler.set(
                        target.rx || 0,
                        THREE.MathUtils.degToRad(asset.baseAnimationAngle || 0) + (target.ry || 0),
                        target.rz || 0
                    );
                    animatedQuaternion.setFromEuler(animatedEuler);
                    asset.position.copy(nextPosition);
                    animatedDummy.position.copy(asset.position);
                    animatedDummy.quaternion.copy(animatedQuaternion);
                    animatedDummy.scale.copy(asset.scale);
                    animatedDummy.updateMatrix();
                    instancedMesh.setMatrixAt(meshIndex, animatedDummy.matrix);
                    if (asset.quart?.copy) {
                        asset.quart.copy(animatedQuaternion);
                    } else {
                        asset.quart = animatedQuaternion.clone();
                    }
                });
                instancedMesh.instanceMatrix.needsUpdate = true;
            }
        );
    } else {
        clearDslAnimations(`${projectID}:${name}:office`);
    }

    return {
        floors,
        meshKeys: index > 0 ? [name] : [],
        commandText: assetCommandLines.join(""),
    };
}

