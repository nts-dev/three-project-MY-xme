const INSTANCE_SUFFIX = "__world";

const formatShiftPart = (value = 0) => (
    String(Math.round((Number(value) || 0) * 1000) / 1000).replace(/-/g, "m").replace(/\./g, "p")
);

export const getCellKey = (cell) => {
    const baseKey = `${cell.north || 0},${cell.east || 0},${cell.level || 0}`;
    const modeKey = cell.mode ? `@${cell.mode}` : "";
    const horizontalKey = cell.mode === "currentSceneFall"
        ? `@x${Math.round((cell.horizontalOffsetX || 0) * 1000) / 1000}@z${Math.round((cell.horizontalOffsetZ || 0) * 1000) / 1000}`
        : "";
    const verticalKey = Number.isFinite(cell.verticalOffset)
        ? `@y${Math.round(cell.verticalOffset * 1000) / 1000}`
        : "";
    return cell.landing?.key ? `${baseKey}${modeKey}${horizontalKey}${verticalKey}@${cell.landing.key}` : `${baseKey}${modeKey}${horizontalKey}${verticalKey}`;
};

export const isOriginCell = (cell) => (
    (cell.north || 0) === 0
    && (cell.east || 0) === 0
    && (cell.level || 0) === 0
    && !Number.isFinite(cell.verticalOffset)
    && !cell.mode
);

const cloneField = (field, name, offset, instanceId) => {
    if (!field) {
        return setFieldValue(null, name, offset, instanceId);
    }

    return {
        ...field,
        instance_id: instanceId,
        name: field.name || name,
        value: String((Number.parseFloat(field.value) || 0) + offset),
    };
};

const setFieldValue = (field, name, value, instanceId) => ({
    ...(field || {}),
    instance_id: instanceId,
    name: field?.name || name,
    value: String(value),
});

const rotateYAngleField = (field, degrees = 90) => {
    if (!field) {
        return field;
    }

    try {
        const parsed = JSON.parse(field.value);
        if (parsed && typeof parsed === "object") {
            return {
                ...field,
                value: JSON.stringify({
                    ...parsed,
                    y: (Number.parseFloat(parsed.y) || 0) + degrees,
                }),
            };
        }
    } catch (_) {
        // Numeric/string angles are handled below.
    }

    return {
        ...field,
        value: String((Number.parseFloat(field.value) || 0) + degrees),
    };
};

const getAssetInstanceId = (asset) => asset?._raw?.instance_id || asset?.instanceId || asset?.instance_id || asset?.key;

const getCellShift = (cell, metrics) => {
    const isCurrentSceneFallClone = cell.mode === "currentSceneFall";

    return {
        x: isCurrentSceneFallClone
            ? (cell.horizontalOffsetX || 0)
            : (cell.east || 0) * metrics.spanX,
        y: Number.isFinite(cell.verticalOffset)
            ? cell.verticalOffset
            : (cell.level || 0) * metrics.spanY,
        z: isCurrentSceneFallClone
            ? (cell.horizontalOffsetZ || 0)
            : (cell.north || 0) * metrics.spanZ,
    };
};

const getShiftPrefix = (cell, metrics) => {
    const shift = getCellShift(cell, metrics);

    return `shift_x${formatShiftPart(shift.x)}_y${formatShiftPart(shift.y)}_z${formatShiftPart(shift.z)}`;
};

const getPlainValue = (field, key) => field?.[key] ?? field?._raw?.[key];

const toPlainField = (field, name, instanceId) => {
    if (!field) {
        return undefined;
    }

    if (typeof field !== "object") {
        return {
            instance_id: instanceId,
            name,
            value: String(field),
        };
    }

    return {
        ...(field._raw || {}),
        instance_id: getPlainValue(field, "instance_id") || instanceId,
        fieldId: getPlainValue(field, "fieldId") || getPlainValue(field, "field_id"),
        field_id: getPlainValue(field, "field_id") || getPlainValue(field, "fieldId"),
        name: getPlainValue(field, "name") || name,
        value: String(getPlainValue(field, "value") ?? ""),
        description: getPlainValue(field, "description"),
        showExtra: getPlainValue(field, "showExtra"),
    };
};

const toPlainFields = (fields = {}, instanceId) => (
    Object.fromEntries(
        Object.entries(fields)
            .map(([name, field]) => [name, toPlainField(field, name, instanceId)])
            .filter(([, field]) => Boolean(field))
    )
);

