const aborted = () => new DOMException("Aborted", "AbortError");
const closeImages = (images) => images.forEach((image) => image?.bitmap?.close());

export function createTileImageryWorker() {
    if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function") return null;

    let worker;
    try {
        worker = new Worker(new URL("./tileImagery.worker.js", import.meta.url), { type: "module" });
    } catch {
        return null;
    }

    const queue = [];
    let active;

    const settle = (task, error, bitmap) => {
        task.signal.removeEventListener("abort", task.onAbort);
        if (error) task.reject(error);
        else task.resolve(bitmap);
    };

    const disable = (error = new Error("Terrain imagery worker unavailable")) => {
        worker?.terminate();
        worker = null;
        if (active) {
            settle(active, error);
            active = null;
        }
        for (const task of queue.splice(0)) {
            closeImages(task.job.images);
            settle(task, error);
        }
    };

    const pump = () => {
        if (!worker || active || !queue.length) return;
        let next = 0;
        for (let i = 1; i < queue.length; i++) {
            if (queue[i].priority() < queue[next].priority()) next = i;
        }
        const [task] = queue.splice(next, 1);
        try {
            const bitmaps = task.job.images.flatMap((image) => image?.bitmap ? [image.bitmap] : []);
            worker.postMessage(task.job, bitmaps);
            active = task;
        } catch (error) {
            closeImages(task.job.images);
            settle(task, error);
            disable(error);
        }
    };

    worker.onmessage = ({ data: { bitmap, error } }) => {
        const task = active;
        active = null;
        if (!task || task.signal.aborted) {
            bitmap?.close();
        } else if (error) {
            settle(task, new Error(error));
            disable();
        } else {
            settle(task, null, bitmap);
        }
        pump();
    };
    worker.onerror = () => disable();
    worker.onmessageerror = () => disable();

    return {
        get enabled() { return Boolean(worker); },
        disable,
        compose(job, signal, priority) {
            return new Promise((resolve, reject) => {
                if (!worker || signal.aborted) {
                    closeImages(job.images);
                    reject(signal.aborted ? aborted() : new Error("Terrain imagery worker unavailable"));
                    return;
                }
                const task = { job, signal, priority, resolve, reject, onAbort: () => {
                    const index = queue.indexOf(task);
                    if (index !== -1) {
                        queue.splice(index, 1);
                        closeImages(job.images);
                    }
                    settle(task, aborted());
                } };
                signal.addEventListener("abort", task.onAbort, { once: true });
                queue.push(task);
                pump();
            });
        },
    };
}
