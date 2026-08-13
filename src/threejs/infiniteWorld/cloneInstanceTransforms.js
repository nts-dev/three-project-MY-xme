import { Box3, Euler, MathUtils, Quaternion, Vector3 } from "three";

const extractAngle = (angle) => {
    try {
        const parsed = JSON.parse(angle);
        if (typeof parsed === "object" && parsed !== null) {
            return parsed;
        }
    } catch (_) {
        // Use the numeric/string value as the Y angle below.
    }

    return { x: 0, y: angle || 0, z: 0 };
};

const getBoundingBoxSize = (model) => {
    const box = new Box3().setFromObject(model);
    return {
        width: (box.max.x - box.min.x) / 2,
        height: (box.max.y - box.min.y) / 2,
        length: (box.max.z - box.min.z) / 2,
        box,
    };
};

const getInstanceKey = (asset) => asset?._raw?.instance_id || asset?.instanceId || asset?.instance_id || asset?.key;

export const getCloneBaseObject = (fbx) => (
    fbx?.children?.[0]?.children?.[0]?.clone?.()
    || fbx?.children?.[0]?.clone?.()
    || fbx?.clone?.()
);

export const buildCloneInstanceTransforms = ({
    assets = [],
    object,
    material,
    defaultColor,
    projectId,
    name,
    fileName,
    id,
}) => {
    if (!object) {
        return [];
    }

    const size = getBoundingBoxSize(object);
    const pivotBox = new Box3().setFromObject(object);
    const initialQuaternion = object.quaternion;
    const hexColor = material?.color?.getHexString?.();
    const fallbackColor = defaultColor || (hexColor ? `#${hexColor}` : "#ffffff");
    const isNumericLike = !isNaN(projectId) || /_L\d+$/i.test(String(projectId));

    return assets.reduce((instances, asset) => {
        const fields = asset?.fields || {};
        const instanceKey = getInstanceKey(asset);
        const cloneKey = asset?.cloneKey || asset?.worldCloneKey || asset?._raw?.clone_key || asset?._raw?.world_clone_key || instanceKey;

        if (!instanceKey || instanceKey === 0 || instanceKey === "0") {
            return instances;
        }

        const x = Number.parseFloat(fields["X-pos"]?.value) || 0;
        const y = Number.parseFloat(fields["Y-pos"]?.value) || 0;
        const z = Number.parseFloat(fields["Z-pos"]?.value) || 0;
        const angle = extractAngle(fields.Angle?.value || "");
        const angleX = MathUtils.degToRad(angle.x);
        const angleY = MathUtils.degToRad(angle.y);
        const angleZ = MathUtils.degToRad(angle.z);
        const width = Number.parseFloat(fields.Width?.value) || 0;
        const length = Number.parseFloat(fields.Length?.value) || 0;
        const height = Number.parseFloat(fields.Height?.value) || 0;
        const halfLength = size.length;
        const halfWidth = size.width;
        const l = length ? length / 20 : halfLength;
        const w = width ? width / 20 : halfWidth;
        const position = isNumericLike
            ? new Vector3(x + w, z, y + l).multiplyScalar(0.01)
            : new Vector3(x, z, y).multiplyScalar(0.01);

        const quaternionX = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), angleX);
        const quaternionY = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angleY);
        const quaternionZ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angleZ);
        const finalQuaternion = new Quaternion();
        const xzQuaternion = new Quaternion();
        const initialAndYQuaternion = new Quaternion();

        initialAndYQuaternion.multiplyQuaternions(initialQuaternion, quaternionY);
        xzQuaternion.multiplyQuaternions(quaternionX, quaternionZ);
        finalQuaternion.multiplyQuaternions(initialAndYQuaternion, xzQuaternion);

        const scale = object.scale.clone();
        if (width > 0 && pivotBox.max.x !== pivotBox.min.x) {
            scale.y = width / 10 / (pivotBox.max.x - pivotBox.min.x);
        }
        if (height > 0 && pivotBox.max.y !== pivotBox.min.y) {
            scale.z = height / 10 / (pivotBox.max.y - pivotBox.min.y);
        }
        scale.multiplyScalar(0.01);

        const rotation = new Euler().setFromQuaternion(finalQuaternion, "XYZ");
        const color = fields.Color?.value === undefined ? fallbackColor : fields.Color.value;

        instances.push({
            key: String(cloneKey),
            instanceId: String(instanceKey),
            instance_id: String(instanceKey),
            cloneKey: String(cloneKey),
            worldCloneShift: asset?.worldCloneShift || asset?._raw?.world_clone_shift,
            position: [position.x, position.y, position.z],
            rotation: [rotation.x, rotation.y, rotation.z],
            scale,
            color,
            userData: {
                name,
                instance_id: String(instanceKey),
                cloneKey: String(cloneKey),
                worldCloneShift: asset?.worldCloneShift || asset?._raw?.world_clone_shift,
                assetID: asset?._raw?.asset_id || asset?.asset_id || asset?.assetId,
                fileName,
                categoryIndex: asset?._raw?.category_index || asset?.category_index || asset?.category || id,
            },
        });

        return instances;
    }, []);
};
