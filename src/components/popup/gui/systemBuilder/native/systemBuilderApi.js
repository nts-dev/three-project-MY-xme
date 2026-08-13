const API_BASE_URL = "https://react.nts.nl/api/system-builder";

const cache = new Map();

const toNumber = (value, fallback = null) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const cachedJson = async (url) => {
    if (!cache.has(url)) {
        cache.set(url, fetch(url).then((response) => {
            if (!response.ok) throw new Error(`System builder request failed: ${response.status}`);
            return response.json();
        }));
    }

    return cache.get(url);
};

const normalizeMenuNode = (node = {}) => ({
    id: String(node.id ?? ""),
    label: String(node.label ?? ""),
    level: toNumber(node.level, 0),
    parentId: node.parentId ?? null,
    path: String(node.path ?? ""),
    subMenu: Array.isArray(node.subMenu) ? node.subMenu.map(normalizeMenuNode) : [],
});

const normalizeDetail = (payload = {}) => {
    const detail = payload.SystemCategory;
    if (!detail) return null;

    return {
        title: String(detail.title ?? ""),
        status: String(detail.status ?? ""),
        img: detail.img?.trim() || null,
        mainCat: toNumber(detail.mainCat),
    };
};

const normalizeImage = (image = {}) => ({
    thumbnail: image.thumbnail?.trim() || null,
    original: image.original?.trim() || null,
});

const normalizeProduct = (product = {}) => {
    const id = toNumber(product.products_id);
    if (!id) return null;

    return {
        id,
        name: String(product.products_name ?? ""),
        model: String(product.products_model ?? ""),
        price: toNumber(product.products_price, 0),
        stock: toNumber(product.products_quantity, 0),
        defaultSelected: toNumber(product.defaultSel, 0) === 1,
        maxQuantity: toNumber(product.product_max_qty, 1) || 1,
        images: Array.isArray(product.images) ? product.images.map(normalizeImage) : [],
    };
};

const normalizeProductGroup = (item = {}) => {
    const category = item.category;
    const catId = toNumber(category?.catId);
    if (!category || !catId) return null;

    return {
        id: catId,
        title: String(category.title ?? ""),
        minQty: toNumber(category.minQty, 1) || 1,
        products: Array.isArray(item.products)
            ? item.products.map(normalizeProduct).filter(Boolean)
            : [],
    };
};

export const getSystemBuilderMenu = async (language = "nl") => {
    const data = await cachedJson(`${API_BASE_URL}/menu/${language}`);
    const root = Array.isArray(data.menu) ? data.menu[0] : null;
    return root ? normalizeMenuNode(root) : null;
};

export const getSystemBuilderDetail = async (systemId) => (
    normalizeDetail(await cachedJson(`${API_BASE_URL}/system/${systemId}`))
);

export const getSystemBuilderProductGroups = async (systemId) => {
    const data = await cachedJson(`${API_BASE_URL}/product/${systemId}`);
    return Array.isArray(data) ? data.map(normalizeProductGroup).filter(Boolean) : [];
};
