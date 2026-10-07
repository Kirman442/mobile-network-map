# Mobile network performance map

A React / MapLibre / deck.gl map of preprocessed Ookla mobile network performance records in 42 countries. The published site is https://mobile-network-map.netlify.app/.

## Run and verify

Use Node.js 20 or later.

```sh
npm ci
npm run dev
npm run lint
npm run test
npm run build
npm run preview
```

The tests cover all 42 copied Arrow datasets and their gzip/Brotli variants, multi-batch and multi-row input, ownership transfer, fallback/error handling, background palette parity with D3, cancellation, and worker failures.

## What the map means

- **Download speed** colours tile locations by the average download speed on a 0–200+ Mbps scale. Values above 200 Mbps share the final colour. Point tooltips and picking are disabled.
- **Record density** is a relative density of loaded tile records in the current view. It does not represent speed, test counts, or coverage.
- The counter reports loaded **tile records**, not individual Speedtest measurements.
- Points derive from zoom-level-16 tiles (about 610.8 metres across at the equator). Circle size is a display choice, not the tile footprint.
- The map does not distinguish operators or 4G/5G. Missing records do not imply missing coverage.
- The source period is not documented in the prepared files. Do not interpret these as current network speeds.

Ookla source: https://github.com/teamookla/ookla-open-data.
This branch uses local copies of the 42 packed Arrow datasets validated in the independent prototype. The source Parquet cohort is `new_countries/optimized_data/countries/test`. The prototype folder is read-only input; its files are not changed or moved. Historical Parquet hosting: https://github.com/Kirman442/deckgl/tree/main/ookla.
The preparation script and source period should be documented before updating the dataset.

## Data contract

Each Arrow IPC file contains a `binary_data: List<Float32>` column with schema metadata:

- `stride: 6`
- `columns: x,y,id,avg_d_kbps,avg_u_kbps,country_code`

Packed records contain longitude, latitude, record ID, download kbps, upload kbps, and numeric country code. All list rows and all Arrow record batches are processed. Incompatible layouts, null data, invalid coordinates, or negative/non-finite speeds are reported as file failures.

## Processing and memory

1. A pool of 1–4 module Web Workers, sized by hardware concurrency, fetches same-origin Arrow IPC files. On Netlify, physical `.arrow.br` URLs use HTTP Brotli; a failed response, invalid header, or invalid dataset triggers a `.arrow.gz` retry. Local Vite dev/preview uses uncompressed `.arrow` files. IPC has no internal compression.
2. The browser performs HTTP decompression. Workers parse the received IPC directly; no Parquet decoding, WASM runtime, or JS/WASM serialization is required.
3. Workers retain views into the received Arrow numeric buffers, validate country codes and record counts, and prepare only the selected RGBA palette. They explicitly copy just download values (4 bytes per record) into compact buffers for the later background job.
4. Unique ArrayBuffers are transferred to the UI thread, moving ownership without structured-clone copies.
5. Each chunk remains independent. ScatterplotLayer receives interleaved binary positions (24-byte stride) and binary colours. Loaded source arrays are never repeatedly concatenated.
6. Density mode uses one logical chunk index across all files to aggregate records together. It generates position attributes through deck.gl accessors; separate country heatmaps would give incorrect overlapping densities.
7. After all loading has settled and the first full (or partial on failure) map frame has rendered, the loading workers are terminated and one dedicated worker prepares the other three palettes. Compact download buffers and resulting colours are transferred. Work is split into slices targeting 4 ms, yielding tasks so a requested palette can take priority. The old palette and its legend remain visible until all chunks for the requested palette are ready. Inactive palette arrivals do not rebuild map layers.
8. The compact input is released and the background worker terminates on completion. Retry/unmount cancels old work and pending palette requests. Workers have error handling and time limits.

This is **not end-to-end zero-copy**. The numeric path is scoped: received, decompressed IPC ArrayBuffer → Float32 views → Worker/UI ownership transfer → binary scatterplot position attributes, without repacking or cloning the source numeric array. HTTP decompression, offline data preparation, the explicit compact download copy, new colour arrays, density accessor attributes, and GPU uploads are outside this scope. Physical copies inside the browser/OS are not traced.

