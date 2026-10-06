import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import PaletteController from '../src/components/workers/paletteController.js';
import { COUNTRIES } from '../src/components/data/countries.js';
import { PALETTES, extractChunks, prepareChunk } from '../src/components/data/binaryData.js';
import { tableFromIPC } from 'apache-arrow';
import { readFileSync } from 'node:fs';

class NodePaletteWorker {
    constructor() {
        const entry = new URL('../src/components/workers/paletteWorker.js', import.meta.url).href;
        const bridge = `const { parentPort } = await import('node:worker_threads'); globalThis.self={postMessage:(message,buffers)=>parentPort.postMessage(message,buffers)}; await import(${JSON.stringify(entry)}); parentPort.on('message',data=>self.onmessage({data}));`;
        this.worker = new Worker(new URL('data:text/javascript,' + encodeURIComponent(bridge)));
        this.worker.on('message', data => this.onmessage?.({ data }));
        this.worker.on('error', error => this.onerror?.({ message: error.message }));
    }
    postMessage(message, buffers) { this.worker.postMessage(message, buffers); }
    terminate() { this.worker.terminate(); }
}

test('background palettes match synchronous D3 for all countries; source buffers survive, compact inputs transfer', async () => {
    const chunks = COUNTRIES.flatMap(country => extractChunks(tableFromIPC(readFileSync(`public/data/${country.key}.arrow`)))
        .map((chunk, index) => ({ ...prepareChunk(chunk, { palette: 'ElectricViolet', countryCode: country.countryCode }), id: `${country.key}:${index}` })));
    const sources = chunks.map(chunk => chunk.src);
    const inputs = chunks.map(chunk => chunk.download);
    const controller = new PaletteController(NodePaletteWorker, chunks, 'ElectricViolet');
    const requested = controller.request('MutedStone'); // A request before the first full frame must wait.
    assert.equal(controller.started, false);
    controller.start();
    assert.ok(inputs.every(input => input.byteLength === 0));
    assert.ok(chunks.every(chunk => !chunk.download));
    try {
        await requested;
        await Promise.all(PALETTES.map(palette => controller.request(palette)));
        for (const [index, chunk] of chunks.entries()) {
            const expected = prepareChunk({ src: chunk.src, length: chunk.length });
            assert.equal(chunk.src, sources[index]);
            for (const palette of PALETTES) assert.deepEqual(controller.colors(chunk, palette), expected.colors[palette]);
        }
    } finally { controller.dispose(); }
});

test('cancellation rejects pending palette requests and prevents late messages from reviving cache', async () => {
    const source = new Float32Array([1, 40, 1, 25000, 10, 4]);
    const chunk = { ...prepareChunk({ src: source, length: 1 }, { palette: 'ElectricViolet' }), id: 'a' };
    const controller = new PaletteController(NodePaletteWorker, [chunk], 'ElectricViolet');
    const waiting = assert.rejects(controller.request('MutedStone'), /cancelled/);
    controller.start();
    const oldWorker = controller.worker;
    controller.dispose();
    await waiting;
    oldWorker.onmessage({ data: { type: 'colors', id: 'a', palette: 'MutedStone', colors: new Uint8Array(4) } });
    assert.equal(controller.colors(chunk, 'MutedStone'), undefined);
    assert.equal(chunk.src, source);
    await assert.rejects(controller.request('bogus'), /Unknown palette/);
});

test('background worker failure rejects requests and releases input without losing displayed colors', async () => {
    class FailedWorker { postMessage() {} terminate() { this.terminated = true; } }
    const chunk = { ...prepareChunk({ src: new Float32Array([1, 40, 1, 25000, 10, 4]), length: 1 }, { palette: 'ElectricViolet' }), id: 'a' };
    let failure;
    const controller = new PaletteController(FailedWorker, [chunk], 'ElectricViolet', error => { failure = error; });
    const waiting = assert.rejects(controller.request('MutedStone'), /worker failed/);
    controller.start();
    const worker = controller.worker;
    worker.onerror({ message: 'Palette worker failed' });
    await waiting;
    assert.ok(worker.terminated);
    assert.equal(chunk.download, undefined);
    assert.equal(controller.colors(chunk, 'ElectricViolet'), chunk.colors.ElectricViolet);
    assert.match(failure.message, /worker failed/);
});
