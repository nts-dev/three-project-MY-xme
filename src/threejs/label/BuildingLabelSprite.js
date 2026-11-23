import * as THREE from "three";
import { getBusinessKind } from "../../components/popup/gui/playAssetInfo/businessKind";

const META_FIELD_NAMES = [
    "Company Name",
    "Business Type",
    "Business Description",
    "Website Url",
    "Telephone",
    "Street Name",
    "Building Number",
    "Opening Hours",
    "Comments",
];

const LABEL_FIELD_NAMES = [
    "Company Name",
    "AssetName",
    "Name",
    "Business Type",
];

const LABEL_FONT = "\"Plus Jakarta Sans\", \"Inter\", \"Segoe UI\", Arial, sans-serif";
const LABEL_TOP_OFFSET = 0.3;
const LABEL_WIDTH = 9.3 * 1.4 * 1.5;
const LABEL_HEIGHT = 3.42 * 1.4;
const labelLogoCache = new Map();

const getFieldValue = (fields, names) => {
   
    if (!fields) {
        return "";
    }

    for (const name of names) {
        const direct = fields[name];
         
        const directValue = direct?.value ?? direct;
        
        if (directValue !== undefined && directValue !== null && String(directValue).trim()) {
            
            return String(directValue).trim();
        }
    }

    const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
    for (const field of Object.values(fields)) {
        const fieldName = String(field?.name || "").trim().toLowerCase();
        const value = field?.value;
        if (normalizedNames.has(fieldName) && value !== undefined && value !== null && String(value).trim()) {
            return String(value).trim();
        }
    }

    return "";
};

const hasBusinessMetadata = (fields) =>
    META_FIELD_NAMES.some((name) => getFieldValue(fields, [name]));

const detectCategory = (fields, name) => {
    const businessType = getFieldValue(fields, ["Business Type"]);
    const description = getFieldValue(fields, ["Business Description", "Comments"]);
    const text = `${businessType} ${description} ${name || ""}`.toLowerCase();

    if (/restaurant|food|beverage|cafe|coffee|tomyam|kitchen|dining|meal|snack/.test(text)) {
        return "food";
    }
    if (/school|education|teaching|tuition|college|academy|book|publisher/.test(text)) {
        return "education";
    }
    if (/clinic|hospital|health|medical|skin care|pharmacy|dental/.test(text)) {
        return "health";
    }
    if (/car|auto|vehicle|motor|workshop|parking/.test(text)) {
        return "auto";
    }
    if (/shop|store|retail|market|salon|mart/.test(text)) {
        return "retail";
    }

    return "service";
};

const truncateText = (context, text, maxWidth) => {
    const value = String(text || "").trim();
    if (!value || context.measureText(value).width <= maxWidth) {
        return value;
    }

    let next = value;
    while (next.length > 1 && context.measureText(`${next}...`).width > maxWidth) {
        next = next.slice(0, -1);
    }

    return `${next.trim()}...`;
};

const roundRect = (context, x, y, width, height, radius) => {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
};

const loadLogoImage = (logoUrl) => new Promise((resolve) => {
    if (!logoUrl) {
        resolve(null);
        return;
    }

    const cachedLogo = labelLogoCache.get(logoUrl);
    if (cachedLogo) {
        resolve(cachedLogo);
        return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
        labelLogoCache.set(logoUrl, image);
        resolve(image);
    };
    image.onerror = () => resolve(null);
    image.src = logoUrl;
});

// Canvas layout units (the canvas itself is drawn at LABEL_PIXEL_RATIO for sharp text).
const LABEL_CANVAS_WIDTH = 768;
const LABEL_CANVAS_HEIGHT = 188;
const LABEL_PIXEL_RATIO = 2;
const LABEL_PIN_Y = 162; // canvas y of the pin dot's bottom: the point that touches the roof
const LABEL_ROOF_GAP = 0.25; // metres between the roof and the pin

