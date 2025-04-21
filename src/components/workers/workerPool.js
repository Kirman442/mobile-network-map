class WorkerPool {
    // --- Шаг 1: Добавляем параметр workerOptions в конструктор ---
    constructor(workerScript, poolSize = navigator.hardwareConcurrency - 1 || 3, workerOptions = {}) {
        this.taskQueue = []; // Очередь задач
        this.workers = []; // Массив объектов воркеров { worker, busy, id }
        this.poolSize = Math.max(2, poolSize); // Размер пула
        this.workerScript = workerScript; // Сохраняем URL скрипта воркера
        this.workerOptions = workerOptions; // <-- Шаг 2: Сохраняем опции воркера
        this.taskPromises = new Map(); // Карта для хранения Promise'ов задач по ID { taskId: { resolve, reject } }
        this.nextTaskId = 0; // Счетчик для уникальных ID задач

        this.initialize(); // Инициализируем воркеры
    }

    initialize() {
        for (let i = 0; i < this.poolSize; i++) {
            // --- Шаг 3: Передаем опции в конструктор Worker ---
            const worker = new Worker(this.workerScript, this.workerOptions); // <-- Передаем this.workerOptions сюда!

            this.workers.push({ worker, busy: false, id: `worker-${i}` });

            // --- Шаг 4: Перерабатываем обработчики сообщений для использования taskId ---
            // Единый обработчик для всех сообщений от этого воркера
            worker.onmessage = (e) => {
                // Ожидаем, что сообщение содержит taskId и результат (success/error)
                const { taskId, success, data, error } = e.data;

                const taskPromise = this.taskPromises.get(taskId);
                if (taskPromise) {
                    // Удаляем Promise из карты, так как задача завершена
                    this.taskPromises.delete(taskId);

                    // Разрешаем или отклоняем Promise в зависимости от успеха
                    if (success) {
                        taskPromise.resolve({ success: true, data: data }); // Разрешаем с результатом
                    } else {
                        // Отклоняем Promise с ошибкой
                        taskPromise.reject(new Error(error || `Worker task ${taskId} failed without specific error.`));
                    }

                    // Освобождаем воркер и пытаемся взять следующую задачу
                    const workerObj = this.workers.find(w => w.worker === worker);
                    if (workerObj) {
                        workerObj.busy = false;
                        this.processNextTask();
                    }
                } else {
                    // Это сообщение для задачи, которую мы не отслеживаем (уже завершена?)
                    console.warn(`Worker ${this.workers.find(w => w.worker === worker).id} sent message for unknown or completed task ID: ${taskId}`, e.data);
                }
            };

            // Единый обработчик фатальных ошибок воркера (например, ошибка загрузки скрипта, необработанное исключение)
            worker.onerror = (error) => {
                console.error(`Fatal Error in worker ${this.workers.find(w => w.worker === worker).id}:`, error);

                // В случае фатальной ошибки, все текущие задачи, запущенные на этом воркере, могут быть испорчены.
                // Лучше всего полагаться на то, что сам воркер отправит сообщение об ошибке задачи через onmessage.
                // Этот onerror больше для диагностики проблем самого воркера.
                // Пока просто помечаем воркер как свободный (или лучше его перезапустить/заменить?)
                const workerObj = this.workers.find(w => w.worker === worker);
                if (workerObj) {
                    workerObj.busy = false;
                    // В продакшене, возможно, стоит terminate() этот воркер и создать новый
                    this.processNextTask(); // Пытаемся запустить следующую задачу на другом воркере
                }
            };
            // --- Конец переработки обработчиков ---
        }
    }

    // Метод добавления задачи в очередь
    enqueueTask(taskData) {
        // Шаг 5: Теперь Promise поддерживает reject
        return new Promise((resolve, reject) => {
            const taskId = this.nextTaskId++; // Генерируем уникальный ID для задачи
            // Шаг 6: Сохраняем taskId вместе с задачей и Promise'ами
            this.taskQueue.push({ taskId: taskId, data: taskData, resolve: resolve, reject: reject });
            // Шаг 7: Сохраняем Promise'ы в карту по taskId
            this.taskPromises.set(taskId, { resolve: resolve, reject: reject });

            this.processNextTask(); // Пытаемся запустить задачу сразу
        });
    }

    // Метод обработки следующей задачи
    processNextTask() {
        if (this.taskQueue.length === 0) return; // Нет задач в очереди
        const availableWorker = this.workers.find(w => !w.busy); // Ищем свободный воркер
        if (!availableWorker) return; // Все воркеры заняты

        const nextTask = this.taskQueue.shift(); // Берем следующую задачу из очереди
        availableWorker.busy = true; // Помечаем воркер как занятый

        // Шаг 8: Отправляем сообщение воркеру, ВКЛЮЧАЯ taskId и данные задачи
        availableWorker.worker.postMessage({ taskId: nextTask.taskId, data: nextTask.data });
    }

    async processFile(parquetData, fileName, isLargeFile = false) {
        if (!isLargeFile) {
            return this.enqueueTask({
                parquetData,
                fileName,
                isLargeFile
            });
        } else {
            // Для больших файлов разбиваем на чанки
            const CHUNK_SIZE = 80000;
            const chunks = [];
            const totalRows = parquetData.data.length;

            for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
                chunks.push({
                    parquetData,
                    fileName,
                    isLargeFile: true,
                    chunkStart: i,
                    chunkEnd: Math.min(i + CHUNK_SIZE, totalRows)
                });
            }

            // Возвращаем Promise, который разрешится, когда все чанки будут обработаны
            const results = await Promise.all(chunks.map(chunk => this.enqueueTask(chunk)));
            return {
                features: results.flatMap(result => result.features),
                fileName,
                processingTime: results.reduce((sum, r) => sum + (r.processingTime || 0), 0),
                processedRowsCount: results.reduce((sum_1, r_1) => sum_1 + (r_1.processedRowsCount || 0), 0),
                success: results.every(r_2 => r_2.success)
            };
        }
    }
    // Метод для завершения всех воркеров (если нужно)
    terminate() {
        this.workers.forEach(({ worker }) => worker.terminate());
        this.workers = [];
        this.taskQueue = [];
        this.taskPromises.clear();
    }
}
export default WorkerPool;