# MobileNetwork: Impressum and Datenschutz

Release approved by the user on 18 November 2026, after local review of the documents, working links and combined native attribution. Branch: `codex/legal-notices`, based on production commit `0dd4d9e`. Publication targets the existing Netlify production branch `production`; `main` and the four/eight-worker experiment are preserved.

## Confirmed operator information

Kirill Lisochenko · k.lisochenko@web.de.

The user explicitly requested name and email only, without a postal address. Do not restore an address from other projects, old files or templates. The address requirement under [section 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html) was explained before implementation: if that section applies, name and email alone do not fulfil its address requirement. The user subsequently approved publication of the reviewed version. That approval is not a legal determination that the application is exempt.

## Content sources and adaptation

The main source, supplied by the user, is the published [Unfallatlas Datenschutz](https://unfallatlas.krmn.app/accidents/app.html?screen=about#about-privacy). The public app and its NativeReference module were read on 18 November 2026. Hosting, retention criteria, international transfers, email contact and rights follow that text.

Changes specific to MobileNetwork:

- CARTO is contacted as soon as the map application opens, including styles, tiles and any requested map glyphs/sprites. Do not copy Unfallatlas's statement that its other analysis screens do not use the basemap.
- The current styles point to `basemaps.cartocdn.com` and `tiles.basemaps.cartocdn.com`. OpenStreetMap supplies basemap data; its attribution website is an external link, not the directly configured tile endpoint.
- The map loads prepared Ookla arrays, not accident records. It performs no visitor speed tests and requests no device geolocation.
- Source inspection found no application use of cookies, Local Storage or Session Storage. Map/palette preferences are held in React memory; browser HTTP caching remains possible. Do not copy Unfallatlas's `uad-map-theme`, period/filter storage or language-storage statements.
- The legal dialog introduces no additional external requests, trackers, consent storage or dependencies. Its external reference links open only when selected.

Official references checked:

- [Netlify GDPR / DPA information](https://www.netlify.com/gdpr-ccpa/), which states the DPA is incorporated in its terms.
- [Netlify DPA](https://www.netlify.com/pdf/netlify-dpa.pdf), linked from that official page and the user-supplied Datenschutz.
- [Netlify Privacy Statement](https://www.netlify.com/privacy/), updated 4 November 2026. Its general controller policy is not a promise of a fixed retention period for the hosted app's processor logs.
- [CARTO Basemaps Terms](https://www.carto.com/legal/basemap-terms/), section 10: truncation of IPs at ingestion; truncated request logs retained for thirty days in the US. This specific basemap policy takes precedence over substituting the general marketing site's retention description.
- [CARTO Personal Data Processing Agreement](https://carto.com/legal/pdpa).
- [BayLDA](https://www.lda.bayern.de/), the authority linked in the user-supplied text.

No fixed Netlify log period has been invented. Hosting/account settings, the use of any additional analytics and the applicable contract/subprocessor configuration should be reconfirmed before publishing or changing hosting features. Cross-border safeguards are described conditionally, matching the supplied text; no blanket claim is made that every recipient is DPF-certified.

## Local review

Run `npm run dev -- --host 127.0.0.1 --port 4180 --strictPort`.

- Map: http://127.0.0.1:4180/
- Impressum: http://127.0.0.1:4180/#impressum
- Datenschutz: http://127.0.0.1:4180/#datenschutz

Legal links are combined into the native MapLibre attribution through `customAttribution`, alongside MapLibre's credit and the dynamically generated source credits. There is one footer control, with no separate legal plaque. DeckGL forces its basemap child into a negative stacking context, so the attribution control is mounted in a bottom-right sibling overlay through public IControl lifecycle methods. Its source attribution, default compact behaviour and production styles are retained. The overlay background ignores pointer events; only the actual control accepts clicks. The two documents share one native modal dialog, with hash links, native Escape handling and a visible close button. Switching documents resets content scroll. Native modality supplies background inertness and focus containment. Outside-click dismissal uses `closedby` with a pointer-boundary fallback for unsupported browsers.

Local development serves the existing uncompressed Arrow files; the Netlify deployment's Arrow+Brotli delivery code remains unchanged. The test-only four/eight-worker branch is preserved separately.

## Verification

ESLint, production build, fourteen existing data/worker tests, whitespace validation and the Impeccable mechanical detector passed. The user confirmed the documents' appearance, then confirmed working links after the stacking fix and approved the combined attribution control. Browser automation was stopped by the Computer Use tool because it could not determine the active browser URL confidently. No alternative browser automation was used to bypass that restriction. Keyboard focus return and narrow-screen behaviour have not been independently browser-tested; do not describe user visual approval as a complete automated accessibility audit.
