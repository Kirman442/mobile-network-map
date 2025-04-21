// parquetWorker.js
// Самая первая строка в вашем worker-скрипте (parquetWorker.js)
self.onerror = function (e) {
    console.error('Error caught by worker.onerror:', e);
    // Дополнительно можно отправить сообщение об ошибке обратно в главный поток
    self.postMessage({ error: 'Worker encountered an internal error', details: e.message, originalError: e });
};

console.log('Worker script started'); // Добавь этот лог

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
};