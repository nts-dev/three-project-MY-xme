import React, { useCallback, useEffect, useRef } from "react";
import { FaEye, FaLocationArrow, FaTag, FaEllipsisH, FaVideo, FaRobot, FaCamera, FaSatelliteDish, FaMap, FaSmog } from "react-icons/fa";
import useGame from "../../../../hooks/useGame";
import { publicAssetUrl } from "../../../../puzzleUi/publicAssetUrl";
import VrViewButton from "./VrViewButton";
import RobotTrialControls from "./RobotTrialControls";
import "./PlayMobileSplit.css";
import useTopView from "../../../topview/topViewStore";
import { useWeatherStore } from "../../../weather/weatherStore";
import { MdGpsFixed } from "react-icons/md";
import useLiveGps from "../../../livegps/liveGpsStore";
import { sceneHasTerrain } from "../../../../threejs/terrain/terrainData";
import { FaRoute } from "react-icons/fa";
import useGpsRouteTest from "../../../livegps/gpsRouteTest";
import GpsRouteTestPanel from "../../../livegps/GpsRouteTestPanel";
import { routeTestFor } from "../../../../threejs/player/gpsRoutes";

// Phones (see PlayMobileSplit.css): while the map is navigated freely, the map takes the top 2/3
// of the screen and the bottom 1/3 shows the details popup, or these buttons when it is closed.
const MOBILE_SPLIT_CLASS = "play-mobile-split";
const MOBILE_WALK_CLASS = "play-mobile-walk";

const characterIconUrl = publicAssetUrl("character.svg");
const freeCameraIconUrl = publicAssetUrl("freecamera.svg");
const navigationIconUrl = publicAssetUrl("navigation.svg");

const VIEW_CONTROLS = [
    {
        id: "firstPerson",
        label: "First person view",
        short: "First person",
        Icon: FaVideo,
    },
    {
        id: "character",
        label: "Character view",
        short: "Character",
        src: characterIconUrl,
    },
    {
        id: "orbit",
        label: "Free navigation view",
        short: "Free view",
        src: freeCameraIconUrl,
    },
];

/** Top view map on / off (the map with the blue dot, components/topview/TopViewMap.jsx). */
function TopViewButton() {
    const open = useTopView((s) => s.open);
    const toggle = useTopView((s) => s.toggle);
    const label = open ? "Hide top view map" : "Show top view map";
    return (
        <button
            type="button"
            className={`play-view-controls__button${open ? " is-active" : ""}`}
            aria-label={label}
            aria-pressed={open}
            data-tooltip={label}
            data-short="Map"
            onClick={toggle}
        >
            <FaMap className="play-view-controls__svg-icon" aria-hidden="true" />
        </button>
    );
}

/** Fog / haze on / off: off keeps the map visible when zoomed far out (RainEffect.jsx). */
function FogButton() {
    const hidden = useWeatherStore((s) => s.fogHidden);
    const toggle = useWeatherStore((s) => s.toggleFog);
    const label = hidden ? "Show fog" : "Hide fog";
    return (
        <button
            type="button"
            className={`play-view-controls__button${hidden ? " is-active" : ""}`}
            aria-label={label}
            aria-pressed={hidden}
            data-tooltip={label}
            data-short={hidden ? "Fog off" : "Fog"}
            onClick={toggle}
        >
            <FaSmog className="play-view-controls__svg-icon" aria-hidden="true" />
        </button>
    );
}

/**
 * Live GPS on / off: this device streams its real position, and the others see this player's
 * avatar walk the real route on the map (liveGpsStore.js, gpsTrack.ts). Only on map (terrain) scenes.
 */
