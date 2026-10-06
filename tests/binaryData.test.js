import test from 'node:test';
import assert from 'node:assert/strict';
import { Field, Float32, List, Table, tableFromIPC, tableToIPC, vectorFromArray } from 'apache-arrow';
import { extractChunks, prepareChunk, createChunkIndex } from '../src/components/data/binaryData.js';
import { SCHEME_REGISTRY, SPEED_DOMAIN_DKBPS } from '../src/components/ColorScaleMaps.js';

function makeTable(rows) {
    const binary_data = vectorFromArray(rows, new List(new Field('item', new Float32())));
    const table = new Table({ binary_data });
    table.schema.metadata.set('stride', '6');
    table.schema.metadata.set('columns', 'x,y,id,avg_d_kbps,avg_u_kbps,country_code');
    return table;
}

test('all list rows and record batches survive IPC without repacking source buffers', () => {
    const first = makeTable([[1, 40, 10, 50000, 10000, 2], [2, 41, 11, 100000, 20000, 2]]);
    const second = makeTable([[3, 42, 12, 250000, 30000, 3, 4, 43, 13, 500000, 40000, 3]]);
    const ipc = tableToIPC(new Table(first.schema, [...first.batches, ...second.batches]), 'stream');
    const table = tableFromIPC(ipc);
    const chunks = extractChunks(table);
    assert.equal(table.batches.length, 2);
    assert.deepEqual(chunks.map(chunk => chunk.length), [1, 1, 2]);
    assert.deepEqual(chunks.map(chunk => chunk.src[0]), [1, 2, 3]);
    assert.ok(chunks.every(chunk => chunk.src.buffer === ipc.buffer));
    const index = createChunkIndex(chunks);
    assert.equal(index.length, 4);
    assert.equal(index.locate(3).chunk.src[index.locate(3).offset], 4);
    assert.equal(index.locate(4), null);
    const copy = structuredClone(chunks, { transfer: [ipc.buffer] });
    assert.equal(ipc.byteLength, 0);
    assert.equal(copy[2].src[6], 4);
});

test('palette colours use actual kbps, every stop, and clamp outliers', () => {
    for (const scheme of Object.values(SCHEME_REGISTRY).filter(scheme => scheme.scaleFunction)) {
        assert.equal(scheme.colorRange.length, SPEED_DOMAIN_DKBPS.length);
        SPEED_DOMAIN_DKBPS.forEach((speed, index) => {
            assert.deepEqual(scheme.scaleFunction(speed), scheme.colorRange[index]);
        });
        assert.deepEqual(scheme.scaleFunction(9000000), scheme.colorRange.at(-1));
    }
    const chunk = extractChunks(makeTable([[1, 40, 10, 25000, 10000, 2]]))[0];
    const result = prepareChunk(chunk);
    assert.equal(result.src, chunk.src);
    assert.deepEqual(Array.from(result.colors.ElectricViolet), SCHEME_REGISTRY.ElectricViolet.colorRange[1]);
});

test('reject invalid schema, truncated records, null rows, and invalid speeds', () => {
    const table = makeTable([[1, 40, 10, 50000, 10000, 2]]);
    table.schema.metadata.set('stride', '7');
    assert.throws(() => extractChunks(table), /schema/);
    assert.throws(() => extractChunks(makeTable([[1, 2, 3]])), /Invalid packed/);
    assert.throws(() => extractChunks(makeTable([null])), /Null/);
    assert.throws(() => prepareChunk({ src: new Float32Array([1, 40, 1, -1, 1, 2]), length: 1 }), /Invalid coordinates or speed/);
});
