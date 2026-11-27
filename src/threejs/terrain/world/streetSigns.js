import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { isBridgeShown, regionToScene } from "./bridgeMeshes";

// Street name signs from the regions' signs.json (backend scripts/terrain/steps/streetSigns.mjs):
// a post per junction with a blade per street, the local name on top and the English name below
// it when there is one. All blade texts share a few atlas textures, so the whole set is a handful
// of draw calls (posts, blade backs, one text mesh per atlas).

const POST_HEIGHT = 3.1; // metres to the top of the upper blade
const POST_RADIUS = 0.045;
const BLADE_GAP = 0.04; // between stacked blades
const STEM_RADIUS = 0.014; // holds the blades above the post, inside them (hidden by their faces)
const BLADE_THICKNESS = 0.035;
const PX_PER_METRE = 170; // text atlas resolution on the blade
const NAME_PX = 40; // local name text height (px)
const EN_PX = 28; // English name text height (px)
const PAD_PX = 14;
const MAX_TEXT_PX = 900; // longer names are squeezed
const ATLAS = 2048;
const SIGN_GREEN = "#0d6b3c";
const FONT = '"Arial Narrow", Arial, "Helvetica Neue", sans-serif';

/** Region signs in region coordinates, with the region (for its ground and scene frame). */
function collectSigns(regions) {
    const signs = [];
    for (const region of regions) {
        for (const sign of region.signs || []) {
            if (!sign.blades?.length) continue;
            // Like the bridges: none near the region's edge, where its ground fades out.
            if (!isBridgeShown(region, { points: [[sign.x, sign.z], [sign.x, sign.z]] })) continue;
            signs.push({ region, sign });
        }
    }
    return signs;
}

/** Packs one text cell per distinct blade (name + English) into atlas canvases (shelf packing). */
function buildAtlases(texts) {
    const measure = document.createElement("canvas").getContext("2d");
    const cells = new Map();
    const atlases = [];
    let atlas = null;
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    const newAtlas = () => {
        const canvas = document.createElement("canvas");
        canvas.width = ATLAS;
        canvas.height = ATLAS;
        const context = canvas.getContext("2d");
        context.fillStyle = SIGN_GREEN;
        context.fillRect(0, 0, ATLAS, ATLAS);
        atlas = { canvas, context, used: 0 };
        atlases.push(atlas);
        x = 0;
        y = 0;
        rowHeight = 0;
    };
    for (const [key, { name, en }] of texts) {
        measure.font = `bold ${NAME_PX}px ${FONT}`;
        const nameWidth = measure.measureText(name).width;
        measure.font = `${EN_PX}px ${FONT}`;
        const enWidth = en ? measure.measureText(en).width : 0;
        const textWidth = Math.min(MAX_TEXT_PX, Math.max(nameWidth, enWidth));
        const w = Math.ceil(textWidth + 2 * PAD_PX);
        const h = Math.ceil(en ? NAME_PX * 1.25 + EN_PX * 1.25 + PAD_PX * 1.2 : NAME_PX * 1.3 + PAD_PX * 1.2);
        if (!atlas || x + w > ATLAS) {
            x = 0;
            y += rowHeight;
            rowHeight = 0;
        }
        if (!atlas || y + h > ATLAS) newAtlas();
        const { context } = atlas;
        // White border inset, then the text (squeezed horizontally when too long).
        context.strokeStyle = "#f4f4ee";
        context.lineWidth = 3;
        context.strokeRect(x + 5, y + 5, w - 10, h - 10);
        context.fillStyle = "#f8f8f2";
        context.textAlign = "center";
        context.textBaseline = "middle";
        const centreX = x + w / 2;
        const drawText = (text, px, weight, cy, natural) => {
            context.font = `${weight}${px}px ${FONT}`;
            const squeeze = Math.min(1, MAX_TEXT_PX / Math.max(1, natural));
            context.save();
            context.translate(centreX, cy);
            context.scale(squeeze, 1);
            context.fillText(text, 0, 0);
            context.restore();
        };
        if (en) {
            drawText(name, NAME_PX, "bold ", y + PAD_PX * 0.6 + NAME_PX * 0.68, nameWidth);
            drawText(en, EN_PX, "", y + h - PAD_PX * 0.6 - EN_PX * 0.68, enWidth);
        } else {
            drawText(name, NAME_PX, "bold ", y + h / 2 + 1, nameWidth);
        }
        cells.set(key, { atlas: atlases.length - 1, x, y, w, h });
        atlas.used = Math.max(atlas.used, y + h);
        x += w;
        rowHeight = Math.max(rowHeight, h);
    }
    return { cells, atlases };
}

