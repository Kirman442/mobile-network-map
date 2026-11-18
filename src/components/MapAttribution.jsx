import PropTypes from 'prop-types';
import { useControl } from '@vis.gl/react-maplibre';

// DeckGL places the basemap in a negative stacking context. Mount the native
// attribution in a sibling overlay, using public IControl lifecycle methods.
export default function MapAttribution({ containerRef }) {
    useControl(({ mapLib }) => {
        const attribution = new mapLib.AttributionControl({
            compact: true,
            customAttribution: [
                '<a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer">MapLibre</a>',
                '<a href="#impressum" lang="de" aria-haspopup="dialog">Impressum</a> · ' +
                '<a href="#datenschutz" lang="de" aria-haspopup="dialog">Datenschutz</a>',
            ],
        });
        let placeholder;
        return {
            onAdd(map) {
                const element = attribution.onAdd(map);
                containerRef.current.appendChild(element);
                placeholder = element.ownerDocument.createElement('div');
                placeholder.hidden = true;
                return placeholder;
            },
            onRemove() {
                attribution.onRemove();
                placeholder?.remove();
            },
            getDefaultPosition() { return 'bottom-right'; },
        };
    });
    return null;
}

MapAttribution.propTypes = { containerRef: PropTypes.shape({ current: PropTypes.object }).isRequired };
