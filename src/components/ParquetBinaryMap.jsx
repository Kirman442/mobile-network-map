import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Map } from '@vis.gl/react-maplibre';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { GridLayer, HexagonLayer, HeatmapLayer } from '@deck.gl/aggregation-layers';
import { lightingEffect } from './effects.jsx';
import * as ColorMaps from './ColorScaleMaps.jsx';
import { useParquetFileUrls } from './FileUrls';
import WorkerPool from './workers/workerPool'
import 'maplibre-gl/dist/maplibre-gl.css';
import LegendPanel from './RightPanel.jsx';

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
    const [mapReady, setMapReady] = useState(true); // Карта всегда готова к отображению
    const [allData, setAllData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processedFiles, setProcessedFiles] = useState(0);
    const [totalFiles, setTotalFiles] = useState(0);
    const [error, setError] = useState(null);
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

    useEffect(() => {
        // Сброс данных при изменении списка файлов
        // if (fileUrls.length > 0) {
        //     setAllData([{ src: new Float32Array(0), length: 0 }]);
        //     loadingStartedRef.current = false;
        // }
    }, [fileUrls]);

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

    // Функция для объединения данных
    const mergeData = useCallback((existingData, newData) => {
        if (!newData || newData.length === 0) return existingData;
        if (existingData.length === 0) return newData;

        const totalLength = existingData.length + newData.length;
        const combinedSrc = new Float32Array(totalLength * 6);

        // Копируем существующие данные
        combinedSrc.set(existingData.src);

        // Добавляем новые данные
        combinedSrc.set(newData.src, existingData.length * 6);
        setTotalDataLenght(totalLength)

        return { src: combinedSrc, length: totalLength };
    }, []);

    // Эффект для инициализации и загрузки данных
    useEffect(() => {
        if (loadingStartedRef.current) {
            console.log("Data loading already started, skipping.");
            return;
        }

        async function initialize() {
            loadingStartedRef.current = true;
            console.log("Starting data loading process");

            // Инициализируем состояние
            setProcessedFiles(0);
            setTotalFiles(fileUrls.length);
            setIsLoading(true);
            setError(null);
            setMapReady(true);

            // Создаем worker pool
            // Вместо
            // const worker = new Worker(new URL('./parquetWorker.js', import.meta.url), { type: 'module' });

            // Используйте инлайн воркер с CDN-версиями библиотек
            const workerCode = `
  // Глобальный обработчик ошибок
  self.onerror = function(e) {
    console.error('Global worker error caught:', e);
    return true;
  };

  console.log('Worker: Starting initialization...');

  // Загружаем зависимости напрямую с CDN
  self.importScripts(
    'https://unpkg.com/apache-arrow@13.0.0/Arrow.es2015.min.js',
    'https://cdn.jsdelivr.net/npm/parquet-wasm@0.6.1/+esm'
  );
  
  console.log('Worker: Libraries loaded via importScripts');
  
  // Проверяем, что библиотеки загрузились правильно
  if (!self.Apache || !self.Apache.Arrow) {
    throw new Error('Apache Arrow library not loaded correctly');
  }
  
  if (!self.parquetWasm) {
    throw new Error('Parquet WASM library not loaded correctly');
  }
  
  // Получаем необходимые функции из загруженных библиотек
  const tableFromIPC = self.Apache.Arrow.tableFromIPC;
  const initWasm = self.parquetWasm.default;
  const readParquet = self.parquetWasm.readParquet;
  
  // Инициализируем WASM при старте воркера один раз
  let wasmInitialized = false;
  
  async function ensureWasmInitialized() {
    console.log('Worker: Ensuring WASM is initialized...');
    if (!wasmInitialized) {
      console.log('Worker: Initializing WASM...');
      try {
        await initWasm();
        wasmInitialized = true;
        console.log('Worker: WASM initialized successfully');
      } catch (error) {
        console.error('Worker: WASM initialization error:', error);
        throw error;
      }
    }
  }
  
  self.onmessage = async function (e) {
    // Используем let для taskId и url, чтобы они были доступны в catch блоке
    let taskId = -1;
    let url = 'unknown';
    
    try {
      console.log('Worker: Received message:', e.data);
      
      // --- Получение taskId и данных задачи ---
      if (!e.data || typeof e.data !== 'object' || !('taskId' in e.data) || !e.data.data || typeof e.data.data !== 'object' || !('url' in e.data.data)) {
        throw new Error('Invalid message format received by worker: missing taskId or data.url.');
      }
      
      taskId = e.data.taskId;
      url = e.data.data.url;
      console.log(\`Worker: Processing task \${taskId} for URL: \${url}\`);
      
      // Инициализация WASM
      await ensureWasmInitialized();
      
      // Получение данных Parquet
      console.log(\`Worker: Fetching Parquet data from \${url}\`);
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(\`HTTP error! Status: \${res.status} for \${url}\`);
      }
      
      const parquetUint8Array = new Uint8Array(await res.arrayBuffer());
      console.log(\`Worker: Parquet data fetched, size: \${parquetUint8Array.length} bytes\`);
      
      // Чтение parquet данных
      console.log('Worker: Reading Parquet data...');
      const arrowWasmTable = readParquet(parquetUint8Array);
      const arrowTable = tableFromIPC(arrowWasmTable.intoIPCStream());
      console.log('Worker: Parquet data read successfully');
      
      // --- Проверка наличия батчей и получение данных ---
      if (!arrowTable.batches || arrowTable.batches.length === 0) {
        console.log(\`Worker: Task \${taskId}: No batches in arrow table, returning empty result\`);
        self.postMessage({
          taskId: taskId,
          success: true,
          data: { src: new Float32Array(0), length: 0, url }
        }, [new Float32Array(0).buffer]);
        return;
      }
      
      const recordBatch = arrowTable.batches[0];
      const arrowSchema = arrowTable.schema;
      
      // Проверка stride
      const strideStr = arrowSchema.metadata.get('stride');
      const stride = parseInt(strideStr);
      if (isNaN(stride) || stride <= 0) {
        throw new Error(\`Worker task \${taskId} (\${url}): Invalid stride value "\${strideStr}" (\${stride}) in metadata.\`);
      }
      
      // Получение массива float32
      const float32Array = recordBatch.data.children[0].children[0].values;
      const numRecords = float32Array.length / stride;
      console.log(\`Worker: Processing \${numRecords} records with stride \${stride}\`);
      
      // --- Преобразование данных ---
      const binaryData = new Float32Array(numRecords * 6);
      for (let i = 0; i < numRecords; i++) {
        const index = i * stride;
        const newIndex = i * 6;
        
        binaryData[newIndex + 0] = float32Array[index + 0]; // longitude
        binaryData[newIndex + 1] = float32Array[index + 1]; // latitude
        binaryData[newIndex + 2] = float32Array[index + 2]; // country
        binaryData[newIndex + 3] = float32Array[index + 3]; // downloadSpeed
        binaryData[newIndex + 4] = float32Array[index + 4]; // uploadSpeed
        binaryData[newIndex + 5] = float32Array[index + 5]; // countryCode
      }
      
      // --- Отправка результатов ---
      console.log(\`Worker: Task \${taskId}: Sending processed data (\${numRecords} records)\`);
      self.postMessage({
        taskId: taskId,
        success: true,
        data: { src: binaryData, length: numRecords, url }
      }, [binaryData.buffer]);
      
    } catch (error) {
      // --- Логирование ошибки в воркере и отправка в основной поток ---
      console.error(\`Worker task \${taskId} (\${url}) caught error:\`, error);
      
      self.postMessage({
        taskId: taskId,
        success: false,
        error: error.message || 'Unknown worker error',
        stack: error.stack,
        url: url
      });
    }
  };
  
  console.log('Worker: Initialization complete, ready to process messages');
`;

            // Создаем Blob из кода воркера
            const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
            // Создаем URL для этого Blob
            const workerUrl = URL.createObjectURL(workerBlob);
            // Создаем воркер с этим URL
            const workerScriptUrl = new Worker(workerUrl);

            // Не забудьте освободить URL, когда он больше не нужен
            window.addEventListener('unload', () => URL.revokeObjectURL(workerUrl));
            // const workerScriptUrl = new URL('./workers/parquetWorker.js', import.meta.url);
            console.log('workerScriptUrl', workerScriptUrl)
            workerPoolRef.current = new WorkerPool(workerScriptUrl, 10, { type: 'module' });
            console.log('workerPoolRef.current', workerPoolRef.current)
            // Сбрасываем текущие данные
            currentDataRef.current = { src: new Float32Array(0), length: 0 };

            // Обрабатываем файлы
            console.time("⏱️ Full Feature Load Time");
            await processFilesWithWorkers(fileUrls);
            console.timeEnd("⏱️ Full Feature Load Time");

            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }

        initialize();
        const timer = setTimeout(() => setElevation(50), 2500);

        // Очистка
        return () => {
            console.log("Component unmounted");
            clearTimeout(timer);
            isMountedRef.current = false;

            if (workerPoolRef.current) {
                workerPoolRef.current.terminate();
            }
        };
    }, [fileUrls]);

    // Функция для обработки файлов с использованием воркер-пула
    const processFilesWithWorkers = useCallback(async (urls) => {
        const BATCH_SIZE = 10;
        for (let i = 0; i < urls.length; i += BATCH_SIZE) {
            const batchUrls = urls.slice(i, i + BATCH_SIZE);
            const batchPromises = batchUrls.map(url => workerPoolRef.current.enqueueTask({ url }) // enqueueTask теперь вернет Promise
                .then(result => { // Этот .then сработает при success: true
                    if (!isMountedRef.current) return null;
                    setProcessedFiles(prev => prev + 1);
                    // result будет иметь структуру { success: true, data: { src, length, url } }
                    return result.data;
                })
                .catch(error => { // Добавляем .catch для обработки ошибок воркера
                    if (!isMountedRef.current) return null;
                    setProcessedFiles(prev => prev + 1); // Считаем файл обработанным (неудачно)
                    console.error(`Failed to process file ${url}:`, error);
                    // Возможно, здесь нужно показать ошибку пользователю setErrorMessage(...)
                    return null; // Возвращаем null для неудачного файла
                })
            );
            const batchResults = await Promise.all(batchPromises);

            // Объединяем результаты текущего пакета
            let batchData = { src: new Float32Array(0), length: 0 };
            for (const result of batchResults) {
                if (result) {
                    batchData = mergeData(batchData, result);
                }
            }

            // Объединяем с общими данными
            if (batchData.length > 0 && isMountedRef.current) {
                const newData = mergeData(currentDataRef.current, batchData);
                currentDataRef.current = newData;
                setAllData([newData]);
            }
        }
    }, [mergeData, isMountedRef, setProcessedFiles]);

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