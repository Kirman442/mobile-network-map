import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Map } from '@vis.gl/react-maplibre';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { GridLayer, HexagonLayer, HeatmapLayer } from '@deck.gl/aggregation-layers';
import { lightingEffect } from './Effects.jsx';
import * as ColorMaps from './ColorScaleMaps.jsx';
import { useParquetFileUrls } from './FileUrls';
import WorkerPool from './workers/workerPool'
import { ensureWasmInitialized } from './workers/wasmInitializer';
import 'maplibre-gl/dist/maplibre-gl.css';
import LegendPanel from './RightPanel.jsx';
import { readParquet } from 'parquet-wasm'; // Импорт для обработки в основном потоке
import ParquetWorkerConstructor from './workers/parquetWorker?worker'; // Используем ?worker



const INITIAL_VIEW_STATE = {
    longitude: 15.1,
    latitude: 48.9,
    zoom: 4,
    maxZoom: 12,
    minZoom: 4,
    pitch: 30,
    bearing: 0,
};

export default function ParquetMap() {
    const [mapStyle, setMapStyle] = useState(true)
    const [wasmReady, setWasmReady] = useState(false); // Состояние готовности WASM
    const [mapReady, setMapReady] = useState(true); // Карта всегда готова к отображению
    const [allData, setAllData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processedFiles, setProcessedFiles] = useState(0);
    const [totalFiles, setTotalFiles] = useState(0);
    const [error, setError] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [elevation, setElevation] = useState(0);
    const [showHex, setShowHex] = useState(true);
    const [activeLayerKey, setActiveLayerKey] = useState('scatterplot');
    const [activeColorSchemeKey, setActiveColorSchemeKey] = useState('ElectricViolet'); // <-- Ключ схемы по умолчанию для Scatterplot
    const [activeColorHexagonSchemeKey, setActiveColorHexagonSchemeKey] = useState('BrightSpectrum'); // <-- Ключ схемы по умолчанию для Hexagon/Heatmap
    const [totalDataLenght, setTotalDataLenght] = useState()


    // Ref для отслеживания монтирования компонента
    const isMountedRef = useRef(true);
    const loadingStartedRef = useRef(false);
    const fileUrls = useParquetFileUrls();

    const workerPoolRef = useRef(null);
    const currentDataRef = useRef({ src: new Float32Array(0), length: 0 });

    const darkMatterStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    const darkMatterNolabels = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json';

    const setActiveMapStyleOnMap = useMemo(() => {
        return mapStyle ? darkMatterNolabels : darkMatterStyle
    }, [mapStyle]);

    // Выбираем актуальную функцию цветовой шкалы на основе ключа для ScatterplotLayer
    const activeColorScaleFunction = useMemo(() => {
        const schemeMap = {
            'ElectricViolet': ColorMaps.avgd_ElectricViolet_ScaleFunction,
            'VividGem': ColorMaps.avgd_VividGem_ScaleFunction,
            'InfernoLava': ColorMaps.avgd_InfernoGradient_ScaleFunction,
            'MutedStone': ColorMaps.avgd_MutedStone_ScaleFunction,
        };
        const selectedFunction = schemeMap[activeColorSchemeKey];
        if (selectedFunction) {
            return selectedFunction;
        } else {
            console.warn(`Unknown color scheme key: ${activeColorSchemeKey}. Using the default 'blues' scheme.`);
            return ColorMaps.avgd_ElectricViolet_ScaleFunction;
        }
    }, [activeColorSchemeKey]);

    // Выбираем актуальную цветовую шкалу на основе ключа для HexagonLayer и HeatmapLayer
    const activeColorHexagonScaleFunction = useMemo(() => {
        const schemeMap = {
            'BrightSpectrum': ColorMaps.COLOR_RANGE_AGGREGATE.BrightSpectrum,
            'DeepMauve': ColorMaps.COLOR_RANGE_AGGREGATE.DeepMauve,
            'TwilightBlue': ColorMaps.COLOR_RANGE_AGGREGATE.TwilightBlue,
            'MarineTeal': ColorMaps.COLOR_RANGE_AGGREGATE.MarineTeal,
        };
        const selectedFunction = schemeMap[activeColorHexagonSchemeKey];
        if (selectedFunction) {
            return selectedFunction;
        } else {
            console.warn(`Unknown color scheme key: ${activeColorHexagonSchemeKey}. Using the default 'blues' scheme.`);
            return ColorMaps.COLOR_RANGE_AGGREGATE.MarineTeal;
        }
    }, [activeColorHexagonSchemeKey]);

    // Создаем слои на основе текущих данных
    const layers = useMemo(() => {
        if (allData.length === 0 || allData[0].length === 0) return [];
        const commonProps = {
            data: allData[0],
            getPosition: (_, { index, data, target }) => {
                target[0] = data.src[index * 6];
                target[1] = data.src[index * 6 + 1];
                target[2] = 0;
                return target;
            },
            colorRange: activeColorHexagonScaleFunction,
            updateTriggers: {
                elevationScale: [elevation],
                colorRange: activeColorHexagonScaleFunction,
            }
        };

        const layersArray = [];

        // --- Конфигурация первого слоя ---
        if (activeLayerKey === 'hexagon') {
            layersArray.push(new HexagonLayer({
                id: 'hexagon-layer',
                ...commonProps,
                coverage: .9,
                gpuAggregation: true,
                radius: 1000,
                // elevationRange: [1, 150],
                // elevationScale: elevation,
                // extruded: true,
                upperPercentile: 1000,
                material: { ambient: 0.94, diffuse: 0.4, shininess: 32 }, //, specularColor: [51, 51, 51] 
                // transitions: { elevationScale: 3000 },
            }));
            // --- Конфигурация второго слоя ---
        } else if (activeLayerKey === 'heatmap') {
            layersArray.push(new HeatmapLayer({
                id: 'heatmap-layer',
                ...commonProps,
                radiusPixels: 3,
                intensity: .7,
                threshold: 0.5,
            }));
            // --- Конфигурация третьего слоя ---
        } else if (activeLayerKey === 'scatterplot') {
            layersArray.push(new ScatterplotLayer({
                id: 'scatterplot-layer',
                ...commonProps,
                gpuAggregation: true,
                // pickable: true,
                filled: true,
                opacity: 1,
                radiusScale: 200,
                parameters: {
                    depthTest: false
                },
                getFillColor: (_, { index, data, target }) => {
                    target[0] = data.src[index * 6 + 3];
                    return activeColorScaleFunction(target * 5);
                },
                updateTriggers: {
                    getFillColor: [
                        commonProps.data,
                        activeColorScaleFunction,
                    ],
                },
            }));
        }

        return layersArray;
    }, [allData, elevation, activeLayerKey, activeColorScaleFunction, activeColorHexagonScaleFunction]);

    // --- Функция обработки Parquet с помощью WASM (в основном потоке) ---
    const processParquetWithWasm = useCallback(async (parquetUint8Array) => {
        if (!wasmReady) {
            throw new Error("Parquet-WASM module is not initialized yet.");
        }
        try {
            // Не передаем второй аргумент { parallel: true }, если это вызывает проблемы
            const arrowWasmTable = readParquet(parquetUint8Array);
            // Конвертируем результат в IPC Stream (бинарный формат)
            const ipcStream = arrowWasmTable.intoIPCStream(); // Это Uint8Array
            return ipcStream; // Возвращаем Uint8Array
        } catch (err) {
            console.error("Main thread: Error during readParquet:", err);
            throw err; // Перебрасываем ошибку для WorkerPool
        }
    }, [wasmReady]); // Зависимость от wasmReady

    // Эффект для инициализации WASM при монтировании
    useEffect(() => {
        isMountedRef.current = true;
        // console.log("ParquetMap mounted. Initializing WASM...");
        ensureWasmInitialized()
            .then(success => {
                if (success && isMountedRef.current) {
                    // console.log("WASM initialized successfully in main thread.");
                    setWasmReady(true); // Устанавливаем флаг готовности WASM
                    setError(null);
                } else if (isMountedRef.current) {
                    console.error("WASM initialization failed after retries.");
                    setError("Failed to initialize WASM module. Data cannot be loaded.");
                    setWasmReady(false);
                }
            })
            .catch(err => {
                if (isMountedRef.current) {
                    console.error("WASM initialization threw an error:", err);
                    setError(`WASM Initialization Error: ${err.message}`);
                    setWasmReady(false);
                }
            });

        return () => {
            isMountedRef.current = false;
            // Завершаем работу пула воркеров при размонтировании
            if (workerPoolRef.current) {
                workerPoolRef.current.terminate();
                workerPoolRef.current = null;
                console.log("WorkerPool terminated on unmount.");
            }
            loadingStartedRef.current = false; // Сбрасываем флаг загрузки
        };
    }, []); // Пустой массив зависимостей - выполняется один раз при монтировании

    // Эффект для сброса данных при изменении списка файлов
    useEffect(() => {
        if (fileUrls.length > 0) {
            setAllData([]); // Сбрасываем данные полностью
            currentDataRef.current = { src: new Float32Array(0), length: 0 };
            setTotalDataLenght(0);
            setProcessedFiles(0);
            setTotalFiles(fileUrls.length);
            setIsLoading(true); // Начинаем загрузку
            setError(null);
            setErrorMessage(null);
            setMapReady(true); // Карта готова, показываем карту, но пока данные не загружены
            loadingStartedRef.current = false; // Позволяем следующему useEffect начать загрузку

            // Если пул уже существует, лучше его пересоздать или очистить очередь
            if (workerPoolRef.current) {
                workerPoolRef.current.terminate();
                workerPoolRef.current = null;
            }

        } else {
            setAllData([]);
            currentDataRef.current = { src: new Float32Array(0), length: 0 };
            setTotalDataLenght(0);
            setProcessedFiles(0);
            setTotalFiles(0);
            setIsLoading(false); // Нет файлов - нечего грузить
            setError(null);
            setErrorMessage(null);
            setMapReady(true); // Карта готова (пустая)
            loadingStartedRef.current = false;
            if (workerPoolRef.current) {
                workerPoolRef.current.terminate();
                workerPoolRef.current = null;
            }
        }
    }, [fileUrls]); // Зависимость от списка файлов

    // Эффект для запуска загрузки данных, когда WASM готов и есть файлы
    useEffect(() => {
        // Не начинаем загрузку, если WASM не готов, или уже идет загрузка, или нет файлов
        if (!wasmReady || loadingStartedRef.current || fileUrls.length === 0) {
            // if (!wasmReady) console.log("Data loading delayed: WASM not ready.");
            // if (loadingStartedRef.current) console.log("Data loading delayed: Already in progress.");
            // if (fileUrls.length === 0) console.log("Data loading skipped: No files.");
            return;
        }

        async function loadData() {
            if (!isMountedRef.current) return; // Проверка на размонтирование
            loadingStartedRef.current = true; // Устанавливаем флаг начала загрузки
            setIsLoading(true);
            setProcessedFiles(0); // Сброс счетчика перед началом
            setTotalFiles(fileUrls.length); // Устанавливаем общее количество
            setError(null);
            setErrorMessage(null);

            // Создаем worker pool ТОЛЬКО СЕЙЧАС, передавая обработчик WASM
            if (!workerPoolRef.current) {
                try {
                    workerPoolRef.current = new WorkerPool(
                        ParquetWorkerConstructor, // Передаем конструктор
                        10,                      // Размер пула
                        { type: 'module' },      // Опции воркера (важно для импортов внутри воркера)
                        processParquetWithWasm   // Обработчик WASM
                    );
                    // console.log("WorkerPool created successfully.");
                } catch (poolError) {
                    console.error("Failed to create WorkerPool:", poolError);
                    if (isMountedRef.current) {
                        setError(`Failed to create worker pool: ${poolError.message}`);
                        setIsLoading(false);
                        loadingStartedRef.current = false;
                    }
                    return; // Не можем продолжать без пула
                }
            }

            // Сбрасываем текущие данные перед загрузкой новой партии
            currentDataRef.current = { src: new Float32Array(0), length: 0 };
            setAllData([]); // Очищаем отображаемые данные

            console.time("⏱️ Full Feature Load Time");
            try {
                await processFilesWithWorkers(fileUrls); // Запускаем обработку
                console.timeEnd("⏱️ Full Feature Load Time");
                if (isMountedRef.current) {
                    console.log(`Finished processing all files. Total records: ${currentDataRef.current.length}`);
                    setMapReady(true); // Карта готова к отображению данных
                }
            } catch (processingError) {
                console.error("Error during file processing:", processingError);
                console.timeEnd("⏱️ Full Feature Load Time"); // Останавливаем таймер при ошибке
                if (isMountedRef.current) {
                    setError(`Error processing files: ${processingError.message}`);
                    setMapReady(false); // Не можем показать карту с ошибкой
                }
            } finally {
                // Устанавливаем isLoading в false только если компонент еще смонтирован
                if (isMountedRef.current) {
                    setIsLoading(false);
                }
                // Не сбрасываем loadingStartedRef.current здесь,
                // он сбрасывается при изменении fileUrls или размонтировании
            }
        }

        loadData(); // Запускаем асинхронную функцию загрузки

        // Таймер для анимации (оставляем, если нужен)
        const timer = setTimeout(() => {
            if (isMountedRef.current) {
                // setElevation(50); // Убедись, что setElevation определена
            }
        }, 2500);

        // Очистка таймера при изменении зависимостей или размонтировании
        return () => {
            clearTimeout(timer);
        };

    }, [wasmReady, fileUrls, processParquetWithWasm]); // Зависимости: готовность WASM, список файлов, функция-обработчик

    // Функция для объединения данных (без изменений)
    const mergeData = useCallback((existingData, newData) => {
        if (!newData || newData.length === 0) return existingData;
        if (!existingData || existingData.length === 0) {
            setTotalDataLenght(newData.length);
            return newData;
        };
        const totalLength = existingData.length + newData.length;
        const combinedSrc = new Float32Array(totalLength * 6);
        combinedSrc.set(existingData.src);
        combinedSrc.set(newData.src, existingData.length * 6);
        setTotalDataLenght(totalLength); // Обновляем общую длину
        return { src: combinedSrc, length: totalLength };
    }, []); // Убираем setTotalDataLenght из зависимостей, если она не меняется

    // Функция для обработки файлов с использованием воркер-пула (без изменений в логике вызова)
    const processFilesWithWorkers = useCallback(async (urls) => {
        if (!workerPoolRef.current) {
            throw new Error("Worker pool is not available.");
        }
        const BATCH_SIZE = 8; // Размер пакета обработки файлов

        for (let i = 0; i < urls.length; i += BATCH_SIZE) {
            if (!isMountedRef.current) {
                break; // Прерываем цикл, если компонент размонтирован
            }
            const batchUrls = urls.slice(i, i + BATCH_SIZE);

            const batchPromises = batchUrls.map(url =>
                workerPoolRef.current.enqueueTask({ url }) // Отправляем URL в воркер
                    .then(result => {
                        // Этот .then сработает, когда воркер пришлет FINAL_RESULT и success: true
                        if (!isMountedRef.current) return null;
                        setProcessedFiles(prev => prev + 1);
                        return result.data; // { src, length, url }
                    })
                    .catch(error => {
                        // Этот .catch сработает, если промис был отклонен (ошибка в воркере или в WASM)
                        if (!isMountedRef.current) return null;
                        const failedUrl = error.message?.includes('URL:') ? error.message.split('URL: ')[1] : url;
                        setProcessedFiles(prev => prev + 1); // Считаем обработанным (неудачно)
                        setErrorMessage(prev => prev ? `${prev}\nFailed: ${failedUrl}` : `Failed: ${failedUrl}`); // Показываем ошибку
                        return null; // Возвращаем null для неудачного файла
                    })
            );

            // Ожидаем завершения всех промисов в текущем пакете
            const batchResults = await Promise.all(batchPromises);

            // Объединяем результаты текущего пакета, пропуская null (ошибки)
            let batchData = { src: new Float32Array(0), length: 0 };
            for (const result of batchResults) {
                if (result) { // Только если результат не null (т.е. успешный)
                    batchData = mergeData(batchData, result);
                }
            }

            // Обновляем общие данные, если компонент еще смонтирован и есть новые данные
            if (batchData.length > 0 && isMountedRef.current) {
                const newData = mergeData(currentDataRef.current, batchData);
                currentDataRef.current = newData; // Обновляем ref с текущими данными
                setAllData([newData]); // Обновляем состояние для рендеринга DeckGL
            } else if (isMountedRef.current) {
                console.log("Batch completed with no new data (or only errors).");
            }
        }
    }, [mergeData]); // Зависимости: mergeData (setErrorMessage и setProcessedFiles стабильны)


    // Функция для тултипа
    const getTooltip = useCallback(({ index }) => {
        if (index === -1 || !allData.length) return null;

        const { src } = allData[0];
        const i = index * 6;

        if (i + 5 >= src.length) return null;

        return {
            html: `
        <div class="custom-tooltip">
          <b>Download:</b> ${(src[i + 3] / 1000).toFixed(2)} Mbps<br>
          <b>Upload:</b>  ${(src[i + 4] / 1000).toFixed(2)} Mbps<br>
          <b>Country Code:</b> ${src[i + 5]}
        </div>
      `,
            style: {
                backgroundColor: '#1a1a1a',
                fontSize: '14px',
                padding: '10px',
                borderRadius: '4px'
            }
        };
    }, [allData]);

    // DeckGL опции
    const deckGLOptions = useMemo(() => ({
        initialViewState: INITIAL_VIEW_STATE,
        controller: true,
        layers: layers,
        useDevicePixels: false,
    }), [layers]);
    // console.log('layers after setAllData:', layers);
    return (
        <div>
            {/* Карта всегда отображается немедленно */}
            {mapReady && (
                <DeckGL {...deckGLOptions} effects={[lightingEffect]} > {/* getTooltip={getTooltip} */}
                    <Map mapStyle={setActiveMapStyleOnMap} />
                    <div className="rotate-shift">
                        Hold down shift to rotate <br />
                        Zum Drehen Umschalttaste gedrückt halten
                    </div>
                    <LegendPanel
                        showHex={showHex}
                        setShowHex={setShowHex}
                        mapStyle={mapStyle}
                        setMapStyle={setMapStyle}
                        activeColorHexagonSchemeKey={activeColorHexagonSchemeKey}
                        setActiveColorHexagonSchemeKey={setActiveColorHexagonSchemeKey}
                        activeColorSchemeKey={activeColorSchemeKey}
                        setActiveColorSchemeKey={setActiveColorSchemeKey}
                        activeLayerKey={activeLayerKey}
                        setActiveLayerKey={setActiveLayerKey}
                        totalDataLenght={totalDataLenght}
                    />
                </DeckGL>
            )}
            {/* Прогресс загрузки поверх карты */}
            {isLoading && (
                <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '5px',
                    zIndex: 100
                }}>

                    Downloaded {processedFiles} of {totalFiles} files ({Math.round(processedFiles / totalFiles * 100)}%)
                </div>
            )}
            {error && (
                <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(255,0,0,0.7)', color: 'white', padding: '10px', borderRadius: '4px', zIndex: 10 }}>
                    Loading Error: {error.message}
                </div>
            )}
        </div>
    );
}