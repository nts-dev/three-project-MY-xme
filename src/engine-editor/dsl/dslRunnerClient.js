export const runDslDocument = async ({
    content,
    fileName,
    language,
    projectId,
    level,
    gridVisible,
}) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/run-dsl-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content,
            fileName,
            language,
            projectId,
            level,
            gridVisible,
        }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || `Run failed (${response.status})`);
    }

    return result;
};
