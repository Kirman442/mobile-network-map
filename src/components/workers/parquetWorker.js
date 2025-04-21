// parquetWorker.js
console.log('Worker starting initialization...');

// Глобальный обработчик ошибок
self.onerror = function (e) {
    console.error('Global worker error caught:', e);
    return true;
};

// Используем динамический импорт с правильными относительными путями
async function loadDependencies() {
    try {
        console.log('Worker: Loading dependencies via importScripts...');

        // URL прямо к файлам в собранной версии
        const baseUrl = self.location.origin + self.location.pathname.slice(0, self.location.pathname.lastIndexOf('/') + 1);

        // Получаем ссылки на необходимые модули
        console.log('Base URL for imports:', baseUrl);
        const arrowUrl = new URL('./apache-arrow-iife.min.js', baseUrl).href;
        const parquetWasmUrl = new URL('./parquet-wasm-iife.js', baseUrl).href;

        console.log('Loading apache-arrow from', arrowUrl);
        console.log('Loading parquet-wasm from', parquetWasmUrl);

        // Загружаем скрипты синхронно
        importScripts(arrowUrl, parquetWasmUrl);

        console.log('Scripts loaded successfully');

        // После загрузки скриптов, эти объекты должны быть доступны глобально
        if (!self.Apache || !self.Apache.Arrow || !self.parquetWasm) {
            throw new Error('Failed to load required libraries');
        }

        return {
            tableFromIPC: self.Apache.Arrow.tableFromIPC,
            initWasm: self.parquetWasm.default,
            readParquet: self.parquetWasm.readParquet
        };
    } catch (error) {
        console.error('Failed to load dependencies:', error);
        throw error;
    }
}

// Инициализируем модули
let modules = null;
let wasmInitialized = false;

async function ensureWasmInitialized() {
    // if (!modules) {
    //     console.log('Loading modules...');
    //     modules = await importLibraries();
    //     console.log('Modules loaded successfully');
    // }

    if (!wasmInitialized) {
        console.log('Initializing WASM...');
        try {
            await modules.initWasm();
            wasmInitialized = true;
            console.log('WASM initialized successfully');
        } catch (error) {
            console.error('WASM initialization failed:', error);
            throw error;
        }
    }
}

self.onmessage = async function (e) {
    // Используем let для taskId и url, чтобы они были доступны в catch блоке
    let taskId = -1;
    let url = 'unknown';

    try {
        console.log('Worker received message:', e.data);

        // --- Получение taskId и данных задачи ---
        if (!e.data || typeof e.data !== 'object' || !('taskId' in e.data) || !e.data.data || typeof e.data.data !== 'object' || !('url' in e.data.data)) {
            throw new Error('Invalid message format received by worker: missing taskId or data.url.');
        }

        taskId = e.data.taskId;
        url = e.data.data.url;
        console.log(`Processing task ${taskId} for URL: ${url}`);

        // Инициализация WASM и импорт модулей
        await ensureWasmInitialized();
        const { tableFromIPC, readParquet } = modules;

        // Получение данных Parquet
        console.log(`Fetching Parquet data from ${url}`);
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status} for ${url}`);
        }

        const parquetUint8Array = new Uint8Array(await res.arrayBuffer());
        console.log(`Parquet data fetched, size: ${parquetUint8Array.length} bytes`);

        // Чтение parquet данных
        console.log('Reading Parquet data...');
        const arrowWasmTable = readParquet(parquetUint8Array);
        const arrowTable = tableFromIPC(arrowWasmTable.intoIPCStream());
        console.log('Parquet data read successfully');

        // --- Проверка наличия батчей и получение данных ---
        if (!arrowTable.batches || arrowTable.batches.length === 0) {
            console.log(`Task ${taskId}: No batches in arrow table, returning empty result`);
            self.postMessage({
                taskId: taskId,
                success: true,
                data: { src: new Float32Array(0), length: 0, url }
            }, [new Float32Array(0).buffer]);
            return;
        }

        const recordBatch = arrowTable.batches[0];
        const arrowSchema = arrowTable.schema;

        // Проверка stride
        const strideStr = arrowSchema.metadata.get('stride');
        const stride = parseInt(strideStr);
        if (isNaN(stride) || stride <= 0) {
            throw new Error(`Worker task ${taskId} (${url}): Invalid stride value "${strideStr}" (${stride}) in metadata.`);
        }

        // Получение массива float32
        const float32Array = recordBatch.data.children[0].children[0].values;
        const numRecords = float32Array.length / stride;
        console.log(`Processing ${numRecords} records with stride ${stride}`);

        // --- Преобразование данных ---
        const binaryData = new Float32Array(numRecords * 6);
        for (let i = 0; i < numRecords; i++) {
            const index = i * stride;
            const newIndex = i * 6;

            binaryData[newIndex + 0] = float32Array[index + 0]; // longitude
            binaryData[newIndex + 1] = float32Array[index + 1]; // latitude
            binaryData[newIndex + 2] = float32Array[index + 2]; // country
            binaryData[newIndex + 3] = float32Array[index + 3]; // downloadSpeed
            binaryData[newIndex + 4] = float32Array[index + 4]; // uploadSpeed
            binaryData[newIndex + 5] = float32Array[index + 5]; // countryCode
        }

        // --- Отправка результатов ---
        console.log(`Task ${taskId}: Sending processed data (${numRecords} records)`);
        self.postMessage({
            taskId: taskId,
            success: true,
            data: { src: binaryData, length: numRecords, url }
        }, [binaryData.buffer]);

    } catch (error) {
        // --- Логирование ошибки в воркере и отправка в основной поток ---
        console.error(`Worker task ${taskId} (${url}) caught error:`, error);

        self.postMessage({
            taskId: taskId,
            success: false,
            error: error.message || 'Unknown worker error',
            stack: error.stack,
            url: url
        });
    }
};

console.log('Worker initialized and ready to process messages');