import { tableFromIPC } from "apache-arrow";

// Хранилище для данных задачи между этапами
const taskDataStore = new Map();

self.onmessage = async function (e) {
    const messageData = e.data;

    // Проверка формата сообщения
    if (!messageData || typeof messageData !== 'object' || !('taskId' in messageData)) {
        // Отправляем ошибку обратно, если возможно определить taskId
        if (messageData && messageData.taskId !== undefined) {
            self.postMessage({ taskId: messageData.taskId, success: false, error: 'Invalid message format received by worker.' });
        }
        return;
    }

    const taskId = messageData.taskId;

    try {
        // Этап 1: Получение начальной задачи и загрузка файла
        if (messageData.type === 'INITIAL_TASK') {
            if (!messageData.data || typeof messageData.data !== 'object' || !('url' in messageData.data)) {
                throw new Error(`Worker task ${taskId}: Invalid data format for INITIAL_TASK.`);
            }
            const url = messageData.data.url;
            taskDataStore.set(taskId, { url }); // Сохраняем URL

            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status} for ${url}`);
            }
            const parquetUint8Array = new Uint8Array(await res.arrayBuffer());

            // Отправка сырых данных в основной поток для WASM обработки
            self.postMessage({
                taskId: taskId,
                type: 'WASM_REQUEST',
                payload: parquetUint8Array
            }, [parquetUint8Array.buffer]); // Передаем владение буфером

        }
        // Этап 2: Получение результата WASM и финальная обработка
        else if (messageData.type === 'WASM_RESPONSE') {
            const ipcStreamData = messageData.payload;
            const originalTaskData = taskDataStore.get(taskId);
            const url = originalTaskData?.url || 'N/A'; // Получаем URL из хранилища

            if (!ipcStreamData || !(ipcStreamData instanceof Uint8Array)) {
                throw new Error(`Worker task ${taskId} (${url}): Invalid WASM response payload received.`);
            }

            const arrowTable = tableFromIPC(ipcStreamData);

            // Проверка наличия батчей
            if (!arrowTable.batches || arrowTable.batches.length === 0) {
                // Если нет батчей, отправляем пустые данные как успешный результат
                self.postMessage({ taskId: taskId, success: true, data: { src: new Float32Array(0), length: 0, url } }, [new Float32Array(0).buffer]);
                taskDataStore.delete(taskId); // Очищаем хранилище
                return;
            }

            const recordBatch = arrowTable.batches[0];
            const arrowSchema = arrowTable.schema;

            // Проверка и получение stride
            const strideStr = arrowSchema.metadata.get('stride');
            const stride = parseInt(strideStr);
            if (isNaN(stride) || stride <= 0) {
                throw new Error(`Worker task ${taskId} (${url}): Invalid stride value "${strideStr}" (${stride}) in metadata.`);
            }

            // Получение данных и проверка структуры
            if (!recordBatch.data || !recordBatch.data.children || !recordBatch.data.children[0]?.children?.[0]?.values) {
                throw new Error(`Worker task ${taskId} (${url}): Unexpected Arrow data structure.`);
            }
            const float32Array = recordBatch.data.children[0].children[0].values;

            // Проверка типа данных
            if (!(float32Array instanceof Float32Array)) {
                throw new Error(`Worker task ${taskId} (${url}): Expected Float32Array, but received ${float32Array?.constructor?.name}.`);
            }

            const numRecords = float32Array.length / stride;

            // Проверка целостности данных 
            if (!Number.isInteger(numRecords) || numRecords < 0) {
                throw new Error(`Worker task ${taskId} (${url}): Invalid data length (${float32Array.length}) for stride (${stride}).`);
            }

            // Преобразование данных
            const binaryData = new Float32Array(numRecords * 6);
            for (let i = 0; i < numRecords; i++) {
                const index = i * stride;
                const newIndex = i * 6;
                // Копирование данных
                binaryData[newIndex + 0] = float32Array[index + 0]; // longitude
                binaryData[newIndex + 1] = float32Array[index + 1]; // latitude
                binaryData[newIndex + 2] = float32Array[index + 2]; // country
                binaryData[newIndex + 3] = float32Array[index + 3]; // downloadSpeed
                binaryData[newIndex + 4] = float32Array[index + 4]; // uploadSpeed
                binaryData[newIndex + 5] = float32Array[index + 5]; // countryCode
            }

            // Отправка финальных результатов
            self.postMessage({
                taskId: taskId,
                success: true,
                type: 'FINAL_RESULT',
                data: { src: binaryData, length: numRecords, url }
            }, [binaryData.buffer]); // Передаем владение буфером
            taskDataStore.delete(taskId); // Очищаем хранилище

        } else {
            // Неизвестный тип сообщения - отправляем ошибку обратно
            console.warn(`Worker task ${taskId}: Received message with unknown type: ${messageData.type}`);
            self.postMessage({ taskId: taskId, success: false, error: `Worker received unknown message type: ${messageData.type}` });
        }

    } catch (error) {
        // Логирование критических ошибок в консоль воркера (оставляем для production)
        const url = taskDataStore.get(taskId)?.url || 'N/A';
        console.error(`Worker task ${taskId} (${url}) caught error:`, error);

        // Отправка ошибки в основной поток
        self.postMessage({
            taskId: taskId,
            success: false,
            error: error instanceof Error ? error.message : String(error), // Отправляем только сообщение
            url: url
        });
        taskDataStore.delete(taskId); // Очищаем хранилище при ошибке
    }
};