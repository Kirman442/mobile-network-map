import { PALETTES } from '../data/binaryData.js';

export default class PaletteController {
    constructor(WorkerConstructor, chunks, selected, onError = () => {}, onComplete = () => {}) {
        this.WorkerConstructor = WorkerConstructor;
        this.chunks = chunks;
        this.cache = new Map(chunks.map(chunk => [chunk.id, { ...chunk.colors }]));
        this.ready = new Set([selected]);
        this.selected = selected;
        this.waiters = new Map();
        this.closed = false;
        this.started = false;
        this.onError = onError;
        this.onComplete = onComplete;
    }

    colors(chunk, palette) { return this.cache.get(chunk.id)?.[palette]; }

    start() {
        if (this.started || this.closed) return;
        this.started = true;
        try {
            const inputs = this.chunks.map(chunk => ({ id: chunk.id, download: chunk.download }));
            this.worker = new this.WorkerConstructor();
            this.timer = setTimeout(() => this.fail(new Error('Palette preparation timed out.')), 60000);
            this.worker.onmessage = ({ data }) => {
                if (this.closed) return;
                if (data.type === 'colors') this.cache.get(data.id)[data.palette] = data.colors;
                if (data.type === 'palette-ready') {
                    this.ready.add(data.palette);
                    this.waiters.get(data.palette)?.resolve();
                    this.waiters.delete(data.palette);
                }
                if (data.type === 'done') {
                    clearTimeout(this.timer);
                    this.worker.terminate();
                    this.worker = null;
                    this.onComplete(data);
                }
                if (data.type === 'error') this.fail(new Error(data.error));
            };
            this.worker.onerror = event => this.fail(new Error(event.message || 'Palette worker failed.'));
            this.worker.onmessageerror = () => this.fail(new Error('Invalid palette worker response.'));
            this.worker.postMessage({ type: 'init', selected: this.selected, chunks: inputs }, inputs.map(chunk => chunk.download.buffer));
            for (const palette of this.waiters.keys()) this.worker.postMessage({ type: 'priority', palette });
            for (const chunk of this.chunks) delete chunk.download;
        } catch (error) { this.fail(error); }
    }

    request(palette) {
        if (!PALETTES.includes(palette)) return Promise.reject(new Error('Unknown palette.'));
        if (this.closed) return Promise.reject(new Error('Palette preparation cancelled.'));
        if (this.ready.has(palette)) return Promise.resolve();
        if (!this.waiters.has(palette)) {
            let resolve, reject;
            const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
            this.waiters.set(palette, { promise, resolve, reject });
        }
        this.worker?.postMessage({ type: 'priority', palette });
        return this.waiters.get(palette).promise;
    }

    fail(error) { this.dispose(error); this.onError(error); }

    dispose(error = new Error('Palette preparation cancelled.')) {
        this.closed = true;
        clearTimeout(this.timer);
        this.worker?.terminate();
        this.worker = null;
        for (const waiter of this.waiters.values()) waiter.reject(error);
        this.waiters.clear();
        for (const chunk of this.chunks) delete chunk.download;
    }
}
