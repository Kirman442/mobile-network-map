import { loadArrowCountry } from '../data/arrowLoader.js';

self.onmessage = async ({ data: { taskId, data } }) => {
    try {
        const result = await loadArrowCountry(data.country, data.palette, import.meta.env.VITE_ARROW_TRANSPORT === 'suffix');
        const buffers = [...new Set(result.chunks.flatMap(chunk => [
            chunk.src.buffer, chunk.download.buffer, ...Object.values(chunk.colors).map(colors => colors.buffer)
        ]))];
        self.postMessage({ taskId, success: true, data: result }, buffers);
    } catch (error) {
        self.postMessage({ taskId, success: false, error: error.message });
    }
};
