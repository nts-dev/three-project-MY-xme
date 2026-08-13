import * as THREE from 'three'
import useGame from "../../hooks/useGame";
import {useFrame, useThree} from "@react-three/fiber";
import {useCallback, useEffect, useMemo, useRef} from "react";

const AUDIO_UPDATE_INTERVAL = 0.12;
const AUDIBLE_DISTANCE = 5;
const AUDIBLE_DISTANCE_SQ = AUDIBLE_DISTANCE * AUDIBLE_DISTANCE;
const VOLUME_EPSILON = 0.025;

export default function VideoTexture({object}: any) {

    const character: any = useGame((state: any) => state.character)
    const firstPerson: any = useGame((state: any) => state.firstPerson)
    const characterRef = useGame((state:any)  => state.characterRef)
    const {camera} = useThree()
    const listener = useMemo(() => new THREE.AudioListener(), []);
    const videosRef = useRef<any[]>([]);
    const audioUpdateAccumulatorRef = useRef(0);
    const characterStateRef = useRef({character, firstPerson, characterRef});
    const characterPositionRef = useMemo(() => new THREE.Vector3(), []);

    useEffect(() => {
        characterStateRef.current = {character, firstPerson, characterRef};
    }, [character, firstPerson, characterRef]);

    useEffect(() => {
        camera.add(listener);
        return () => {
            camera.remove(listener);
        };
    }, [camera, listener]);

    const createPositionalAudio = useCallback((videoElement:any) => {
        const positionalAudio = new THREE.PositionalAudio(listener);

        // Create a MediaElementAudioSourceNode from the video element's audio
        const audioContext = positionalAudio.context;
        const source = videoElement.__videoTextureAudioSource || audioContext.createMediaElementSource(videoElement);
        videoElement.__videoTextureAudioSource = source;
        positionalAudio.userData.source = source;

        // Connect the video audio to the positional audio node
        source.connect(positionalAudio.gain);

        // Set initial positional audio properties
        positionalAudio.setRefDistance(3); // Adjust based on desired distance effect
        positionalAudio.setVolume(0);

        return positionalAudio;
    }, [listener]);

    const createVideoAudioEntry = useCallback((video: any, position: THREE.Vector3) => ({
        video,
        position,
        audio: createPositionalAudio(video),
        audible: false,
        volume: 0,
    }), [createPositionalAudio]);

    const creatVideoElement = useCallback((url: string, webmUrl: string) => {
        const videoElement = document.createElement('video');
        videoElement.loop = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.preload = "metadata";

        const mp4Source = document.createElement('source');
        mp4Source.src = url;
        mp4Source.type = 'video/mp4';

        const webmSource = document.createElement('source');
        webmSource.src = webmUrl;
        webmSource.type = 'video/webm';
        videoElement.appendChild(mp4Source);
        videoElement.appendChild(webmSource);
        videoElement.play().catch(() => {});


        const videoTexture = new THREE.VideoTexture(videoElement);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.format = THREE.RGBFormat;
        videoTexture.needsUpdate = true;
        // @ts-ignore
        return [new THREE.MeshStandardMaterial({
            map: videoTexture,
            emissive: '#020b19',
        }), videoElement];
    }, []);

    useEffect(() => {
    const localVideos: any[] = [];
    const createdMaterials = new Set<any>();
    const createdVideos = new Set<any>();
    let envTexture: THREE.Texture | null = null;
    let disposed = false;
    const matFuryG10List = creatVideoElement(`${import.meta.env.VITE_VIDEO_URL}/ZBook Fury G10 _ Z by HP.mp4`, `${import.meta.env.VITE_VIDEO_URL}/ZBook Fury G10 _ Z by HP.webm`)

    const matFuryG10 = matFuryG10List[0];
    const matFuryVideo = matFuryG10List[1];

    const matFuryG5List = creatVideoElement(`${import.meta.env.VITE_VIDEO_URL}/Z8 Fury G5 _ Z by HP.mp4`, `${import.meta.env.VITE_VIDEO_URL}/Z8 Fury G5 _ Z by HP.webm`)
    const matFuryG5 = matFuryG5List[0]
    const matFuryG5Video = matFuryG5List[1];

    const matFireList = creatVideoElement(`${import.meta.env.VITE_VIDEO_URL}/ZBook Firefly G10 _ Z by HP.mp4`, `${import.meta.env.VITE_VIDEO_URL}/ZBook Firefly G10 _ Z by HP.webm`)
    const matFire = matFireList[0]
    const matFireVideo = matFireList[1]

    const matStudioList = creatVideoElement(`${import.meta.env.VITE_VIDEO_URL}/ZBook Studio G10 _ Z by HP.mp4`, `${import.meta.env.VITE_VIDEO_URL}/ZBook Studio G10 _ Z by HP.webm`)
    const matStudio = matStudioList[0]
    const matStudioVideo = matStudioList[1]
    const matList = creatVideoElement(`${import.meta.env.VITE_VIDEO_URL}/Z8 Fury G5 _ Z by HP.mp4`, `${import.meta.env.VITE_VIDEO_URL}/Z8 Fury G5 _ Z by HP.webm`)
    const mat = matList[0]
    const matVideo = matList[1];
    [matFuryG10, matFuryG5, matFire, matStudio, mat].forEach((material) => createdMaterials.add(material));
    [matFuryVideo, matFuryG5Video, matFireVideo, matStudioVideo, matVideo].forEach((video) => createdVideos.add(video));



        new THREE.TextureLoader().load(
            `${import.meta.env.VITE_VIDEO_URL}/light.png`,
            function (texture) {
                if (disposed) {
                    texture.dispose();
                    return;
                }

                texture.mapping = THREE.EquirectangularReflectionMapping;
                texture.colorSpace = THREE.SRGBColorSpace;
                envTexture = texture;
                const pngBackground = texture;

                object.traverse(function (child: any) {
                    if (child.isMesh) {
                        // Ensure child.material exists
                        if (!child.material) return;

                        // Handle both single material and array of materials
                        const materials = Array.isArray(child.material) ? child.material : [child.material];

                        materials.forEach((material: any, matId: number) => {
                            if (!material.color) {
                                material.color = new THREE.Color(0xffffff); // Set a default color
                            }

                            // const standardMaterial = new THREE.MeshStandardMaterial();
                            // standardMaterial.copy(material); // Copy the existing material properties
                            material.metalness = 0.0;
                            material.roughness = 0.1;
                            material.envMap = pngBackground;
                            material.envMapIntensity = 0.8;
                            material.emissiveIntensity = 1.5;
                            material.needsUpdate = true;

                            // Replace the material
                            materials[matId] = material//standardMaterial;

                            if (material.name.includes("Screen_")) {
                                // Handle screen-specific materials and videos
                                switch (material.name) {
                                    case "Screen_02":
                                        materials[matId] = matFuryG10;
                                        localVideos.push(createVideoAudioEntry(matFuryVideo, new THREE.Vector3(3, 0.9, 27.7)));
                                        break;
                                    case "Screen_01":
                                        materials[matId] = matFuryG5;
                                        localVideos.push(createVideoAudioEntry(matFuryG5Video, new THREE.Vector3(1.5, 2.4, 7.4)));
                                        break;
                                    case "Screen_04":
                                        materials[matId] = matFire;
                                        localVideos.push(createVideoAudioEntry(matFireVideo, new THREE.Vector3(12.9, 1.9, 24.8)));
                                        break;
                                    case "Screen_11":
                                        materials[matId] = matStudio;
                                        localVideos.push(createVideoAudioEntry(matVideo, new THREE.Vector3(3.1, 2.02, 29.15)));
                                        break;
                                    case "Screen_12":
                                        materials[matId] = matStudio;
                                        localVideos.push(createVideoAudioEntry(matVideo, new THREE.Vector3(4.6, 1.8, 31.82)));
                                        break;
                                    case "Screen_13":
                                        materials[matId] = matStudio;
                                        localVideos.push(createVideoAudioEntry(matVideo, new THREE.Vector3(3.19, 1.47, 33)));
                                        break;
                                    case "Screen_14":
                                        materials[matId] = matStudio;
                                        localVideos.push(createVideoAudioEntry(matStudioVideo, new THREE.Vector3(4.2, 1.9, 30)));
                                        break;
                                }
                            }
                        });

                        // Re-assign materials if it was an array
                        if (Array.isArray(child.material)) {
                            child.material = materials;
                        } else {
                            child.material = materials[0];
                        }
                    }
                });
                videosRef.current = localVideos;
            }
        );

        return () => {
            disposed = true;
            const audioSources = new Set<any>();
            videosRef.current.forEach(({audio}) => {
                audio.stop();
                if (audio.userData.source) {
                    audioSources.add(audio.userData.source);
                }
            });
            audioSources.forEach((source) => source.disconnect?.());
            createdVideos.forEach((video) => {
                video.pause();
                video.removeAttribute("src");
                video.load();
            });
            videosRef.current = [];
            createdMaterials.forEach((material: any) => {
                material.map?.dispose?.();
                material.dispose?.();
            });
            envTexture?.dispose?.();
        };

    }, [createVideoAudioEntry, creatVideoElement, object]);

    const updateAudio = useCallback(() => {
        const {character: currentCharacter, firstPerson: currentFirstPerson, characterRef: currentCharacterRef} = characterStateRef.current;
        let sourcePosition = camera.position;

        if((currentCharacter|| currentFirstPerson) && currentCharacterRef){

            const currentPosition = currentCharacterRef.translation();
            characterPositionRef.set(currentPosition.x,currentPosition.y,currentPosition.z)
            sourcePosition = characterPositionRef;

        }

        for (let i = 0; i < videosRef.current.length; i += 1) {
            const entry = videosRef.current[i];
            const { video, position, audio } = entry;
            const distanceSq = sourcePosition.distanceToSquared(position);
            const isAudible = distanceSq < AUDIBLE_DISTANCE_SQ;

            if (isAudible) {
                const volume = THREE.MathUtils.clamp(1 - Math.sqrt(distanceSq) / AUDIBLE_DISTANCE, 0, 1);

                if (!entry.audible) {
                    if (video.muted) video.muted = false;
                    if (!audio.isPlaying) audio.play();
                    entry.audible = true;
                }

                if (Math.abs(volume - entry.volume) > VOLUME_EPSILON) {
                    audio.setVolume(volume);
                    entry.volume = volume;
                }
            } else if (entry.audible) {
                if (!video.muted) video.muted = true;
                if (audio.isPlaying) audio.stop();
                if (entry.volume !== 0) {
                    audio.setVolume(0);
                    entry.volume = 0;
                }
                entry.audible = false;
            }
        }
    }, [camera, characterPositionRef]);

    useFrame((_, delta)=>{
        audioUpdateAccumulatorRef.current += delta;
        if (audioUpdateAccumulatorRef.current < AUDIO_UPDATE_INTERVAL) return;
        audioUpdateAccumulatorRef.current = 0;
        updateAudio()
    })
    // Function to check distance and mute/unmute video audio

    //
    // // Call updateAudio in your animation loop
    // const animate = () => {
    //     requestAnimationFrame(animate);
    //     updateAudio();
    // }
    //
    // animate(); // Start the animation loop

    return null;
}
