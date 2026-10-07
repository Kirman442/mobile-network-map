import { tableFromIPC } from 'apache-arrow';
import { extractChunks, prepareChunk } from './binaryData.js';

export async function loadArrowCountry(country, palette, compressed, fetchFile = fetch) {
    const variants = compressed ? ['.arrow.br', '.arrow.gz'] : ['.arrow'];
    const failures = [];
    for (const suffix of variants) {
        const url = `/data/${country.key}${suffix}`;
        try {
            const response = await fetchFile(url, { signal: AbortSignal.timeout(60000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const expectedEncoding = suffix.endsWith('.br') ? 'br' : suffix.endsWith('.gz') ? 'gzip' : 'identity';
            const encoding = response.headers.get('content-encoding') || 'identity';
            if (encoding !== expectedEncoding) throw new Error(`Expected ${expectedEncoding} HTTP encoding, received ${encoding}`);
            const bytes = new Uint8Array(await response.arrayBuffer());
            const started = performance.now();
            const chunks = extractChunks(tableFromIPC(bytes));
            if (chunks.reduce((sum, chunk) => sum + chunk.length, 0) !== country.records) {
                throw new Error('Unexpected record count.');
            }
            if (!chunks.every(chunk => chunk.src.buffer === bytes.buffer)) throw new Error('Arrow numeric buffer was copied.');
            return {
                chunks: chunks.map(chunk => prepareChunk(chunk, { palette, countryCode: country.countryCode })),
                decodeMs: performance.now() - started, url, encoding
            };
        } catch (error) {
            failures.push(`${suffix}: ${error.message}`);
        }
    }
    throw new Error(failures.join('; '));
}