const LABEL_SPACING = 180; // metres of street per name label
const LABEL_LIFT = 0.12; // above the ground (the road meshes are 0.06 - 0.09 up)
const LABEL_NAME_PX = 56;
const LABEL_EN_PX = 38;
const LABEL_REPEAT_DISTANCE = 150; // no second label of the same street this close

/** Point at distance `at` along a polyline [[x, z], ...] with cumulative lengths. */
function along(points, cumulative, at) {
    let i = 1;
    while (i < points.length - 1 && cumulative[i] < at) i++;
    const t = Math.max(0, Math.min(1, (at - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1)));
    const [x1, z1] = points[i - 1];
    const [x2, z2] = points[i];
    return [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t];
}

/** The named streets of the regions as flat text along the roads (one mesh, one atlas). */
function buildStreetLabels(regions, frame, anchorElevation, groundAt, maxAnisotropy) {
    const streets = [];
    for (const region of regions) {
        for (const street of region.streets || []) if (street.points?.length >= 2) streets.push({ region, street });
    }
    if (!streets.length) return null;

    // Text cells: white with a dark outline on a transparent atlas.
    const measure = document.createElement("canvas").getContext("2d");
    const texts = new Map();
    for (const { street } of streets) texts.set(`${street.name}\n${street.en ?? ""}`, street);
    const canvas = document.createElement("canvas");
    canvas.width = ATLAS;
    canvas.height = ATLAS;
    const context = canvas.getContext("2d");
    const cells = new Map();
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    for (const [key, { name, en }] of texts) {
        measure.font = `bold ${LABEL_NAME_PX}px ${FONT}`;
        const nameWidth = measure.measureText(name).width;
        measure.font = `${LABEL_EN_PX}px ${FONT}`;
        const enWidth = en ? measure.measureText(en).width : 0;
        const w = Math.ceil(Math.max(nameWidth, enWidth) + 16);
        const h = Math.ceil(en ? LABEL_NAME_PX * 1.2 + LABEL_EN_PX * 1.2 + 8 : LABEL_NAME_PX * 1.25 + 8);
        if (x + w > ATLAS) {
            x = 0;
            y += rowHeight;
            rowHeight = 0;
        }
        if (y + h > ATLAS || w > ATLAS) continue; // atlas full: this street goes without a label
        const draw = (text, px, weight, cy) => {
            context.font = `${weight}${px}px ${FONT}`;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.lineJoin = "round";
            context.lineWidth = px * 0.16;
            context.strokeStyle = "rgba(20, 24, 28, 0.85)";
            context.strokeText(text, x + w / 2, cy);
            context.fillStyle = "#ffffff";
            context.fillText(text, x + w / 2, cy);
        };
        if (en) {
            draw(name, LABEL_NAME_PX, "bold ", y + 4 + LABEL_NAME_PX * 0.6);
            draw(en, LABEL_EN_PX, "", y + h - 4 - LABEL_EN_PX * 0.6);
        } else {
            draw(name, LABEL_NAME_PX, "bold ", y + h / 2);
        }
        cells.set(key, { x, y, w, h });
        x += w;
        rowHeight = Math.max(rowHeight, h);
    }

    const positions = [];
    const uvs = [];
    const indices = [];
    const placed = [];
    for (const { region, street } of streets) {
        const cell = cells.get(`${street.name}\n${street.en ?? ""}`);
        if (!cell) continue;
        const toScene = regionToScene(region, frame, anchorElevation);
        const points = street.points.map(([px, pz]) => {
            const p = toScene(px, pz, 0);
            return [p.x, p.z];
        });
        const cumulative = [0];
        for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
        const length = cumulative[cumulative.length - 1];
        // Letters about 0.7 of the half carriageway high (2.5 .. 5.5 m): readable from the usual aerial views.
        const letter = Math.min(5.5, Math.max(2.5, (street.half ?? 3.5) * 0.7));
        const scale = letter / LABEL_NAME_PX; // metres per atlas pixel
        const width = cell.w * scale;
        const height = cell.h * scale;
        if (length < width * 1.2) continue;
        const count = Math.max(1, Math.floor(length / LABEL_SPACING));
        for (let k = 0; k < count; k++) {
            const centre = (length * (k + 0.5)) / count;
            // On a straight stretch (the label is a flat straight quad): shift along until one is found.
            let spot = null;
            for (const shift of [0, 15, -15, 30, -30, 50, -50]) {
                const at = centre + shift;
                if (at - width / 2 < 0 || at + width / 2 > length) continue;
                const a = along(points, cumulative, at - width / 2);
                const b = along(points, cumulative, at + width / 2);
                const chord = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
                let straight = true;
                for (let f = 0.25; f < 1 && straight; f += 0.25) {
                    const m = along(points, cumulative, at - width / 2 + width * f);
                    const off = Math.abs((m[0] - a[0]) * (b[1] - a[1]) - (m[1] - a[1]) * (b[0] - a[0])) / chord;
                    if (off > letter * 0.3) straight = false;
                }
                if (straight) {
                    spot = [a, b];
                    break;
                }
            }
            if (!spot) continue;
            const [a, b] = spot;
            const cx = (a[0] + b[0]) / 2;
            const cz = (a[1] + b[1]) / 2;
            if (placed.some((p) => p.name === street.name && Math.hypot(p.x - cx, p.z - cz) < LABEL_REPEAT_DISTANCE)) continue;
            placed.push({ name: street.name, x: cx, z: cz });
            // Reading direction east-ish (upright on a north-up view); the text top to its left.
            let ux = b[0] - a[0];
            let uz = b[1] - a[1];
            const ul = Math.hypot(ux, uz) || 1;
            ux /= ul;
            uz /= ul;
            if (ux < -0.05 || (Math.abs(ux) <= 0.05 && uz > 0)) {
                ux = -ux;
                uz = -uz;
            }
            const vx = uz;
            const vz = -ux;
            const start = positions.length / 3;
            for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
                const px = cx + (ux * su * width) / 2 + (vx * sv * height) / 2;
                const pz = cz + (uz * su * width) / 2 + (vz * sv * height) / 2;
                const ground = groundAt(px, pz);
                positions.push(px, (Number.isFinite(ground) ? ground : 0) + LABEL_LIFT, pz);
                uvs.push((su < 0 ? cell.x : cell.x + cell.w) / ATLAS, 1 - (sv < 0 ? cell.y + cell.h : cell.y) / ATLAS);
            }
            indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
        }
    }
    if (!indices.length) return null;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = maxAnisotropy;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -12,
        toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "street_name_labels";
    mesh.renderOrder = 2;
    return { mesh, disposables: [texture, geometry, material] };
}