const labelInitials = (title) => String(title || "")
    .replace(/\(.*?\)|\b(sdn|bhd)\b|[^\p{L}\p{N}\s]/giu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

// A compact map label: a dark pill sized to its text, with the company logo (or initials on the
// industry colour) on the left, the name, and "No. 122 · Food & Beverage" under it. A short stem
// and dot under the pill mark the building.
const drawBuildingLabelCanvas = (canvas, {
    fields,
    fallbackName,
    logoImage = null,
}) => {
    const context = canvas.getContext("2d");
    if (!context) {
        return false;
    }

    const title = getFieldValue(fields, LABEL_FIELD_NAMES) || fallbackName;
    const kind = getBusinessKind(
        getFieldValue(fields, ["Business Type", "Kind of Business"]),
        title,
        getFieldValue(fields, ["Business Description"]),
        getFieldValue(fields, ["Comments"]),
    );
    const accent = kind.color || "#10b981";
    const number = getFieldValue(fields, ["Building Number", "Building No", "Street Number", "Unit"]);
    const subtitleText = [number && `No. ${number}`, kind.label].filter(Boolean).join("  ·  ");

    const W = LABEL_CANVAS_WIDTH;
    const ratio = canvas.width / W;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const cardH = 84;
    const cardY = 20;
    const avatar = 60;
    const padL = 12;
    const gap = 16;
    const padR = 30;
    const maxCardW = W - 24;
    const maxTextW = maxCardW - padL - avatar - gap - padR;

    context.font = `700 29px ${LABEL_FONT}`;
    const titleText = truncateText(context, title, maxTextW);
    const titleW = context.measureText(titleText).width;
    context.font = `500 21px ${LABEL_FONT}`;
    const subText = truncateText(context, subtitleText, maxTextW);
    const subW = context.measureText(subText).width;

    const cardW = Math.min(maxCardW, padL + avatar + gap + Math.max(titleW, subW) + padR);
    const cardX = (W - cardW) / 2;
    const centerX = W / 2;

    // Card with soft shadow.
    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.45)";
    context.shadowBlur = 16;
    context.shadowOffsetY = 6;
    context.fillStyle = "rgba(17, 20, 24, 0.94)";
    roundRect(context, cardX, cardY, cardW, cardH, cardH / 2);
    context.fill();
    context.restore();
    context.strokeStyle = "rgba(255, 255, 255, 0.12)";
    context.lineWidth = 1.5;
    roundRect(context, cardX + 0.75, cardY + 0.75, cardW - 1.5, cardH - 1.5, cardH / 2);
    context.stroke();

    // Pointer: small notch under the card, a thin stem and a dot on the building.
    context.fillStyle = "rgba(17, 20, 24, 0.94)";
    context.beginPath();
    context.moveTo(centerX - 11, cardY + cardH - 1);
    context.lineTo(centerX + 11, cardY + cardH - 1);
    context.lineTo(centerX, cardY + cardH + 12);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(255, 255, 255, 0.55)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(centerX, cardY + cardH + 12);
    context.lineTo(centerX, 152);
    context.stroke();
    context.fillStyle = accent;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(centerX, 158, 7, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    // Logo, or initials on the industry colour.
    const ax = cardX + padL + avatar / 2;
    const ay = cardY + cardH / 2;
    context.save();
    context.beginPath();
    context.arc(ax, ay, avatar / 2, 0, Math.PI * 2);
    context.fillStyle = logoImage ? "#ffffff" : accent;
    context.fill();
    if (logoImage) {
        context.clip();
        const inner = avatar * 0.72;
        const r = logoImage.naturalWidth && logoImage.naturalHeight ? logoImage.naturalWidth / logoImage.naturalHeight : 1;
        const dw = r >= 1 ? inner : inner * r;
        const dh = r >= 1 ? inner / r : inner;
        context.drawImage(logoImage, ax - dw / 2, ay - dh / 2, dw, dh);
    } else {
        context.fillStyle = "#ffffff";
        context.font = `800 24px ${LABEL_FONT}`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(labelInitials(title) || "•", ax, ay + 1);
    }
    context.restore();

    // Name and subtitle.
    const textX = cardX + padL + avatar + gap;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#f8fafc";
    context.font = `700 29px ${LABEL_FONT}`;
    context.fillText(titleText, textX, cardY + 39);
    context.fillStyle = "#94a3b8";
    context.font = `500 21px ${LABEL_FONT}`;
    context.fillText(subText, textX, cardY + 67);

    return true;
};

export const updateBuildingLabelSpriteLogo = async ({
    sprite,
    fields,
    fallbackName,
    logoUrl,
}) => {
    if (!sprite?.material?.map?.image || !fields || !logoUrl) {
        return;
    }

    const logoImage = await loadLogoImage(logoUrl);
    if (!logoImage) {
        return;
    }

    drawBuildingLabelCanvas(sprite.material.map.image, { fields, fallbackName, logoImage });
    sprite.material.map.needsUpdate = true;
};

export const createBuildingLabelSprite = ({
    fields,
    fallbackName,
    position,
    angle = 0,
    halfHeight = 0,
    topY,
    center = null,
    labelOffset = 0,
    instanceId,
    name,
    projectID
}) => {
    const hasdata = hasBusinessMetadata(fields)
    
    if (typeof document === "undefined" || !position || !hasdata) {
        return null;
    }

    const title = getFieldValue(fields, LABEL_FIELD_NAMES) || fallbackName;
    if (!title) {
        return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = LABEL_CANVAS_WIDTH * LABEL_PIXEL_RATIO;
    canvas.height = LABEL_CANVAS_HEIGHT * LABEL_PIXEL_RATIO;
    const kind = detectCategory(fields, title);

    if (!drawBuildingLabelCanvas(canvas, { fields, fallbackName })) {
        return null;
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        // Billboard planes have no volume; a second transparent pass adds no detail.
        forceSinglePass: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });

    // The plane's origin is the pin dot, so the label stands on its anchor and grows upwards when
    // BuildingLabelManager scales it (scaling about the middle pushed the pin into the roof up close).
    const geometry = new THREE.PlaneGeometry(LABEL_WIDTH, LABEL_HEIGHT);
    geometry.translate(0, (LABEL_PIN_Y / LABEL_CANVAS_HEIGHT - 0.5) * LABEL_HEIGHT, 0);
    const sprite = new THREE.Mesh(geometry, material);

    const labelAngle = THREE.MathUtils.degToRad(Number(angle) || 0);
    let anchorPosition;
    if (center && Number.isFinite(topY)) {
        // On the roof, over the footprint centre (or over this company's half of a shared unit).
        const rotatedOffset = new THREE.Vector3(Number(labelOffset) || 0, 0, 0)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), labelAngle);
        anchorPosition = new THREE.Vector3(center.x, topY + LABEL_ROOF_GAP, center.z).add(rotatedOffset);
    } else {
        const heightTop = position.y + (Number(halfHeight) * 2) / 100 + 1;
        const xOffset = (Number(halfHeight) * 2) / 200;
        const localXOffset = String(projectID).includes('153')
            ? (String(name || '').includes('ShortLeft') ? -xOffset : xOffset)
            : 0;
        const rotatedOffset = new THREE.Vector3(localXOffset, 0, 0)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), labelAngle);
        anchorPosition = new THREE.Vector3(position.x, heightTop, position.z).add(rotatedOffset);
    }
    sprite.position.copy(anchorPosition);
    sprite.rotation.set(0, labelAngle, 0);
    sprite.onBeforeRender = (_renderer, _scene, camera) => {
        sprite.position.copy(anchorPosition);
        sprite.quaternion.copy(camera.quaternion);
    };
    sprite.renderOrder = 10000;
    sprite.name = `building-label:${instanceId || title}`;
    sprite.userData = {
        ...(sprite.userData || {}),
        instanceId,
        isBuildingLabel: true,
        opensBuildingLabelPopup: true,
        anchorPosition,
        labelFallbackName: fallbackName,
        labelKind: kind,
    };

    return sprite;
};

export const disposeBuildingLabelSprite = (sprite) => {
    if (!sprite) {
        return;
    }

    const material = sprite.material;
    material?.map?.dispose?.();
    material?.dispose?.();
    sprite.geometry?.dispose?.();
};
