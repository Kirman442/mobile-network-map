import PropTypes from 'prop-types';
import './workerBenchmark.css';

function milliseconds(value) { return value == null ? 'Unavailable' : (value / 1000).toFixed(2) + ' s'; }
export default function WorkerBenchmarkPanel({ workers, report }) {
    function download() {
        const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `workers-${workers}-${Date.now()}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return <aside className="worker-benchmark" aria-label="Worker comparison">
        <strong>Worker comparison · {workers} workers</strong>
        <nav aria-label="Choose worker count"><a href="?workers=4">Test 4</a><a href="?workers=8">Test 8</a></nav>
        {!report ? <p role="status">Measuring loading and the first full frame…</p> : <>
            <p>{report.valid ? 'Complete dataset · foreground run' : 'Invalid comparison run: missing data or background tab'}</p>
            <dl>
                <dt>First points</dt><dd>{milliseconds(report.firstFrameMs)}</dd>
                <dt>Data ready</dt><dd>{milliseconds(report.dataReadyMs)}</dd>
                <dt>Full frame</dt><dd>{milliseconds(report.fullFrameMs)}</dd>
                <dt>Worker processing, sum</dt><dd>{milliseconds(report.workerProcessingMs)}</dd>
                <dt>Longest frame gap</dt><dd>{Math.round(report.maxFrameGapMs)} ms</dd>
                <dt>Frame gaps over 50 ms</dt><dd>{report.frameGapsOver50Ms}</dd>
                <dt>Main JS heap, sampled peak</dt><dd>{report.peakMainHeapBytes == null ? 'Unavailable' : (report.peakMainHeapBytes / 1048576).toFixed(1) + ' MiB'}</dd>
            </dl>
            <button type="button" onClick={download}>Save results</button>
            <details><summary>Measurement details</summary><p>{report.note}</p>
                <p>Keep this tab visible. Compare repeated runs with the same cache and network settings.</p>
                <pre aria-label="Worker benchmark results">{JSON.stringify(report, null, 2)}</pre>
            </details>
        </>}
    </aside>;
}
WorkerBenchmarkPanel.propTypes = { workers: PropTypes.number.isRequired, report: PropTypes.object };
