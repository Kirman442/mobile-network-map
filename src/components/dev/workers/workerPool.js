// components/workers/workerPool.js
class WorkerPool {
    // Принимает workerConstructor вместо workerScript
    constructor(workerConstructor, poolSize = navigator.hardwareConcurrency - 1 || 3, workerOptions = {}, wasmProcessor) {
        this.taskQueue = [];
        this.workers = [];
        this.poolSize = Math.max(2, poolSize);

        // Проверяем и сохраняем конструктор
        if (typeof workerConstructor !== 'function' || !workerConstructor.prototype) {
            // Добавим проверку на prototype для базовой валидации конструктора
            console.error("Invalid Worker constructor provided:", workerConstructor);
            throw new Error("WorkerPool requires a valid Worker constructor function.");
        }
        this.workerConstructor = workerConstructor;
        this.workerOptions = workerOptions; // Сохраняем опции
        this.taskPromises = new Map();
        this.nextTaskId = 0;
        if (typeof wasmProcessor !== 'function') {
            throw new Error("WorkerPool requires a valid wasmProcessor function.");
        }
        this.wasmProcessor = wasmProcessor;
        this.initialize();
        console.log(`WorkerPool initialized with ${this.poolSize} workers (using constructor).`);
    }

    initialize() {
        console.log(`WorkerPool: Initializing workers with options:`, this.workerOptions);
        for (let i = 0; i < this.poolSize; i++) {
            const workerId = `worker-${i}`;
            try {
                const worker = new this.workerConstructor(this.workerOptions);
                console.log(`WorkerPool: Worker ${workerId} instance created.`);
                const workerObj = { worker, busy: false, id: workerId, currentTaskId: null };
                this.workers.push(workerObj);

                worker.onmessage = async (e) => {
                    const messageData = e.data;
                    if (!messageData || typeof messageData.taskId === 'undefined') {
                        console.error(`${workerObj.id}: Received message without taskId`, messageData);
                        return;
                    }

                    const taskId = messageData.taskId;
                    const taskPromise = this.taskPromises.get(taskId);

                    try {
                        if (messageData.type === 'WASM_REQUEST') {
                            if (this.wasmProcessor) {
                                const result = await this.wasmProcessor(messageData.payload);
                                // Отправляем обратно воркеру
                                worker.postMessage({ taskId, type: 'WASM_RESPONSE', payload: result }, [result.buffer]);
                            } else {
                                throw new Error('WASM Processor not available.');
                            }
                        } else if (messageData.success && messageData.type === 'FINAL_RESULT') {
                            if (taskPromise) {
                                taskPromise.resolve(messageData);
                                this.taskPromises.delete(taskId);
                            }
                            workerObj.busy = false; // освобождаем воркер
                            workerObj.currentTaskId = null;
                            this.processNextTask(); // пробуем запустить следующую задачу
                        } else if (!messageData.success) {
                            if (taskPromise) {
                                taskPromise.reject(new Error(messageData.error || 'Unknown worker error.'));
                                this.taskPromises.delete(taskId);
                            }
                            workerObj.busy = false; // освобождаем воркер даже при ошибке
                            workerObj.currentTaskId = null;
                            this.processNextTask();
                        } else {
                            console.warn(`${workerObj.id}: Unknown message type received`, messageData);
                            if (taskPromise) {
                                taskPromise.reject(new Error('Unknown message type from worker.'));
                                this.taskPromises.delete(taskId);
                            }
                            workerObj.busy = false;
                            workerObj.currentTaskId = null;
                            this.processNextTask();
                        }
                    } catch (error) {
                        console.error(`${workerObj.id}: Error in message handler:`, error);
                        if (taskPromise) {
                            taskPromise.reject(error);
                            this.taskPromises.delete(taskId);
                        }
                        workerObj.busy = false;
                        workerObj.currentTaskId = null;
                        this.processNextTask();
                    }
                };

                worker.onerror = (event) => {
                    console.error(`Fatal Error EVENT in ${workerObj.id}:`, event);
                    let errorMessage = 'Unknown fatal error (event logged above).';
                    if (event.message) {
                        errorMessage = event.message;
                    } else if (event.error) {
                        errorMessage = event.error.message || event.error.toString();
                        console.error(`Nested error object in ${workerObj.id}:`, event.error);
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
                console.error(`WorkerPool: Failed to instantiate worker ${workerId}:`, error);
            }
        }

        if (this.workers.length === 0 && this.poolSize > 0) {
            console.error("WorkerPool: Failed to initialize ANY workers!");
        } else {
            console.log(`WorkerPool: Finished initialization. ${this.workers.length} of ${this.poolSize} workers created.`);
        }
    }

    // Методы enqueueTask, processNextTask, terminate остаются БЕЗ ИЗМЕНЕНИЙ
    enqueueTask(taskData) {
        // ... существующий код ...
        return new Promise((resolve, reject) => {
            const taskId = this.nextTaskId++;
            console.log(`WorkerPool: Enqueuing task ${taskId} with data:`, taskData);
            this.taskQueue.push({ taskId: taskId, data: taskData, resolve: resolve, reject: reject });
            this.taskPromises.set(taskId, { resolve: resolve, reject: reject });
            this.processNextTask();
        });
    }

    processNextTask() {
        // ... существующий код ...
        if (this.taskQueue.length === 0) return;
        const availableWorker = this.workers.find(w => !w.busy);
        if (!availableWorker) return;
        const nextTask = this.taskQueue.shift();
        console.log(`WorkerPool: Assigning task ${nextTask.taskId} to ${availableWorker.id}`);
        availableWorker.busy = true;
        availableWorker.currentTaskId = nextTask.taskId;
        availableWorker.worker.postMessage({ taskId: nextTask.taskId, type: 'INITIAL_TASK', data: nextTask.data });
    }

    terminate() {
        // ... существующий код ...
        console.log("WorkerPool: Terminating all workers...");
        this.workers.forEach(({ worker, id }) => { /* ... worker.terminate() ... */ });
        this.workers = []; this.taskQueue = [];
        this.taskPromises.forEach(p => p.reject(new Error("WorkerPool terminated")));
        this.taskPromises.clear();
        console.log("WorkerPool: Termination complete.");
    }
}

export default WorkerPool;