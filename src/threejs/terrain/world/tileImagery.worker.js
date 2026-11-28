import { composeTileImagery } from "./tileImagery";

self.onmessage = async ({ data: job }) => {
    try {
        const canvas = composeTileImagery(job, (width, height) => new OffscreenCanvas(width, height));
        const bitmap = await createImageBitmap(canvas, { imageOrientation: "flipY", premultiplyAlpha: "none" });
        self.postMessage({ bitmap }, [bitmap]);
    } catch (error) {
        self.postMessage({ error: error.message });
    }
};
