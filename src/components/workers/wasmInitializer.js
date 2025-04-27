// components/workers/wasmInitializer.js
import initWasm from "parquet-wasm";

let wasmInitialized = false;

export async function ensureWasmInitialized(retries = 3, delay = 500) {
    if (wasmInitialized) {
        console.log('Parquet-wasm already initialized.');
        return true;
    }

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            await initWasm();
            wasmInitialized = true;
            // console.log('parquet-wasm initialized successfully.');
            return true;
        } catch (error) {
            console.error(`Attempt ${attempt} to initialize parquet-wasm failed:`, error);
            if (attempt <= retries) {
                console.log(`Waiting ${delay}ms before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('Max retries reached. Failed to initialize parquet-wasm.');
                throw error;
            }
        }
    }
    return false;
}

// Дополнительная функция для проверки статуса (не обязательно, но полезно)
export function isWasmInitialized() {
    return wasmInitialized;
}