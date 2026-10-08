export function benchmarkWorkerCount(mode, search) {
    if (mode !== 'workerbench') return undefined;
    return new URLSearchParams(search).get('workers') === '8' ? 8 : 4;
}

export function startWorkerBenchmark(workers, expectedRecords, onComplete) {
    const started = performance.now();
    let firstFrameMs = null;
    let dataReadyMs = null;
    let workerProcessingMs = 0;
    let files = 0;
    let failures = 0;
    let frame;
    let lastFrame = null;
    let maxFrameGapMs = 0;
    let frameGapsOver50Ms = 0;
    let longTasks = 0;
    let longTaskMs = 0;
    let peakMainHeapBytes = null;
    let stayedVisible = !document.hidden;
    let finished = false;
    const observer = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')
        ? new PerformanceObserver(list => {
            for (const entry of list.getEntries()) { longTasks++; longTaskMs += entry.duration; }
        }) : null;
    observer?.observe({ type: 'longtask' });
    const visibility = () => { if (document.hidden) stayedVisible = false; };
    document.addEventListener('visibilitychange', visibility);
    const sample = now => {
        if (lastFrame !== null) {
            const gap = now - lastFrame;
            maxFrameGapMs = Math.max(maxFrameGapMs, gap);
            if (gap > 50) frameGapsOver50Ms++;
        }
        lastFrame = now;
        const heap = performance.memory?.usedJSHeapSize;
        if (typeof heap === 'number') peakMainHeapBytes = Math.max(peakMainHeapBytes ?? 0, heap);
        frame = requestAnimationFrame(sample);
    };
    frame = requestAnimationFrame(sample);
    function stop() {
        cancelAnimationFrame(frame);
        observer?.disconnect();
        document.removeEventListener('visibilitychange', visibility);
    }
    return {
        country(cpuMs) { files++; workerProcessingMs += cpuMs; },
        failed() { failures++; },
        dataReady() { dataReadyMs = performance.now() - started; },
        rendered(records, complete) {
            if (finished || records === 0) return;
            firstFrameMs ??= performance.now() - started;
            if (!complete) return;
            finished = true;
            for (const entry of observer?.takeRecords() ?? []) { longTasks++; longTaskMs += entry.duration; }
            const report = {
                workers, hardwareConcurrency: navigator.hardwareConcurrency ?? null,
                records, expectedRecords, files, failures, stayedVisible,
                firstFrameMs, dataReadyMs, fullFrameMs: performance.now() - started,
                workerProcessingMs, maxFrameGapMs, frameGapsOver50Ms,
                longTasks: observer ? longTasks : null, longTaskMs: observer ? longTaskMs : null,
                peakMainHeapBytes,
                note: 'Times start at the data-loading effect. Frames are deck.gl onAfterRender callbacks, not GPU completion. Heap samples cover the main JS heap only, excluding workers and GPU. Background palettes start after this measurement.',
            };
            report.valid = failures === 0 && records === expectedRecords && stayedVisible;
            stop();
            console.info('Worker benchmark complete', JSON.stringify(report));
            onComplete(report);
        },
        dispose: stop,
    };
}
