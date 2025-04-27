// components/workers/workerPool.js
class WorkerPool {
    // Принимает workerConstructor вместо workerScript
    constructor(workerConstructor, poolSize = navigator.hardwareConcurrency - 1 || 3, workerOptions = {}, wasmProcessor) {
        this.taskQueue = [];
        this.workers = [];
        this.poolSize = Math.max(2, poolSize);

        // Проверяем конструктор воркера (оставляем console.error для этой критической проверки)
        if (typeof workerConstructor !== 'function' || !workerConstructor.prototype) {
            console.error("WorkerPool: Invalid Worker constructor provided:", workerConstructor);
            throw new Error("WorkerPool requires a valid Worker constructor function.");
        }
        this.workerConstructor = workerConstructor;
        this.workerOptions = workerOptions; // Сохраняем опции

        this.taskPromises = new Map();
        this.nextTaskId = 0;

        // Проверяем обработчик WASM
        if (typeof wasmProcessor !== 'function') {
            throw new Error("WorkerPool requires a valid wasmProcessor function.");
        }
        this.wasmProcessor = wasmProcessor;

        this.initialize();
    }

    initialize() {
        for (let i = 0; i < this.poolSize; i++) {
            const workerId = `worker-${i}`;
            try {
                const worker = new this.workerConstructor(this.workerOptions);

                const workerObj = { worker, busy: false, id: workerId, currentTaskId: null };
                this.workers.push(workerObj);

                worker.onmessage = async (e) => {
                    const messageData = e.data;
                    // Проверка наличия taskId (оставляем console.error для нарушения протокола)
                    if (!messageData || typeof messageData.taskId === 'undefined') {
                        console.error(`WorkerPool (${workerObj.id}): Received message without taskId`, messageData);
                        return; // Прерываем обработку, если нет ID
                    }

                    const taskId = messageData.taskId;
                    const taskPromise = this.taskPromises.get(taskId);

                    try {
                        // Обработка запроса на WASM
                        if (messageData.type === 'WASM_REQUEST') {
                            if (this.wasmProcessor) {
                                // Неявно предполагаем, что messageData.payload это ArrayBuffer или совместимый тип
                                const result = await this.wasmProcessor(messageData.payload);
                                // Проверяем, что результат имеет buffer для передачи (добавлено)
                                if (!result?.buffer) {
                                    throw new Error('WASM processor did not return an object with a transferable buffer.');
                                }
                                worker.postMessage({ taskId, type: 'WASM_RESPONSE', payload: result }, [result.buffer]);
                            } else {
                                // Ошибка, если обработчик WASM отсутствует
                                throw new Error('WASM Processor not configured or available.');
                            }
                        }
                        // Обработка успешного финального результата
                        else if (messageData.success && messageData.type === 'FINAL_RESULT') {
                            if (taskPromise) {
                                // Разрешаем промис с полным сообщением (содержит data)
                                taskPromise.resolve(messageData); // Используем resolve(messageData) чтобы получить data в основном потоке
                                this.taskPromises.delete(taskId);
                            } // Не логируем предупреждение об неизвестном taskId в production
                            workerObj.busy = false;
                            workerObj.currentTaskId = null;
                            this.processNextTask();
                        }
                        // Обработка сообщения об ошибке от воркера
                        else if (!messageData.success) {
                            if (taskPromise) {
                                // Отклоняем промис с сообщением об ошибке из воркера
                                taskPromise.reject(new Error(messageData.error || `Worker task ${taskId} failed without specific error message.`));
                                this.taskPromises.delete(taskId);
                            } // Не логируем предупреждение об неизвестном taskId в production
                            workerObj.busy = false;
                            workerObj.currentTaskId = null;
                            this.processNextTask();
                        }
                        // Обработка неизвестного типа сообщения
                        else {
                            if (taskPromise) {
                                taskPromise.reject(new Error(`Unknown message type received from worker: ${messageData.type}`));
                                this.taskPromises.delete(taskId);
                            }
                            workerObj.busy = false;
                            workerObj.currentTaskId = null;
                            this.processNextTask();
                        }
                    } catch (error) {
                        // Логируем ошибку, возникшую при обработке сообщения ЗДЕСЬ, в WorkerPool
                        console.error(`WorkerPool (${workerObj.id}): Error handling message for task ${taskId}:`, error);
                        if (taskPromise) {
                            // Отклоняем промис задачи основной ошибкой
                            taskPromise.reject(error instanceof Error ? error : new Error(String(error)));
                            this.taskPromises.delete(taskId);
                        }
                        // Освобождаем воркер после ошибки
                        workerObj.busy = false;
                        workerObj.currentTaskId = null;
                        this.processNextTask();
                    }
                };

                // Обработчик фатальных ошибок воркера (onerror) - оставляем console.error
                worker.onerror = (event) => {
                    console.error(`WorkerPool (${workerObj.id}): Fatal Error EVENT received:`, event);
                    let errorMessage = 'Unknown fatal error (event logged above).';
                    if (event.message) {
                        errorMessage = event.message;
                    } else if (event.error) {
                        errorMessage = event.error.message || event.error.toString();
                        console.error(`WorkerPool (${workerObj.id}): Nested error object:`, event.error);
                    } else if (typeof event === 'string') {
                        errorMessage = event;
                    }

                    const currentTaskId = workerObj.currentTaskId;
                    if (currentTaskId !== null) {
                        const taskPromise = this.taskPromises.get(currentTaskId);
                        if (taskPromise) {
                            taskPromise.reject(new Error(`Fatal error in worker ${workerObj.id} while processing task ${currentTaskId}. Message: ${errorMessage}`));
                            this.taskPromises.delete(currentTaskId);
                        }
                    }
                    workerObj.busy = false;
                    workerObj.currentTaskId = null;
                    this.processNextTask();
                };

            } catch (error) {
                // Логируем критическую ошибку создания экземпляра воркера
                console.error(`WorkerPool: Failed to instantiate worker ${workerId}:`, error);
            }
        }

        // Проверка и логирование, если не удалось создать ни одного воркера
        if (this.workers.length === 0 && this.poolSize > 0) {
            console.error("WorkerPool: Failed to initialize ANY workers!");
        }
    }

    enqueueTask(taskData) {
        return new Promise((resolve, reject) => {
            const taskId = this.nextTaskId++;
            this.taskQueue.push({ taskId: taskId, data: taskData, resolve: resolve, reject: reject });
            this.taskPromises.set(taskId, { resolve: resolve, reject: reject });
            this.processNextTask();
        });
    }

    processNextTask() {
        if (this.taskQueue.length === 0) return;
        const availableWorker = this.workers.find(w => !w.busy);
        if (!availableWorker) return;

        const nextTask = this.taskQueue.shift();
        availableWorker.busy = true;
        availableWorker.currentTaskId = nextTask.taskId;
        // Отправляем начальное сообщение воркеру
        availableWorker.worker.postMessage({ taskId: nextTask.taskId, type: 'INITIAL_TASK', data: nextTask.data });
    }

    terminate() {
        this.workers.forEach(({ worker, id }) => {
            try {
                // Добавим try-catch на случай ошибки при terminate
                worker.terminate();
            } catch (e) {
                console.error(`WorkerPool: Error terminating worker ${id}:`, e);
            }
        });
        this.workers = [];
        this.taskQueue = [];
        // Отклоняем все ожидающие промисы
        this.taskPromises.forEach(p => p.reject(new Error("WorkerPool terminated")));
        this.taskPromises.clear();
    }
}

export default WorkerPool;