/**
 * Builds the street name signs of the given regions. `groundAt(x, z)` gives the scene ground
 * height (y) at scene x, z. Returns { group, count, dispose }.
 */
export function buildStreetSigns({ regions, frame, anchorElevation, groundAt, maxAnisotropy = 8 }) {
    const group = new THREE.Group();
    group.name = "world_street_signs";
    const entries = collectSigns(regions);
    if (!entries.length && !regions.some((region) => region.streets?.length)) return { group, count: 0, dispose: () => {} };

    const texts = new Map();
    for (const { sign } of entries) {
        for (const blade of sign.blades) texts.set(`${blade.name}\n${blade.en ?? ""}`, blade);
    }
    const { cells, atlases } = buildAtlases(texts);

    const textParts = atlases.map(() => ({ positions: [], normals: [], uvs: [], indices: [] }));
    const backs = [];
    const posts = [];
    const stems = [];
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);

    for (const { region, sign } of entries) {
        const toScene = regionToScene(region, frame, anchorElevation);
        const base = toScene(sign.x, sign.z, 0);
        const ground = groundAt(base.x, base.z);
        if (!Number.isFinite(ground)) continue;
        // The post ends under the blades (it covered the middle of the name); a thin stem inside
        // the blades holds them.
        let top = ground + POST_HEIGHT;
        const stackHeight = sign.blades.reduce((sum, blade) => sum + cells.get(`${blade.name}
${blade.en ?? ""}`).h / PX_PER_METRE + BLADE_GAP, -BLADE_GAP);
        const postTop = top - stackHeight;
        posts.push([base.x, ground - 0.3, base.z, postTop - ground + 0.3]);
        stems.push([base.x, postTop, base.z, stackHeight - 0.01]);
        for (const blade of sign.blades) {
            const cell = cells.get(`${blade.name}\n${blade.en ?? ""}`);
            const width = cell.w / PX_PER_METRE;
            const height = cell.h / PX_PER_METRE;
            const centreY = top - height / 2;
            top -= height + BLADE_GAP;
            // Blade along the street: local +x along the heading (x east, z south in both frames).
            quaternion.setFromAxisAngle(up, -blade.heading);
            matrix.compose(new THREE.Vector3(base.x, centreY, base.z), quaternion, new THREE.Vector3(1, 1, 1));
            const back = new THREE.BoxGeometry(width, height, BLADE_THICKNESS);
            back.deleteAttribute("uv");
            back.applyMatrix4(matrix);
            backs.push(back);
            // Text on both faces, each readable from its side.
            const part = textParts[cell.atlas];
            const u0 = cell.x / ATLAS;
            const u1 = (cell.x + cell.w) / ATLAS;
            const v0 = 1 - (cell.y + cell.h) / ATLAS;
            const v1 = 1 - cell.y / ATLAS;
            const offset = BLADE_THICKNESS / 2 + 0.002;
            for (const face of [1, -1]) {
                const start = part.positions.length / 3;
                const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
                const normal = new THREE.Vector3(0, 0, face).applyQuaternion(quaternion);
                for (const [cx, cy] of corners) {
                    const p = new THREE.Vector3((cx * width) / 2, (cy * height) / 2, face * offset).applyMatrix4(matrix);
                    part.positions.push(p.x, p.y, p.z);
                    part.normals.push(normal.x, normal.y, normal.z);
                    // Front: left-to-right along +x; back: mirrored so it reads from behind.
                    const u = (face === 1 ? cx : -cx) < 0 ? u0 : u1;
                    part.uvs.push(u, cy < 0 ? v0 : v1);
                }
                if (face === 1) part.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
                else part.indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
            }
        }
    }

    const disposables = [];
    const metal = new THREE.MeshStandardMaterial({ color: "#8d9093", roughness: 0.5, metalness: 0.6 });
    const bladeBack = new THREE.MeshStandardMaterial({ color: SIGN_GREEN, roughness: 0.6, metalness: 0.1 });
    disposables.push(metal, bladeBack);

    if (posts.length) {
        const postGeometry = new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, 1, 8);
        postGeometry.translate(0, 0.5, 0);
        const postMesh = new THREE.InstancedMesh(postGeometry, metal, posts.length);
        posts.forEach(([x, y, z, length], i) => {
            matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, length, 1));
            postMesh.setMatrixAt(i, matrix);
        });
        postMesh.instanceMatrix.needsUpdate = true;
        postMesh.computeBoundingSphere();
        postMesh.name = "street_sign_posts";
        group.add(postMesh);
        const stemGeometry = new THREE.CylinderGeometry(STEM_RADIUS, STEM_RADIUS, 1, 6);
        stemGeometry.translate(0, 0.5, 0);
        const stemMesh = new THREE.InstancedMesh(stemGeometry, metal, stems.length);
        stems.forEach(([x, y, z, length], i) => {
            matrix.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, length, 1));
            stemMesh.setMatrixAt(i, matrix);
        });
        stemMesh.instanceMatrix.needsUpdate = true;
        stemMesh.computeBoundingSphere();
        stemMesh.name = "street_sign_stems";
        group.add(stemMesh);
        disposables.push(postGeometry, stemGeometry);
    }
    if (backs.length) {
        const merged = mergeGeometries(backs);
        backs.forEach((geometry) => geometry.dispose());
        const mesh = new THREE.Mesh(merged, bladeBack);
        mesh.name = "street_sign_blades";
        group.add(mesh);
        disposables.push(merged);
    }
    atlases.forEach((atlas, i) => {
        const part = textParts[i];
        if (!part.indices.length) return;
        const texture = new THREE.CanvasTexture(atlas.canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = maxAnisotropy;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(part.normals, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(part.uvs, 2));
        geometry.setIndex(part.indices);
        geometry.computeBoundingSphere();
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0.05 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `street_sign_text_${i}`;
        group.add(mesh);
        disposables.push(texture, geometry, material);
    });
    // Names along the roads, flat on the asphalt: readable from above (a sign is a few pixels there).
    const labels = buildStreetLabels(regions, frame, anchorElevation, groundAt, maxAnisotropy);
    if (labels) {
        group.add(labels.mesh);
        disposables.push(...labels.disposables);
    }
    group.traverse((object) => {
        if (!object.isMesh) return;
        object.receiveShadow = true;
        object.userData.isTerrain = true;
        object.raycast = () => {}; // not pickable
    });

    return {
        group,
        count: posts.length,
        dispose: () => {
            group.removeFromParent();
            disposables.forEach((item) => item.dispose());
        },
    };
}
