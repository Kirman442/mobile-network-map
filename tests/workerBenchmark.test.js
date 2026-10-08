import test from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkWorkerCount } from '../src/components/data/workerBenchmark.js';

test('normal builds ignore benchmark URLs and retain the adaptive worker pool', () => {
    for (const mode of ['production', 'development']) {
        assert.equal(benchmarkWorkerCount(mode, '?workers=8'), undefined);
    }
});

test('benchmark builds compare exactly four and eight without hardware adaptation', () => {
    assert.equal(benchmarkWorkerCount('workerbench', '?workers=8'), 8);
    for (const search of ['', '?workers=4', '?workers=100', '?workers=0']) {
        assert.equal(benchmarkWorkerCount('workerbench', search), 4);
    }
});
