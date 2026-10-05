import { SCHEME_REGISTRY } from '../ColorScaleMaps.js';

export const STRIDE = 6;
const EXPECTED_COLUMNS = 'x,y,id,avg_d_kbps,avg_u_kbps,country_code';

// Keep Arrow buffer views, including all batches and list rows.
export function extractChunks(table) {
    if (Number(table.schema.metadata.get('stride')) !== STRIDE ||
        table.schema.metadata.get('columns') !== EXPECTED_COLUMNS) {
        throw new Error('Unsupported dataset schema. Expected six mobile performance fields.');
    }
    const chunks = [];
    for (const batch of table.batches) {
        const column = batch.getChild('binary_data');
        if (!column) throw new Error('Missing binary_data column.');
        for (let row = 0; row < batch.numRows; row++) {
            const vector = column.get(row);
            if (!vector) throw new Error('Null binary_data row.');
            for (const data of vector.data) {
                // Arrow already slices numeric values for List children. data.offset
                // tracks the original logical row and must not be applied twice.
                const src = data.values.subarray(0, data.length);
                if (!(src instanceof Float32Array) || src.length % STRIDE !== 0 || data.nullCount) {
                    throw new Error('Invalid packed Float32 data.');
                }
                if (src.length) chunks.push({ src, length: src.length / STRIDE });
            }
        }
    }
    return chunks;
}

export function prepareChunk(chunk) {
    const colors = {};
    const schemes = Object.entries(SCHEME_REGISTRY).filter(([, scheme]) => scheme.layerType === 'scatterplot');
    for (const [key] of schemes) colors[key] = new Uint8Array(chunk.length * 4);
    for (let index = 0; index < chunk.length; index++) {
        const start = index * STRIDE;
        const longitude = chunk.src[start];
        const latitude = chunk.src[start + 1];
        const speed = chunk.src[start + 3];
        const upload = chunk.src[start + 4];
        if (!Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
            !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
            !Number.isFinite(speed) || speed < 0 || !Number.isFinite(upload) || upload < 0) {
            throw new Error('Invalid coordinates or speed in dataset.');
        }
        for (const [key, scheme] of schemes) colors[key].set(scheme.scaleFunction(speed), index * 4);
    }
    return { ...chunk, colors };
}

// One logical dataset for density aggregation, without concatenating source arrays.
export function createChunkIndex(chunks) {
    let length = 0;
    const ends = chunks.map(chunk => (length += chunk.length));
    return {
        length,
        locate(index) {
            if (index < 0 || index >= length) return null;
            let low = 0;
            let high = ends.length - 1;
            while (low < high) {
                const middle = (low + high) >>> 1;
                if (index < ends[middle]) high = middle;
                else low = middle + 1;
            }
            return { chunk: chunks[low], offset: (index - (ends[low - 1] || 0)) * STRIDE };
        }
    };
}