GeoArrow, FFI, SharedArrayBuffer and cross-origin isolation are not required. The current `main` production version remains unchanged until this branch is approved and merged.

For 1,235,099 records, numeric payload is 29.64 MB, one palette 4.94 MB and four palettes 19.76 MB. The compact background input temporarily adds 4.94 MB. After all palettes are prepared, final numeric+colour payload remains 49.40 MB (40 bytes per record); background preparation reduces work before the first frame, not final cache size. IPC metadata/padding, JS objects, browser decoding and GPU buffers are additional. These figures are not peak RSS.

Download colours interpolate through 0, 25, 50, 100, 150, and 200 Mbps. Each stop has one colour; values above the maximum clamp to the final colour. The legend uses the same non-uniform stop positions. There is no speed multiplier, and the underlying speed values remain unchanged.

Record density retains unit weights, SUM aggregation and a 12-pixel kernel radius. Its visual presentation uses intensity 0.6, a fading threshold of 0.15 and opacity 0.7 to reduce broad opaque colour patches while retaining denser areas. These settings affect display, not the number or weight of records; colours remain relative to the current view.

Point radius is 200 metres, with no minimum screen-pixel radius. An overview therefore retains small points instead of painting every record as a full-pixel disc. Point size and colour contrast are separate controls; multiplying speed values to reduce clutter would make the numeric legend misleading.

## Architecture description for the portfolio

The map visualizes preprocessed Ookla mobile network performance records across 42 countries using React, MapLibre and deck.gl. A bounded Web Worker pool fetches Arrow IPC delivered with HTTP Brotli or gzip, validates numeric records and prepares the selected palette. The UI receives transferred ArrayBuffers and renders independent chunks through binary scatterplot attributes. After the full map frame, a dedicated worker computes the remaining palettes with priority for user requests. The speed legend uses actual Mbps; the heatmap represents relative tile-record density.

The numeric data path uses Arrow views and ownership transfer without additional source-array copies or coordinate repacking. Background palettes intentionally copy a compact download column. Decompression, colour allocation, density attributes and GPU upload remain outside the no-copy claim.

## Performance comparison

Compare the production site with the deploy **permalink**, not just the pull-request preview URL. Netlify's Deploy Preview URL adds its collaboration drawer and related requests; the deploy permalink does not. Keep cache settings, viewport, layer, map style and network throttling identical. Repeat runs and measure dataset/render readiness as well as navigation events: DOMContentLoaded and Load do not mean the asynchronous dataset has finished loading. Resource size is a network/decompressed-resource metric, not a measurement of application RAM.

## Failure handling

Progress counts processed files, including failures. Failed files remain visible in an error panel; successfully loaded data stays available. Retry reloads the dataset. Fetches and worker tasks have time limits; fatal worker errors reject queued work rather than leaving the loader hanging. Workers terminate after loading and on component cleanup.

## Deployment

Netlify is linked to `Kirman442/mobile-network-map`:

- production branch: `main`;
- pull requests against `main`: Deploy Preview;
- other branches are not deployed independently;
- build command: `npm run build`;
- publish directory: `dist`.

Use a feature branch and pull request, validate its Netlify preview, then merge only after approval. Pushing/merging to `main` triggers production deployment.

`npm run deploy` is a legacy GitHub Pages command, not the Netlify deployment command. The legacy workflow under `.github_res/workflows` is inactive. `src/components/dev` contains local ignored experiments and is not part of the application.

Hashed assets have immutable caching. Netlify headers assign the correct JS/CSS/WASM content types; no blanket WASM content type is applied to all assets.

Netlify builds set `VITE_ARROW_TRANSPORT=suffix`. A streaming Edge Function sets the Arrow MIME and Content-Encoding for `.arrow.br`/`.arrow.gz` responses; ordinary custom headers alone are insufficient for this encoding contract. Data responses use `no-store, no-transform` for the comparison phase. Verify actual encoded bytes and browser decoding on the Deploy Preview, rather than assuming a successful build proves CDN behavior. A local production build with this variable requires equivalent encoded HTTP serving; normal `npm run preview` uses identity Arrow.