function LiveGpsButton() {
    const onMap = useGame((s) => sceneHasTerrain(s, s.projectID));
    const status = useLiveGps((s) => s.status);
    const accuracy = useLiveGps((s) => s.accuracy);
    const error = useLiveGps((s) => s.error);
    const toggle = useLiveGps((s) => s.toggle);
    const stop = useLiveGps((s) => s.stop);
    useEffect(() => () => stop(), [stop]); // leaving play mode / the map ends the stream
    if (!onMap) return null;
    const on = status === "live" || status === "waiting";
    const label = status === "live"
        ? `Stop sharing live GPS (±${accuracy} m)`
        : status === "waiting"
            ? "Live GPS: waiting for a fix… (tap to stop)"
            : error || "Share live GPS: your avatar follows your real position";
    return (
        <button
            type="button"
            className={`play-view-controls__button play-view-controls__button--live-gps is-${status}${on ? " is-active" : ""}`}
            aria-label={label}
            aria-pressed={on}
            data-tooltip={label}
            data-short={status === "live" ? `GPS ±${accuracy} m` : status === "waiting" ? "GPS…" : "Live GPS"}
            onClick={toggle}
        >
            <MdGpsFixed className="play-view-controls__svg-icon" aria-hidden="true" />
        </button>
    );
}

/**
 * GPS route walk: the own avatar walks a route between two buildings (picked in the panel; preset per
 * project, e.g. 153_L2 NTS Computers -> Girbau Southeast Asia) in character view, driven by live GPS
 * fixes and held on the route's blue line (gpsRouteTest.js): simulated fixes, or on a phone its
 * precise GPS.
 */
function GpsRouteTestButton({ enterCharacterView }) {
    const projectID = useGame((s) => s.projectID);
    const onMap = useGame((s) => sceneHasTerrain(s, s.projectID));
    const active = useGpsRouteTest((s) => s.active);
    const open = useGpsRouteTest((s) => s.open);
    const preset = routeTestFor(projectID);
    useEffect(() => () => useGpsRouteTest.getState().close(), []);
    if (!onMap) return null;
    const label = active ? "Stop the GPS route walk" : open ? "Close GPS route walks" : "GPS route walk: pick two buildings and walk between them";
    const run = async (walkMode) => {
        const state = useGpsRouteTest.getState();
        const current = state.route;
        // The route shown (Show route) when it is still From -> To; otherwise planned now.
        const route = current && state.fromId && current.test.fromId === state.fromId && current.test.toId === state.toId ? current : await state.plan();
        if (route && useGpsRouteTest.getState().start(route.test, walkMode, route)) enterCharacterView();
    };
    const onClick = () => {
        const state = useGpsRouteTest.getState();
        if (state.active) state.stop();
        else if (state.open) state.close();
        else {
            state.preset(preset);
            state.show();
        }
    };
    return (
        <>
            <button
                type="button"
                className={`play-view-controls__button play-view-controls__button--gps-route${active || open ? " is-active" : ""}`}
                aria-label={label}
                aria-pressed={active || open}
                data-tooltip={label}
                data-short={active ? "Stop route" : "Route walk"}
                onClick={onClick}
            >
                <FaRoute className="play-view-controls__svg-icon" aria-hidden="true" />
            </button>
            <GpsRouteTestPanel onStart={run} />
        </>
    );
}

