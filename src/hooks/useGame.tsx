import { create } from 'zustand'
import { Vector3 } from "three";
import { socket } from "../socket";

const useGame = create((set) => ({
    cameraPosition: [100, 100, 100], // Initial camera position
    zoomFactor: 10, // Factor to adjust zoom level
    zoomLevel: 1,
    zoom: 1,// Initial zoom level
    formData: {},
    projectID: 0,
    isPopupOpen: false,
    assets: [],
    info: true,
    shadow: false,
    walls: false,
    anims: false,
    searchAssets: Map,
    players: false,
    editPopup: false,
    assetInfo: {},
    character: false,
    searchItemId: 0,
    gizmo: null,
    sound: true,
    grid: true,
    camera: 'Camera',
    map: false,
    roof: false,
    multiplayer: false,
    selectedAssetId: null,
    editable: false,
    projectList: [],
    matList: [],
    selectedAsset: {},
    drawerOpen: false,
    fieldsMap: {},
    formStatus: {},
    updatedFieldsMap: {},
    channel: false,
    channelEvent: null,
    gridlEvent: null,
    category: false,
    categoryEvent: null,
    videoLink: '',
    showVideo: false,
    toggleSideBar: '-translate-x-full',
    lazy: false,
    lazyMsg: '',
    fps: false,// process.env.MODE == 'development',
    tranformation: '',
    clientId: null,
    playerMap: {},
    playerSpeed: 10,
    playerRotationSpeed: 30,
    playerViewAngle: 0,
    firstPerson: false,
    devicePath: [],
    newDevicePath: [],
    reload: false,
    branch: '',
    location: false,
    dots: false,
    cordinates: [],
    label: false,
    dotEvent: null,
    displayDialog: false,
    nonRealtime: new Set(),
    jumpPoints: false,
    jumpPointsEvent: null,
    floorValue: -0.6,
    checkReload: 0,
    assetEdit: false,
    documents: false,
    documentsEvent: null,
    searchItem: {},
    checkedItems: {},
    categoriesData: {},
    catId: 0,
    gridAssets: [],
    expandedKeys: {},
    floorMap: false,
    iframeLazy: true,
    annotations: false,
    scanner: false,
    scannedId: 0,
    scan: false,
    isCamera: false,
    images: [],
    imagesToSave: [],
    colliders: [],
    collision: false,
    isPackage: false,
    packageControl: false,
    componentTree: [],
    isComponentTree: false,
    animate: false,
    pause: true,
    showBdims: false,
    showOdims: false,
    showFdims: false,
    playerActions: {},
    showBox: false,
    showFoam: true,
    showObject: true,
    pLabel: true,
    playBackward: false,
    labelRenderer: null,
    modelTreeChecks: {},
    userData: {},
    lights: true,
    personColor: '',
    isCameraMoving: false,
    videoRawLink: '',
    searchList: [],
    locationId: '',
    isProductsOpen: false,
    floorHeight: 0,
    characterRef: null,
    searchCenter: new Vector3(0, 0, 0),
    searchDimensions: null,
    template: {},
    htmlData: '',
    wallsOpacity: 10,
    locationList: {},
    lightIntensity: 30,
    lightColor: 'ffffff',
    indexId: 0,
    showDetails: false,
    assetIndexArray: [],
    formValues: {},
    tableFieldId: 0,
    gridFieldId: 0,
    fieldId: 0,
    selectedGridIds: '',
    selectedTableIds: '',
    floors: [],
    selectedFloors: [],
    rawCategories: [],
    projectSceneData: null,
    projectSceneKey: null,
    dragObjectProperties: { position: {}, rotation: {}, distance: {}, interval: {} },
    isDragAssetDeleted: false,
    dragAssetProps: {},
    editEvent: null,
    editAssetId: 0,
    drop: false,
    firstDrop: false,
    noOfCoins: 0,
    gameInstances: {},
    forwardOnly: true,
    resetCoins: 0,
    hasDied: false,
    isRecovering: false,
    noOfLivesRemaining: 3,
    charIsLoaded: false,
    soundUrl: 'initialSound.mp3',
    toolBarHidden: false,
    notification: {},
    characterIsInWater: false,
    ladderList: {},
    isMobile: false,
    isGame: false,
    editProps: {},
    dragObjectProp: {},
    selectedDragObject: null,
    selectedEditorInstance: null,
    editorSelectionEnabled: true,
    editorInstanceSelectionRequest: null,
    editorGizmoMode: 'translate',
    playAssetInfoRequest: null,
    annotationSettings: { fontSize: 90, color: '#ff0055' },
    popupInfo: {},
    hideAssets: false,
    hideAssetProps: {},
    searchQrCode: false,
    showQR: false,
    selectedFormTab: 0,
    selectedImageProps: {},
    filesToSave: [],
    files: [],
    selectedFileIndex: null,
    selectedLogIndex: null,
    logs: [],
    logsToSave: [],
    refreshPlanning: false,
    logFormData: {},
    employees: [],
    showCamControls: false,
    isLoggedIn: true,
    jumpSpeed: 30,
    insertLocations: false,
    saveClick: false,
    checkSaveClick: false,
    comboAssetID: 0,
    assetName: null,
    templateAssetProps: {},
    worldRef: null,
    controlButtonIndex: 0,
    buttonMode: 'Edit Mode',
    defaultInstanceId: 0,
    shouldMoveUp: false,
    restart: false,
    selectedAssetName: null,
    instanceData: [],
    instanceDataList: [],
    removedObject: {},
    blackListedCoins: new Set(),
    rotationValue: null,
    vAlignValue: null,
    movingSpeed: 0.006,
    totalCoins: 0,
    soundParams: {},
    animationRef: null,
    fbxNames: [],
    gameCharacterRef: null,
    remoteCharacterPosition: new Vector3(0, 0, 0),
    showInventory: false,
    assetSettings: {},
    keys: 0,
    itemsDictionary: {},
    inventoryDragObject: null,
    cameraRef: null,
    sceneRef: null,
    orbitControlsRef: null,
    animatedInstances: [],
    isDraggingInventory: false,
    isPuzzleGame: null,
    gridSize: {},
    deleteObject: false,
    deleteAssetId: 0,
    deleteAssetConfirmed: false,
    assetClone: null,
    assetColor: '#000000',
    selectedId: 0,
    audioAnalyser: null,
    terminalMessage: {},
    deleteId: 0,
    isSelected: false,
    selectedAssetIdNumber: 0,
    mainIconMap: new Map(),
    hitPoint: false,
    resetGame: false,
    droppedToken: null,
    activatedDoor: null,
    invisible: false,
    doorList: [],
    pauseGame: false,
    toMainMenu: false,
    distanceCount: 0,
    activatedTile: null,
    controlClose: false,
    confirmationObj: {},
    uName: '',
    gameStartTick: 0,
    alternateWorldIndex: 0,
    uColor: null,
    avatarColor: null,
    avatarColors: [],
    hp: 100,
    enPct: 100,
    isLoaded: false,
    tokenCode: { id: 0, code: '##', codeValue: '##-##-##-##-##', color: null },
    droppedTokenData: {},
    speedFactor: 1,
    waiting: 'null',
    clicked: false,
    isClimbing: false,
    atTop: false,
    hasJumped: false,
    headHit: false,
    standingOnMovingBlock: '',
    movingPlatforms: {},
    collectibleColliderHandles: {},
    collectibleRayHit: { id: null, tick: 0 },
    addLevel: false,
    selectedCatId: null,
    levels: [],
    selectedLevel: null,
    previewDslMode: null,
    directPlayMode: false,
    dslSceneCommand: null,
    dslSceneCommandTick: 0,
    showConfirmDelete: false,
    placeHolderPosition: null,
    soundName: null,
    apiData: [],
    assetSelected: false,
    hasUnsavedTransformUpdate: false,
    unsavedAssetSaveHandler: null,
    isEditing: false,
    isGizmoActive: false,
    setisGizmoActive: (isGizmoActive: boolean) =>
        set((state: any) => ({
            ...state,
            isGizmoActive: isGizmoActive
        })),
    setIsEditing: (isEditing: boolean) =>
        set((state: any) => ({
            ...state,
            isEditing: isEditing
        })),
     setAssetSelected: (assetSelected: boolean) =>
        set((state: any) => ({
            ...state,
            assetSelected: assetSelected
        })),
    setHasUnsavedTransformUpdate: (hasUnsavedTransformUpdate: boolean) =>
        set((state: any) => ({
            ...state,
            hasUnsavedTransformUpdate
        })),
    setUnsavedAssetSaveHandler: (unsavedAssetSaveHandler: any) =>
        set((state: any) => ({
            ...state,
            unsavedAssetSaveHandler
        })),
    setApiData: (apiData: any) =>
        set((state: any) => ({
            ...state,
            apiData: apiData
        })),
    setDslSceneCommand: (dslSceneCommand: any) =>
        set((state: any) => ({
            ...state,
            dslSceneCommand,
            dslSceneCommandTick: (Number(state.dslSceneCommandTick) || 0) + 1
        })),
    clearDslSceneCommand: () =>
        set((state: any) => ({
            ...state,
            dslSceneCommand: null
        })),
    setSoundName: (soundName: any) =>
        set((state: any) => ({
            ...state,
            soundName: soundName
        })),
     setPlaceHolderPosition: (placeHolderPosition: any) =>
        set((state: any) => ({
            ...state,
            placeHolderPosition: placeHolderPosition
        })),
    setShowConfirmDelete: (showConfirmDelete: any) =>
        set((state: any) => ({
            ...state,
            showConfirmDelete: showConfirmDelete
        })),
      setSelectedLevel: (selectedLevel: any) =>
        set((state: any) => ({
            ...state,
            selectedLevel: selectedLevel
        })),
      setPreviewDslMode: (previewDslMode: any) =>
        set((state: any) => ({
            ...state,
            previewDslMode: previewDslMode
        })),
      setDirectPlayMode: (directPlayMode: boolean) =>
        set((state: any) => ({
            ...state,
            directPlayMode: directPlayMode
        })),
     setLevels: (levels: any) =>
        set((state: any) => ({
            ...state,
            levels: levels
        })),
    setSelectedCatId: (selectedCatId: any) =>
        set((state: any) => ({
            ...state,
            selectedCatId: selectedCatId
        })),
    setAddLevel: (addLevel: boolean) =>
        set((state: any) => ({
            ...state,
            addLevel: addLevel
        })),
    setHeadHit: (headHit: boolean) =>
        set((state: any) => ({
            ...state,
            headHit: headHit
        })),
    setStandingOnMovingBlock: (standingOnMovingBlock: string) =>
        set((state: any) => ({
            ...state,
            standingOnMovingBlock: standingOnMovingBlock
        })),
    setMovingPlatformState: (key: string | number, platform: any) =>
        set((state: any) => ({
            ...state,
            movingPlatforms: {
                ...state.movingPlatforms,
                [String(key)]: platform
            }
        })),
    removeMovingPlatformState: (key: string | number) =>
        set((state: any) => {
            const nextPlatforms = { ...state.movingPlatforms };
            delete nextPlatforms[String(key)];
            return {
                ...state,
                movingPlatforms: nextPlatforms
            };
        }),
    registerCollectibleCollider: (handle: string, id: any) =>
        set((state: any) => ({
            ...state,
            collectibleColliderHandles: {
                ...state.collectibleColliderHandles,
                [handle]: id
            }
        })),
    unregisterCollectibleCollider: (handle: string) =>
        set((state: any) => {
            const next = { ...state.collectibleColliderHandles };
            delete next[handle];
            return {
                ...state,
                collectibleColliderHandles: next
            };
        }),
    setCollectibleRayHit: (id: any) =>
        set((state: any) => ({
            ...state,
            collectibleRayHit: {
                id,
                tick: Date.now()
            }
        })),
    setHasJumped: (hasJumped: boolean) =>
        set((state: any) => ({
            ...state,
            hasJumped: hasJumped
        })),
    setAtTop: (atTop: boolean) =>
        set((state: any) => ({
            ...state,
            atTop: atTop
        })),
    setIsClimbing: (isClimbing: boolean) =>
        set((state: any) => ({
            ...state,
            isClimbing: isClimbing
        })),
    setClicked: (clicked: boolean) =>
        set((state: any) => ({
            ...state,
            clicked: clicked
        })),
    setWaiting: (waiting: boolean) =>
        set((state: any) => ({
            ...state,
            waiting: waiting
        })),

    setSpeedFactor: (speedFactor: number) =>
        set((state: any) => ({
            ...state,
            speedFactor: speedFactor
        })),
    setDroppedTokenData: (droppedTokenData: any) =>
        set((state: any) => ({
            ...state,
            droppedTokenData: droppedTokenData
        })),
    setTokenCode: (tokenCode: any) =>
        set((state: any) => ({
            ...state,
            tokenCode: tokenCode
        })),
    setIsLoaded: (isLoaded: boolean) =>
        set((state: any) => ({
            ...state,
            isLoaded: isLoaded
        })),
    setEnPct: (enPct: any[]) =>
        set((state: any) => ({
            ...state,
            enPct: enPct
        })),
    setHp: (hp: any[]) =>
        set((state: any) => ({
            ...state,
            hp: hp
        })),
    setAvatarColors: (avatarColors: any[]) =>
        set((state: any) => ({
            ...state,
            avatarColors: avatarColors
        })),
    setAvatarColor: (avatarColor: any) =>
        set((state: any) => ({
            ...state,
            avatarColor: avatarColor
        })),
    setUName: (uName: any) =>
        set((state: any) => ({
            ...state,
            uName: uName
        })),
    setGameStartTick: () =>
        set((state: any) => ({
            ...state,
            gameStartTick: (Number(state.gameStartTick) || 0) + 1
        })),
    setAlternateWorldIndex: (alternateWorldIndex: number) =>
        set((state: any) => ({
            ...state,
            alternateWorldIndex: Math.max(0, Math.min(8, Number(alternateWorldIndex) || 0))
        })),
    setUColor: (uColor: any) =>
        set((state: any) => ({
            ...state,
            uColor: uColor
        })),
    setConfirmationObj: (confirmationObj: any) =>
        set((state: any) => ({
            ...state,
            confirmationObj: confirmationObj
        })),
    setControlClose: (controlClose: boolean) =>
        set((state: any) => ({
            ...state,
            controlClose: controlClose
        })),
    setActivatedTile: (activatedTile: number) =>
        set((state: any) => ({
            ...state,
            activatedTile: activatedTile
        })),
    setDistanceCount: (distanceCount: number) =>
        set((state: any) => ({
            ...state,
            distanceCount: distanceCount
        })),
    setToMainMenu: (toMainMenu: any[]) =>
        set((state: any) => ({
            ...state,
            toMainMenu: toMainMenu
        })),
    setPauseGame: (pauseGame: any[]) =>
        set((state: any) => ({
            ...state,
            pauseGame: pauseGame
        })),
    setInvisible: (invisible: any[]) =>
        set((state: any) => ({
            ...state,
            invisible: invisible
        })),
    setDoorList: (newDoors: any[]) =>
        set((state: any) => {
            const merged = [...state.doorList, ...newDoors];
            const unique = Array.from(new Map(merged.map(d => [d.key, d])).values());
            return { doorList: unique };
        }),

    setActivatedDoor: (activatedDoor: any) =>
        set((state: any) => ({
            ...state,
            activatedDoor: activatedDoor
        })),

    setDroppedToken: (droppedToken: any) =>
        set((state: any) => ({
            ...state,
            droppedToken: droppedToken
        })),
    setResetGame: (resetGame: any) =>
        set((state: any) => ({
            ...state,
            resetGame: resetGame
        })),
    setHitPoint: (hitPoint: any) =>
        set((state: any) => ({
            ...state,
            hitPoint: hitPoint
        })),
    setMainIconMap: (mainIconMap: any) =>
        set((state: any) => ({
            ...state,
            mainIconMap: mainIconMap
        })),
    setSelectedAssetIdNumber: (selectedAssetIdNumber: number) =>
        set((state: any) => ({
            ...state,
            selectedAssetIdNumber: selectedAssetIdNumber
        })),
    setIsSelected: (isSelected: boolean) =>
        set((state: any) => ({
            ...state,
            isSelected: isSelected
        })),
    setDeleteId: (deleteId: number) =>
        set((state: any) => ({
            ...state,
            deleteId: deleteId
        })),
    setTerminalMessage: (terminalMessage: any) =>
        set((state: any) => {
            const nextMessage = {
                ...terminalMessage,
                id: terminalMessage?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                projectId: terminalMessage?.projectId ?? state.projectID,
            };

            if (!terminalMessage?.remote) {
                socket.emit("terminalMessage", nextMessage);
            }

            return {
                ...state,
                terminalMessage: nextMessage
            };
        }),
    setAudioAnalyser: (audioAnalyser: any) =>
        set((state: any) => ({
            ...state,
            audioAnalyser: audioAnalyser
        })),
    setSelectedId: (selectedId: any) =>
        set((state: any) => ({
            ...state,
            selectedId: selectedId
        })),
    setAssetColor: (assetColor: any) =>
        set((state: any) => ({
            ...state,
            assetColor: assetColor
        })),
    setVAlignValue: (vAlignValue: any) =>
        set((state: any) => ({
            ...state,
            vAlignValue: vAlignValue
        })),

    setAssetClone: (assetClone: any) =>
        set((state: any) => ({
            ...state,
            assetClone: assetClone
        })),
    setDeleteAssetId: (deleteAssetId: number) =>
        set((state: any) => ({
            ...state,
            deleteAssetId: deleteAssetId
        })),
    setDeleteAssetConfirmed: (deleteAssetConfirmed: boolean) =>
        set((state: any) => ({
            ...state,
            deleteAssetConfirmed: deleteAssetConfirmed
        })),
    setDeleteObject: (deleteObject: boolean) =>
        set((state: any) => ({
            ...state,
            deleteObject: deleteObject
        })),
    setGridSize: (gridSize: any) =>
        set((state: any) => ({
            ...state,
            gridSize: gridSize
        })),
    setIsPuzzleGame: (isPuzzleGame: any) =>
        set((state: any) => ({
            ...state,
            isPuzzleGame: isPuzzleGame
        })),
    setIsDraggingInventory: (isDraggingInventory: any) =>
        set((state: any) => ({
            ...state,
            isDraggingInventory: isDraggingInventory
        })),
    setAnimatedInstances: (animatedInstances: any) =>
        set((state: any) => ({
            ...state,
            animatedInstances: animatedInstances
        })),

    setCameraRef: (cameraRef: any) =>
        set((state: any) => ({
            ...state,
            cameraRef: cameraRef
        })),

    setSceneRef: (sceneRef: any) =>
        set((state: any) => ({
            ...state,
            sceneRef: sceneRef
        })),

    setOrbitControlsRef: (orbitControlsRef: any) =>
        set((state: any) => ({
            ...state,
            orbitControlsRef: orbitControlsRef
        })),

    setInventoryDragObject: (inventoryDragObject: any) =>
        set((state: any) => ({
            ...state,
            inventoryDragObject: inventoryDragObject
        })),
    setItemsDictionary: (itemsDictionary: any) =>
        set((state: any) => ({
            ...state,
            itemsDictionary: itemsDictionary
        })),
    setKeys: (keys: any) =>
        set((state: any) => ({
            ...state,
            keys: keys
        })),
    setAssetSettings: (assetSettings: any) =>
        set((state: any) => ({
            ...state,
            assetSettings: assetSettings
        })),
    setShowInventory: (showInventory: any) =>
        set((state: any) => ({
            ...state,
            showInventory: showInventory
        })),
    setGameCharacterRef: (gameCharacterRef: any) =>
        set((state: any) => ({
            ...state,
            gameCharacterRef: gameCharacterRef
        })),
    setRemoteCharacterPosition: (remoteCharacterPosition: any) =>
        set((state: any) => ({
            ...state,
            remoteCharacterPosition: remoteCharacterPosition
        })),
    setFbxNames: (fbxNames: any) =>
        set((state: any) => ({
            ...state,
            fbxNames: fbxNames
        })),
    setAnimationRef: (animationRef: any) =>
        set((state: any) => ({
            ...state,
            animationRef: animationRef
        })),
    setSoundParams: (soundParams: number) =>
        set((state: any) => ({
            ...state,
            soundParams: soundParams
        })),
    setTotalCoins: (totalCoins: number) =>
        set((state: any) => ({
            ...state,
            totalCoins: totalCoins
        })),
    setMovingSpeed: (movingSpeed: number) =>
        set((state: any) => ({
            ...state,
            movingSpeed: movingSpeed
        })),
    setRotationValue: (rotationValue: any) =>
        set((state: any) => ({
            ...state,
            rotationValue: rotationValue
        })),
    setBlackListedCoins: (blackListedCoins: any) =>
        set((state: any) => ({
            ...state,
            blackListedCoins: blackListedCoins
        })),
    setRemovedObject: (removedObject: any) =>
        set((state: any) => ({
            ...state,
            removedObject: removedObject
        })),

    setInstanceData: (instanceData: any) =>
        set((state: any) => ({
            ...state,
            instanceData: instanceData
        })),
    setSelectedAssetName: (selectedAssetName: any) =>
        set((state: any) => ({
            ...state,
            selectedAssetName: selectedAssetName
        })),
    setRestart: (restart: boolean) =>
        set((state: any) => ({
            ...state,
            restart: restart
        })),
    setShouldMoveUp: (shouldMoveUp: boolean) =>
        set((state: any) => ({
            ...state,
            shouldMoveUp: shouldMoveUp
        })),
    setDefaultInstanceId: (defaultInstanceId: number) =>
        set((state: any) => ({
            ...state,
            defaultInstanceId: defaultInstanceId
        })),
    setButtonMode: (buttonMode: number) =>
        set((state: any) => ({
            ...state,
            buttonMode: buttonMode
        })),

    setControlButtonIndex: (controlButtonIndex: number) =>
        set((state: any) => ({
            ...state,
            controlButtonIndex: controlButtonIndex
        })),
    setWorldRef: (worldRef: any) =>
        set((state: any) => ({
            ...state,
            worldRef: worldRef
        })),

    setTemplateAssetProps: (templateAssetProps: any) =>
        set((state: any) => ({
            ...state,
            templateAssetProps: templateAssetProps
        })),

    setAssetName: (assetName: any) =>
        set((state: any) => ({
            ...state,
            assetName: assetName
        })),
    setComboAssetID: (comboAssetID: any) =>
        set((state: any) => ({
            ...state,
            comboAssetID: comboAssetID
        })),
    setCheckSaveClick: (checkSaveClick: any) =>
        set((state: any) => ({
            ...state,
            checkSaveClick: checkSaveClick
        })),
    setSaveClick: (saveClick: any) =>
        set((state: any) => ({
            ...state,
            saveClick: saveClick
        })),
    setInsertLocations: (insertLocations: any) =>
        set((state: any) => ({
            ...state,
            insertLocations: insertLocations
        })),
    setJumpSpeed: (jumpSpeed: any) =>
        set((state: any) => ({
            ...state,
            jumpSpeed: jumpSpeed
        })),
    setIsLoggedIn: (isLoggedIn: any) =>
        set((state: any) => ({
            ...state,
            isLoggedIn: isLoggedIn
        })),
    setPlayerRotationSpeed: (playerRotationSpeed: any) =>
        set((state: any) => ({
            ...state,
            playerRotationSpeed: playerRotationSpeed
        })),
    setShowCamControls: (showCamControls: any) =>
        set((state: any) => ({
            ...state,
            showCamControls: showCamControls
        })),
    setEmployees: (employees: any) =>
        set((state: any) => ({
            ...state,
            employees: employees
        })),
    setLogFormData: (logFormData: any) =>
        set((state: any) => ({
            ...state,
            logFormData: logFormData
        })),
    setRefreshPlanning: (refreshPlanning: any) =>
        set((state: any) => ({
            ...state,
            refreshPlanning: refreshPlanning
        })),
    setLogs: (logs: any) =>
        set((state: any) => ({
            ...state,
            logs: logs
        })),
    setLogsToSave: (logsToSave: any) =>
        set((state: any) => ({
            ...state,
            logsToSave: logsToSave
        })),
    setSelectedFileIndex: (selectedFileIndex: any) =>
        set((state: any) => ({
            ...state,
            selectedFileIndex: selectedFileIndex
        })),

    setSelectedLogIndex: (selectedLogIndex: any) =>
        set((state: any) => ({
            ...state,
            selectedLogIndex: selectedLogIndex
        })),
    setFilesToSave: (filesToSave: any) =>
        set((state: any) => ({
            ...state,
            filesToSave: filesToSave
        })),
    setFiles: (files: any) =>
        set((state: any) => ({
            ...state,
            files: files
        })),

    setSelectedImageProps: (selectedImageProps: any) =>
        set((state: any) => ({
            ...state,
            selectedImageProps: selectedImageProps
        })),
    setSelectedFormTab: (selectedFormTab: number) =>
        set((state: any) => ({
            ...state,
            selectedFormTab: selectedFormTab
        })),
    setShowQR: (showQR: boolean) =>
        set((state: any) => ({
            ...state,
            showQR: showQR
        })),
    setSearchQrCode: (searchQrCode: any) =>
        set((state: any) => ({
            ...state,
            searchQrCode: searchQrCode
        })),
    setHideAssetProps: (hideAssetProps: any) =>
        set((state: any) => ({
            ...state,
            hideAssetProps: hideAssetProps
        })),
    setHideAssets: (hideAssets: boolean) =>
        set((state: any) => ({
            ...state,
            hideAssets: hideAssets
        })),
    setPopupInfo: (popupInfo: any) =>
        set((state: any) => ({
            ...state,
            popupInfo: popupInfo
        })),
    setAnnotationSettings: (annotationSettings: any) =>
        set((state: any) => ({
            ...state,
            annotationSettings: annotationSettings
        })),
    setSelectedDragObject: (selectedDragObject: any) =>
        set((state: any) => ({
            ...state,
            selectedDragObject: selectedDragObject
        })),
    setSelectedEditorInstance: (selectedEditorInstance: any) =>
        set((state: any) => ({
            ...state,
            selectedEditorInstance: selectedEditorInstance
                ? {
                    ...selectedEditorInstance,
                    updatedAt: Date.now()
                }
                : null
        })),
    setEditorSelectionEnabled: (editorSelectionEnabled: boolean) =>
        set((state: any) => ({
            ...state,
            editorSelectionEnabled
        })),
    updateSelectedEditorTransform: (transform: any) =>
        set((state: any) => {
            if (!state.selectedEditorInstance) {
                return state;
            }

            const selectedInstanceId = state.selectedEditorInstance.instanceId;
            const transformInstanceId = transform.instanceId;
            const transformObject = transform.object;
            const selectedObject = state.selectedEditorInstance.object;
            if (
                transformInstanceId !== undefined &&
                transformInstanceId !== null &&
                selectedInstanceId !== undefined &&
                selectedInstanceId !== null &&
                String(transformInstanceId) !== String(selectedInstanceId) &&
                (!transformObject || !selectedObject || transformObject !== selectedObject)
            ) {
                return state;
            }

            const previousGameObject = state.selectedEditorInstance.gameObject || {};
            const nextGameObject = {
                ...previousGameObject,
                position: transform.position || previousGameObject.position,
                rotation: transform.rotation || previousGameObject.rotation,
                scale: transform.scale || previousGameObject.scale,
            };
            const nextDragObjectProperties = transform.dragObjectProperties || {
                ...state.dragObjectProperties,
                position: nextGameObject.position || state.dragObjectProperties?.position,
                rotation: nextGameObject.rotation || state.dragObjectProperties?.rotation,
                distance: state.dragObjectProperties?.distance,
                interval: state.dragObjectProperties?.interval,
            };

            return {
                ...state,
                selectedEditorInstance: {
                    ...state.selectedEditorInstance,
                    gameObject: nextGameObject,
                    position: nextGameObject.position,
                    rotation: nextGameObject.rotation,
                    scale: nextGameObject.scale,
                    object: transform.object || state.selectedEditorInstance.object,
                    instanceId: selectedInstanceId ?? transformInstanceId,
                    updatedAt: Date.now(),
                },
                editProps: {
                    ...state.editProps,
                    position: nextGameObject.position,
                    angle: nextGameObject.rotation?.y ?? state.editProps?.angle,
                    obj: transform.object || state.editProps?.obj,
                },
                dragObjectProperties: nextDragObjectProperties,
                hasUnsavedTransformUpdate: transform.markUnsavedTransform
                    ? true
                    : state.hasUnsavedTransformUpdate
            };
        }),
    requestEditorInstanceSelection: (request: any) =>
        set((state: any) => ({
            ...state,
            editorInstanceSelectionRequest: request
                ? {
                    ...request,
                    requestedAt: Date.now()
                }
                : null
        })),
    setPlayAssetInfoRequest: (request: any) =>
        set((state: any) => {
            if (request && (state.character || state.firstPerson)) {
                return state;
            }

            return {
                ...state,
                playAssetInfoRequest: request
                    ? {
                        ...request,
                        requestedAt: Date.now()
                    }
                    : null
            };
        }),
    setEditorGizmoMode: (editorGizmoMode: any) =>
        set((state: any) => ({
            ...state,
            editorGizmoMode
        })),
    setDragObjectProp: (dragObjectProp: any) =>
        set((state: any) => ({
            ...state,
            dragObjectProp: dragObjectProp
        })),
    setIsGame: (isGame: boolean) =>
        set((state: any) => ({
            ...state,
            isGame: isGame
        })),

    setIsMobile: (isMobile: boolean) =>
        set((state: any) => ({
            ...state,
            isMobile: isMobile
        })),
    setLadderList: (ladderList: any) =>
        set((state: any) => ({
            ...state,
            ladderList: ladderList
        })),

    setCharacterIsInWater: (characterIsInWater: boolean) =>
        set((state: any) => ({
            ...state,
            characterIsInWater: characterIsInWater
        })),

    setNotification: (notification: any) =>
        set((state: any) => ({
            ...state,
            notification: {
                ...notification,
                id: notification?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`
            }
        })),
    setToolBarHidden: (toolBarHidden: boolean) =>
        set((state: any) => ({
            ...state,
            toolBarHidden: toolBarHidden
        })),
    setSoundUrl: (soundUrl: string) =>
        set((state: any) => ({
            ...state,
            soundUrl: soundUrl
        })),

    setNoOfLivesRemaining: (noOfLivesRemaining: number) =>
        set((state: any) => ({
            ...state,
            noOfLivesRemaining: noOfLivesRemaining,
        })),
    setIsRecovering: (isRecovering: boolean) =>
        set((state: any) => ({
            ...state,
            isRecovering: isRecovering,
        })),
    setHasDied: (hasDied: boolean) =>
        set((state: any) => ({
            ...state,
            hasDied: hasDied,
        })),
    setResetCoins: (resetCoins: any) =>
        set((state: any) => ({
            ...state,
            resetCoins: resetCoins,
        })),

    setGameInstances: (newInstances: any) =>
        set((state: any) => ({
            ...state,
            gameInstances: { ...state.gameInstances, ...newInstances }, // Merge new instances
        })),

    setForwardOnly: (forwardOnly: boolean): any => {
        set((state: any) => ({
            ...state,
            forwardOnly: forwardOnly
        }))
    }, setFirstDrop: (firstDrop: number): any => {
        set((state: any) => ({
            ...state,
            firstDrop: firstDrop
        }))
    },
    setNoOfCoins: (noOfCoins: number): any => {
        set((state: any) => ({
            ...state,
            noOfCoins: noOfCoins
        }))
    },
    setDrop: (drop: number): any => {
        set((state: any) => ({
            ...state,
            drop: drop
        }))
    },
    setEditAssetId: (editAssetId: number): any => {
        set((state: any) => ({
            ...state,
            editAssetId: editAssetId
        }))
    },
    setEditProps: (editProps: number): any => {
        set((state: any) => ({
            ...state,
            editProps: editProps
        }))
    },
    setEditEvent: (editEvent: any): any => {
        set((state: any) => ({
            ...state,
            editEvent: editEvent
        }))
    },
    setDragAssetProps: (dragAssetProps: any): any => {
        set((state: any) => ({
            ...state,
            dragAssetProps: dragAssetProps
        }))
    },
    setIsDragAssetDeleted: (isDragAssetDeleted: any): any => {
        set((state: any) => ({
            ...state,
            isDragAssetDeleted: isDragAssetDeleted
        }))
    },
    setDragObjectProperties: (dragObjectProperties: any): any => {
        set((state: any) => ({
            ...state,
            dragObjectProperties: dragObjectProperties
        }))
    },
    setSelectedFloors: (selectedFloors: any): any => {
        set((state: any) => ({
            ...state,
            selectedFloors: selectedFloors
        }))
    },
    setFloors: (floors: any): any => {
        set((state: any) => ({
            ...state,
            floors: floors
        }))
    },
    setSelectedTableIds: (selectedTableIds: string): any => {
        set((state: any) => ({
            ...state,
            selectedTableIds: selectedTableIds
        }))
    },
    setSelectedGridIds: (selectedGridIds: string): any => {
        set((state: any) => ({
            ...state,
            selectedGridIds: selectedGridIds
        }))
    },
    setFieldId: (fieldId: number): any => {
        set((state: any) => ({
            ...state,
            fieldId: fieldId
        }))
    },
    setTableFieldId: (tableFieldId: number): any => {
        set((state: any) => ({
            ...state,
            tableFieldId: tableFieldId
        }))
    },
    setGridFieldId: (gridFieldId: number): any => {
        set((state: any) => ({
            ...state,
            gridFieldId: gridFieldId
        }))
    },
    setAssetIndexArray: (assetIndexArray: number): any => {
        set((state: any) => ({
            ...state,
            assetIndexArray: assetIndexArray
        }))
    },
    setFormValues: (formValues: number): any => {
        set((state: any) => ({
            ...state,
            formValues: formValues
        }))
    },
    setShowDetails: (showDetails: boolean): any => {
        set((state: any) => ({
            ...state,
            showDetails: showDetails
        }))
    },
    setIndexId: (indexId: number): any => {
        set((state: any) => ({
            ...state,
            indexId: indexId
        }))
    },
    setLightColor: (lightColor: string): any => {
        set((state: any) => ({
            ...state,
            lightColor: lightColor
        }))
    },
    setLightIntensity: (lightIntensity: number): any => {
        set((state: any) => ({
            ...state,
            lightIntensity: lightIntensity
        }))
    },
    setLocationList: (locationList: any): any => {
        set((state: any) => ({
            ...state,
            locationList: locationList
        }))
    },
    setWallsOpacity: (wallsOpacity: number): any => {
        set((state: any) => ({
            ...state,
            wallsOpacity: wallsOpacity
        }))
    },
    setHtmlData: (htmlData: any): any => {
        set((state: any) => ({
            ...state,
            htmlData: htmlData
        }))
    },

    setTemplate: (template: any): any => {
        set((state: any) => ({
            ...state,
            template: template
        }))
    },
    setSearchCenter: (searchCenter: any): any => {
        set((state: any) => ({
            ...state,
            searchCenter: searchCenter
        }))
    },
    setSearchDimensions: (searchDimensions: any): any => {
        set((state: any) => ({
            ...state,
            searchDimensions: searchDimensions
        }))
    },
    setCharacterRef: (characterRef: any): any => {
        set((state: any) => ({
            ...state,
            characterRef: characterRef
        }))
    },
    setFloorHeight: (floorHeight: number): any => {
        set((state: any) => ({
            ...state,
            floorHeight: floorHeight
        }))
    },
    setPlayerViewAngle: (playerViewAngle: number): any => {
        set((state: any) => ({
            ...state,
            playerViewAngle: playerViewAngle
        }))
    },
    setisProductsOpen: (isProductsOpen: boolean): any => {
        set((state: any) => ({
            ...state,
            isProductsOpen: isProductsOpen
        }))
    },
    setLocationId: (locationId: string): any => {
        set((state: any) => ({
            ...state,
            locationId: locationId
        }))
    },

    setSearchList: (searchList: any): any => {
        set((state: any) => ({
            ...state,
            searchList: searchList
        }))
    },


    setIsCameraMoving: (isCameraMoving: boolean): any => {
        set((state: any) => ({
            ...state,
            isCameraMoving: isCameraMoving
        }))
    },

    setPersonColor: (personColor: string): any => {
        set((state: any) => ({
            ...state,
            personColor: personColor
        }))
    },

    setLights: (lights: boolean): any => {
        set((state: any) => ({
            ...state,
            lights: lights
        }))
    },
    setUserData: (userData: any): any => {
        set((state: any) => ({
            ...state,
            userData: userData
        }))
    },
    setModelTreeChecks: (modelTreeChecks: any): any => {
        set((state: any) => ({
            ...state,
            modelTreeChecks: modelTreeChecks
        }))
    }, setLabelRenderer: (labelRenderer: any): any => {
        set((state: any) => ({
            ...state,
            labelRenderer: labelRenderer
        }))
    }, setPlayBackward: (playBackward: boolean): any => {
        set((state: any) => ({
            ...state,
            playBackward: playBackward
        }))
    },
    setPlabel: (pLabel: boolean): any => {
        set((state: any) => ({
            ...state,
            pLabel: pLabel
        }))
    },
    setShowObject: (showObject: boolean): any => {
        set((state: any) => ({
            ...state,
            showObject: showObject
        }))
    },
    setShowBox: (showBox: boolean): any => {
        set((state: any) => ({
            ...state,
            showBox: showBox
        }))
    },
    setShowFoam: (showFoam: boolean): any => {
        set((state: any) => ({
            ...state,
            showFoam: showFoam
        }))
    },
    setPlayerActions: (playerActions: any): any => {
        set((state: any) => ({
            ...state,
            playerActions: playerActions
        }))
    },
    setShowBdims: (showBdims: boolean): any => {
        set((state: any) => ({
            ...state,
            showBdims: showBdims
        }))
    },
    setShowFdims: (showFdims: boolean): any => {
        set((state: any) => ({
            ...state,
            showFdims: showFdims
        }))
    },
    setShowOdims: (showOdims: boolean): any => {
        set((state: any) => ({
            ...state,
            showOdims: showOdims
        }))
    },
    setPause: (pause: boolean): any => {
        set((state: any) => ({
            ...state,
            pause: pause
        }))
    },
    setAnimate: (animate: boolean): any => {
        set((state: any) => ({
            ...state,
            animate: animate
        }))
    },
    setIsComponentTree: (isComponentTree: boolean): any => {
        set((state: any) => ({
            ...state,
            isComponentTree: isComponentTree
        }))
    },

    setComponentTree: (componentTree: any): any => {
        set((state: any) => ({
            ...state,
            componentTree: componentTree
        }))
    },
    setPackageControl: (packageControl: boolean): any => {
        set((state: any) => ({
            ...state,
            packageControl: packageControl
        }))
    },
    setIsPackage: (isPackage: boolean): any => {
        set((state: any) => ({
            ...state,
            isPackage: isPackage
        }))
    },
    setCollision: (collision: boolean): any => {
        set((state: any) => ({
            ...state,
            collision: collision
        }));
    },
    setColliders: (colliders: any): any => {
        set((state: any) => ({
            ...state,
            colliders: colliders
        }));
    },
    setImagesToSave: (imagesToSave: any): any => {
        set((state: any) => ({
            ...state,
            imagesToSave: imagesToSave
        }));
    },
    setImages: (images: any): any => {
        set((state: any) => ({
            ...state,
            images: images
        }));
    },
    setIsCamera: (isCamera: boolean): any => {
        set((state: any) => ({
            ...state,
            isCamera: isCamera
        }));
    },
    setScan: (scan: boolean): any => {
        set((state: any) => ({
            ...state,
            scan: scan
        }));
    },
    setScannedId: (scannedId: boolean): any => {
        set((state: any) => ({
            ...state,
            scannedId: scannedId
        }));
    },

    setScanner: (scanner: boolean): any => {
        set((state: any) => ({
            ...state,
            scanner: scanner
        }));
    },
    setAnnotations: (annotations: boolean): any => {
        set((state: any) => ({
            ...state,
            annotations: annotations
        }));
    },
    setIframeLazy: (iframeLazy: boolean): any => {
        set((state: any) => ({
            ...state,
            iframeLazy: iframeLazy
        }));
    },
    setFloorMap: (floorMap: boolean): any => {
        set((state: any) => ({
            ...state,
            floorMap: floorMap
        }));
    },
    setExpandedKeys: (expandedKeys: any): any => {
        set((state: any) => ({
            ...state,
            expandedKeys: expandedKeys
        }));
    },

    setGridAssets: (gridAssets: any): any => {
        set((state: any) => ({
            ...state,
            gridAssets: gridAssets
        }));
    },
    setRawCategories: (rawCategories: any): any => {
        set((state: any) => ({
            ...state,
            rawCategories: rawCategories
        }));
    },
    setProjectSceneData: (projectSceneData: any, projectSceneKey: any = null): any => {
        set((state: any) => ({
            ...state,
            projectSceneData,
            projectSceneKey
        }));
    },

    setCatId: (catId: number): any => {
        set((state: any) => ({
            ...state,
            catId: catId
        }));
    },
    setCategoriesData: (categoriesData: any): any => {
        set((state: any) => ({
            ...state,
            categoriesData: categoriesData
        }));
    },
    setDocumentsEvent: (documentsEvent: any): any => {
        set((state: any) => ({
            ...state,
            documentsEvent: documentsEvent
        }));
    },
    setCheckedItems: (checkedItems: any): any => {
        set((state: any) => ({
            ...state,
            checkedItems: checkedItems
        }));
    },

    setDocuments: (documents: boolean): any => {
        set((state: any) => ({
            ...state,
            documents: documents
        }));
    },
    setAssetEdit: (assetEdit: boolean): any => {
        set((state: any) => ({
            ...state,
            assetEdit: assetEdit
        }));
    },
    setCheckReload: (checkReload: number): any => {
        set((state: any) => ({
            ...state,
            checkReload: checkReload
        }));
    },
    setFloorValue: (floorValue: number): any => {
        set((state: any) => ({
            ...state,
            floorValue: floorValue
        }));
    }, setJumpPointsEvent: (jumpPointsEvent: any): any => {
        set((state: any) => ({
            ...state,
            jumpPointsEvent: jumpPointsEvent
        }));
    },
    setJumpPoints: (jumpPoints: boolean): any => {
        set((state: any) => ({
            ...state,
            jumpPoints: jumpPoints
        }));
    },

    setNonRealtime: (nonRealtime: Set<string>): any => {
        set((state: any) => ({
            ...state,
            nonRealtime: nonRealtime

        }));
    },
    setDisplayDialog: (displayDialog: any): any => {
        set((state: any) => ({
            ...state,
            displayDialog: displayDialog

        }));
    },
    setNewDevicePath: (newDevicePath: any): any => {
        set((state: any) => ({
            ...state,
            newDevicePath: newDevicePath

        }));
    },
    setDotEvent: (dotEvent: any): any => {
        set((state: any) => ({
            ...state,
            dotEvent: dotEvent

        }));
    },
    setLabel: (label: any): any => {
        set((state: any) => ({
            ...state,
            label: label

        }));
    }, setCordinates: (cordinates: any): any => {
        set((state: any) => ({
            ...state,
            cordinates: cordinates

        }));
    },
    setDots: (dots: any): any => {
        set((state: any) => ({
            ...state,
            dots: dots

        }));
    },
    setLocation: (location: any): any => {
        set((state: any) => ({
            ...state,
            location: location

        }));
    }, setBranch: (branch: any): any => {
        set((state: any) => ({
            ...state,
            branch: branch

        }));
    },
    setDevicePath: (devicePath: any): any => {
        set((state: any) => ({
            ...state,
            devicePath: devicePath

        }));
    },
    setReload: (reload: any): any => {
        set((state: any) => ({
            ...state,
            reload: reload

        }));
    }, setFirstPerson: (firstPerson: boolean): any => {
        set((state: any) => ({
            ...state,
            firstPerson: firstPerson

        }));
    },
    setPlayerSpeed: (playerSpeed: number): any => {
        set((state: any) => ({
            ...state,
            playerSpeed: playerSpeed

        }));
    },
    setPlayerMap: (playerMap: any): any => {
        set((state: any) => ({
            ...state,
            playerMap: playerMap

        }));
    },
    setClientId: (clientId: string): any => {
        set((state: any) => ({
            ...state,
            clientId: clientId

        }));
    },
    setTranformation: (tranformation: any): any => {
        set((state: any) => ({
            ...state,
            tranformation: tranformation

        }));
    },
    setFps: (fps: boolean): any => {

        set((state: any) => ({
            ...state,
            fps: fps

        }));
    },

    setLazyMsg: (lazyMsg: string): any => {
        set((state: any) => ({
            ...state,
            lazyMsg: lazyMsg

        }));
    },
    setLazy: (lazy: boolean): any => {
        set((state: any) => ({
            ...state,
            lazy: lazy

        }));
    },
    setShowVideo: (showVideo: boolean): any => {
        set((state: any) => ({
            ...state,
            showVideo: showVideo

        }));
    },
    setToggleSideBar: (toggleSideBar: string): any => {
        set((state: any) => ({
            ...state,
            toggleSideBar: toggleSideBar

        }));
    },

    setProjectID: (projectID: boolean): any => {
        set((state: any) => ({
            ...state,
            projectID: projectID

        }));
    },
    setvideoLink: (videoLink: string): any => {
        set((state: any) => ({
            ...state,
            videoLink: videoLink

        }));
    },
    setvideoRawLink: (videoRawLink: string): any => {
        set((state: any) => ({
            ...state,
            videoRawLink: videoRawLink

        }));
    },
    setCategoryEvent: (categoryEvent: any): any => {
        set((state: any) => ({
            ...state,
            categoryEvent: categoryEvent

        }));
    },
    setChannelEvent: (channelEvent: any): any => {
        set((state: any) => ({
            ...state,
            channelEvent: channelEvent

        }));
    },
    setGridlEvent: (gridlEvent: any): any => {
        set((state: any) => ({
            ...state,
            gridlEvent: gridlEvent

        }));
    },
    setChannel: (channel: boolean): any => {
        set((state: any) => ({
            ...state,
            channel: channel

        }));
    }, setCategory: (category: boolean): any => {
        set((state: any) => ({
            ...state,
            category: category

        }));
    },
    setUpdatedFieldsMap: (updatedFieldsMap: object): any => {
        set((state: any) => ({
            ...state,
            updatedFieldsMap: updatedFieldsMap

        }));
    }, setFieldsMap: (fieldsMap: string): any => {
        set((state: any) => ({
            ...state,
            fieldsMap: fieldsMap

        }));
    }, setFormStatus: (formStatus: string): any => {
        set((state: any) => ({
            ...state,
            formStatus: formStatus

        }));
    }, setDrawerOpen: (drawerOpen: boolean): any => {
        set((state: any) => ({
            ...state,
            drawerOpen: drawerOpen

        }));
    }, setInfo: (info: boolean): any => {
        set((state: any) => ({
            ...state,
            info: info

        }));
    },
    setSelectedAsset: (selectedAsset: any): any => {
        set((state: any) => ({
            ...state,
            selectedAsset: selectedAsset

        }));
    },
    setMatList: (matList: Array<object>): any => {
        set((state: any) => ({
            ...state,
            matList: matList

        }));
    }, setProjectList: (projectList: Array<number>): any => {
        set((state: any) => ({
            ...state,
            projectList: projectList

        }));
    }, setEditable: (editable: boolean): any => {
        set((state: any) => ({
            ...state,
            editable: editable

        }));
    },
    setSelectedAssetId: (selectedAssetId: number): any => {
        set((state: any) => ({
            ...state,
            selectedAssetId: selectedAssetId

        }));
    }, setRoof: (roof: any): any => {
        set((state: any) => ({
            ...state,
            roof: roof

        }));
    },
    setMultiplayer: (multiplayer: any): any => {
        set((state: any) => ({
            ...state,
            multiplayer: multiplayer

        }));
    },
    setVisiblePopup: (isPopupOpen: any): any => {
        set((state: any) => ({
            ...state,
            isPopupOpen: isPopupOpen

        }));
    },
    updateAssets: (assets: any, projectID: number): any => {
        set((state: any) => ({
            ...state,
            assets: assets,
            projectID: projectID

        }));
    },
    setShadow: (shadow: any): any => {
        set(() => {
            return { shadow: shadow };
        });
    },
    setWalls: (walls: any): any => {
        set((state: any) => ({
            ...state,
            walls: walls

        }));
    },
    setAnims: (anims: any): any => {
        set((state: any) => ({
            ...state,
            anims: anims

        }));
    },
    setPlayersGrid: (players: any): any => {
        set((state: any) => ({
            ...state,
            players: players

        }));
    },
    setAssets: (searchAssets: Map<string, object>): any => {
        set((state: any) => ({
            ...state,
            searchAssets: searchAssets

        }));
    },
    setEditPopup: (editPopup: boolean): any => {
        set((state: any) => ({
            ...state,
            editPopup: editPopup

        }));
    },

    setCharacter: (character: boolean): any => {
        set((state: any) => ({
            ...state,
            character: character

        }));
    },
    setSearchItem: (searchItem: number): any => {
        set((state: any) => ({
            ...state,
            searchItem: searchItem

        }));
    },
    setGizmo: (gizmo: any): any => {
        set((state: any) => ({
            ...state,
            gizmo: gizmo

        }));
    },
    setSound: (sound: any): any => {
        set((state: any) => ({
            ...state,
            sound: sound

        }));
    },
    setGrid: (grid: any): any => {
        set((state: any) => ({
            ...state,
            grid: grid

        }));
    },
    setCamera: (camera: string): any => {
        set((state: any) => ({
            ...state,
            camera: camera

        }));
    },
    setMap: (map: boolean): any => {
        set((state: any) => ({
            ...state,
            map: map

        }));
    },

}));

// @ts-ignore
export default useGame;


