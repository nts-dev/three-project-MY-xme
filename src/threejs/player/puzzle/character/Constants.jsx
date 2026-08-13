import * as THREE from "three";


const realTimeChaPosition = new THREE.Vector3();
const avatarFacingYawDegrees = { current: 0 };
const fallSceneCenterOverride = { current: null };
const horizontalSpeed = {current:0}
const enPc = {current: 100};
const ladderPositions = {current:[]}
const nearLadder = {current:false}
const apiData = {current:{}}
const ladderHeight = {current:0}
const instanceMesh =  [];
const sceneAssets = {};
const locationData = []
const locationPoints = []
const assetCommands = {current:'level L2 \n'}
const categoryCommands = {current: []}
const objects= {}
const floors = []

export {realTimeChaPosition,
    avatarFacingYawDegrees,
    fallSceneCenterOverride,
    horizontalSpeed,
    enPc,
    ladderPositions,
    nearLadder,
    ladderHeight,
    instanceMesh,
    sceneAssets,
    locationData,
    locationPoints,
    objects,
    floors,
    apiData,
    assetCommands,
    categoryCommands
}
