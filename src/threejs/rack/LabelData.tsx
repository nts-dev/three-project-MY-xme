const labelDataCache = new Map<number, Promise<any>>();

export default async function LabelData(branchId: number) {
    if (!labelDataCache.has(branchId)) {
        const request = fetch(`${import.meta.env.VITE_API_URL}/getConvertedLabelData?branch_id=${branchId}`)
            .then((response) => response.json())
            .catch((error) => {
                labelDataCache.delete(branchId);
                throw error;
            });
        labelDataCache.set(branchId, request);
    }

    return await labelDataCache.get(branchId);
}
