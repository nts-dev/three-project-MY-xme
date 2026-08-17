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
    food: { color: "#f59a3d", label: "FOOD" },
    education: { color: "#5b86ff", label: "EDU" },
    health: { color: "#38d487", label: "HEALTH" },
    auto: { color: "#38bdf8", label: "AUTO" },
    retail: { color: "#b56cff", label: "SHOP" },
    service: { color: "#23f4f8", label: "SERVICE" },
};

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

export const createBuildingLabelSprite = ({
    fields,
    fallbackName,
    position,
    halfHeight = 0,
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

    const kind = detectCategory(fields, title);
    const style = CATEGORY_STYLES[kind] || CATEGORY_STYLES.service;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;

    const context = canvas.getContext("2d");
    if (!context) {
        return null;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "700 28px Arial, sans-serif";
    const labelText = truncateText(context, title, 330);

    drawPin(context, 50, 70, style.color);
    drawIcon(context, kind, 50, 58, "#f7fbfc");

    context.save();
    context.font = "700 16px Arial, sans-serif";
    context.fillStyle = style.color;
    context.strokeStyle = "rgba(0, 0, 0, 0.82)";
    context.lineWidth = 5;
    context.strokeText(style.label, 84, 52);
    context.fillText(style.label, 84, 52);

    context.font = "700 28px Arial, sans-serif";
    context.fillStyle = "#f7fbfc";
    context.strokeStyle = "rgba(0, 0, 0, 0.88)";
    context.lineWidth = 7;
    context.lineJoin = "round";
    context.strokeText(labelText, 84, 86);
    context.fillText(labelText, 84, 86);
    context.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: true,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(9.5, 2.38, 1);

    
    sprite.position.set(position.x, (halfHeight/100) *2, position.z);
    sprite.renderOrder = 10000;
    sprite.name = `building-label:${instanceId || title}`;
    sprite.userData = {
        ...(sprite.userData || {}),
        instanceId,
        isBuildingLabel: true,
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
};
