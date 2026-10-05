import PropTypes from 'prop-types';

const ColorLegend = ({ schemeDefinition, activeLayerKey }) => {
    if (!schemeDefinition) return null;
    const { domain, colorRange } = schemeDefinition;
    const density = activeLayerKey === 'heatmap';
    if (!density && domain.length !== colorRange.length) return null;
    const min = domain[0];
    const max = domain[domain.length - 1];
    const stops = colorRange.map((color, index) => {
        const position = density ? index / (colorRange.length - 1) : (domain[index] - min) / (max - min);
        return 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + ((color[3] ?? 255) / 255) + ') ' + position * 100 + '%';
    }).join(', ');
    return (
        <div className="color-legend">
            <p className="dataset text-center">{density ? 'Relative record density' : 'Average download speed'}</p>
            <div className="legend-bar-container">
                <div className="legend-gradient-bar" style={{ background: 'linear-gradient(to right, ' + stops + ')' }} />
                <span className="legend-label-min">{density ? 'Lower' : min / 1000 + ' Mbps'}</span>
                <span className="legend-label-max">{density ? 'Higher' : max / 1000 + '+ Mbps'}</span>
            </div>
            <p className="legend-note">{density ? 'Relative to the current view. More records do not mean faster internet.' : 'Colour stops: ' + domain.map(value => value / 1000).join(' · ') + ' Mbps. Hover or tap a point for exact speeds.'}</p>
        </div>
    );
};
ColorLegend.propTypes = {
    schemeDefinition: PropTypes.shape({
        domain: PropTypes.arrayOf(PropTypes.number).isRequired,
        colorRange: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired
    }),
    activeLayerKey: PropTypes.string
};
export default ColorLegend;
