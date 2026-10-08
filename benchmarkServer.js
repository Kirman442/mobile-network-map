import { createReadStream, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { COUNTRIES } from './src/components/data/countries.js';

// Local benchmark only: serve precompressed bodies just like the Netlify Edge Function.
export function benchmarkServer() {
    const countries = new Set(COUNTRIES.map(country => country.key));
    function configure(server) {
        server.middlewares.use((request, response, next) => {
            response.setHeader('Cache-Control', 'no-store');
            const match = request.url?.split('?')[0].match(/^\/data\/([a-z_]+)\.arrow\.(br|gz)$/);
            if (!match || !countries.has(match[1])) return next();
            if (!['GET', 'HEAD'].includes(request.method)) {
                response.writeHead(405); response.end(); return;
            }
            const file = resolve('public/data', `${match[1]}.arrow.${match[2]}`);
            try {
                response.setHeader('Content-Type', 'application/vnd.apache.arrow.file');
                response.setHeader('Content-Encoding', match[2] === 'br' ? 'br' : 'gzip');
                response.setHeader('Content-Length', statSync(file).size);
                if (request.method === 'HEAD') { response.end(); return; }
                const stream = createReadStream(file);
                stream.on('error', error => response.destroy(error));
                stream.pipe(response);
            } catch { response.writeHead(404); response.end(); }
        });
    }
    return { name: 'worker-benchmark-encoding', configureServer: configure, configurePreviewServer: configure };
}
