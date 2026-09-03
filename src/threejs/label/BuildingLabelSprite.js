import * as THREE from "three";

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

const CATEGORY_STYLES = {
    food: { color: "#f5a33d", label: "Food" },
    education: { color: "#6f9bff", label: "Education" },
    health: { color: "#54e8a8", label: "Health" },
    auto: { color: "#38bdf8", label: "Auto" },
    retail: { color: "#c772ff", label: "Shop" },
    service: { color: "#23f4f8", label: "Service" },
};

const LABEL_FONT = "\"Plus Jakarta Sans\", \"Inter\", \"Segoe UI\", Arial, sans-serif";
const LABEL_TOP_OFFSET = 0.3;
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

const drawPin = (context, x, y, color) => {
    context.save();
    context.translate(x, y);

    context.shadowColor = color;
    context.shadowBlur = 18;
    context.fillStyle = "rgba(0, 0, 0, 0.32)";
    context.beginPath();
    context.ellipse(0, 35, 18, 6, 0, 0, Math.PI * 2);
    context.fill();

    context.shadowColor = color;
    context.shadowBlur = 16;
    context.fillStyle = color;
    context.strokeStyle = "rgba(255, 255, 255, 0.96)";
    context.lineWidth = 5;
    context.beginPath();
    context.arc(0, -12, 27, Math.PI * 0.12, Math.PI * 1.88);
    context.quadraticCurveTo(0, 35, 0, 35);
    context.closePath();
    context.fill();
    context.stroke();

    context.shadowBlur = 0;
    context.fillStyle = "rgba(12, 18, 20, 0.92)";
    context.beginPath();
    context.arc(0, -12, 18, 0, Math.PI * 2);
    context.fill();
    context.restore();
};

const drawMapChipPin = (context, x, y, color) => {
    context.save();
    context.translate(x, y);
    context.shadowColor = color;
    context.shadowBlur = 10;
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, 14);
    context.lineTo(0, 42);
    context.stroke();

    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 46, 6, 0, Math.PI * 2);
    context.fill();

    context.shadowBlur = 0;
    context.fillStyle = "rgba(5, 18, 17, 0.96)";
    context.strokeStyle = color;
    context.lineWidth = 2.5;
    roundRect(context, -20, -20, 40, 40, 10);
    context.fill();
    context.stroke();
    context.restore();
};

const drawLabelTileIcon = (context, x, y, color) => {
    context.save();
    context.translate(x, y);
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";

    roundRect(context, -7, -10, 14, 20, 2.5);
    context.stroke();

    for (const rowY of [-5, 0, 5]) {
        context.beginPath();
        context.moveTo(-3, rowY);
        context.lineTo(3, rowY);
        context.stroke();
    }

    context.beginPath();
    context.moveTo(-2, 10);
    context.lineTo(-2, 6);
    context.lineTo(2, 6);
    context.lineTo(2, 10);
    context.stroke();
    context.restore();
};

const drawLogoImage = (context, image, x, y, size, color) => {
    context.save();
    context.translate(x, y);
    context.shadowColor = color;
    context.shadowBlur = 16;
    context.fillStyle = "rgba(255, 255, 255, 0.96)";
    context.strokeStyle = "rgba(35, 244, 248, 0.68)";
    context.lineWidth = 2;
    roundRect(context, -size / 2, -size / 2, size, size, 13);
    context.fill();
    context.stroke();

    context.shadowBlur = 0;
    context.clip();

    const padding = Math.max(5, size * 0.12);
    const drawSize = size - padding * 2;
    const imageRatio = image.naturalWidth && image.naturalHeight
        ? image.naturalWidth / image.naturalHeight
        : 1;
    const targetRatio = 1;
    let drawWidth = drawSize;
    let drawHeight = drawSize;

    if (imageRatio > targetRatio) {
        drawHeight = drawSize / imageRatio;
    } else {
        drawWidth = drawSize * imageRatio;
    }

    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
};

