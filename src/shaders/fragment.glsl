uniform float uTime;
uniform vec2 uHover;
uniform vec2 uClicks[5];
uniform float uClickTimes[5]; // ← Add this
varying vec2 vUv;

float ripple(vec2 uv, vec2 center, float time, float speed, float frequency, float amplitude) {
    float dist = distance(uv, center);
    return sin((dist - time * speed) * frequency) * amplitude / (1.0 + 10.0 * dist);
}

void main() {
    vec2 uv = vUv;
    float effect = 0.0;

    // Hover ripple (constant)
    if (uHover.x >= 0.0) {
        effect += ripple(uv, uHover, uTime, 1.0, 30.0, 0.13);
    }

    // Click ripples with fading
    for (int i = 0; i < 5; i++) {
        if (uClicks[i].x >= 0.0) {
            float age = uTime - uClickTimes[i];
            if (age < 5.0) { // 5 seconds lifespan
                float fade = exp(-age * 1.8); // exponential fade
                effect += ripple(uv, uClicks[i], age, 1.2, 25.0, 0.08 * fade);
            }
        }
    }

    vec3 base = vec3(0.1, 0.2, 0.3);
    vec3 finalColor = base + vec3(effect);
    gl_FragColor = vec4(finalColor, 0.5);
}
