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
        assert.equal(response.headers.get('cache-control'), 'no-store, no-transform');
        assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    }
});

test('production enables revalidation and preserves validators, 304 and updated bodies', async () => {
    for (const status of [200, 304]) {
        const response = await dataEncoding(new Request('https://example.test/data/belgium.arrow.br', {
            headers: { 'If-None-Match': '"previous"' }
        }), {
            deploy: { context: 'production' },
            next: async options => {
                assert.equal(options.sendConditionalRequest, true);
                return new Response(status === 200 ? 'updated' : null, {
                    status, headers: { ETag: status === 200 ? '"updated"' : '"previous"' }
                });
            }
        });
        assert.equal(response.status, status);
        assert.equal(response.headers.get('cache-control'), 'public, max-age=0, must-revalidate, no-transform');
        assert.equal(response.headers.get('etag'), status === 200 ? '"updated"' : '"previous"');
        assert.equal(response.headers.get('content-encoding'), 'br');
        assert.equal(await response.text(), status === 200 ? 'updated' : '');
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
