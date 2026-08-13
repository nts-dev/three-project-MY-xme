export const formatEuro = (value) => `€${Number(value || 0).toFixed(2)}`;

export const getProductImage = (product, fallback) => (
    product?.images?.find((image) => image.thumbnail || image.original)?.thumbnail ||
    product?.images?.find((image) => image.original || image.thumbnail)?.original ||
    fallback
);

export const flattenMenu = (node, depth = 0) => {
    if (!node) return [];
    return [
        { ...node, depth },
        ...node.subMenu.flatMap((child) => flattenMenu(child, depth + 1)),
    ];
};

export const getSelectedProduct = (group) => (
    group.products.find((product) => product.defaultSelected) ||
    group.products[0] ||
    null
);

export const getSelectedItems = (groups) => (
    groups
        .map((group) => {
            const product = getSelectedProduct(group);
            if (!product) return null;
            return {
                group,
                product,
                quantity: Math.max(1, group.minQty || 1),
            };
        })
        .filter(Boolean)
);
