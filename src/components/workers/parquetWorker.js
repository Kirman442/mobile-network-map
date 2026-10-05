import initWasm, { readParquet } from 'parquet-wasm';
import wasmUrl from 'parquet-wasm/esm/parquet_wasm_bg.wasm?url';
import { tableFromIPC } from 'apache-arrow';
import { extractChunks, prepareChunk } from '../data/binaryData.js';

let initialization;
self.onmessage = async ({ data: message }) => {
    const { taskId, data } = message;
    try {
        initialization ??= initWasm(wasmUrl);
        try {
            await initialization;
        } catch (error) {
            initialization = null;
            throw error;
        }
        const response = await fetch(data.url, { signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const started = performance.now();
        const table = tableFromIPC(readParquet(bytes).intoIPCStream());
        const chunks = extractChunks(table).map(prepareChunk);
        const buffers = new Set();
        for (const chunk of chunks) {
            buffers.add(chunk.src.buffer);
            for (const colors of Object.values(chunk.colors)) buffers.add(colors.buffer);
        }
        self.postMessage({
            taskId, success: true,
            data: { chunks, url: data.url, decodeMs: performance.now() - started }
        }, [...buffers]);
    } catch (error) {
        self.postMessage({ taskId, success: false, error: error.message, url: data?.url });
    }
};
