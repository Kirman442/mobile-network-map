import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { loadArrowCountry } from '../src/components/data/arrowLoader.js';
import { COUNTRIES } from '../src/components/data/countries.js';
import { SCHEME_REGISTRY } from '../src/components/ColorScaleMaps.js';

test('all 42 copied countries decode exactly from identity/gzip/Brotli and retain IPC views', async () => {
    let records = 0;
    for (const country of COUNTRIES) {
        const ipc = readFileSync(`public/data/${country.key}.arrow`);
        assert.deepEqual(gunzipSync(readFileSync(`public/data/${country.key}.arrow.gz`)), ipc);
        assert.deepEqual(brotliDecompressSync(readFileSync(`public/data/${country.key}.arrow.br`)), ipc);
        const result = await loadArrowCountry(country, 'ElectricViolet', false, async () => new Response(ipc));
        records += result.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        for (const chunk of result.chunks) {
            assert.deepEqual(Object.keys(chunk.colors), ['ElectricViolet']);
            assert.equal(chunk.download.length, chunk.length);
            for (let i = 0; i < chunk.length; i++) assert.equal(chunk.download[i], chunk.src[i * 6 + 3]);
        }
    }
    assert.equal(records, 1235099);
});

test('Brotli failure falls back to gzip; record/country/header failures remain visible', async () => {
    const country = COUNTRIES.find(country => country.key === 'belgium');
    const bytes = readFileSync('public/data/belgium.arrow');
    const urls = [];
    const load = await loadArrowCountry(country, 'VividGem', true, async url => {
        urls.push(url);
        return url.endsWith('.br') ? new Response('', { status: 503 }) : new Response(bytes, { headers: { 'content-encoding': 'gzip' } });
    });
    assert.deepEqual(urls, ['/data/belgium.arrow.br', '/data/belgium.arrow.gz']);
    assert.equal(load.encoding, 'gzip');
    const chunk = load.chunks[0];
    assert.deepEqual([...chunk.colors.VividGem.subarray(0, 4)], SCHEME_REGISTRY.VividGem.scaleFunction(chunk.src[3]).map(Math.trunc));
    await assert.rejects(loadArrowCountry(country, 'ElectricViolet', true, async () => new Response(bytes)), /Expected.*HTTP encoding/);
    await assert.rejects(loadArrowCountry({ ...country, records: 1 }, 'ElectricViolet', false, async () => new Response(bytes)), /record count/);
    await assert.rejects(loadArrowCountry({ ...country, countryCode: -1 }, 'ElectricViolet', false, async () => new Response(bytes)), /country code/);
});