const toPlainAsset = (asset) => {
    const instanceId = getAssetInstanceId(asset);

    return {
        key: asset?.key,
        instanceId: asset?.instanceId || asset?._raw?.instance_id || instanceId,
        instance_id: asset?.instance_id || asset?._raw?.instance_id || instanceId,
        assetId: asset?.assetId || asset?._raw?.asset_id,
        asset_id: asset?.asset_id || asset?._raw?.asset_id,
        category: asset?.category || asset?._raw?.category,
        category_index: asset?.category_index || asset?._raw?.category_index,
        projectId: asset?.projectId || asset?._raw?.project_id,
        project_id: asset?.project_id || asset?._raw?.project_id,
        template_id: asset?.template_id || asset?._raw?.template_id,
        description: asset?.description || asset?._raw?.description || [],
        images: asset?.images || asset?._raw?.images || [],
        categoryImages: asset?.categoryImages || asset?._raw?.categoryImages || [],
        fields: toPlainFields(asset?.fields || {}, instanceId),
        rawFields: toPlainFields(asset?.rawFields || {}, instanceId),
        _raw: asset?._raw
            ? { ...asset._raw }
            : undefined,
    };
};

const rotateLandingPosition = (asset, cell, metrics, virtualInstanceId) => {
    const fields = asset.fields || {};
    const sourceX = Number.parseFloat(fields["X-pos"]?.value) || 0;
    const sourceY = Number.parseFloat(fields["Y-pos"]?.value) || 0;
    const localX = sourceX / metrics.fieldScale;
    const localZ = sourceY / metrics.fieldScale;
    const rotatedX = -localZ;
    const rotatedZ = localX;

    return {
        xField: setFieldValue(
            fields["X-pos"],
            "X-pos",
            ((cell.east || 0) * metrics.spanX + rotatedX) * metrics.fieldScale,
            virtualInstanceId
        ),
        yField: setFieldValue(
            fields["Y-pos"],
            "Y-pos",
            ((cell.north || 0) * metrics.spanZ + rotatedZ) * metrics.fieldScale,
            virtualInstanceId
        ),
    };
};

const cloneAssetForWorld = (asset, cell, metrics) => {
    const baseInstanceId = getAssetInstanceId(asset);
    const shift = getCellShift(cell, metrics);
    const shiftPrefix = getShiftPrefix(cell, metrics);
    const cloneKey = `${shiftPrefix}${INSTANCE_SUFFIX}_${baseInstanceId}`;
    const fields = asset.fields || {};
    const isCurrentSceneFallClone = cell.mode === "currentSceneFall";
    const eastOffset = shift.x * metrics.fieldScale;
    const northOffset = shift.z * metrics.fieldScale;
    const verticalOffset = shift.y;
    const landingPosition = cell.landing
        ? rotateLandingPosition(asset, cell, metrics, baseInstanceId)
        : null;

      
    return {
        ...asset,
        key: cloneKey,
        cloneKey,
        worldCloneKey: cloneKey,
        worldCloneShift: shift,
        worldCloneCellKey: getCellKey(cell),
        instanceId: baseInstanceId,
        instance_id: baseInstanceId,
        fields: {
            ...fields,
            "X-pos": landingPosition?.xField
                || cloneField(fields["X-pos"], "X-pos", eastOffset, baseInstanceId),
            "Y-pos": landingPosition?.yField
                || cloneField(fields["Y-pos"], "Y-pos", northOffset, baseInstanceId),
            "Z-pos": cloneField(fields["Z-pos"], "Z-pos", verticalOffset * metrics.fieldScale, baseInstanceId),
            ...(cell.landing && fields.Angle ? { Angle: rotateYAngleField(fields.Angle, 90) } : {}),
        },
        _raw: asset._raw
            ? {
                ...asset._raw,
                instance_id: baseInstanceId,
                clone_key: cloneKey,
                world_clone_key: cloneKey,
                world_clone_shift: shift,
                world_clone_cell_key: getCellKey(cell),
            }
            : asset._raw,
    };
};

export const buildScenePayload = (data = []) => data.map((item, sourceIndex) => ({
    sourceIndex,
    renderKey: item.renderKey || item.cleanKey || item.fileName || item.name,
    cleanKey: item.cleanKey,
    fileName: item.fileName,
    name: item.name,
    assets: (item.assets || []).map(toPlainAsset),
}));

export const buildWorldCloneCells = ({ scenePayload = [], cells = [], metrics }) => (
    cells
        .filter((cell) => !isOriginCell(cell))
        .map((cell) => {
            const cellKey = getCellKey(cell);

            return {
                cell,
                cellKey,
                categories: scenePayload.map((item) => {
                    const assets = item.assets.map((asset) => cloneAssetForWorld(asset, cell, metrics));

                    return {
                        sourceIndex: item.sourceIndex,
                        renderKey: `${item.renderKey}${INSTANCE_SUFFIX}_${cellKey}`,
                        assets,
                    };
                }),
            };
        })
);
