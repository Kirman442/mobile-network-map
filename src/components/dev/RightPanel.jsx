import React, { useState } from 'react';
import '../css/rightPanel.css';
import { SCHEME_REGISTRY } from './ColorScaleMaps';
import ColorLegend from './ColorLegend';

const LegendPanel = ({ mapStyle, setMapStyle, activeColorSchemeKey, setActiveColorSchemeKey, activeColorHexagonSchemeKey, setActiveColorHexagonSchemeKey, activeLayerKey, setActiveLayerKey, totalDataLenght }) => {
    const [isInfoExpanded, setIsInfoExpanded] = useState(true);
    const [isDatasetExpanded, setIsDatasetExpanded] = useState(false);

    const formatNumber = (num) => {
        if (!num) return '0';

        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        }
        return num.toString();
    };

    const LAYER_KEYS = ['hexagon', 'heatmap', 'scatterplot'];

    const renderLayerButtons = () => (
        <div className="color-scheme-buttons">
            {LAYER_KEYS.map(key => (
                <button
                    key={key}
                    className={`legend-button ${activeLayerKey === key ? 'active' : ''}`}
                    onClick={() => handleLayerChange(key)} // Используем функцию handleLayerChange
                >
                    {/* Отображаемое имя слоя */}
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
            ))}
        </div>
    );

    // Функция для переключения панелей с автоматическим закрытием другой
    const toggleInfoPanel = () => {
        setIsInfoExpanded(!isInfoExpanded);
        if (!isInfoExpanded) {
            setIsDatasetExpanded(false);
        }
    };

    const toggleDatasetPanel = () => {
        setIsDatasetExpanded(!isDatasetExpanded);
        if (!isDatasetExpanded) {
            setIsInfoExpanded(false);
        }
    };
    // Функция, вызывающаяся при клике для смены слоя
    const handleLayerChange = (key) => {
        setActiveLayerKey(key);
    };

    // --- Логика кнопок выбора цветовых схем ---
    // Определяем, какие ключи схем актуальны для текущего активного слоя
    let relevantSchemeKeys = []; // Массив ключей схем, которые нужно показать
    let activeSchemeSetter = null; // Актуальный сеттер стейта схемы
    let currentActiveSchemeKey = null; // Ключ активной схемы ДЛЯ ПОДСВЕТКИ КНОПКИ

    if (activeLayerKey === 'scatterplot') {
        // Фильтруем схемы по layerType: 'scatterplot' из SCHEME_REGISTRY
        relevantSchemeKeys = Object.keys(SCHEME_REGISTRY).filter(key => SCHEME_REGISTRY[key].layerType === 'scatterplot');
        activeSchemeSetter = setActiveColorSchemeKey; // Используем сеттер для Scatterplot
        currentActiveSchemeKey = activeColorSchemeKey; // Используем стейт для Scatterplot
    } else if (activeLayerKey === 'hexagon' || activeLayerKey === 'heatmap') {
        // Фильтруем схемы по layerType: 'hexagon-heatmap'
        relevantSchemeKeys = Object.keys(SCHEME_REGISTRY).filter(key => SCHEME_REGISTRY[key].layerType === 'hexagon-heatmap');
        activeSchemeSetter = setActiveColorHexagonSchemeKey;
        currentActiveSchemeKey = activeColorHexagonSchemeKey;
    }

    const renderColorSchemeButtons = () => {
        if (relevantSchemeKeys.length === 0) {
            return null; // Не показываем блок, если нет схем для этого слоя
        }

        return (
            <div className="color-scheme-buttons">
                {/* <h4>Select Scheme:</h4> */}
                {relevantSchemeKeys.map(schemeKey => {
                    const schemeDef = SCHEME_REGISTRY[schemeKey]; // Получаем определение из реестра
                    if (!schemeDef) return null; // Проверка на всякий случай

                    return (
                        <button
                            key={schemeKey}
                            className={`legend-button ${currentActiveSchemeKey === schemeKey ? 'active' : ''}`} // Подсветка активной кнопки схемы
                            onClick={() => activeSchemeSetter(schemeKey)} // Вызываем актуальный сеттер с ключом схемы
                        >
                            {schemeDef.displayName}
                        </button>
                    );
                })}
            </div>
        );
    };

    // --- Логика определения данных для Легенды ---
    let currentSchemeKey = null;
    // Определяем ключ активной схемы на основе активного слоя и соответствующих стейтов схем
    if (activeLayerKey === 'scatterplot') {
        currentSchemeKey = activeColorSchemeKey;
    } else if (activeLayerKey === 'hexagon' || activeLayerKey === 'heatmap') {
        currentSchemeKey = activeColorHexagonSchemeKey;
    }

    const activeSchemeDefinition = SCHEME_REGISTRY[currentSchemeKey];


    return (
        <div className="panel-container">
            {/* Информационный блок */}
            <div className="panel-block">
                <div className="panel-header" onClick={toggleInfoPanel}>
                    <div className="panel-title">Internet Speed Map</div>
                    <div className="panel-expander">
                        {isInfoExpanded ? '×' : 'i'}
                    </div>
                </div>

                {isInfoExpanded && (
                    <div className="panel-content">
                        <div className="stat-item">
                            <div className="stat-label">Total number of measurements </div>
                            <div className="stat-value">{formatNumber(totalDataLenght)}</div>
                        </div>
                        <div className="description-block">
                            <p className='dataset text-center'>Change color map palette:</p>
                            {renderColorSchemeButtons()}

                            <p className='dataset text-center'>Select the layer:</p>
                            {renderLayerButtons()}
                            <p className='dataset text-center'>Select a map style:</p>
                            <button className='legend-button button-center mb-10' onClick={() => setMapStyle(!mapStyle)}>{mapStyle ? 'With Labels' : 'No Labels'}</button>
                            <ColorLegend
                                schemeDefinition={activeSchemeDefinition}
                                activeLayerKey={activeLayerKey} // Передаем активный слой, чтобы Легенда могла формировать заголовок
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Dataset блок */}
            <div className="panel-block">
                <div className="panel-header" onClick={toggleDatasetPanel}>
                    <div className="panel-title">Infos zum Datensatz</div>
                    <div className="panel-expander">
                        {isDatasetExpanded ? '×' : 'i'}
                    </div>
                </div>

                {isDatasetExpanded && (
                    <div className="panel-content">
                        <div className="description-block">
                            <h4>Über den Datensatz</h4>
                            <p className="dataset">
                                Dieser Datensatz enthält Leistungskennzahlen für globale mobile Breitbandnetze in Form von Mercator-Kacheln auf Skalenebene 16 (etwa 610,8 Meter mal 610,8 Meter am Äquator). Upload- und Download-Geschwindigkeiten sowie Latenzzeiten werden mit den Speedtest by Ookla-Apps für Android und iOS erfasst und für jede Kachel gemittelt. Die Messungen werden gefiltert, um Ergebnisse mit einer Standortgenauigkeit in GPS-Qualität zu erhalten.
                                <br /><br /> </p>

                            <p>Datenquelle: <a href="https://github.com/teamookla/ookla-open-data" target="_blank" rel="noopener noreferrer">Ookla Global Mobile Network</a></p>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LegendPanel;