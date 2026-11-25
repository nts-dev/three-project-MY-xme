import { useEffect } from "react";
import useGame from "../../hooks/useGame";
import { useGame1 } from "../../hooks/useGame1";
import { rainIntensity, useSkyStore, useWeatherStore } from "./weatherStore";
import { onFootstep, useSoundStore } from "./soundStore";
import { onStrike } from "./lightning";

// Ambient sound for the map, all synthesised with Web Audio (no sound files):
//  - rain: band-passed noise (hiss) plus a low wash, louder with the rain level;
//  - wind: low-passed noise whose filter and level drift slowly (gusts), from the wind speed;
//  - thunder: in thunderstorms (or ?weather=storm), a rumble every 15-45 s;
//  - footsteps: in character mode while the avatar walks or runs (faster steps when running,
//    splashier on wet ground).
// Browsers only start audio after a click or key press, so the context resumes on the first one.

const STEP_INTERVAL = { Walk: 0.45, Run: 0.3 }; // fallback seconds between footsteps (avatars without foot bones)

function noiseBuffer(ctx, seconds, kind) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (kind === "brown") {
            last = (last + 0.02 * white) / 1.02;
            data[i] = last * 3.5;
        } else {
            data[i] = white;
        }
    }
    return buffer;
}

function loop(ctx, buffer, destination, filters) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    let node = source;
    for (const f of filters) {
        node.connect(f);
        node = f;
    }
    const gain = ctx.createGain();
    gain.gain.value = 0;
    node.connect(gain).connect(destination);
    source.start();
    return gain;
}

function createEngine() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const white = noiseBuffer(ctx, 3, "white");
    const brown = noiseBuffer(ctx, 4, "brown");
    const filter = (type, frequency, Q = 0.7) => {
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = frequency;
        f.Q.value = Q;
        return f;
    };
    const rainHiss = loop(ctx, white, master, [filter("highpass", 1200), filter("lowpass", 7000)]);
    const rainWash = loop(ctx, brown, master, [filter("lowpass", 900)]);
    const windFilter = filter("lowpass", 400, 1.2);
    const wind = loop(ctx, brown, master, [windFilter]);

    const engine = { ctx, master, rainHiss, rainWash, wind, windFilter, nextThunder: 0, nextStep: 0, wet: 0 };

    engine.thunder = (distance = 600, delay = 0) => {
        const t = ctx.currentTime + 0.05 + delay;
        const near = Math.min(1, Math.max(0.25, 400 / distance)); // closer: louder and sharper
        const source = ctx.createBufferSource();
        source.buffer = brown;
        const lp = filter("lowpass", 900);
        lp.frequency.setValueAtTime(500 + 900 * near, t);
        lp.frequency.exponentialRampToValueAtTime(120, t + 3.5);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(1.8 * near, t + 0.08 + Math.random() * 0.3); // crack / roll onset
        gain.gain.exponentialRampToValueAtTime(0.6 * near, t + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 4 + Math.random() * 2);
        source.connect(lp).connect(gain).connect(master);
        source.start(t, Math.random() * 2);
        source.stop(t + 6.5);
    };

    // A shoe on paving: heel strike (muffled low impact + body resonance), a few grit grains, then
    // the toe-off; on wet ground a short splash. Every step varies a little (level, pitch, timing).
    const burst = (t, { type = "bandpass", freq, q = 1, gain, attack = 0.002, decay, offset = Math.random() * 2.5 }) => {
        const src = ctx.createBufferSource();
        src.buffer = white;
        const f = filter(type, freq, q);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
        src.connect(f).connect(g).connect(master);
        src.start(t, offset);
        src.stop(t + attack + decay + 0.02);
    };
    const vary = (v, k = 0.15) => v * (1 + (Math.random() * 2 - 1) * k);
    engine.step = (running) => {
        const t = ctx.currentTime + 0.005;
        const level = running ? 1.25 : 1;
        // Heel: low muffled hit and the short "body" of the shoe.
        burst(t, { type: "lowpass", freq: vary(running ? 420 : 340), q: 0.8, gain: vary(0.9 * level), decay: vary(0.07) });
        burst(t, { freq: vary(150), q: 2.5, gain: vary(0.6 * level), attack: 0.003, decay: vary(0.09) });
        // Grit under the sole: tiny bright grains over the first few tens of ms.
        const grains = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < grains; i++) {
            burst(t + 0.004 + Math.random() * (running ? 0.03 : 0.05), { type: "highpass", freq: vary(3500, 0.3), q: 0.7, gain: vary(0.07 * level, 0.5), attack: 0.001, decay: vary(0.008, 0.5) });
        }
        // Toe-off: a softer second contact.
        const toe = t + vary(running ? 0.045 : 0.085, 0.2);
        burst(toe, { freq: vary(900), q: 1.2, gain: vary(0.25 * level), decay: vary(0.04) });
        // Wet ground: splash.
        if (engine.wet > 0) {
            burst(t + 0.01, { freq: vary(4200, 0.2), q: 0.9, gain: vary((0.12 + 0.25 * engine.wet) * level), attack: 0.004, decay: vary(0.14) });
            burst(toe, { type: "highpass", freq: vary(5000, 0.2), q: 0.7, gain: vary(0.08 + 0.12 * engine.wet), decay: vary(0.08) });
        }
    };
    return engine;
}

