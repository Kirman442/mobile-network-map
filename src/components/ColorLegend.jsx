// ColorLegend.jsx
import React from 'react';
import PropTypes from 'prop-types';

// Компонент для отрисовки легенды цвета с градиентной полосой
const ColorLegend = ({ schemeDefinition, activeLayerKey }) => {
    // Проверяем, получили ли мы полное и валидное определение схемы
    if (!schemeDefinition || !schemeDefinition.domain || !schemeDefinition.colorRange || schemeDefinition.domain.length !== schemeDefinition.colorRange.length + 1) {
        // Если данных нет или они некорректны, ничего не отрисовываем
        return null;
    }

    const { displayName, domain, colorRange } = schemeDefinition; // Извлекаем нужные данные

    // Определяем заголовок легенды
    let legendTitle = "Legend";
    if (activeLayerKey === 'scatterplot') {
        legendTitle = "Legend";
    } else if (activeLayerKey === 'hexagon' || activeLayerKey === 'heatmap') {
        legendTitle = "Legend";
    }

    // --- Создаем строку для CSS linear-gradient ---
    // Градиент будет идти слева направо. Каждому цвету из colorRange назначается позиция
    // Первая позиция (индекс 0) = 0%, последняя (индекс N-1) = 100%
    const gradientColors = colorRange.map((color, index) => {
        const alpha = color && color.length > 3 ? color[3] / 255 : 1; // Учитываем альфа-канал
        const rgbaString = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
        // Позиция цвета в градиенте (от 0% до 100%)
        const position = (index / (colorRange.length - 1)) * 100;
        return `${rgbaString} ${position}%`; // Формат: "rgba(r,g,b,a) NN%"
    }).join(', '); // Соединяем все элементы через запятую

    const gradientStyle = `linear-gradient(to right, ${gradientColors})`;
    // --- Конец создания строки градиента ---


    // --- Отрисовка Легенды с градиентной полосой и мин/макс метками ---
    return (
        <div className="color-legend"> {/* Главный контейнер легенды */}
            <p className='dataset text-center'>{legendTitle}</p> {/* Заголовок и имя схемы - Color palette {displayName} */}

            {/* Контейнер для градиентной полосы и меток */}
            {/* Делаем его position: relative, чтобы метки внутри можно было позиционировать абсолютно */}
            <div className="legend-bar-container">
                {/* Элемент самой градиентной полосы */}
                <div
                    className="legend-gradient-bar"
                    style={{ background: gradientStyle }} // Применяем стиль градиента
                ></div>
                {/* Метки минимального и максимального значения */}
                {/* Позиционируем их абсолютно внутри legend-bar-container */}
                <span className="legend-label-min">{domain[0]} Mb</span> {/* Первая метка */}
                <span className="legend-label-max">{domain[domain.length - 1] / 1000} Mb</span> {/* Последняя метка */}
            </div>
        </div>
    );
};

// Проверка типов пропсов
ColorLegend.propTypes = {
    schemeDefinition: PropTypes.shape({
        displayName: PropTypes.string,
        domain: PropTypes.arrayOf(PropTypes.number).isRequired,
        colorRange: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
        layerType: PropTypes.string
    }),
    activeLayerKey: PropTypes.string
};

export default ColorLegend;