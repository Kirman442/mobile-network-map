// parquetWorker.js
import { tableFromIPC } from "apache-arrow";
import initWasm, { readParquet } from "parquet-wasm";

// Инициализируем WASM при старте воркера один раз
let wasmInitialized = false;
async function ensureWasmInitialized() {
    if (!wasmInitialized) {
        await initWasm();
        wasmInitialized = true;
    }
}

self.onmessage = async function (e) {
    // Используем let для taskId и url, чтобы они были доступны в catch блоке
    let taskId;
    let url;

    try {
        // --- Получение taskId и данных задачи  ---
        // Проверяем только наличие taskId и data.url
        if (!e.data || typeof e.data !== 'object' || !('taskId' in e.data) || !e.data.data || typeof e.data.data !== 'object' || !('url' in e.data.data)) {
            // Если формат сообщения совсем не тот, бросаем ошибку сразу
            throw new Error('Invalid message format received by worker: missing taskId or data.url.');
        }

        taskId = e.data.taskId;
        url = e.data.data.url;
        // --- Конец получения ---

        await ensureWasmInitialized(); // Инициализация WASM

        const res = await fetch(url);

        // Проверка статуса HTTP ответа
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status} for ${url}`);
        }

        const parquetUint8Array = new Uint8Array(await res.arrayBuffer());

        const arrowWasmTable = readParquet(parquetUint8Array);

        const arrowTable = tableFromIPC(arrowWasmTable.intoIPCStream());

        // --- Проверка наличия батчей и получение данных ---
        if (!arrowTable.batches || arrowTable.batches.length === 0) {
            // Если нет батчей, отправляем пустые данные как успешный результат
            self.postMessage({ taskId: taskId, success: true, data: { src: new Float32Array(0), length: 0, url } }, [new Float32Array(0).buffer]);
            return; // Завершаем обработку этого файла
        }

        const recordBatch = arrowTable.batches[0]; // Берем первый батч
        const arrowSchema = arrowTable.schema; // Схема доступна

        // Проверка stride (более простая, но необходимая)
        const strideStr = arrowSchema.metadata.get('stride');
        const stride = parseInt(strideStr);
        if (isNaN(stride) || stride <= 0) {
            throw new Error(`Worker task ${taskId} (${url}): Invalid stride value "${strideStr}" (${stride}) in metadata.`);
        }

        // Получение массива float32 (полагаемся на то, что ошибки доступа к свойствам будут пойманы ниже)
        const float32Array = recordBatch.data.children[0].children[0].values;
        const numRecords = float32Array.length / stride;

        // --- Преобразование данных (ваш цикл) ---
        const binaryData = new Float32Array(numRecords * 6);
        for (let i = 0; i < numRecords; i++) {
            const index = i * stride;
            const newIndex = i * 6;
            // Копирование данных (полагаемся на корректность stride и данных из Parquet)
            binaryData[newIndex + 0] = float32Array[index + 0]; // longitude;
            binaryData[newIndex + 1] = float32Array[index + 1]; // latitude;
            binaryData[newIndex + 2] = float32Array[index + 2]; // country;
            binaryData[newIndex + 3] = float32Array[index + 3]; // downloadSpeed;
            binaryData[newIndex + 4] = float32Array[index + 4]; // uploadSpeed;
            binaryData[newIndex + 5] = float32Array[index + 5]; // countryCode;
        }

        // --- Отправка результатов ---
        self.postMessage({ taskId: taskId, success: true, data: { src: binaryData, length: numRecords, url } }, [binaryData.buffer]);

    } catch (error) {
        // --- Логирование ошибки в воркере и отправка в основной поток ---
        // taskId и url должны быть доступны благодаря объявлению через let в начале
        console.error(`Worker task ${taskId !== undefined ? taskId : 'N/A'} (${url !== undefined ? url : 'N/A'}) caught error:`, error);
        // Отправляем ошибку обратно (включаем taskId)
        self.postMessage({ taskId: taskId !== undefined ? taskId : -1, success: false, error: error.message || 'Unknown worker error', url: url !== undefined ? url : 'N/A' });
    }
}

// // parquetWorker.js
// console.log('Worker starting initialization...');

// // Добавляем глобальный обработчик ошибок
// self.onerror = function (e) {
//     console.error('Global worker error caught:', e);
//     // Предотвращаем прерывание выполнения
//     return true;
// };

// // Пробуем импортировать библиотеки с диагностикой
// console.log('Worker: Attempting to import apache-arrow and parquet-wasm');

// // Оборачиваем импорты в async функцию для лучшей обработки ошибок
// async function importLibraries() {
//     try {
//         console.log('Importing apache-arrow...');
//         const arrowModule = await import("apache-arrow");
//         console.log('apache-arrow imported successfully');

//         console.log('Importing parquet-wasm...');
//         const parquetModule = await import("parquet-wasm");
//         console.log('parquet-wasm imported successfully');

//         return {
//             tableFromIPC: arrowModule.tableFromIPC,
//             initWasm: parquetModule.default,
//             readParquet: parquetModule.readParquet
//         };
//     } catch (error) {
//         console.error('Failed to import libraries:', error);
//         throw error;
//     }
// }

// // Инициализируем модули
// let modules = null;
// let wasmInitialized = false;

// async function ensureWasmInitialized() {
//     if (!modules) {
//         console.log('Loading modules...');
//         modules = await importLibraries();
//         console.log('Modules loaded successfully');
//     }

//     if (!wasmInitialized) {
//         console.log('Initializing WASM...');
//         try {
//             await modules.initWasm();
//             wasmInitialized = true;
//             console.log('WASM initialized successfully');
//         } catch (error) {
//             console.error('WASM initialization failed:', error);
//             throw error;
//         }
//     }
// }

// self.onmessage = async function (e) {
//     // Используем let для taskId и url, чтобы они были доступны в catch блоке
//     let taskId = -1;
//     let url = 'unknown';

//     try {
//         console.log('Worker received message:', e.data);

//         // --- Получение taskId и данных задачи ---
//         if (!e.data || typeof e.data !== 'object' || !('taskId' in e.data) || !e.data.data || typeof e.data.data !== 'object' || !('url' in e.data.data)) {
//             throw new Error('Invalid message format received by worker: missing taskId or data.url.');
//         }

//         taskId = e.data.taskId;
//         url = e.data.data.url;
//         console.log(`Processing task ${taskId} for URL: ${url}`);

//         // Инициализация WASM и импорт модулей
//         await ensureWasmInitialized();
//         const { tableFromIPC, readParquet } = modules;

//         // Получение данных Parquet
//         console.log(`Fetching Parquet data from ${url}`);
//         const res = await fetch(url);

//         if (!res.ok) {
//             throw new Error(`HTTP error! Status: ${res.status} for ${url}`);
//         }

//         const parquetUint8Array = new Uint8Array(await res.arrayBuffer());
//         console.log(`Parquet data fetched, size: ${parquetUint8Array.length} bytes`);

//         // Чтение parquet данных
//         console.log('Reading Parquet data...');
//         const arrowWasmTable = readParquet(parquetUint8Array);
//         const arrowTable = tableFromIPC(arrowWasmTable.intoIPCStream());
//         console.log('Parquet data read successfully');

//         // --- Проверка наличия батчей и получение данных ---
//         if (!arrowTable.batches || arrowTable.batches.length === 0) {
//             console.log(`Task ${taskId}: No batches in arrow table, returning empty result`);
//             self.postMessage({
//                 taskId: taskId,
//                 success: true,
//                 data: { src: new Float32Array(0), length: 0, url }
//             }, [new Float32Array(0).buffer]);
//             return;
//         }

//         const recordBatch = arrowTable.batches[0];
//         const arrowSchema = arrowTable.schema;

//         // Проверка stride
//         const strideStr = arrowSchema.metadata.get('stride');
//         const stride = parseInt(strideStr);
//         if (isNaN(stride) || stride <= 0) {
//             throw new Error(`Worker task ${taskId} (${url}): Invalid stride value "${strideStr}" (${stride}) in metadata.`);
//         }

//         // Получение массива float32
//         const float32Array = recordBatch.data.children[0].children[0].values;
//         const numRecords = float32Array.length / stride;
//         console.log(`Processing ${numRecords} records with stride ${stride}`);

//         // --- Преобразование данных ---
//         const binaryData = new Float32Array(numRecords * 6);
//         for (let i = 0; i < numRecords; i++) {
//             const index = i * stride;
//             const newIndex = i * 6;

//             binaryData[newIndex + 0] = float32Array[index + 0]; // longitude
//             binaryData[newIndex + 1] = float32Array[index + 1]; // latitude
//             binaryData[newIndex + 2] = float32Array[index + 2]; // country
//             binaryData[newIndex + 3] = float32Array[index + 3]; // downloadSpeed
//             binaryData[newIndex + 4] = float32Array[index + 4]; // uploadSpeed
//             binaryData[newIndex + 5] = float32Array[index + 5]; // countryCode
//         }

//         // --- Отправка результатов ---
//         console.log(`Task ${taskId}: Sending processed data (${numRecords} records)`);
//         self.postMessage({
//             taskId: taskId,
//             success: true,
//             data: { src: binaryData, length: numRecords, url }
//         }, [binaryData.buffer]);

//     } catch (error) {
//         // --- Логирование ошибки в воркере и отправка в основной поток ---
//         console.error(`Worker task ${taskId} (${url}) caught error:`, error);

//         self.postMessage({
//             taskId: taskId,
//             success: false,
//             error: error.message || 'Unknown worker error',
//             stack: error.stack,
//             url: url
//         });
//     }
// };

// console.log('Worker initialized and ready to process messages');