const drawIcon = (context, kind, x, y, color) => {
    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.translate(x, y);
    context.shadowColor = "rgba(0, 0, 0, 0.9)";
    context.shadowBlur = 3;

    if (kind === "food") {
        context.beginPath();
        context.moveTo(-9, -16);
        context.lineTo(-9, 14);
        context.moveTo(-16, -16);
        context.lineTo(-16, -3);
        context.moveTo(-2, -16);
        context.lineTo(-2, -3);
        context.moveTo(10, -15);
        context.quadraticCurveTo(20, -6, 11, 6);
        context.lineTo(11, 14);
        context.stroke();
    } else if (kind === "education") {
        context.beginPath();
        context.moveTo(-19, -4);
        context.lineTo(0, -15);
        context.lineTo(19, -4);
        context.lineTo(0, 8);
        context.closePath();
        context.fill();
        context.strokeStyle = "rgba(12, 18, 20, 0.92)";
        context.lineWidth = 2;
        context.stroke();
        context.strokeStyle = color;
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(13, 1);
        context.lineTo(13, 15);
        context.stroke();
    } else if (kind === "health") {
        context.fillRect(-5, -18, 10, 36);
        context.fillRect(-18, -5, 36, 10);
    } else if (kind === "auto") {
        roundRect(context, -20, -7, 40, 18, 6);
        context.fill();
        context.strokeStyle = "rgba(12, 18, 20, 0.92)";
        context.lineWidth = 2;
        context.stroke();
        context.beginPath();
        context.arc(-12, 13, 4, 0, Math.PI * 2);
        context.arc(12, 13, 4, 0, Math.PI * 2);
        context.fill();
    } else if (kind === "retail") {
        roundRect(context, -17, -9, 34, 26, 5);
        context.fill();
        context.strokeStyle = "rgba(12, 18, 20, 0.92)";
        context.lineWidth = 2;
        context.stroke();
        context.strokeStyle = color;
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(-9, -9);
        context.quadraticCurveTo(0, -20, 9, -9);
        context.stroke();
    } else {
        context.beginPath();
        context.moveTo(-17, 16);
        context.lineTo(-17, -6);
        context.lineTo(0, -18);
        context.lineTo(17, -6);
        context.lineTo(17, 16);
        context.closePath();
        context.fill();
        context.strokeStyle = "rgba(12, 18, 20, 0.92)";
        context.lineWidth = 2;
        context.stroke();
        context.strokeStyle = color;
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(-6, 16);
        context.lineTo(-6, 5);
        context.lineTo(6, 5);
        context.lineTo(6, 16);
        context.stroke();
    }

    context.restore();
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
    const kind = detectCategory(fields, title);
    const style = CATEGORY_STYLES[kind] || CATEGORY_STYLES.service;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `800 28px ${LABEL_FONT}`;
    const hasLogo = Boolean(logoImage);
    const textX = hasLogo ? 178 : 160;
    const textMaxWidth = hasLogo ? 224 : 250;
    const labelText = truncateText(context, title, textMaxWidth);
    const building = getFieldValue(fields, ["Building Number", "Building No", "Unit"]);
    const floor = getFieldValue(fields, ["Floor", "Level"]);
    const subtitle = truncateText(context, [building, floor].filter(Boolean).join(" - ") || style.label, textMaxWidth);

    context.save();
    context.shadowColor = "rgba(4, 87, 69, 0.58)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 8;
    context.fillStyle = "#253630";
    context.strokeStyle = "rgba(75, 255, 226, 0.16)";
    context.lineWidth = 1;
    roundRect(context, 70, 20, 350, 96, 14);
    context.fill();
    context.stroke();

    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    if (logoImage) {
        drawLogoImage(context, logoImage, 120, 65, 58, style.color);
    } else {
        context.fillStyle = "rgba(16, 98, 91, 0.42)";
        context.strokeStyle = "rgba(35, 244, 248, 0.34)";
        context.lineWidth = 1.5;
        roundRect(context, 96, 42, 46, 46, 10);
        context.fill();
        context.stroke();
        drawLabelTileIcon(context, 119, 65, "#23f4f8");
    }

    context.shadowBlur = 0;
    context.fillStyle = "#f8fbfc";
    context.font = `800 28px ${LABEL_FONT}`;
    context.fillText(labelText, textX, 60);

    context.fillStyle = "rgba(203, 218, 214, 0.58)";
    context.font = `500 17px ${LABEL_FONT}`;
    context.fillText(subtitle, textX, 88);

    context.strokeStyle = "rgba(35, 244, 248, 0.38)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(245, 118);
    context.lineTo(245, 150);
    context.stroke();

    context.shadowColor = "#23f4f8";
    context.shadowBlur = 10;
    context.fillStyle = "rgba(35, 244, 248, 0.54)";
    context.strokeStyle = "rgba(35, 244, 248, 0.46)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(245, 158, 9, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();

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
    halfLength = 0,
    topY,
    instanceId,
}) => {
    if (typeof document === "undefined" || !position || !hasBusinessMetadata(fields)) {
        return null;
    }

    const title = getFieldValue(fields, LABEL_FIELD_NAMES) || fallbackName;
    if (!title) {
        return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 188;
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
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
    });

    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(9.3, 3.42), material);

    const heightTop =  position.y + (Number(halfHeight)*2)/100 + 1;
    const labelAngle = THREE.MathUtils.degToRad(Number(angle) || 0);
    const lengthTop =   position.z - (Number(halfLength))/100;
    const anchorPosition = new THREE.Vector3(
        position.x ,
        heightTop ,
        lengthTop 
    );
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
