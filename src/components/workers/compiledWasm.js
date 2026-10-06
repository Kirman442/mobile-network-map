import wasmUrl from 'parquet-wasm/esm/parquet_wasm_bg.wasm?url';

let compiledModule;

// Share compiled code across workers; each worker still owns its WASM memory.
// This fetches the asset once, rather than once per worker on a cold visit.
export function getCompiledWasm() {
    compiledModule ??= compile().catch(error => {
        compiledModule = null;
        throw error;
    });
    return compiledModule;
}

async function compile() {
    const response = await fetch(wasmUrl, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`WASM download failed: HTTP ${response.status}`);
    if (typeof WebAssembly.compileStreaming === 'function' &&
        response.headers.get('Content-Type')?.split(';')[0].trim() === 'application/wasm') {
        return WebAssembly.compileStreaming(response);
    }
    return WebAssembly.compile(await response.arrayBuffer());
}