export default function PlayModeViewControls() {
    // Phones: the menu sheet is as tall as its buttons; the map gets the rest of the screen
    // (--play-menu-h on <body>, read by PlayMobileSplit.css).
    const toolbarRef = useRef(null);
    useEffect(() => {
        const element = toolbarRef.current;
        if (!element || typeof ResizeObserver !== "function") return undefined;
        const update = () => {
            const height = element.getBoundingClientRect().height;
            if (window.innerWidth <= 760 && height > 0) document.body.style.setProperty("--play-menu-h", `${Math.ceil(height)}px`);
            else document.body.style.removeProperty("--play-menu-h");
        };
        const observer = new ResizeObserver(update);
        observer.observe(element);
        window.addEventListener("resize", update);
        update();
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", update);
            document.body.style.removeProperty("--play-menu-h");
        };
    }, []);

    const firstPerson = useGame((state) => state.firstPerson);
    const character = useGame((state) => state.character);
    const setFirstPerson = useGame((state) => state.setFirstPerson);
    const setCharacter = useGame((state) => state.setCharacter);
    const setButtonMode = useGame((state) => state.setButtonMode);
    const playerTrackReplay = useGame((state) => state.playerTrackReplay);
    const setPlayerTrackReplay = useGame((state) => state.setPlayerTrackReplay);
    const cameraPathReplay = useGame((state) => state.cameraPathReplay);
    const cameraPathSource = useGame((state) => state.cameraPathSource);
    const setCameraPathSource = useGame((state) => state.setCameraPathSource);
    const rtlsRouteDots = useGame((state) => state.rtlsRouteDots);
    const setRtlsRouteDots = useGame((state) => state.setRtlsRouteDots);
    const robotRouteDots = useGame((state) => state.robotRouteDots);
    const setRobotRouteDots = useGame((state) => state.setRobotRouteDots);
    const robotFirstPerson = useGame((state) => state.robotFirstPerson);
    const setRobotFirstPerson = useGame((state) => state.setRobotFirstPerson);
    const robotRealtimeFollow = useGame((state) => state.robotRealtimeFollow);
    const setRobotRealtimeFollow = useGame((state) => state.setRobotRealtimeFollow);
    const setCameraPathReplay = useGame((state) => state.setCameraPathReplay);
    const cameraRealtimeFollow = useGame((state) => state.cameraRealtimeFollow);
    const setCameraRealtimeFollow = useGame((state) => state.setCameraRealtimeFollow);

    const activeView = firstPerson ? "firstPerson" : character ? "character" : "orbit";

    // Character / first-person views keep the full screen (their joystick sits at the bottom) and
    // get their own compact layout.
    useEffect(() => {
        const className = activeView === "orbit" ? MOBILE_SPLIT_CLASS : MOBILE_WALK_CLASS;
        document.body.classList.add(className);
        return () => document.body.classList.remove(className);
    }, [activeView]);

    const setViewMode = useCallback(
        (mode) => {
            setCameraPathReplay(false);
            setCameraRealtimeFollow(false);
            setRobotFirstPerson(false);
            setRobotRealtimeFollow(false);

            if (mode === "firstPerson") {
                setButtonMode("Play mode");
                setFirstPerson(true);
                setCharacter(false);
                return;
            }

            if (mode === "character") {
                setButtonMode("Play mode");
                setFirstPerson(false);
                setCharacter(true);
                return;
            }

            setButtonMode("Play mode");
            setFirstPerson(false);
            setCharacter(false);
        },
        [setButtonMode, setCameraPathReplay, setCameraRealtimeFollow, setCharacter, setFirstPerson, setRobotFirstPerson, setRobotRealtimeFollow]
    );

    const toggleCameraPathReplay = useCallback((source) => {
        const nextCameraPathReplay = !cameraPathReplay || cameraPathSource !== source;

        setButtonMode("Play mode");
        setFirstPerson(false);
        setCharacter(false);
        setRobotFirstPerson(false);
        setRobotRealtimeFollow(false);
        setCameraPathSource(source);
        setCameraPathReplay(nextCameraPathReplay);
        if (nextCameraPathReplay) setCameraRealtimeFollow(false);
    }, [cameraPathReplay, cameraPathSource, setCameraPathSource, setButtonMode, setCameraPathReplay, setCameraRealtimeFollow, setCharacter, setFirstPerson, setRobotFirstPerson, setRobotRealtimeFollow]);

    const toggleCameraRealtimeFollow = useCallback(() => {
        const nextCameraRealtimeFollow = !cameraRealtimeFollow;

        setButtonMode("Play mode");
        if (nextCameraRealtimeFollow) {
            setFirstPerson(false);
            setCharacter(false);
            setCameraPathReplay(false);
            setRobotFirstPerson(false);
            setRobotRealtimeFollow(false);
        }
        setCameraRealtimeFollow(nextCameraRealtimeFollow);
    }, [cameraRealtimeFollow, setButtonMode, setCameraPathReplay, setCameraRealtimeFollow, setCharacter, setFirstPerson, setRobotFirstPerson, setRobotRealtimeFollow]);

    const toggleRobotFirstPerson = useCallback(() => {
        const nextRobotFirstPerson = !robotFirstPerson;

        setButtonMode("Play mode");
        if (nextRobotFirstPerson) {
            setFirstPerson(false);
            setCharacter(false);
            setCameraPathReplay(false);
            setCameraRealtimeFollow(false);
            setRobotRealtimeFollow(false);
            // The robot must actually be visible/walking for first-person to show anything.
            setRobotRouteDots(true);
        }
        setRobotFirstPerson(nextRobotFirstPerson);
    }, [robotFirstPerson, setButtonMode, setCameraPathReplay, setCameraRealtimeFollow, setCharacter, setFirstPerson, setRobotFirstPerson, setRobotRealtimeFollow, setRobotRouteDots]);

    const toggleRobotRealtimeFollow = useCallback(() => {
        const nextRobotRealtimeFollow = !robotRealtimeFollow;

        setButtonMode("Play mode");
        if (nextRobotRealtimeFollow) {
            setFirstPerson(false);
            setCharacter(false);
            setCameraPathReplay(false);
            setCameraRealtimeFollow(false);
            setRobotFirstPerson(false);
        }
        setRobotRealtimeFollow(nextRobotRealtimeFollow);
    }, [robotRealtimeFollow, setButtonMode, setCameraPathReplay, setCameraRealtimeFollow, setCharacter, setFirstPerson, setRobotFirstPerson, setRobotRealtimeFollow]);

    return (
        <div ref={toolbarRef} className="play-view-controls" role="toolbar" aria-label="Play mode view controls">
            <div className="play-view-controls__radio" role="radiogroup" aria-label="Camera mode">
                {VIEW_CONTROLS.map(({ id, label, short, Icon: ViewIcon, src }) => {
                    return (
                        <button
                            key={id}
                            type="button"
                            className={`play-view-controls__button${activeView === id ? " is-active" : ""}`}
                            aria-label={label}
                            aria-checked={activeView === id}
                            data-tooltip={label}
                            data-short={short}
                            role="radio"
                            onClick={() => setViewMode(id)}
                        >
                            {src ? (
                                <img className={`play-view-controls__asset-icon play-view-controls__asset-icon--${id}`} src={src} alt="" aria-hidden="true" />
                            ) : (
                                React.createElement(ViewIcon, { className: `play-view-controls__svg-icon play-view-controls__svg-icon--${id}`, "aria-hidden": "true" })
                            )}
                        </button>
                    );
                })}
                <VrViewButton />
            </div>

            <TopViewButton />
            <FogButton />
            <LiveGpsButton />
            <GpsRouteTestButton enterCharacterView={() => setViewMode("character")} />

            <button
                type="button"
                className={`play-view-controls__button play-view-controls__button--camera-path${cameraPathReplay && cameraPathSource === "gps" ? " is-active" : ""}`}
                aria-label={cameraPathReplay && cameraPathSource === "gps" ? "Stop GPS camera route" : "Play GPS camera route"}
                aria-pressed={cameraPathReplay && cameraPathSource === "gps"}
                data-tooltip={cameraPathReplay && cameraPathSource === "gps" ? "Stop GPS camera route" : "Play GPS camera route"}
                data-short="GPS route"
                onClick={() => toggleCameraPathReplay("gps")}
            >
                <FaLocationArrow className="play-view-controls__svg-icon play-view-controls__svg-icon--cameraPath" aria-hidden="true" />
            </button>

            <button
                type="button"
                className={`play-view-controls__button${cameraPathReplay && cameraPathSource === "rtls" ? " is-active" : ""}`}
                aria-label={cameraPathReplay && cameraPathSource === "rtls" ? "Stop RTLS tag camera route" : "Play RTLS tag camera route"}
                aria-pressed={cameraPathReplay && cameraPathSource === "rtls"}
                data-tooltip={cameraPathReplay && cameraPathSource === "rtls" ? "Stop RTLS tag camera route" : "Play RTLS tag camera route"}
                data-short="RTLS route"
                onClick={() => toggleCameraPathReplay("rtls")}
            >
                <FaTag className="play-view-controls__svg-icon" aria-hidden="true" />
            </button>

            <button
                type="button"
                className={`play-view-controls__button${rtlsRouteDots ? " is-active" : ""}`}
                aria-label={rtlsRouteDots ? "Hide RTLS route dots" : "Show RTLS route dots"}
                aria-pressed={rtlsRouteDots}
                data-tooltip={rtlsRouteDots ? "Hide RTLS route dots" : "Show RTLS route dots"}
                data-short="RTLS dots"
                onClick={() => setRtlsRouteDots(!rtlsRouteDots)}
            >
                <FaEllipsisH className="play-view-controls__svg-icon" aria-hidden="true" />
            </button>

            <button
                type="button"
                className={`play-view-controls__button${robotRouteDots ? " is-active" : ""}`}
                aria-label={robotRouteDots ? "Hide robot path" : "Show robot path"}
                aria-pressed={robotRouteDots}
                data-tooltip={robotRouteDots ? "Hide robot path" : "Show robot path"}
                data-short="Robot path"
                onClick={() => setRobotRouteDots(!robotRouteDots)}
            >
                <FaRobot className="play-view-controls__svg-icon" aria-hidden="true" />
            </button>

            <RobotTrialControls />

            <button
                type="button"
                className={`play-view-controls__button${robotFirstPerson ? " is-active" : ""}`}
                aria-label={robotFirstPerson ? "Exit Raspbot first-person view" : "Raspbot First-Person View"}
                aria-pressed={robotFirstPerson}
                data-tooltip={robotFirstPerson ? "Exit Raspbot first-person view" : "Raspbot First-Person View"}
                data-short="Robot view"
                onClick={toggleRobotFirstPerson}
            >
                <FaCamera className="play-view-controls__svg-icon" aria-hidden="true" />
            </button>

            <button
                type="button"
                className={`play-view-controls__button${robotRealtimeFollow ? " is-active" : ""}`}
                aria-label={robotRealtimeFollow ? "Stop real-time robot follow" : "Follow robot (real-time)"}
                aria-pressed={robotRealtimeFollow}
                data-tooltip={robotRealtimeFollow ? "Stop real-time robot follow" : "Follow robot (real-time)"}
                data-short="Follow robot"
                onClick={toggleRobotRealtimeFollow}
            >
                <FaSatelliteDish className="play-view-controls__svg-icon" aria-hidden="true" />
            </button>

            <button
                type="button"
                className={`play-view-controls__button play-view-controls__button--camera-realtime${cameraRealtimeFollow ? " is-active" : ""}`}
                aria-label={cameraRealtimeFollow ? "Stop realtime camera follow" : "Follow walking camera"}
                aria-pressed={cameraRealtimeFollow}
                data-tooltip={cameraRealtimeFollow ? "Stop realtime camera follow" : "Follow walking camera"}
                data-short="Follow camera"
                onClick={toggleCameraRealtimeFollow}
            >
                <FaEye className="play-view-controls__svg-icon play-view-controls__svg-icon--cameraRealtime" aria-hidden="true" />
            </button>

            <button
                type="button"
                className={`play-view-controls__button play-view-controls__button--navigation${playerTrackReplay ? " is-active" : ""}`}
                aria-label={playerTrackReplay ? "Stop player track" : "Play player track"}
                aria-pressed={playerTrackReplay}
                data-tooltip={playerTrackReplay ? "Stop player track" : "Play player track"}
                data-short="Player track"
                onClick={() => setPlayerTrackReplay(!playerTrackReplay)}
            >
                <img className="play-view-controls__asset-icon play-view-controls__asset-icon--navigation" src={navigationIconUrl} alt="" aria-hidden="true" />
            </button>
        </div>
    );
}
