import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Map } from '@vis.gl/react-maplibre';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { SCHEME_REGISTRY, STRIDE_BYTES } from './ColorScaleMaps.js';
import { createChunkIndex } from './data/binaryData.js';
import { COUNTRIES } from './data/countries.js';
import WorkerPool from './workers/workerPool';
import ArrowWorker from './workers/arrowWorker?worker';
import PaletteWorker from './workers/paletteWorker?worker';
import PaletteController from './workers/paletteController.js';
import LegendPanel from './RightPanel.jsx';
import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE = {
    longitude: 15.1, latitude: 48.9, zoom: 4,
    maxZoom: 12, minZoom: 3, pitch: 30, bearing: 0
};
const BASEMAP = 'https://basemaps.cartocdn.com/gl/';
const numberFormatter = new Intl.NumberFormat('en');
const speedFormatter = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

export default function ArrowMap() {
    const [mapStyle, setMapStyle] = useState(true);
    const [chunks, setChunks] = useState([]);
    const [progress, setProgress] = useState({ completed: 0, failed: [], loading: true });
    const [attempt, setAttempt] = useState(0);
    const [basemapError, setBasemapError] = useState(false);
    const [basemapAttempt, setBasemapAttempt] = useState(0);
    const [activeLayerKey, setActiveLayerKey] = useState('scatterplot');
    const [tooltipEnabled, setTooltipEnabled] = useState(false);
    const [activeColorSchemeKey, setActiveColorSchemeKey] = useState('ElectricViolet');
    const [activeColorHexagonSchemeKey, setActiveColorHexagonSchemeKey] = useState('BrightSpectrum');
    const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
    const [pendingPalette, setPendingPalette] = useState(null);
    const [paletteError, setPaletteError] = useState(null);
    const paletteController = useRef(null);
    const requestedPalette = useRef('ElectricViolet');
    const requestGeneration = useRef(0);
    const dataReady = useRef(false);

    const requestPalette = useCallback(key => {
        requestedPalette.current = key;
        const generation = ++requestGeneration.current;
        setPendingPalette(key);
        setPaletteError(null);
        const controller = paletteController.current;
        if (!controller || !dataReady.current) return;
        controller.request(key).then(() => {
            if (generation !== requestGeneration.current) return;
            setActiveColorSchemeKey(key);
            setPendingPalette(null);
        }).catch(error => {
            if (generation !== requestGeneration.current) return;
            setPendingPalette(null);
            setPaletteError(error.message);
        });
    }, []);

    useEffect(() => {
        const query = window.matchMedia('(max-width: 768px)');
        const update = () => setIsMobileView(query.matches);
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        let cancelled = false;
        let pool;
        let frame;
        let pendingChunks = [];
        const loadedChunks = [];
        const selected = requestedPalette.current;
        requestGeneration.current = requestGeneration.current + 1;
        paletteController.current?.dispose();
        paletteController.current = null;
        dataReady.current = false;
        setActiveColorSchemeKey(selected);
        setPendingPalette(null);
        setPaletteError(null);
        setChunks([]);
        setProgress({ completed: 0, failed: [], loading: true });
        const started = performance.now();
        let loadedRecords = 0;
        let decodeMs = 0;
        function flushChunks() {
            if (frame) cancelAnimationFrame(frame);
            frame = null;
            const batch = pendingChunks;
            pendingChunks = [];
            if (!cancelled && batch.length) setChunks(previous => [...previous, ...batch]);
        }
        async function load() {
            try {
                pool = new WorkerPool(ArrowWorker);
                await Promise.all(COUNTRIES.map(async country => {
                    try {
                        const result = await pool.enqueueTask({ country, palette: selected });
                        if (cancelled) return;
                        loadedRecords += result.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                        decodeMs += result.decodeMs;
                        const additions = result.chunks.map((chunk, index) => ({ ...chunk, id: country.key + ':' + index }));
                        loadedChunks.push(...additions);
                        pendingChunks.push(...additions);
                        frame ??= requestAnimationFrame(flushChunks);
                        setProgress(previous => ({ ...previous, completed: previous.completed + 1 }));
                    } catch (error) {
                        if (cancelled) return;
                        setProgress(previous => ({
                            ...previous, completed: previous.completed + 1,
                            failed: [...previous.failed, { file: country.key, message: error.message }]
                        }));
                    }
                }));
                if (!cancelled) {
                    if (loadedChunks.length) {
                        paletteController.current = new PaletteController(PaletteWorker, loadedChunks, selected, error => {
                            if (!cancelled) { setPaletteError(error.message); setPendingPalette(null); }
                        }, result => {
                            if (!cancelled) console.info('Background palettes complete', JSON.stringify({
                                elapsedMs: Math.round(result.elapsedMs), workerProcessingMs: Math.round(result.cpuMs),
                                releasedInputBytes: result.releasedInputBytes
                            }));
                        });
                        dataReady.current = true;
                        if (requestedPalette.current !== selected) requestPalette(requestedPalette.current);
                    }
                    console.info('Mobile map loading complete', JSON.stringify({
                        files: COUNTRIES.length, records: loadedRecords,
                        elapsedMs: Math.round(performance.now() - started),
                        workerProcessingMs: Math.round(decodeMs)
                    }));
                }
            } catch (error) {
                if (!cancelled) setProgress(previous => ({
                    ...previous, failed: [{ file: 'Data loader', message: error.message }]
                }));
            } finally {
                pool?.terminate();
                flushChunks();
                if (!cancelled) setProgress(previous => ({ ...previous, loading: false }));
            }
        }
        load();
        return () => {
            cancelled = true;
            if (frame) cancelAnimationFrame(frame);
            pool?.terminate();
            requestGeneration.current = requestGeneration.current + 1;
            paletteController.current?.dispose();
            paletteController.current = null;
            dataReady.current = false;
        };
    }, [attempt, requestPalette]);

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
                    getFillColor: { value: paletteController.current?.colors(chunk, activeColorSchemeKey) || chunk.colors[activeColorSchemeKey], size: 4, normalized: true }
                }
            },
            pickable: tooltipEnabled,
            getRadius: 200,
            radiusMinPixels: 0,
            radiusMaxPixels: 8,
            parameters: { depthWriteEnabled: false }
        }));
    }, [chunks, chunkIndex, densityData, activeLayerKey, activeColorSchemeKey, activeColorHexagonSchemeKey, tooltipEnabled]);

    const getTooltip = useCallback(({ picked, index, layer }) => {
        if (!tooltipEnabled || activeLayerKey !== 'scatterplot' || !picked || index < 0) return null;
        // Binary picking provides an index even when there is no row object.
        const chunk = chunks.find(item => layer?.id === 'speed-' + item.id);
        if (!chunk || index >= chunk.length) return null;
        const offset = index * 6;
        return { text: 'Download: ' + speedFormatter.format(chunk.src[offset + 3] / 1000) + ' Mbps\n' +
            'Upload: ' + speedFormatter.format(chunk.src[offset + 4] / 1000) + ' Mbps' };
    }, [tooltipEnabled, activeLayerKey, chunks]);

    return (
        <main className="map-app" aria-label="Mobile internet performance map">
            <DeckGL initialViewState={INITIAL_VIEW_STATE} controller={{
                dragPan: true, touchZoom: true, touchRotate: true, touchPitch: false
            }} layers={layers} getTooltip={getTooltip} useDevicePixels={false} onAfterRender={() => {
                // Start only after the full (or partial, on file failure) map has rendered.
                const controller = paletteController.current;
                if (!progress.loading && chunks.length && controller?.chunks.length === chunks.length) controller.start();
            }}>
                <Map key={basemapAttempt}
                    onError={() => setBasemapError(true)} onLoad={() => setBasemapError(false)}
                    mapStyle={BASEMAP + (mapStyle ? 'dark-matter-nolabels' : 'dark-matter') + '-gl-style/style.json'} />
            </DeckGL>
            {!isMobileView && <div className="rotate-shift">Hold Shift to rotate</div>}
            <LegendPanel
                mapStyle={mapStyle} setMapStyle={setMapStyle}
                activeColorHexagonSchemeKey={activeColorHexagonSchemeKey}
                setActiveColorHexagonSchemeKey={setActiveColorHexagonSchemeKey}
                activeColorSchemeKey={activeColorSchemeKey} setActiveColorSchemeKey={requestPalette}
                activeLayerKey={activeLayerKey} setActiveLayerKey={setActiveLayerKey}
                totalDataLenght={chunkIndex.length} isMobileView={isMobileView}
                tooltipEnabled={tooltipEnabled} setTooltipEnabled={setTooltipEnabled}
            />
            {progress.loading && <div className="load-status" role="status">
                Processed {progress.completed} of {COUNTRIES.length} files
                {progress.failed.length > 0 && ' · ' + progress.failed.length + ' failed'}
                {pendingPalette && ' · Palette change queued'}
            </div>}
            {pendingPalette && !progress.loading && <div className="load-status" role="status">
                Preparing {SCHEME_REGISTRY[pendingPalette].displayName} palette…
            </div>}
            {(progress.failed.length > 0 || basemapError || paletteError) && <div className="load-error" role="alert">
                {paletteError && <div><strong>Palette preparation unavailable</strong><p>{paletteError}</p>
                    <button className="legend-button" onClick={() => setAttempt(value => value + 1)}>Retry loading</button></div>}
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
