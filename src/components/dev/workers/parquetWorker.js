// --- WASM инициализация удалена отсюда ---
import { tableFromIPC } from "apache-arrow";

// Хранилище для данных задачи между этапами
const taskDataStore = new Map();

self.onmessage = async function (e) {
    // --- Обработка сообщений ---
    const messageData = e.data;

    if (!messageData || typeof messageData !== 'object' || !('taskId' in messageData)) {
        console.error('Worker received invalid message format:', messageData);
        // Пытаемся отправить ошибку, если есть хоть какой-то ID
        if (messageData && messageData.taskId !== undefined) {
            self.postMessage({ taskId: messageData.taskId, success: false, error: 'Invalid message format received by worker.' });
        }
        return;
    }

    const taskId = messageData.taskId;

    try {
        // --- Этап 1: Получение начальной задачи и загрузка файла ---
        if (messageData.type === 'INITIAL_TASK') {
            const url = messageData.data.url;
            console.log(`Worker task ${taskId}: Received initial task for URL: ${url}`);
            taskDataStore.set(taskId, { url }); // Сохраняем URL

            const res = await fetch(url);
            console.log(`Worker task ${taskId}: Fetch status ${res.status} for ${url}`);
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status} for ${url}`);
            }
            const parquetUint8Array = new Uint8Array(await res.arrayBuffer());
            console.log(`Worker task ${taskId}: Fetched ${parquetUint8Array.byteLength} bytes from ${url}`);

            // --- Отправка сырых данных в основной поток для WASM обработки ---
            console.log(`Worker task ${taskId}: Sending raw data to main thread for WASM processing.`);
            self.postMessage({
                taskId: taskId,
                type: 'WASM_REQUEST', // Указываем тип сообщения
                payload: parquetUint8Array
            }, [parquetUint8Array.buffer]); // Передаем владение буфером

        }
        // --- Этап 2: Получение результата WASM и финальная обработка ---
        else if (messageData.type === 'WASM_RESPONSE') {
            const ipcStreamData = messageData.payload; // Это Uint8Array с IPC Stream
            const originalTaskData = taskDataStore.get(taskId);
            const url = originalTaskData?.url || 'N/A'; // Получаем URL из хранилища
            console.log(`Worker task ${taskId}: Received WASM result (IPC Stream) from main thread for ${url}. Size: ${ipcStreamData?.byteLength} bytes.`);

            if (!ipcStreamData || !(ipcStreamData instanceof Uint8Array)) {
                throw new Error(`Worker task ${taskId} (${url}): Invalid WASM response payload received.`);
            }

            const arrowTable = tableFromIPC(ipcStreamData);
            console.log(`Worker task ${taskId}: Reconstructed Arrow Table from IPC Stream.`);

            // --- Проверка наличия батчей и получение данных (как было раньше) ---
            if (!arrowTable.batches || arrowTable.batches.length === 0) {
                console.log(`Worker task ${taskId} (${url}): No record batches found. Sending empty result.`);
                self.postMessage({ taskId: taskId, success: true, data: { src: new Float32Array(0), length: 0, url } }, [new Float32Array(0).buffer]);
                taskDataStore.delete(taskId); // Очищаем хранилище
                return;
            }

            const recordBatch = arrowTable.batches[0];
            const arrowSchema = arrowTable.schema;
            const strideStr = arrowSchema.metadata.get('stride');
            const stride = parseInt(strideStr);

            if (isNaN(stride) || stride <= 0) {
                throw new Error(`Worker task ${taskId} (${url}): Invalid stride value "${strideStr}" (${stride}) in metadata.`);
            }

            const float32Array = recordBatch.data.children[0].children[0].values;
            const numRecords = float32Array.length / stride;
            console.log(`Worker task ${taskId}: Extracted data. Stride: ${stride}, Records: ${numRecords}`);

            // --- Преобразование данных ---
            const binaryData = new Float32Array(numRecords * 6);
            for (let i = 0; i < numRecords; i++) {
                const index = i * stride;
                const newIndex = i * 6;
                binaryData[newIndex + 0] = float32Array[index + 0]; // longitude;
                binaryData[newIndex + 1] = float32Array[index + 1]; // latitude;
                binaryData[newIndex + 2] = float32Array[index + 2]; // country;
                binaryData[newIndex + 3] = float32Array[index + 3]; // downloadSpeed;
                binaryData[newIndex + 4] = float32Array[index + 4]; // uploadSpeed;
                binaryData[newIndex + 5] = float32Array[index + 5]; // countryCode;
            }
            console.log(`Worker task ${taskId}: Transformed data to final Float32Array (${binaryData.byteLength} bytes).`);

            // --- Отправка финальных результатов ---
            self.postMessage({
                taskId: taskId,
                success: true,
                type: 'FINAL_RESULT', // Четко указываем тип финального сообщения
                data: { src: binaryData, length: numRecords, url }
            }, [binaryData.buffer]); // Передаем владение буфером
            taskDataStore.delete(taskId); // Очищаем хранилище

        } else {
            console.warn(`Worker task ${taskId}: Received message with unknown type: ${messageData.type}`);
            // Можно отправить ошибку или просто проигнорировать
            self.postMessage({ taskId: taskId, success: false, error: `Worker received unknown message type: ${messageData.type}` });
        }

    } catch (error) {
        // --- Логирование ошибки в воркере и отправка в основной поток ---
        const url = taskDataStore.get(taskId)?.url || 'N/A'; // Пытаемся получить URL
        console.error(`Worker task ${taskId} (${url}) caught error:`, error);
        self.postMessage({
            taskId: taskId,
            success: false,
            error: error.message || 'Unknown worker error',
            url: url
        });
        taskDataStore.delete(taskId); // Очищаем хранилище при ошибке
    }
};

console.log("Parquet worker script loaded."); // Лог при загрузке скрипта воркера