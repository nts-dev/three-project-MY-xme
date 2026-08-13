const MODEL_EXTENSIONS = ['fbx', 'glb', 'gltf', 'obj', 'stl'];

export const getExtension = (name = '') => {
    const cleanName = String(name).split('?')[0];
    const parts = cleanName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

export const normalizeModelPath = (path = '') => String(path).replace(/\\/g, '/');

export const normalizeProjectId = (projectId) => {
    const match = String(projectId ?? '').match(/^(\d+)/);
    return match ? Number(match[1]) : Number(projectId) || 0;
};

export const isModelFile = (path = '') => MODEL_EXTENSIONS.includes(getExtension(path));

export const uniqueByPath = (files) => {
    const seen = new Map();
    const result = [];

    files.forEach((file) => {
        const key = normalizeModelPath(file.path).toLowerCase();

        
        if (seen.has(key)) {
            const existing = seen.get(key);
            if ((!existing.textures || existing.textures.length === 0) && file.textures?.length) {
                existing.textures = file.textures;
            }
            return;
        }

        seen.set(key, file);
        result.push(file);
    });

    return result;
};
