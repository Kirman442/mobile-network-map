// wasmBridge.js
import { readParquet } from "parquet-wasm";
import { ensureWasmInitialized } from "./wasmInitializer";

/**
 * Мост между основным потоком и воркерами для операций WASM
 */
class WasmBridge {
    constructor() {
        this.workerTasksMap = new Map(); // Хранит соответствие между идентификаторами задач и воркерами
    }

    /**
     * Инициализирует мост для работы с WASM
     */
    async initialize() {
        try {
            await ensureWasmInitialized();
            console.log('WasmBridge initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize WasmBridge:', error);
            throw error;
        }
    }

    /**
     * Регистрирует воркер для обработки WASM-операций
     * @param {Worker} worker - Экземпляр воркера
     */
    registerWorker(worker) {
        if (!worker) return;

        // Сохраняем оригинальный обработчик сообщений воркера
        const originalOnMessage = worker.onmessage;

        // Переопределяем обработчик сообщений
        worker.onmessage = (e) => {
            if (e.data && e.data.type === 'wasm_operation') {
                // Обрабатываем WASM-операцию
                this.handleWasmOperation(worker, e.data);
            } else if (originalOnMessage) {
                // Передаем сообщение оригинальному обработчику
                originalOnMessage(e);
            }
        };

        console.log('Worker registered with WasmBridge');
    }

    /**
     * Обрабатывает WASM-операцию и отправляет результат обратно в воркер
     * @param {Worker} worker - Экземпляр воркера
     * @param {Object} data - Данные операции
     */
    async handleWasmOperation(worker, data) {
        const { taskId, operation, data: operationData, url } = data;

        try {
            console.log(`Processing WASM operation: ${operation} for task ${taskId}`);

            // Проверяем, что WASM инициализирован
            await ensureWasmInitialized();

            let result;

            // Выполняем соответствующую WASM-операцию
            if (operation === 'readParquet') {
                result = readParquet(operationData);
                console.log(`WASM readParquet completed for task ${taskId}`);
            } else {
                throw new Error(`Unknown WASM operation: ${operation}`);
            }

            // Отправляем результат обратно в воркер
            const arrowWasmTable = result;
            const ipcStream = arrowWasmTable.intoIPCStream();

            worker.postMessage({
                taskId: taskId,
                type: 'wasm_result',
                success: true,
                data: {
                    arrowWasmTable: ipcStream,
                    url: url
                }
            });

        } catch (error) {
            console.error(`Error processing WASM operation for task ${taskId}:`, error);

            // Отправляем ошибку обратно в воркер
            worker.postMessage({
                taskId: taskId,
                type: 'wasm_result',
                success: false,
                error: error.message || 'Unknown WASM operation error'
            });
        }
    }
}

// Создаем и экспортируем экземпляр моста
const wasmBridge = new WasmBridge();
export default wasmBridge;