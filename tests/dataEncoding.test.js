import test from 'node:test';
import assert from 'node:assert/strict';
import dataEncoding from '../netlify/edge-functions/data-encoding.js';

test('Netlify middleware streams encoded assets with correct headers without touching their body', async () => {
    for (const [extension, encoding] of [['arrow.br', 'br'], ['arrow.gz', 'gzip'], ['arrow', 'identity']]) {
        const bytes = new Uint8Array([1, 2, 3]);
        const response = await dataEncoding(new Request(`https://example.test/data/belgium.${extension}`), {
            next: async () => new Response(bytes)
        });
        assert.equal(response.headers.get('content-encoding'), encoding);
        assert.equal(response.headers.get('content-type'), 'application/vnd.apache.arrow.file');
        assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    }
});

test('Netlify missing data stays an error, unknown countries and double compression are rejected', async () => {
    const next = async () => new Response('', { status: 404 });
    assert.equal((await dataEncoding(new Request('https://example.test/data/belgium.arrow'), { next })).status, 404);
    assert.equal((await dataEncoding(new Request('https://example.test/data/missing.arrow'), { next })).status, 404);
    assert.equal((await dataEncoding(new Request('https://example.test/data/belgium.arrow.br'), {
        next: async () => new Response('', { headers: { 'content-encoding': 'gzip' } })
    })).status, 502);
});