export default function WeatherSound() {
    useEffect(() => {
        let engine = null;
        const ensure = () => {
            if (!engine) engine = createEngine();
            if (engine?.ctx.state === "suspended") engine.ctx.resume().catch(() => {});
        };
        // Audio may only start after a user gesture.
        const onGesture = () => ensure();
        window.addEventListener("pointerdown", onGesture);
        window.addEventListener("keydown", onGesture);
        // Footsteps from the avatar's animation (foot touch-downs); the timer below is only a
        // fallback for avatars without foot bones.
        const offStrike = onStrike(({ distance }) => {
            if (engine && useSoundStore.getState().on && engine.ctx.state === "running") engine.thunder(distance, distance / 343);
        });
        let lastAnimatedStep = -Infinity;
        const offStep = onFootstep(({ running }) => {
            lastAnimatedStep = performance.now();
            if (engine && useSoundStore.getState().on && engine.ctx.state === "running") engine.step(running);
        });

        let gust = 0;
        const timer = setInterval(() => {
            if (!engine) return;
            const { ctx, master } = engine;
            const now = ctx.currentTime;
            const on = useSoundStore.getState().on;
            master.gain.setTargetAtTime(on ? 0.6 : 0, now, 0.3);
            if (!on) return;

            const { weather, preview } = useWeatherStore.getState();
            const rain = rainIntensity(weather, preview);
            engine.wet = rain;
            engine.rainHiss.gain.setTargetAtTime(rain > 0 ? 0.05 + 0.25 * rain : 0, now, 1.5);
            engine.rainWash.gain.setTargetAtTime(rain > 0 ? 0.08 + 0.35 * rain : 0, now, 1.5);

            // Wind: audible from ~5 km/h, full by ~40 km/h; gusts drift the level and pitch.
            const windPreview = useSkyStore.getState().windPreview;
            const speed = windPreview ?? (Number.isFinite(weather?.windSpeed) ? weather.windSpeed : 0);
            const strength = Math.min(1, Math.max(0, (speed - 5) / 35));
            gust += (Math.random() - 0.5) * 0.3;
            gust *= 0.95;
            engine.wind.gain.setTargetAtTime(strength * (0.25 + 0.12 * gust), now, 0.8);
            engine.windFilter.frequency.setTargetAtTime(250 + 500 * strength + 200 * gust, now, 0.8);

            // Thunder: played per lightning strike (onStrike above).

            // Footsteps while the avatar walks or runs (character mode only).
            const anim = useGame1.getState().curAnimation;
            const interval = useGame.getState().character ? STEP_INTERVAL[anim] : undefined;
            if (interval && performance.now() - lastAnimatedStep > 1500) {
                if (now >= engine.nextStep) {
                    engine.step(anim === "Run");
                    engine.nextStep = now + interval * (0.95 + Math.random() * 0.1);
                }
            } else {
                engine.nextStep = 0;
            }
        }, 50);

        return () => {
            clearInterval(timer);
            offStep();
            offStrike();
            window.removeEventListener("pointerdown", onGesture);
            window.removeEventListener("keydown", onGesture);
            engine?.ctx.close().catch(() => {});
        };
    }, []);
    return null;
}
