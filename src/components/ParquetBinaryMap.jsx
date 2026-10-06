import { useState, useEffect, useMemo } from 'react';
import { Map } from '@vis.gl/react-maplibre';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { SCHEME_REGISTRY, STRIDE_BYTES } from './ColorScaleMaps.js';
import { createChunkIndex } from './data/binaryData.js';
import { useParquetFileUrls } from './FileUrls';
import WorkerPool from './workers/workerPool';
import { getCompiledWasm } from './workers/compiledWasm';
import ParquetWorker from './workers/parquetWorker?worker';
import LegendPanel from './RightPanel.jsx';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE = {
    longitude: 15.1, latitude: 48.9, zoom: 4,
    maxZoom: 12, minZoom: 3, pitch: 30, bearing: 0
};
const BASEMAP = 'https://basemaps.cartocdn.com/gl/';
const numberFormatter = new Intl.NumberFormat('en');

export default function ParquetMap() {
    const [mapStyle, setMapStyle] = useState(true);
    const [chunks, setChunks] = useState([]);
    const [progress, setProgress] = useState({ completed: 0, failed: [], loading: true });
    const [attempt, setAttempt] = useState(0);
    const [basemapError, setBasemapError] = useState(false);
    const [basemapAttempt, setBasemapAttempt] = useState(0);
    const [activeLayerKey, setActiveLayerKey] = useState('scatterplot');
    const [activeColorSchemeKey, setActiveColorSchemeKey] = useState('ElectricViolet');
    const [activeColorHexagonSchemeKey, setActiveColorHexagonSchemeKey] = useState('BrightSpectrum');
    const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
    const fileUrls = useParquetFileUrls();

    useEffect(() => {
        const query = window.matchMedia('(max-width: 768px)');
        const update = () => setIsMobileView(query.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        let cancelled = false;
        let pool;
        setChunks([]);
        setProgress({ completed: 0, failed: [], loading: true });
        const started = performance.now();
        let loadedRecords = 0;
        let decodeMs = 0;
        async function load() {
            try {
                const wasmModule = await getCompiledWasm();
                if (cancelled) return;
                pool = new WorkerPool(ParquetWorker, undefined, wasmModule);
                await Promise.all(fileUrls.map(async url => {
                    try {
                        const result = await pool.enqueueTask({ url });
                        if (cancelled) return;
                        loadedRecords += result.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                        decodeMs += result.decodeMs;
                        setChunks(previous => [...previous, ...result.chunks.map((chunk, index) => ({
                            ...chunk, id: url + ':' + index
                        }))]);
                        setProgress(previous => ({ ...previous, completed: previous.completed + 1 }));
                    } catch (error) {
                        if (cancelled) return;
                        setProgress(previous => ({
                            ...previous, completed: previous.completed + 1,
                            failed: [...previous.failed, { file: url.split('/').pop(), message: error.message }]
                        }));
                    }
                }));
                if (!cancelled) {
                    console.info('Mobile map loading complete', {
                        files: fileUrls.length, records: loadedRecords,
                        elapsedMs: Math.round(performance.now() - started),
                        workerDecodeMs: Math.round(decodeMs)
                    });
                }
            } catch (error) {
                if (!cancelled) setProgress(previous => ({
                    ...previous, failed: [{ file: 'Data loader', message: error.message }]
                }));
            } finally {
                pool?.terminate();
                if (!cancelled) setProgress(previous => ({ ...previous, loading: false }));
            }
        }
        load();
        return () => { cancelled = true; pool?.terminate(); };
    }, [fileUrls, attempt]);

    const chunkIndex = useMemo(() => createChunkIndex(chunks), [chunks]);
    const densityData = useMemo(() => ({ length: chunkIndex.length }), [chunkIndex]);
    const layers = useMemo(() => {
        if (!chunks.length) return [];
        if (activeLayerKey === 'heatmap') {
            return [new HeatmapLayer({
                id: 'density-layer',
                data: densityData,
                getPosition: (_, { index, target }) => {
                    const { chunk, offset } = chunkIndex.locate(index);
                    target[0] = chunk.src[offset];
                    target[1] = chunk.src[offset + 1];
                    target[2] = 0;
                    return target;
                },
                getWeight: 1,
                aggregation: 'SUM',
                colorRange: SCHEME_REGISTRY[activeColorHexagonSchemeKey].colorRange,
                radiusPixels: 12,
                intensity: 0.6,
                threshold: 0.15,
                opacity: 0.7
            })];
        }
        return chunks.map(chunk => new ScatterplotLayer({
            id: 'speed-' + chunk.id,
            data: {
                length: chunk.length,
                attributes: {
                    getPosition: { value: chunk.src, size: 2, stride: STRIDE_BYTES },
                    getFillColor: { value: chunk.colors[activeColorSchemeKey], size: 4, normalized: true }
                }
            },
            pickable: false,
            getRadius: 200,
            radiusMinPixels: 0,
            radiusMaxPixels: 8,
            parameters: { depthWriteEnabled: false }
        }));
    }, [chunks, chunkIndex, densityData, activeLayerKey, activeColorSchemeKey, activeColorHexagonSchemeKey]);

    return (
        <main className="map-app" aria-label="Mobile internet performance map">
            <DeckGL initialViewState={INITIAL_VIEW_STATE} controller={{
                dragPan: true, touchZoom: true, touchRotate: true, touchPitch: false
            }} layers={layers} useDevicePixels={false}>
                <Map key={basemapAttempt}
                    onError={() => setBasemapError(true)} onLoad={() => setBasemapError(false)}
                    mapStyle={BASEMAP + (mapStyle ? 'dark-matter-nolabels' : 'dark-matter') + '-gl-style/style.json'} />
            </DeckGL>
            {!isMobileView && <div className="rotate-shift">Hold Shift to rotate</div>}
            <LegendPanel
                mapStyle={mapStyle} setMapStyle={setMapStyle}
                activeColorHexagonSchemeKey={activeColorHexagonSchemeKey}
                setActiveColorHexagonSchemeKey={setActiveColorHexagonSchemeKey}
                activeColorSchemeKey={activeColorSchemeKey} setActiveColorSchemeKey={setActiveColorSchemeKey}
                activeLayerKey={activeLayerKey} setActiveLayerKey={setActiveLayerKey}
                totalDataLenght={chunkIndex.length} isMobileView={isMobileView}
            />
            {progress.loading && <div className="load-status" role="status">
                Processed {progress.completed} of {fileUrls.length} files
                {progress.failed.length > 0 && ' · ' + progress.failed.length + ' failed'}
            </div>}
            {(progress.failed.length > 0 || basemapError) && <div className="load-error" role="alert">
                {basemapError && <div><strong>Basemap unavailable</strong><p>The data layer is still available.</p>
                    <button className="legend-button" onClick={() => {
                        setBasemapError(false); setBasemapAttempt(value => value + 1);
                    }}>Retry basemap</button></div>}
                {progress.failed.length > 0 && <>
                <strong>{chunkIndex.length ? 'Partial dataset' : 'Data unavailable'}</strong>
                <p>{progress.failed.length} file(s) failed. {numberFormatter.format(chunkIndex.length)} records loaded.</p>
                <details><summary>Show errors</summary><ul>
                    {progress.failed.map(item => <li key={item.file}>{item.file}: {item.message}</li>)}
                </ul></details>
                {!progress.loading && <button className="legend-button" onClick={() => setAttempt(value => value + 1)}>Retry loading</button>}
                </>}
            </div>}
        </main>
    );
}
