export const DEFAULT_LEVEL_CODE = '0';

export const buildLevelOptions = (rows) => {
    const optionMap = new Map();
    optionMap.set('0', { name: 'L 0', code: '0' });

    (Array.isArray(rows) ? rows : rows?.levels || []).forEach((row) => {
        const num = String(row.level).replace(/[^\d]/g, '') || '0';
        optionMap.set(num, { name: `L ${num}`, code: num, id: row.id });
    });

    return Array.from(optionMap.values()).sort((left, right) => Number(left.code) - Number(right.code));
};

export const getBaseProjectId = (projectID) => String(projectID || '').split('_')[0];

export const getCurrentLevelCode = (projectID) => {
    const match = /_L(\d+)$/i.exec(String(projectID || ''));
    return match?.[1] ?? null;
};
