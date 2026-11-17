// Shared download queue for map images: limited concurrency, nearest (lowest priority value)
// first, abortable. Resolves to an ImageBitmap.

export function createImageQueue({ concurrency = 12 } = {}) {
    const queue = [];
    let active = 0;

    const pump = () => {
        while (active < concurrency && queue.length) {
            let best = 0;
            for (let i = 1; i < queue.length; i++) if (queue[i].priority() < queue[best].priority()) best = i;
            const job = queue.splice(best, 1)[0];
            if (job.signal?.aborted) {
                job.reject(new DOMException("Aborted", "AbortError"));
                continue;
            }
            active++;
            fetch(job.url, { signal: job.signal, mode: "cors" })
                .then((response) => {
                    if (!response.ok) throw new Error(`${job.url}: HTTP ${response.status}`);
                    return response.blob();
                })
                .then((blob) => createImageBitmap(blob, job.bitmapOptions))
                .then(job.resolve, job.reject)
                .finally(() => {
                    active--;
                    pump();
                });
        }
    };

    // New jobs start in a task of their own, not inside the caller (the terrain update queues many
    // at once, and each fetch() call costs about a millisecond in Firefox).
    let pumpScheduled = false;
    const schedulePump = () => {
        if (pumpScheduled) return;
        pumpScheduled = true;
        setTimeout(() => {
            pumpScheduled = false;
            pump();
        }, 0);
    };

    return {
        /** priority: () => number, read when the job is picked (so it can change while queued). */
        load(url, { signal, priority = () => 0, bitmapOptions } = {}) {
            return new Promise((resolve, reject) => {
                queue.push({ url, signal, priority, bitmapOptions, resolve, reject });
                schedulePump();
            });
        },
        /** Drops queued (not yet started) jobs whose signal was aborted. */
        prune() {
            for (let i = queue.length - 1; i >= 0; i--) {
                if (queue[i].signal?.aborted) queue.splice(i, 1)[0].reject(new DOMException("Aborted", "AbortError"));
            }
        },
    };
}

let scratchCanvas = null;

/** Draws a bitmap and returns its RGBA pixels. */
export function readPixels(bitmap) {
    const { width, height } = bitmap;
    if (!scratchCanvas || scratchCanvas.width !== width || scratchCanvas.height !== height) {
        scratchCanvas = typeof OffscreenCanvas !== "undefined"
            ? new OffscreenCanvas(width, height)
            : Object.assign(document.createElement("canvas"), { width, height });
    }
    const context = scratchCanvas.getContext("2d", { willReadFrequently: true });
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, width, height).data;
}
