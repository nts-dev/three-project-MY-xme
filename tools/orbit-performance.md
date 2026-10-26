Browser check for project 153_L1 (2026-10-26)

Tested the real scene from the configured local API in headless Chrome, using
the NVIDIA Quadro M620 through ANGLE/D3D11. The viewport remained 1424 x 805,
DPR 1, with hardware antialiasing enabled throughout the drag.

The profiling script sends 180 mouse moves along the same orbit gesture,
starting at camera [5, 25, 50], target [0, 0, 0]. Frame times come from
requestAnimationFrame; triangle counts come from WebGLRenderer.info.render.

| Measurement | Original category batches | Spatial batches |
| --- | ---: | ---: |
| Mean frame time | 71.18 ms | 20.06 ms |
| Approximate mean FPS | 14.0 | 49.8 |
| Triangles in the last sampled frame | 20,958,619 | 6,523,993 |
| Hardware antialiasing | Enabled | Enabled |
| Canvas size during gesture | 1424 x 805 | 1424 x 805 |

Raw captures: orbit-before.json and orbit-after.json. Results depend on camera
position, GPU, and other running work; distant views containing more buildings
will benefit less from frustum culling. Spatial batches increase draw calls
while substantially reducing the geometry submitted in this tested view.

A direct framebuffer comparison at the final tested camera position compared
all 1,146,320 pixels: no pixel differed by more than one 8-bit channel value.
The saved screenshot is orbit-after.png. The saved implementation was also
checked after a full page reload: four categories created 99 spatial batches.

To repeat, start Vite on localhost:3001 and Chrome with remote debugging on
port 9223 using a separate temporary browser profile. Use localhost rather than
127.0.0.1 for the page origin; the local API allows localhost:3001 through CORS.

    node tools/profile-orbit.mjs --navigate --inspect
    node tools/profile-orbit.mjs --measure
    node tools/profile-orbit.mjs --orbit --baseline --output tools/orbit-before.json
    node tools/profile-orbit.mjs --orbit --output tools/orbit-after.json
    node tools/profile-orbit.mjs --visual-check

Wait for the scene to finish loading before profiling. --baseline temporarily
draws the original parent meshes and hides the spatial children, then restores
the optimized rendering after the measurement. It does not modify scene data.
