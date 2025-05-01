import React, { useState, useEffect } from 'react';
import '../css/rightPanel.css';
import { SCHEME_REGISTRY } from './ColorScaleMaps';
import ColorLegend from './ColorLegend';

const LegendPanel = ({ mapStyle, setMapStyle, activeColorSchemeKey, setActiveColorSchemeKey, activeColorHexagonSchemeKey, setActiveColorHexagonSchemeKey, activeLayerKey, setActiveLayerKey, totalDataLenght, isMobileView }) => {
    const [isInfoExpanded, setIsInfoExpanded] = useState(true);
    const [isDatasetExpanded, setIsDatasetExpanded] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


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

    // Обработчик мобильного меню
    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

    // Закрываем меню при изменении размера экрана с мобильного на десктоп
    useEffect(() => {
        if (!isMobileView) {
            setIsMobileMenuOpen(false);
        }
    }, [isMobileView]);

    // Мобильная кнопка меню
    const MobileMenuButton = () => (
        <div className="mobile-menu-button" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? '×' : '☰'}
        </div>
    );

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
        <>
            {/* Кнопка меню для мобильных */}
            {isMobileView && <MobileMenuButton />}

            {/* Затемнение фона при открытом мобильном меню */}
            {isMobileView && (
                <div
                    className={`mobile-overlay ${isMobileMenuOpen ? 'visible' : ''}`}
                    onClick={toggleMobileMenu}
                />
            )}
            <div className={`panel-container ${isMobileView ? 'mobile' : ''} ${isMobileMenuOpen ? 'open' : ''}`}>
                {/* Информационный блок */}
                <div className="panel-block">
                    <div className="panel-header" onClick={toggleInfoPanel}>
                        <div className="panel-title">Internet speed map</div>
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
                        <div className="panel-title">Information</div>
                        <div className="panel-expander">
                            {isDatasetExpanded ? '×' : 'i'}
                        </div>
                    </div>

                    {isDatasetExpanded && (
                        <div className="panel-content">
                            <div className="description-block">
                                <h4>About the dataset</h4>
                                <p className="dataset">
                                    This dataset provides global mobile network performance metrics in zoom level 16 web mercator tiles (approximately 610.8 meters by 610.8 meters at the equator). Data is provided as Apache Parquet with geometries represented in Well Known Text (WKT) projected in EPSG:4326. Download speed, upload speed, and latency are collected via the Speedtest by Ookla applications for Android and iOS and averaged for each tile. Measurements are filtered to results containing GPS-quality location accuracy.
                                    <br /><br /> </p>

                                <p>Data source: <a href="https://github.com/teamookla/ookla-open-data" target="_blank" rel="noopener noreferrer">Ookla Global Mobile Network</a></p>

                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default LegendPanel;