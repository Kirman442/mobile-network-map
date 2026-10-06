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

The tests cover multi-batch and multi-row Arrow input, buffer ownership transfer, numeric colour mapping, invalid data, and worker failures.

## What the map means

- **Download speed** colours tile locations by the average download speed on a 0–300+ Mbps scale. Values above 300 Mbps share the final colour. Point tooltips and picking are disabled.
- **Record density** is a relative density of loaded tile records in the current view. It does not represent speed, test counts, or coverage.
- The counter reports loaded **tile records**, not individual Speedtest measurements.
- Points derive from zoom-level-16 tiles (about 610.8 metres across at the equator). Circle size is a display choice, not the tile footprint.
- The map does not distinguish operators or 4G/5G. Missing records do not imply missing coverage.
- The source period is not documented in the prepared files. Do not interpret these as current network speeds.

Ookla source: https://github.com/teamookla/ookla-open-data.
Prepared files: https://github.com/Kirman442/deckgl/tree/main/ookla.
The preparation script and source period should be documented before updating the dataset.

## Data contract

Each Parquet file contains a `binary_data: List<Float32>` column with schema metadata:

- `stride: 6`
- `columns: x,y,id,avg_d_kbps,avg_u_kbps,country_code`

Packed records contain longitude, latitude, record ID, download kbps, upload kbps, and numeric country code. All list rows and all Arrow record batches are processed. Incompatible layouts, null data, invalid coordinates, or negative/non-finite speeds are reported as file failures.

## Processing and memory

1. A pool of 1–4 module Web Workers, sized by hardware concurrency, fetches the Parquet files.
2. The app fetches and compiles the WASM asset once, then shares the compiled WebAssembly.Module with the Workers. Each Worker instantiates it with its own memory, decompresses and decodes Parquet, and converts the result to Arrow IPC. Parquet decoding never runs on the UI thread. This avoids separate WASM downloads per Worker on a cold visit.
3. Workers retain views into the existing Arrow numeric buffers rather than repacking six-field records. They validate the values and prepare four RGBA colour buffers.
4. Unique ArrayBuffers are transferred to the UI thread, moving ownership without structured-clone copies.
5. Each chunk remains independent. ScatterplotLayer receives interleaved binary positions (24-byte stride) and binary colours. Loaded source arrays are never repeatedly concatenated.
6. Density mode uses one logical chunk index across all files to aggregate records together. It generates position attributes through deck.gl accessors; separate country heatmaps would give incorrect overlapping densities.

This is **not end-to-end zero-copy**. Input Parquet bytes are copied from JavaScript into WASM, and decompression/decoding allocates Arrow data in WASM memory. `intoIPCStream()` serializes the Arrow data into an IPC buffer in WASM and copies that buffer into JavaScript memory. Colours require new arrays, density position attributes are generated through accessors, and WebGL uploads data to GPU memory. The zero-copy parts are the Arrow numeric views and Worker-to-UI ownership transfer. Sharing the compiled WebAssembly.Module does not share the Workers' data memory.

Arrow FFI could eliminate IPC serialization. In `arrow-js-ffi`, `parseTable` copies by default; passing `copy=false` instead creates views on WASM memory. Those views require controlled memory growth and resource lifetimes, and the ordinary WASM memory buffer cannot be transferred to the UI like a standalone ArrayBuffer. FFI is not implemented in this application. An independent Arrow IPC prototype is being evaluated; its results do not describe the current production or preview architecture. No SharedArrayBuffer or cross-origin isolation is required by the current application.

Final CPU data uses approximately 40 bytes per record: 24 for source values and 16 for four colour palettes, excluding IPC metadata, WASM memory, temporary decoding allocations, and GPU buffers.

Download colours interpolate through 0, 25, 50, 100, 200, and 300 Mbps. Each stop has one colour; values above the maximum clamp to the final colour. The legend uses the same non-uniform stop positions. There is no speed multiplier, and the underlying speed values remain unchanged.

Record density retains unit weights, SUM aggregation and a 12-pixel kernel radius. Its visual presentation uses intensity 0.6, a fading threshold of 0.15 and opacity 0.7 to reduce broad opaque colour patches while retaining denser areas. These settings affect display, not the number or weight of records; colours remain relative to the current view.

Point radius is 200 metres, with no minimum screen-pixel radius. An overview therefore retains small points instead of painting every record as a full-pixel disc. Point size and colour contrast are separate controls; multiplying speed values to reduce clutter would make the numeric legend misleading.

## Architecture description for the portfolio

The map visualizes preprocessed Ookla mobile network performance records across 42 countries using React, MapLibre and deck.gl. A bounded Web Worker pool fetches Parquet files, decompresses and decodes them through parquet-wasm, reads the resulting Arrow IPC, validates numeric records, and prepares colour arrays. The UI receives transferred ArrayBuffers and renders independent chunks through deck.gl's binary scatterplot attributes, avoiding repeated concatenation and coordinate repacking. The speed legend uses actual Mbps; the heatmap represents relative tile-record density.

Zero-copy applies to numeric Arrow buffer views and ownership transfer between Workers and the UI. The application still copies data across the JavaScript/WASM boundary, serializes Arrow IPC, allocates colour and density attributes, and uploads buffers to GPU memory. A separate prototype investigates direct Arrow IPC delivery; the current map continues to use Parquet and WASM.

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
