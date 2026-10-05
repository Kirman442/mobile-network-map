import test from 'node:test';
import assert from 'node:assert/strict';
import WorkerPool from '../src/components/workers/workerPool.js';

class FakeWorker {
    static instances = [];
    constructor() { FakeWorker.instances.push(this); }
    postMessage(message) { this.message = message; }
    terminate() { this.terminated = true; }
    reply(success, data) { this.onmessage({ data: { taskId: this.message.taskId, success, data, error: 'HTTP 404' } }); }
}

test('queue advances after file failures and resolves out of order', async () => {
    FakeWorker.instances = [];
    const pool = new WorkerPool(FakeWorker, 2);
    const first = pool.enqueueTask({ url: 'a' });
    const second = pool.enqueueTask({ url: 'b' });
    const third = pool.enqueueTask({ url: 'c' });
    const outcomes = Promise.allSettled([first, second, third]);
    FakeWorker.instances[1].reply(false);
    assert.equal(FakeWorker.instances[1].message.data.url, 'c');
    FakeWorker.instances[1].reply(true, { length: 3 });
    FakeWorker.instances[0].reply(true, { length: 1 });
    const results = await outcomes;
    assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected', 'fulfilled']);
    assert.equal(results[2].value.length, 3);
    pool.terminate();
});

test('fatal worker errors reject active and queued work instead of hanging', async () => {
    FakeWorker.instances = [];
    const pool = new WorkerPool(FakeWorker, 1);
    const outcomes = Promise.allSettled([pool.enqueueTask({}), pool.enqueueTask({})]);
    FakeWorker.instances[0].onerror({ preventDefault() {}, message: 'WASM load failed' });
    assert.ok((await outcomes).every(result => result.status === 'rejected'));
    assert.equal(FakeWorker.instances[0].terminated, true);
    await assert.rejects(pool.enqueueTask({}), /closed/);
});
