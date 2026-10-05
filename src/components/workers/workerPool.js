export default class WorkerPool {
    constructor(WorkerConstructor, size = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)), wasmModule) {
        this.queue = [];
        this.workers = [];
        this.nextId = 0;
        this.closed = false;
        this.wasmModule = wasmModule;
        try {
            for (let i = 0; i < size; i++) {
                const slot = { worker: new WorkerConstructor(), task: null, timer: null };
                slot.worker.onmessage = ({ data }) => {
                    if (!slot.task || data.taskId !== slot.task.id) return;
                    this.finish(slot, data.success ? null : new Error(data.error), data.data);
                };
                slot.worker.onerror = (event) => {
                    event.preventDefault();
                    this.terminate(new Error(event.message || 'Data worker failed to start.'));
                };
                slot.worker.onmessageerror = () => this.terminate(new Error('Cannot read data worker response.'));
                this.workers.push(slot);
            }
        } catch (error) {
            this.terminate();
            throw error;
        }
    }

    enqueueTask(data) {
        if (this.closed) return Promise.reject(new Error('Worker pool is closed.'));
        return new Promise((resolve, reject) => {
            this.queue.push({ id: this.nextId++, data, resolve, reject });
            this.dispatch();
        });
    }

    dispatch() {
        for (const slot of this.workers) {
            if (slot.task || !this.queue.length) continue;
            slot.task = this.queue.shift();
            slot.timer = setTimeout(() => this.terminate(new Error('Data worker timed out.')), 120000);
            try {
                const message = { taskId: slot.task.id, data: slot.task.data };
                if (!slot.moduleSent) {
                    message.wasmModule = this.wasmModule;
                    slot.moduleSent = true;
                }
                slot.worker.postMessage(message);
            } catch (error) {
                this.terminate(error);
                return;
            }
        }
    }

    finish(slot, error, result) {
        clearTimeout(slot.timer);
        const task = slot.task;
        slot.task = null;
        if (error) task.reject(error);
        else task.resolve(result);
        this.dispatch();
    }

    terminate(error = new Error('Worker pool terminated.')) {
        this.closed = true;
        for (const slot of this.workers) {
            clearTimeout(slot.timer);
            slot.worker.terminate();
            slot.task?.reject(error);
        }
        for (const task of this.queue) task.reject(error);
        this.queue = [];
        this.workers = [];
    }
}
