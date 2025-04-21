// parquetWorker.js
// Самая первая строка в вашем worker-скрипте (parquetWorker.js)

// Временно: Minimal parquetWorker.js for testing
self.onerror = function (e) {
    console.error('--- Minimal Worker: Error caught by onerror:', e);
};
console.log('--- Minimal Worker: Script started!');

self.onmessage = function (e) {
    console.log('--- Minimal Worker: Received message in minimal worker:', e.data);
    // Не делаем ничего сложного, не импортируем библиотеки, не фетчим
    self.postMessage({ success: true, message: 'Minimal worker received message' });
};
// Конец Minimal parquetWorker.js


// import { tableFromIPC } from "apache-arrow";

// import wasmInit, { readParquet } from "parquet-wasm";
import wasmUrl from 'parquet-wasm/esm/parquet_wasm_bg.wasm?url';
console.log('wasmUrl:', wasmUrl);


console.log('Worker script started AFTER IMPORTS'); // <-- Добавьте/перенесите этот лог сюда!
console.log('Worker: apache-arrow and parquet-wasm imported successfully.'); // <-- Добавьте этот новый лог сразу после импортов

// Инициализируем WASM при старте воркера один раз
let wasmInitialized = false;
async function ensureWasmInitialized() {
    if (!wasmInitialized) {
        console.log('Worker: Attempting to initialize WASM with URL:', wasmUrl); // Лог перед инициализацией
        try {
            // --- ПЕРЕДАЕМ ПОЛУЧЕННЫЙ URL В wasmInit ---
            await wasmInit(wasmUrl);
            // ----------------------------------------
            wasmInitialized = true;
            console.log('Worker: WASM initialized successfully!'); // Должен появиться при успехе
        } catch (wasmError) {
            console.error('Worker: !!! Error initializing WASM:', wasmError); // Должен появиться при ошибке инициализации WASM
            // Отправляем детальную ошибку WASM в основной поток
            self.postMessage({ error: 'WASM initialization failed', details: wasmError.message, stack: wasmError.stack });
            // Пробрасываем ошибку дальше, чтобы она попала в onmessage catch или self.onerror
            throw wasmError;
        }
    }
}

// self.onmessage = async function (e) {
//     // Используем let для taskId и url, чтобы они были доступны в catch блоке
//     let taskId;
//     let url;

//     try {
//         // Получаем taskId и url из сообщения
//         if (!e.data || typeof e.data !== 'object' || !('taskId' in e.data) || !e.data.data || typeof e.data.data !== 'object' || !('url' in e.data.data)) {
//             throw new Error('Invalid message format received by worker: missing taskId or data.url.');
//         }
//         taskId = e.data.taskId;
//         url = e.data.data.url;

//         await ensureWasmInitialized(); // Убеждаемся, что WASM инициализирован перед использованием

//         console.log(`Worker task ${taskId}: WASM ensured, fetching data from ${url}...`); // Лог перед fetch

//         const res = await fetch(url); // Твой код загрузки данных

//         // Проверка статуса HTTP ответа
//         if (!res.ok) {
//             throw new Error(`HTTP error! Status: ${res.status} for ${url}`);
//         }

//         const parquetUint8Array = new Uint8Array(await res.arrayBuffer());

//         const arrowWasmTable = readParquet(parquetUint8Array);

//         const arrowTable = tableFromIPC(arrowWasmTable.intoIPCStream());

//         // --- Проверка наличия батчей и получение данных ---
//         if (!arrowTable.batches || arrowTable.batches.length === 0) {
//             // Если нет батчей, отправляем пустые данные как успешный результат
//             self.postMessage({ taskId: taskId, success: true, data: { src: new Float32Array(0), length: 0, url } }, [new Float32Array(0).buffer]);
//             return; // Завершаем обработку этого файла
//         }

//         const recordBatch = arrowTable.batches[0]; // Берем первый батч
//         const arrowSchema = arrowTable.schema; // Схема доступна

//         // Проверка stride (более простая, но необходимая)
//         const strideStr = arrowSchema.metadata.get('stride');
//         const stride = parseInt(strideStr);
//         if (isNaN(stride) || stride <= 0) {
//             throw new Error(`Worker task ${taskId} (${url}): Invalid stride value "${strideStr}" (${stride}) in metadata.`);
//         }

//         // Получение массива float32 (полагаемся на то, что ошибки доступа к свойствам будут пойманы ниже)
//         const float32Array = recordBatch.data.children[0].children[0].values;
//         const numRecords = float32Array.length / stride;

//         // --- Преобразование данных (ваш цикл) ---
//         const binaryData = new Float32Array(numRecords * 6);
//         for (let i = 0; i < numRecords; i++) {
//             const index = i * stride;
//             const newIndex = i * 6;
//             // Копирование данных (полагаемся на корректность stride и данных из Parquet)
//             binaryData[newIndex + 0] = float32Array[index + 0]; // longitude;
//             binaryData[newIndex + 1] = float32Array[index + 1]; // latitude;
//             binaryData[newIndex + 2] = float32Array[index + 2]; // country;
//             binaryData[newIndex + 3] = float32Array[index + 3]; // downloadSpeed;
//             binaryData[newIndex + 4] = float32Array[index + 4]; // uploadSpeed;
//             binaryData[newIndex + 5] = float32Array[index + 5]; // countryCode;
//         }

//         // --- Отправка результатов ---
//         self.postMessage({ taskId: taskId, success: true, data: { src: binaryData, length: numRecords, url } }, [binaryData.buffer]);

//     } catch (error) {
//         // Логируем и отправляем все ошибки, возникающие после onmessage
//         console.error(`Worker task ${taskId !== undefined ? taskId : 'N/A'} (${url !== undefined ? url : 'N/A'}) caught error in onmessage:`, error);
//         self.postMessage({
//             taskId: taskId !== undefined ? taskId : -1,
//             success: false,
//             error: error.message || 'Unknown error in onmessage',
//             details: error.stack || 'No stack trace available',
//             url: url !== undefined ? url : 'N/A'
//         });
//     }
// };